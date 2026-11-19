from decimal import Decimal
from rest_framework import serializers
from .models import Cliente, Insumo, OrdenMantenimiento, MovimientoInsumo


class ClienteSerializer(serializers.ModelSerializer):
    equipos = serializers.IntegerField(source='equipos.count', read_only=True)

    class Meta:
        model = Cliente
        fields = ['id', 'nombre', 'rut', 'telefono', 'correo', 'direccion', 'fechaCliente', 'categoria', 'subcategoria', 'estado', 'equipos']

    def validate_rut(self, value):
        return value.strip().upper() or None if value else None


class InsumoSerializer(serializers.ModelSerializer):
    stock = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0'), coerce_to_string=False)
    minimo = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0'), coerce_to_string=False)
    ultimoCambioPor = serializers.SerializerMethodField()

    class Meta:
        model = Insumo
        fields = ['id', 'nombre', 'categoria', 'stock', 'minimo', 'unidad', 'ultimoCambioPor']

    def get_ultimoCambioPor(self, obj):
        user = obj.modificado_por
        return (user.get_full_name() or user.username) if user else ''


class MovimientoInsumoSerializer(serializers.ModelSerializer):
    insumo_nombre = serializers.CharField(source='insumo.nombre', read_only=True)
    usuario_nombre = serializers.SerializerMethodField()

    class Meta:
        model = MovimientoInsumo
        fields = ['id', 'insumo', 'insumo_nombre', 'cantidad', 'motivo', 'fecha', 'usuario_nombre']

    def get_usuario_nombre(self, obj):
        return obj.usuario.get_full_name() or obj.usuario.username if obj.usuario else 'Sistema'


class ConsumoEntradaSerializer(serializers.Serializer):
    insumo = serializers.IntegerField(min_value=1)
    cantidad = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.01'))


class OrdenEntradaSerializer(serializers.Serializer):
    equipoId = serializers.IntegerField(min_value=1)
    fecha = serializers.DateField()
    comentario = serializers.CharField(min_length=8, max_length=4000)
    mecanicos = serializers.ListField(child=serializers.CharField(max_length=120), allow_empty=False)
    consumos = ConsumoEntradaSerializer(many=True, required=False, default=list)

    def validate_mecanicos(self, value):
        nombres = [x.strip() for x in value if x.strip()]
        if not nombres:
            raise serializers.ValidationError('Indica al menos un responsable real.')
        if len(set(n.lower() for n in nombres)) != len(nombres):
            raise serializers.ValidationError('No repitas el mismo responsable.')
        return nombres

    def validate_consumos(self, value):
        ids = [item['insumo'] for item in value]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError('Cada insumo se registra solo una vez por orden.')
        return value


class OrdenSalidaSerializer(serializers.ModelSerializer):
    equipoId = serializers.IntegerField(source='equipo_id')
    equipo = serializers.SerializerMethodField()
    mecanicos = serializers.SerializerMethodField()
    insumos = serializers.SerializerMethodField()
    creadoPor = serializers.SerializerMethodField()
    finalizadoPor = serializers.SerializerMethodField()

    class Meta:
        model = OrdenMantenimiento
        fields = ['id', 'equipoId', 'equipo', 'mecanicos', 'fecha', 'estado', 'comentario', 'insumos', 'creadoPor', 'finalizadoPor']

    def get_equipo(self, obj):
        return f'{obj.equipo.codigo} · {obj.equipo.nombre}'

    def get_mecanicos(self, obj):
        return [x.nombre for x in obj.responsables.all()]

    def get_insumos(self, obj):
        textos = [f'{x.insumo.nombre}: {x.cantidad:g} {x.unidad_registrada}' for x in obj.consumos.all()]
        return ', '.join(textos) if textos else 'Sin insumos utilizados'

    def get_creadoPor(self, obj):
        return (obj.creado_por.get_full_name() or obj.creado_por.username) if obj.creado_por else 'Sistema'

    def get_finalizadoPor(self, obj):
        return (obj.finalizado_por.get_full_name() or obj.finalizado_por.username) if obj.finalizado_por else None
