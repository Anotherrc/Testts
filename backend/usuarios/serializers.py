from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.models import Group
from django.contrib.auth.models import Permission
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


User = get_user_model()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        username = attrs.get(self.username_field)
        if username:
            user = User.objects.filter(email__iexact=username.strip()).first()
            if user:
                attrs = attrs.copy()
                attrs[self.username_field] = user.get_username()
        return super().validate(attrs)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['email'] = user.email
        token['first_name'] = user.first_name
        token['last_name'] = user.last_name

        roles = [group.name.upper() for group in user.groups.all()]
        if user.is_superuser:
            if 'ADMIN' not in roles:
                roles.insert(0, 'ADMIN')
        token['roles'] = roles
        return token


class RegisterSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.CharField(write_only=True, required=True)
    email = serializers.EmailField(required=True)
    password = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'},
    )
    role = serializers.CharField(
        write_only=True,
        required=False,
        default='PLANIFICACION',
    )

    class Meta:
        model = User
        fields = ('nombre_completo', 'email', 'password', 'role')

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value.strip()).exists():
            raise serializers.ValidationError(
                'Este correo ya está registrado en el sistema.'
            )
        return value.strip().lower()

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate_role(self, value):
        if value.upper() not in ('ADMIN', 'PLANIFICACION', 'TECNICO'):
            raise serializers.ValidationError('Rol inválido.')
        return value.upper()

    def create(self, validated_data):
        nombre_completo = validated_data.pop('nombre_completo').strip()
        email = validated_data.pop('email')
        password = validated_data.pop('password')
        role_name = validated_data.pop('role', 'PLANIFICACION')

        partes_nombre = nombre_completo.split(' ', 1)
        first_name = partes_nombre[0]
        last_name = partes_nombre[1] if len(partes_nombre) > 1 else ''

        user = User.objects.create_user(
            username=email,
            email=email,
            first_name=first_name,
            last_name=last_name,
            password=password,
        )

        try:
            group = Group.objects.get(name=role_name.upper())
            user.groups.add(group)
        except Group.DoesNotExist:
            pass

        return user


class PermisoSerializer(serializers.ModelSerializer):
    app_label = serializers.CharField(source='content_type.app_label', read_only=True)
    modelo = serializers.CharField(source='content_type.model', read_only=True)

    class Meta:
        model = Permission
        fields = ['id', 'name', 'codename', 'app_label', 'modelo']


class RolSerializer(serializers.ModelSerializer):
    permissions = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Permission.objects.all(),
        required=False,
    )

    class Meta:
        model = Group
        fields = ['id', 'name', 'permissions']


class UsuarioAdminSerializer(serializers.ModelSerializer):
    roles = serializers.SerializerMethodField()
    is_superuser = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'is_active',
            'is_superuser',
            'roles',
        ]

    def get_roles(self, obj):
        roles = [group.name.upper() for group in obj.groups.all()]
        if obj.is_superuser:
            if 'ADMIN' not in roles:
                roles.insert(0, 'ADMIN')
        return roles
