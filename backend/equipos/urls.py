from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    EquipoViewSet,
    HistorialMantencionViewSet,
    LogTelemetriaGPSViewSet
)

router = DefaultRouter()
router.register(r'equipos', EquipoViewSet, basename='equipo')
router.register(r'mantenciones', HistorialMantencionViewSet, basename='mantencion')
router.register(r'telemetria', LogTelemetriaGPSViewSet, basename='telemetria')

urlpatterns = [
    path('', include(router.urls)),
]