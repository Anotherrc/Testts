from rest_framework import serializers
from .models import Equipo, HistorialMantencion, LogTelemetriaGPS


class EquipoSerializer(serializers.ModelSerializer):
    """
    Transforma el modelo Equipo (Base de datos) a JSON (Frontend React).
    """
    horas_restantes = serializers.ReadOnlyField()
    color_semaforo = serializers.ReadOnlyField()
    horas_contrato_disponibles = serializers.ReadOnlyField()
    exceso_horas_contrato = serializers.ReadOnlyField()
    is_deleted = serializers.ReadOnlyField()
    fecha_baja = serializers.ReadOnlyField()
    estado_alerta = serializers.ReadOnlyField()

    def validate_foto_archivo(self, archivo):
        if not archivo:
            return archivo
        if archivo.size > 5 * 1024 * 1024:
            raise serializers.ValidationError('La imagen no puede superar los 5 MB.')
        cabecera = archivo.read(12)
        archivo.seek(0)
        jpeg = cabecera.startswith(b'\xff\xd8\xff')
        png = cabecera.startswith(b'\x89PNG\r\n\x1a\n')
        webp = cabecera[:4] == b'RIFF' and cabecera[8:12] == b'WEBP'
        if not (jpeg or png or webp):
            raise serializers.ValidationError('Formato no permitido. Usa JPEG, PNG o WebP.')
        return archivo

    def update(self, instance, validated_data):
        if 'latitud' in validated_data and 'longitud' in validated_data:
            validated_data['ubicacion_registrada'] = True
        return super().update(instance, validated_data)

    def validate(self, attrs):
        import math
        for campo in ('horometro_actual', 'meta_proxima_mant', 'horas_uso_mes', 'limite_contrato_mes'):
            valor = attrs.get(campo)
            if valor is not None and (not math.isfinite(valor) or valor < 0):
                raise serializers.ValidationError({campo: 'Ingresa un número válido mayor o igual a cero.'})
        if self.instance and 'horometro_actual' in attrs and attrs['horometro_actual'] < self.instance.horometro_actual:
            raise serializers.ValidationError({'horometro_actual': 'La lectura no puede disminuir respecto al último registro.'})
        for campo, minimo, maximo in [('latitud', -90, 90), ('longitud', -180, 180)]:
            valor = attrs.get(campo)
            if valor is not None and not minimo <= valor <= maximo:
                raise serializers.ValidationError({campo: 'Coordenada fuera del rango válido.'})
        equipo = self.instance
        if equipo:
            cliente = attrs.get('cliente_empresa', equipo.cliente_empresa)
            estado = attrs.get('estado', equipo.estado)
            if estado != 'Mantenimiento' and equipo.ordenes_trabajo.exclude(estado='Finalizada').exists():
                raise serializers.ValidationError({'estado': 'No puedes sacar el equipo de mantenimiento mientras tenga una orden abierta.'})
            if cliente and estado == 'Disponible' and ('cliente_empresa' not in attrs or attrs['cliente_empresa'] is not None):
                raise serializers.ValidationError({'estado': 'Desasigna primero el cliente antes de marcar la máquina disponible.'})
            if cliente and cliente.estado != 'Activo':
                raise serializers.ValidationError({'cliente_empresa': 'El cliente está inactivo.'})
            if cliente and estado in ('Mantenimiento', 'Deshabilitada') and (cliente != equipo.cliente_empresa):
                raise serializers.ValidationError({'cliente_empresa': 'La máquina no está disponible para arriendo.'})
        return attrs

    class Meta:
        model = Equipo
        fields = '__all__'


class HistorialMantencionSerializer(serializers.ModelSerializer):
    equipo_codigo = serializers.CharField(source='equipo.codigo', read_only=True)
    mecanico_nombre = serializers.SerializerMethodField()

    class Meta:
        model = HistorialMantencion
        fields = [
            'id',
            'equipo',
            'equipo_codigo',
            'mecanico_responsable',
            'mecanico_nombre',
            'fecha_intervencion',
            'horometro_al_momento',
            'descripcion_falla_o_trabajo',
            'insumos_utilizados',
        ]
    
    def get_mecanico_nombre(self, obj):
        if not obj.mecanico_responsable:
            return 'Sin asignar'
        return obj.mecanico_responsable.get_full_name() or obj.mecanico_responsable.username


class LogTelemetriaGPSSerializer(serializers.ModelSerializer):
    class Meta:
        model = LogTelemetriaGPS
        fields = '__all__'