from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import ClienteViewSet, InsumoViewSet, MovimientoInsumoViewSet, OrdenViewSet

router = DefaultRouter()
router.register(r'clientes', ClienteViewSet, basename='cliente')
router.register(r'insumos', InsumoViewSet, basename='insumo')
router.register(r'movimientos-insumos', MovimientoInsumoViewSet, basename='movimiento-insumo')
router.register(r'ordenes', OrdenViewSet, basename='orden')
urlpatterns = [path('', include(router.urls))]
