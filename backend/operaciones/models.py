"""Operación compartida entre planificación, taller y bodega."""
from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone
from decimal import Decimal


class Cliente(models.Model):
    nombre = models.CharField(max_length=180)
    rut = models.CharField(max_length=20, unique=True, blank=True, null=True)
    telefono = models.CharField(max_length=45, blank=True)
    correo = models.EmailField(blank=True)
    direccion = models.CharField(max_length=250, blank=True)
    fechaCliente = models.DateField(blank=True, null=True, db_column='fecha_cliente')
    categoria = models.CharField(max_length=80, blank=True)
    subcategoria = models.CharField(max_length=100, blank=True)
    estado = models.CharField(max_length=10, choices=[('Activo', 'Activo'), ('Inactivo', 'Inactivo')], default='Activo')
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['nombre', 'id']
        indexes = [models.Index(fields=['nombre'], name='idx_cliente_nombre')]

    def __str__(self):
        return self.nombre


class Insumo(models.Model):
    nombre = models.CharField(max_length=150)
    categoria = models.CharField(max_length=80, blank=True, default='General')
    stock = models.DecimalField(max_digits=12, decimal_places=2, default=0, validators=[MinValueValidator(Decimal('0'))])
    minimo = models.DecimalField(max_digits=12, decimal_places=2, default=0, validators=[MinValueValidator(Decimal('0'))])
    unidad = models.CharField(max_length=30, default='unidades')
    activo = models.BooleanField(default=True)
    modificado_por = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['nombre', 'id']
        indexes = [models.Index(fields=['nombre'], name='idx_insumo_nombre')]

    def __str__(self):
        return self.nombre


class OrdenMantenimiento(models.Model):
    ESTADOS = [('Programada', 'Programada'), ('En curso', 'En curso'), ('Finalizada', 'Finalizada')]
    equipo = models.ForeignKey('equipos.Equipo', on_delete=models.PROTECT, related_name='ordenes_trabajo')
    fecha = models.DateField()
    comentario = models.TextField()
    estado = models.CharField(max_length=15, choices=ESTADOS, default='En curso')
    creado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='ordenes_creadas')
    finalizado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='ordenes_finalizadas')
    creado_en = models.DateTimeField(auto_now_add=True)
    finalizado_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-fecha', '-id']
        indexes = [models.Index(fields=['estado', 'fecha'], name='idx_orden_estado_fecha')]
        constraints = [models.UniqueConstraint(fields=['equipo'], condition=~Q(estado='Finalizada'), name='unica_orden_abierta_equipo')]

    def __str__(self):
        return f'OT-{self.id} {self.equipo.codigo}'


class OrdenMecanico(models.Model):
    orden = models.ForeignKey(OrdenMantenimiento, on_delete=models.CASCADE, related_name='responsables')
    nombre = models.CharField(max_length=120)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['orden', 'nombre'], name='unico_responsable_orden')]


class ConsumoInsumo(models.Model):
    orden = models.ForeignKey(OrdenMantenimiento, on_delete=models.CASCADE, related_name='consumos')
    insumo = models.ForeignKey(Insumo, on_delete=models.PROTECT)
    cantidad = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    unidad_registrada = models.CharField(max_length=30)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['orden', 'insumo'], name='unico_insumo_por_orden')]


class MovimientoInsumo(models.Model):
    insumo = models.ForeignKey(Insumo, on_delete=models.PROTECT, related_name='movimientos')
    cantidad = models.DecimalField(max_digits=12, decimal_places=2)
    motivo = models.CharField(max_length=160)
    orden = models.ForeignKey(OrdenMantenimiento, on_delete=models.PROTECT, null=True, blank=True)
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    fecha = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-fecha', '-id']
        indexes = [models.Index(fields=['-fecha'], name='idx_mov_insumo_fecha')]
