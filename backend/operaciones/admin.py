from django.contrib import admin
from .models import Cliente, Insumo, OrdenMantenimiento, OrdenMecanico, ConsumoInsumo, MovimientoInsumo

admin.site.register(Cliente)
admin.site.register(Insumo)
admin.site.register(OrdenMantenimiento)
admin.site.register(OrdenMecanico)
admin.site.register(ConsumoInsumo)
admin.site.register(MovimientoInsumo)
