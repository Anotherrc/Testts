from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin
from .models import Equipo, HistorialMantencion, LogTelemetriaGPS


@admin.register(Equipo)
class EquipoAdmin(SimpleHistoryAdmin):
    list_display = ('codigo', 'nombre', 'estado', 'horometro_actual', 'is_deleted', 'fecha_baja')
    list_filter = ('estado', 'unidad_medida', 'is_deleted')
    search_fields = ('codigo', 'nombre')


@admin.register(HistorialMantencion)
class HistorialMantencionAdmin(SimpleHistoryAdmin):
    list_display = ('equipo', 'mecanico_responsable', 'fecha_intervencion', 'horometro_al_momento')
    list_filter = ('fecha_intervencion',)


@admin.register(LogTelemetriaGPS)
class LogTelemetriaGPSAdmin(admin.ModelAdmin):
    list_display = ('equipo', 'timestamp_evento', 'motor_encendido', 'horometro_reportado', 'sincronizado_offline')
    list_filter = ('motor_encendido', 'sincronizado_offline')