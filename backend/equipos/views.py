from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import Equipo, HistorialMantencion, LogTelemetriaGPS
from .serializers import (
    EquipoSerializer,
    HistorialMantencionSerializer,
    LogTelemetriaGPSSerializer
)
from usuarios.permissions import IsModelActionAllowed


class EquipoViewSet(viewsets.ModelViewSet):
    """
    Endpoint: GET, POST, PUT, PATCH, DELETE /api/equipos/
    Permite gestionar el inventario de vehículos con Soft Delete.
    ADMIN y PLANIFICACION administran; TECNICO solo consulta.
    """
    serializer_class = EquipoSerializer
    permission_classes = [IsModelActionAllowed]
    permission_label = 'equipos.equipo'
    action_permissions = {'restaurar': 'equipos.change_equipo'}

    def get_queryset(self):
        """
        Por defecto lista los equipos activos (no eliminados lógicamente).
        Para incluir los deshabilitados: GET /api/equipos/?incluir_deshabilitados=true
        """
        queryset = Equipo.all_objects.all().order_by('id')
        incluir_bajas = self.request.query_params.get('incluir_deshabilitados', 'false').lower()
        if incluir_bajas == 'true':
            return queryset
        return Equipo.objects.all().order_by('id')

    def _bloquear_baja_no_autorizada(self, request):
        if request.data.get('estado') == 'Deshabilitada' and not request.user.has_perm('equipos.delete_equipo'):
            return Response({'detail': 'Para dar de baja necesitas el permiso Eliminar Maquinarias.'}, status=status.HTTP_403_FORBIDDEN)
        return None

    def update(self, request, *args, **kwargs):
        bloqueo = self._bloquear_baja_no_autorizada(request)
        if bloqueo is not None:
            return bloqueo
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        bloqueo = self._bloquear_baja_no_autorizada(request)
        if bloqueo is not None:
            return bloqueo
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """
        Ejecuta Soft Delete cambiando el estado a 'Deshabilitada' y marcando is_deleted=True.
        """
        equipo = self.get_object()
        if equipo.ordenes_trabajo.exclude(estado='Finalizada').exists():
            return Response({'detail': 'Finaliza la orden abierta antes de dar de baja el equipo.'}, status=status.HTTP_400_BAD_REQUEST)
        equipo.delete()
        return Response(
            {
                "message": f"Equipo {equipo.codigo} deshabilitado correctamente (Soft Delete).",
                "estado": equipo.estado,
                "is_deleted": equipo.is_deleted
            },
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'], url_path='restaurar')
    def restaurar(self, request, pk=None):
        """
        Endpoint: POST /api/equipos/{id}/restaurar/
        Reactiva un equipo deshabilitado pasándolo a estado 'Disponible'.
        """
        equipo = get_object_or_404(Equipo.all_objects, pk=pk)
        if not equipo.is_deleted:
            return Response(
                {"detail": "El equipo no está deshabilitado."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        equipo.restore()
        serializer = self.get_serializer(equipo)
        return Response(serializer.data, status=status.HTTP_200_OK)


class HistorialMantencionViewSet(viewsets.ModelViewSet):
    """Endpoint: /api/mantenciones/."""
    queryset = HistorialMantencion.objects.all().order_by('-fecha_intervencion')
    serializer_class = HistorialMantencionSerializer
    permission_classes = [IsModelActionAllowed]
    permission_label = 'equipos.historialmantencion' 


class LogTelemetriaGPSViewSet(viewsets.ReadOnlyModelViewSet):
    """Endpoint: /api/telemetria/. Solo consulta disponible."""
    queryset = LogTelemetriaGPS.objects.all().order_by('-timestamp_evento')
    serializer_class = LogTelemetriaGPSSerializer
    permission_classes = [IsModelActionAllowed]
    permission_label = 'equipos.logtelemetriagps' 