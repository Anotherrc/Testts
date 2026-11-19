from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from rest_framework import permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .permissions import IsAdmin, IsModelActionAllowed, HasRequiredPermission
from .serializers import (
    CustomTokenObtainPairSerializer,
    RegisterSerializer,
    RolSerializer,
    UsuarioAdminSerializer,
    PermisoSerializer,
)


User = get_user_model()


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class RegisterView(APIView):
    permission_classes = [IsAdmin, HasRequiredPermission]
    required_permission = 'auth.add_user'

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response(
                {
                    'message': 'Usuario registrado exitosamente en Vilas Motor',
                    'user': {
                        'id': user.id,
                        'username': user.username,
                        'email': user.email,
                        'first_name': user.first_name,
                        'last_name': user.last_name,
                    },
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UsuarioPerfilView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        roles = [group.name.upper() for group in user.groups.all()]
        if user.is_superuser:
            if 'ADMIN' not in roles:
                roles.insert(0, 'ADMIN')

        return Response(
            {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'roles': roles,
                'is_active': user.is_active,
                'is_superuser': user.is_superuser,
                'permisos': sorted(user.get_all_permissions()),
            },
            status=status.HTTP_200_OK,
        )


class RolViewSet(viewsets.ModelViewSet):
    queryset = Group.objects.all().order_by('id')
    serializer_class = RolSerializer
    permission_classes = [IsAdmin, IsModelActionAllowed]
    permission_label = 'auth.group'

    def update(self, request, *args, **kwargs):
        rol = self.get_object()
        if rol.name == 'ADMIN' and not request.user.is_superuser:
            return Response({'detail': 'Solo un superusuario puede modificar ADMIN.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        rol = self.get_object()
        if rol.name == 'ADMIN' and not request.user.is_superuser:
            return Response({'detail': 'Solo un superusuario puede modificar ADMIN.'}, status=status.HTTP_403_FORBIDDEN)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        rol = self.get_object()
        if rol.name == 'ADMIN':
            return Response({'detail': 'El rol ADMIN no se puede eliminar.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


class PermisoViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Permission.objects.select_related('content_type').order_by(
        'content_type__app_label', 'content_type__model', 'codename'
    )
    serializer_class = PermisoSerializer
    permission_classes = [IsAdmin, IsModelActionAllowed]
    permission_label = 'auth.group'


class UsuarioAdminViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('id')
    serializer_class = UsuarioAdminSerializer
    permission_classes = [IsAdmin, IsModelActionAllowed]
    permission_label = 'auth.user'
    # La creación requiere contraseña validada y solo se ofrece en /api/registro/.
    http_method_names = ['get', 'patch', 'delete', 'head', 'options']

    def _puede_cambiar_usuario(self, request, user):
        # Las cuentas superusuario solo las administra otro superusuario.
        return not user.is_superuser or request.user.is_superuser

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        if not self._puede_cambiar_usuario(request, user):
            return Response({'detail': 'Operación exclusiva de superusuarios.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user.pk == request.user.pk or user.is_superuser:
            return Response({'detail': 'No puedes eliminar esta cuenta.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        user = self.get_object()
        if not self._puede_cambiar_usuario(request, user):
            return Response({'detail': 'Operación exclusiva de superusuarios.'}, status=status.HTTP_403_FORBIDDEN)
        if 'grupos_ids' in request.data and not request.user.has_perm('auth.change_group'):
            return Response({'detail': 'Falta el permiso Editar Roles.'}, status=status.HTTP_403_FORBIDDEN)
        if user.pk == request.user.pk and request.data.get('is_active') is False:
            return Response({'detail': 'No puedes bloquear tu propia cuenta.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        if 'grupos_ids' in request.data:
            grupos_ids = request.data['grupos_ids']
            grupos = Group.objects.filter(id__in=grupos_ids)
            user.groups.set(grupos)

        return Response(self.get_serializer(user).data)
