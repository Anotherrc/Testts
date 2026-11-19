from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError, PermissionDenied
from django.utils import timezone
import math
from simple_history.models import HistoricalRecords


class EquipoQuerySet(models.QuerySet):
    def delete(self):
        """Aplica soft delete registro por registro para conservar el historial."""
        deleted_count = 0
        for equipo in self.all():
            equipo.delete()
            deleted_count += 1
        return deleted_count, {self.model._meta.label: deleted_count}

    def activos(self):
        return self.filter(is_deleted=False)


class EquipoManager(models.Manager):
    def get_queryset(self):
        return EquipoQuerySet(self.model, using=self._db).filter(is_deleted=False)

    def activos(self):
        return self.get_queryset().activos()


class EquipoAllManager(models.Manager.from_queryset(EquipoQuerySet)):
    """Manager de auditoría que incluye bajas, pero conserva soft delete."""


class Equipo(models.Model):
    UNIDADES_MEDIDA = [
        ('HORAS', 'Horómetro (50 hrs)'),
        ('KM', 'Kilometraje (1000 km)'),
    ]

    ESTADOS_VALIDOS = [
        ('Disponible', 'Disponible'),
        ('Mantenimiento', 'Mantenimiento'),
        ('Arrendada', 'Arrendada'),
        ('Deshabilitada', 'Deshabilitada'),
    ]
    VALORES_ESTADO = ['Disponible', 'Mantenimiento', 'Arrendada', 'Deshabilitada']

    # Campos principales
    codigo = models.CharField(max_length=20, unique=True, verbose_name="Nro Interno")
    nombre = models.CharField(max_length=100, verbose_name="Tipo de Equipo")
    marca = models.CharField(max_length=80, blank=True, default="")
    modelo = models.CharField(max_length=100, blank=True, default="")
    foto_url = models.URLField(blank=True, default="")
    foto_archivo = models.FileField(upload_to="equipos/", blank=True, default="")
    latitud = models.FloatField(default=-20.2141)
    longitud = models.FloatField(default=-70.1524)
    ubicacion_registrada = models.BooleanField(default=False, help_text="Coordenadas introducidas manualmente, no telemetría confirmada")
    zona_operacion = models.CharField(max_length=120, blank=True, default="")
    senal_movil = models.BooleanField(default=True)
    categoria = models.CharField(max_length=100, blank=True, default="")
    subcategoria = models.CharField(max_length=100, blank=True, default="")
    estado = models.CharField(
        max_length=50,
        choices=ESTADOS_VALIDOS,
        default="Disponible",
        verbose_name="Estado Operativo"
    )

    # Campos de Soft Delete (Borrado Lógico)
    is_deleted = models.BooleanField(default=False, verbose_name="Eliminado Lógicamente")
    fecha_baja = models.DateTimeField(null=True, blank=True, verbose_name="Fecha de Baja")

    # Campos adicionales para cumplir con las 5 Historias de Usuario y BD Relacional
    horometro_actual = models.FloatField(default=0.0)
    meta_proxima_mant = models.FloatField(verbose_name="Límite Próxima Mantención")
    unidad_medida = models.CharField(max_length=10, choices=UNIDADES_MEDIDA, default='HORAS')
    horas_uso_mes = models.FloatField(default=0.0, verbose_name="Horas Acumuladas en el Mes")
    limite_contrato_mes = models.FloatField(default=162.0, help_text="Límite mensual: 162 o 176 hrs")
    encendido_gps = models.BooleanField(default=False, verbose_name="Motor Encendido (GPS Teltonika)")
    cliente_asignado = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="maquinas_arrendadas",
    )

    # Cliente empresarial (distinto del usuario del sistema cliente_asignado, conservado por compatibilidad).
    cliente_empresa = models.ForeignKey(
        'operaciones.Cliente', on_delete=models.SET_NULL, null=True, blank=True, related_name='equipos'
    )

    # Manager personalizado
    objects = EquipoManager()
    all_objects = EquipoAllManager()

    # LOGS INMUTABLES: Registra automáticamente usuario, fecha y cambios
    history = HistoricalRecords()

    class Meta:
        indexes = [models.Index(fields=['is_deleted', 'estado'], name='idx_equipo_activo_estado')]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(estado__in=['Disponible', 'Mantenimiento', 'Arrendada', 'Deshabilitada']),
                name='check_equipo_estado_valido'
            )
        ]

    def __str__(self):
        return f"{self.codigo} - {self.nombre} ({self.estado})"

    def clean(self):
        """
        ESTÁNDAR DE CODIFICACIÓN SEGURA Y REGLA HU03 (Caso 2):
        1. Valida que el estado pertenezca a los valores permitidos.
        2. Impide que se ingrese un horómetro menor al último registrado.
        """
        if self.estado not in self.VALORES_ESTADO:
            raise ValidationError({
                'estado': f"Estado inválido. Los valores permitidos son: {', '.join(self.VALORES_ESTADO)}."
            })

        for campo in ('horometro_actual', 'meta_proxima_mant', 'horas_uso_mes', 'limite_contrato_mes'):
            valor = getattr(self, campo)
            if valor is None or not math.isfinite(valor) or valor < 0:
                raise ValidationError({campo: 'Este valor debe ser un número finito, mayor o igual a cero.'})

        if self.pk:
            registro_previo = Equipo.all_objects.get(pk=self.pk)
            if self.horometro_actual < registro_previo.horometro_actual:
                raise ValidationError({
                    'horometro_actual': (
                        f"Error de inconsistencia: El nuevo valor ({self.horometro_actual}) "
                        f"no puede ser inferior al registro histórico ({registro_previo.horometro_actual})."
                    )
                })

    def save(self, *args, **kwargs):
        if self.estado == 'Deshabilitada' and not self.is_deleted:
            self.is_deleted = True
            self.fecha_baja = timezone.now()
        elif self.is_deleted and self.estado != 'Deshabilitada':
            raise ValidationError(
                "Un equipo eliminado debe permanecer en estado 'Deshabilitada'. "
                "Use el endpoint de restauración para reactivarlo."
            )

        self.full_clean()
        super().save(*args, **kwargs)

    def delete(self, using=None, keep_parents=False):
        """
        SOFT DELETE: Sobrescribe el borrado físico para mantener el historial.
        """
        self.is_deleted = True
        self.estado = 'Deshabilitada'
        self.fecha_baja = timezone.now()
        self.save()
        return 1, {self._meta.label: 1}

    def restore(self):
        """Reactiva una maquinaria previamente deshabilitada."""
        self.is_deleted = False
        self.estado = 'Disponible'
        self.fecha_baja = None
        self.save()

    # MOTOR LÓGICO MATEMÁTICO 1: Mantenciones (50 hrs grúas / 1000 km camionetas)
    @property
    def horas_restantes(self):
        """Calcula cuántas horas o kilómetros faltan para la próxima mantención"""
        diferencia = self.meta_proxima_mant - self.horometro_actual
        return round(diferencia, 2)

    @property
    def estado_alerta(self):
        """Genera el estado lógico y semaforización según el tipo de medición"""
        if self.estado == 'Deshabilitada' or self.is_deleted:
            return "INHABILITADO: Fuera de Servicio"

        restante = self.horas_restantes
        umbral_preventivo = 100.0 if self.unidad_medida == 'KM' else 50.0

        if restante <= 0:
            return "URGENTE: Mantenimiento Vencido"
        elif restante <= umbral_preventivo:
            return "PRÓXIMO: Agendar mantenimiento"
        return "OPERATIVO: Disponible"

    @property
    def color_semaforo(self):
        """Semaforización visual requerida por RNF1 (ROJO, AMARILLO, VERDE, GRIS)"""
        if self.estado == 'Deshabilitada' or self.is_deleted:
            return "GRIS"
        if self.estado == 'Mantenimiento' or "URGENTE" in self.estado_alerta:
            return "ROJO"
        elif "PRÓXIMO" in self.estado_alerta:
            return "AMARILLO"
        return "VERDE"

    # MOTOR LÓGICO MATEMÁTICO 2: Regla de Contrato de Arriendo (162 y 176 hrs - HU01 y HU04)
    @property
    def horas_contrato_disponibles(self):
        return round(max(0.0, self.limite_contrato_mes - self.horas_uso_mes), 2)

    @property
    def exceso_horas_contrato(self):
        if self.horas_uso_mes > self.limite_contrato_mes:
            return round(self.horas_uso_mes - self.limite_contrato_mes, 2)
        return 0.0


