"""Recuperación de contraseña con tokens temporales de Django."""

import logging
import binascii

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import PasswordResetForm
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

logger = logging.getLogger(__name__)
User = get_user_model()


class RecuperacionThrottle(AnonRateThrottle):
    """Máximo cinco solicitudes por hora desde una misma IP."""
    rate = '5/hour'


class SolicitarRecuperacionView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    throttle_classes = [RecuperacionThrottle]

    def post(self, request):
        email = request.data.get('email', '')
        formulario = PasswordResetForm(data={'email': email})
        if not formulario.is_valid():
            return Response(formulario.errors, status=status.HTTP_400_BAD_REQUEST)

        # Siempre responder lo mismo, exista o no el correo registrado.
        mensaje = {
            'message': (
                'Si existe una cuenta activa con ese correo, recibirás '
                'instrucciones para recuperar tu contraseña.'
            )
        }

        base_url = settings.FRONTEND_BASE_URL.rstrip('/')
        for usuario in formulario.get_users(formulario.cleaned_data['email']):
            uid = urlsafe_base64_encode(force_bytes(usuario.pk))
            token = default_token_generator.make_token(usuario)
            enlace = f'{base_url}/restablecer-contrasena/{uid}/{token}'
            try:
                send_mail(
                    subject='Recuperar contraseña - Vilas Motor',
                    message=(
                        'Se solicitó recuperar tu contraseña de Vilas Motor.\n\n'
                        f'Abre el siguiente enlace para establecer una nueva contraseña:\n{enlace}\n\n'
                        'El enlace vence en una hora y no podrá reutilizarse después del cambio.\n'
                        'Si no solicitaste esta recuperación, ignora este mensaje.'
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[usuario.email],
                    fail_silently=False,
                )
            except Exception:
                # No filtrar al visitante si el correo existe, ni escribir el token en los logs.
                logger.exception('Falló el envío de una recuperación de contraseña.')

        return Response(mensaje, status=status.HTTP_200_OK)


class ConfirmarRecuperacionView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        uid = request.data.get('uid', '')
        token = request.data.get('token', '')
        password = request.data.get('password', '')
        confirmacion = request.data.get('confirm_password', '')

        if not all(isinstance(valor, str) and valor for valor in (uid, token, password, confirmacion)):
            return Response({'detail': 'Completa todos los campos.'}, status=status.HTTP_400_BAD_REQUEST)
        if password != confirmacion:
            return Response({'detail': 'Las contraseñas no coinciden.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user_id = urlsafe_base64_decode(uid).decode('utf-8')
            usuario = User.objects.get(pk=user_id, is_active=True)
        except (ValueError, TypeError, OverflowError, UnicodeDecodeError, binascii.Error, User.DoesNotExist):
            usuario = None

        if usuario is None or not default_token_generator.check_token(usuario, token):
            return Response(
                {'detail': 'El enlace es inválido o ha expirado. Solicita uno nuevo.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_password(password, user=usuario)
        except ValidationError as error:
            return Response({'password': error.messages}, status=status.HTTP_400_BAD_REQUEST)

        usuario.set_password(password)
        usuario.save(update_fields=['password'])
        return Response({'message': 'Contraseña actualizada. Ya puedes iniciar sesión.'})
