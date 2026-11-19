"""Control RBAC que usa los permisos por modelo configurados desde el panel.

Las casillas Crear/Editar/Eliminar/Consultar son los permisos Django
add_/change_/delete_/view_ de cada modelo. No basta pertenecer a un rol.
"""
from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """Administración de cuentas y roles: exclusivamente ADMIN o superusuario."""

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated and user.is_active and
            (user.is_superuser or user.groups.filter(name='ADMIN').exists())
        )


class HasRequiredPermission(BasePermission):
    """Para endpoints sin ViewSet como el registro de usuarios."""

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated and user.is_active and
            user.has_perm(view.required_permission)
        )


class IsModelActionAllowed(BasePermission):
    """Rechaza por defecto cualquier acción que no tenga permiso asociado.

    permission_label: 'app_label.modelo' (nombre singular minúsculas).
    action_permissions: excepciones para @action como restaurar/finalizar.
    """

    action_map = {
        'list': 'view',
        'retrieve': 'view',
        'create': 'add',
        'update': 'change',
        'partial_update': 'change',
        'destroy': 'delete',
        'metadata': 'view',
    }

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False
        if user.is_superuser:
            return True
        label = getattr(view, 'permission_label', None)
        action = getattr(view, 'action', None)
        if not label or not action:
            return False
        action_permissions = getattr(view, 'action_permissions', {})
        perm = action_permissions.get(action)
        if perm is None:
            verb = self.action_map.get(action)
            if not verb:
                return False
            app_label, model_name = label.split('.', 1)
            perm = f'{app_label}.{verb}_{model_name}'
        return user.has_perm(perm)


class IsAdminPlanificacionOrTecnicoReadOnly(BasePermission):
    """Regla histórica de módulos aún sin casillas: clientes e inventario."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False
        if user.is_superuser:
            return True
        allowed = ['ADMIN', 'PLANIFICACION', 'JEFE DE PLANIFICACION']
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            allowed.append('TECNICO')
        return user.groups.filter(name__in=allowed).exists()


# Compatibilidad si algún módulo utiliza esta clase histórica.
class IsAdminOrPlanificacion(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_active and
                    (user.is_superuser or user.groups.filter(
                        name__in=['ADMIN', 'PLANIFICACION', 'JEFE DE PLANIFICACION']
                    ).exists()))