# MODELO RELACIONAL 2: Historial de Mantenciones y Fallas (HU05 - Vista Mecánico)
class HistorialMantencion(models.Model):
    equipo = models.ForeignKey(Equipo, on_delete=models.PROTECT, related_name='mantenciones')
    mecanico_responsable = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    fecha_intervencion = models.DateTimeField(default=timezone.now)
    horometro_al_momento = models.FloatField()
    descripcion_falla_o_trabajo = models.TextField(help_text="Ej: Cambio de pastillas de freno, mantención 50 hrs")
    insumos_utilizados = models.CharField(max_length=255, blank=True)

    history = HistoricalRecords()

    def __str__(self):
        return f"OT {self.equipo.codigo} - {self.fecha_intervencion.strftime('%d/%m/%Y')}"


# MODELO RELACIONAL 3: Logs de Telemetría GPS Teltonika (HU02 - Almacenamiento Local/Sincronización)
class LogTelemetriaGPS(models.Model):
    equipo = models.ForeignKey(Equipo, on_delete=models.PROTECT, related_name='logs_gps')
    timestamp_evento = models.DateTimeField()
    motor_encendido = models.BooleanField(default=True)
    horometro_reportado = models.FloatField()
    sincronizado_offline = models.BooleanField(
        default=False, help_text="True si fue guardado localmente en zona sin señal (galpón/túnel) y enviado después"
    )

    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise PermissionDenied("Los logs de auditoría y telemetría GPS son inmutables.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise PermissionDenied("Los logs de auditoría y telemetría GPS son inmutables y no pueden eliminarse.")