"""API REST de operación: registros compartidos, permisos y movimientos trazables."""
from decimal import Decimal
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status, viewsets, serializers, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from equipos.models import Equipo, HistorialMantencion
from usuarios.permissions import IsAdminPlanificacionOrTecnicoReadOnly, IsModelActionAllowed
from .models import Cliente, Insumo, MovimientoInsumo, OrdenMantenimiento, OrdenMecanico, ConsumoInsumo
from .serializers import ClienteSerializer, InsumoSerializer, MovimientoInsumoSerializer, OrdenEntradaSerializer, OrdenSalidaSerializer


def _movimiento(insumo, delta, motivo, usuario, orden=None):
    return MovimientoInsumo.objects.create(insumo=insumo, cantidad=delta, motivo=motivo, usuario=usuario, orden=orden)


class ClienteViewSet(viewsets.ModelViewSet):
    queryset = Cliente.objects.all()
    serializer_class = ClienteSerializer
    permission_classes = [IsAdminPlanificacionOrTecnicoReadOnly]
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def perform_update(self, serializer):
        if serializer.validated_data.get('estado') == 'Inactivo' and serializer.instance.equipos.filter(is_deleted=False).exists():
            raise serializers.ValidationError({'estado': 'No puedes desactivar un cliente con equipos asignados.'})
        serializer.save()


class InsumoViewSet(viewsets.ModelViewSet):
    serializer_class = InsumoSerializer
    permission_classes = [IsAdminPlanificacionOrTecnicoReadOnly]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        return Insumo.objects.filter(activo=True).order_by('nombre')

    @transaction.atomic
    def perform_create(self, serializer):
        insumo = serializer.save(modificado_por=self.request.user)
        if insumo.stock > 0:
            _movimiento(insumo, insumo.stock, 'Ingreso inicial', self.request.user)

    @transaction.atomic
    def perform_update(self, serializer):
        anterior = Insumo.objects.select_for_update().get(pk=serializer.instance.pk)
        stock_anterior = anterior.stock  # Copia el valor antes de serializer.save()
        serializer.instance = anterior
        nuevo_stock = serializer.validated_data.get('stock', stock_anterior)
        if nuevo_stock < 0:
            raise serializers.ValidationError({'stock': 'El stock no puede ser negativo.'})

        # No se permite cambiar la unidad de un material con movimientos previos.
        nueva_unidad = serializer.validated_data.get('unidad', anterior.unidad)
        if nueva_unidad != anterior.unidad and anterior.movimientos.exists():
            raise serializers.ValidationError({'unidad': 'El material tiene movimientos. Registra otro insumo para cambiar la unidad.'})

        insumo = serializer.save(modificado_por=self.request.user)
        delta = insumo.stock - stock_anterior
        if delta:
            _movimiento(insumo, delta, 'Corrección de inventario', self.request.user)

    def perform_destroy(self, instance):
        instance.activo = False
        instance.modificado_por = self.request.user
        instance.save(update_fields=['activo', 'modificado_por', 'actualizado_en'])

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def ajustar(self, request, pk=None):
        insumo = get_object_or_404(Insumo.objects.select_for_update(), pk=pk, activo=True)
        class AjusteSerializer(serializers.Serializer):
            cantidad = serializers.DecimalField(max_digits=12, decimal_places=2)
            motivo = serializers.CharField(max_length=160, required=False, default='Ajuste manual')
        entrada = AjusteSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        delta = entrada.validated_data['cantidad']
        if not delta or insumo.stock + delta < 0:
            raise serializers.ValidationError({'cantidad': 'El ajuste debe ser distinto de cero y no puede generar stock negativo.'})
        insumo.stock += delta
        insumo.modificado_por = request.user
        insumo.full_clean()
        insumo.save(update_fields=['stock','modificado_por','actualizado_en'])
        _movimiento(insumo, delta, entrada.validated_data['motivo'], request.user)
        return Response(self.get_serializer(insumo).data)


class MovimientoInsumoViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MovimientoInsumo.objects.select_related('usuario','insumo').all()[:200]
    serializer_class = MovimientoInsumoSerializer
    permission_classes = [IsAdminPlanificacionOrTecnicoReadOnly]
    pagination_class = None


