from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .password_reset import SolicitarRecuperacionView, ConfirmarRecuperacionView
from .views import (
    CustomTokenObtainPairView,
    UsuarioPerfilView,
    RegisterView,
    RolViewSet,
    UsuarioAdminViewSet,
    PermisoViewSet,
)

router = DefaultRouter()
router.register(r'admin/roles', RolViewSet, basename='admin-roles')
router.register(r'admin/usuarios', UsuarioAdminViewSet, basename='admin-usuarios')
router.register(r'admin/permisos', PermisoViewSet, basename='admin-permisos')

urlpatterns = [
    path('', include(router.urls)),
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('login/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('perfil/', UsuarioPerfilView.as_view(), name='usuario_perfil'),
    path('registro/', RegisterView.as_view(), name='register_user'),
    path('contrasena/solicitar/', SolicitarRecuperacionView.as_view(), name='solicitar_recuperacion'),
    path('contrasena/restablecer/', ConfirmarRecuperacionView.as_view(), name='confirmar_recuperacion'),
]