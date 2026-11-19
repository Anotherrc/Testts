from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase


User = get_user_model()


class AuthenticationTests(APITestCase):
    def test_login_accepts_email(self):
        User.objects.create_superuser(
            username='administrador',
            email='admin@vilasmotor.cl',
            password='PasswordSegura123!',
        )

        response = self.client.post(
            '/api/login/',
            {
                'username': 'admin@vilasmotor.cl',
                'password': 'PasswordSegura123!',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.data)

    def test_admin_can_register_user_with_email_as_username(self):
        admin = User.objects.create_superuser(
            username='admin',
            email='admin@vilasmotor.cl',
            password='PasswordSegura123!',
        )
        self.client.force_authenticate(admin)

        response = self.client.post(
            '/api/registro/',
            {
                'nombre_completo': 'Juan Perez',
                'email': 'juan.perez@vilasmotor.cl',
                'password': 'PasswordSegura123!',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(email='juan.perez@vilasmotor.cl')
        self.assertEqual(user.username, 'juan.perez@vilasmotor.cl')


# Pruebas de recuperación de contraseña
from django.core import mail
from django.test import TestCase, override_settings
from django.utils.http import urlsafe_base64_decode
from rest_framework.test import APIClient
from urllib.parse import urlsplit

@override_settings(
    FRONTEND_BASE_URL='http://localhost:5173',
    MAILERS={'default': {'BACKEND': 'django.core.mail.backends.locmem.EmailBackend'}},
)
class RecuperarContrasenaTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.usuario = User.objects.create_user(
            username='plan.prueba@example.com',
            email='plan.prueba@example.com',
            password='ClaveAnteriorSegura123!',
        )

    def test_enlace_llega_al_correo_y_cambia_la_clave(self):
        respuesta = self.client.post('/api/contrasena/solicitar/', {'email': self.usuario.email}, format='json')
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        cuerpo = mail.outbox[0].body
        enlace = next(linea for linea in cuerpo.splitlines() if linea.startswith('http://localhost:5173/'))
        segmentos = urlsplit(enlace).path.strip('/').split('/')
        self.assertEqual(segmentos[0], 'restablecer-contrasena')
        uid, token = segmentos[1], segmentos[2]
        self.assertEqual(int(urlsafe_base64_decode(uid).decode()), self.usuario.pk)
        nueva = 'ClaveNuevaSegura123!'
        guardar = self.client.post('/api/contrasena/restablecer/', {
            'uid': uid, 'token': token, 'password': nueva, 'confirm_password': nueva,
        }, format='json')
        self.assertEqual(guardar.status_code, 200)
        self.usuario.refresh_from_db()
        self.assertTrue(self.usuario.check_password(nueva))
        repeticion = self.client.post('/api/contrasena/restablecer/', {
            'uid': uid, 'token': token, 'password': 'OtraClaveSegura123!',
            'confirm_password': 'OtraClaveSegura123!',
        }, format='json')
        self.assertEqual(repeticion.status_code, 400)

    def test_respuesta_igual_para_correo_desconocido(self):
        conocido = self.client.post('/api/contrasena/solicitar/', {'email': self.usuario.email}, format='json')
        desconocido = self.client.post('/api/contrasena/solicitar/', {'email': 'no-existe@example.com'}, format='json')
        self.assertEqual(conocido.status_code, 200)
        self.assertEqual(desconocido.status_code, 200)
        self.assertEqual(conocido.data, desconocido.data)
        self.assertEqual(len(mail.outbox), 1)

    def test_contrasena_debil_se_rechaza(self):
        self.client.post('/api/contrasena/solicitar/', {'email': self.usuario.email}, format='json')
        enlace = next(linea for linea in mail.outbox[0].body.splitlines() if linea.startswith('http://localhost:5173/'))
        uid, token = urlsplit(enlace).path.strip('/').split('/')[1:3]
        respuesta = self.client.post('/api/contrasena/restablecer/', {
            'uid': uid, 'token': token, 'password': '123', 'confirm_password': '123',
        }, format='json')
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('password', respuesta.data)