class OrdenViewSet(viewsets.ModelViewSet):
    queryset = OrdenMantenimiento.objects.select_related('equipo','creado_por','finalizado_por').prefetch_related('responsables','consumos__insumo')
    serializer_class = OrdenSalidaSerializer
    # Una orden es una operación del módulo de mantenciones.
    permission_classes = [IsModelActionAllowed]
    permission_label = 'equipos.historialmantencion'
    action_permissions = {'finalizar': 'equipos.change_historialmantencion'}
    http_method_names = ['get', 'post', 'head', 'options']

    def create(self, request, *args, **kwargs):
        entrada = OrdenEntradaSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        d = entrada.validated_data
        with transaction.atomic():
            equipo = get_object_or_404(Equipo.objects.select_for_update(), pk=d['equipoId'])
            if equipo.estado in ('Mantenimiento', 'Deshabilitada') or equipo.is_deleted:
                raise serializers.ValidationError({'equipoId': 'Esta máquina no está disponible para iniciar una orden.'})
            if OrdenMantenimiento.objects.filter(equipo=equipo).exclude(estado='Finalizada').exists():
                raise serializers.ValidationError({'equipoId': 'Ya existe una orden abierta para esta máquina.'})
            insumos = {}
            for item in d['consumos']:
                insumo = get_object_or_404(Insumo.objects.select_for_update(), pk=item['insumo'], activo=True)
                if item['cantidad'] > insumo.stock:
                    raise serializers.ValidationError({'consumos': f'Stock insuficiente para {insumo.nombre}.'})
                insumos[insumo.id] = (insumo, item['cantidad'])
            orden = OrdenMantenimiento.objects.create(
                equipo=equipo, fecha=d['fecha'], comentario=d['comentario'], creado_por=request.user
            )
            OrdenMecanico.objects.bulk_create([OrdenMecanico(orden=orden, nombre=n) for n in d['mecanicos']])
            for insumo, cantidad in insumos.values():
                insumo.stock -= cantidad
                insumo.modificado_por = request.user
                insumo.save(update_fields=['stock','modificado_por','actualizado_en'])
                ConsumoInsumo.objects.create(orden=orden, insumo=insumo, cantidad=cantidad, unidad_registrada=insumo.unidad)
                _movimiento(insumo, -cantidad, f'Consumo en OT-{orden.pk}', request.user, orden)
            equipo.estado = 'Mantenimiento'
            equipo.save()
        orden = self.get_queryset().get(pk=orden.pk)
        return Response(self.get_serializer(orden).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def finalizar(self, request, pk=None):
        orden = get_object_or_404(OrdenMantenimiento.objects.select_for_update().select_related('equipo'), pk=pk)
        if orden.estado == 'Finalizada':
            return Response({'detail': 'La orden ya fue finalizada.'}, status=status.HTTP_400_BAD_REQUEST)
        equipo = Equipo.objects.select_for_update().get(pk=orden.equipo_id)
        orden.estado = 'Finalizada'
        orden.finalizado_por = request.user
        orden.finalizado_en = timezone.now()
        orden.save(update_fields=['estado','finalizado_por','finalizado_en'])
        responsables = ', '.join(item.nombre for item in orden.responsables.all())
        es_tecnico = request.user.groups.filter(name='TECNICO').exists()
        HistorialMantencion.objects.create(
            equipo=equipo, mecanico_responsable=request.user if es_tecnico else None,
            fecha_intervencion=timezone.now(), horometro_al_momento=equipo.horometro_actual,
            descripcion_falla_o_trabajo=f'{orden.comentario} | Responsables: {responsables}',
            insumos_utilizados=', '.join(f'{c.insumo.nombre}: {c.cantidad:g} {c.unidad_registrada}' for c in orden.consumos.select_related('insumo').all())[:255],
        )
        equipo.estado = 'Arrendada' if equipo.cliente_empresa_id else 'Disponible'
        equipo.save()
        return Response(self.get_serializer(self.get_queryset().get(pk=orden.pk)).data)
