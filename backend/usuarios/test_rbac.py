"""Pruebas de autorización real para las casillas del panel RBAC."""
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from rest_framework.test import APITestCase
from equipos.models import Equipo


class PermisosGranularesTest(APITestCase):
    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.admin = User.objects.create_superuser(
            username='root-rbac@demo.cl', email='root-rbac@demo.cl', password='PasswordSegura123!'
        )
        cls.operador = User.objects.create_user(
            username='operador-rbac@demo.cl', email='operador-rbac@demo.cl', password='PasswordSegura123!'
        )
        cls.grupo = Group.objects.create(name='PLANIFICACION_RBAC_TEST')
        cls.operador.groups.add(cls.grupo)
        cls.equipo = Equipo.objects.create(codigo='RBAC-01', nombre='Equipo de prueba', meta_proxima_mant=100)

    def login(self):
        # Releer usuario en cada solicitud: evita caché de permisos del modelo User.
        self.client.force_authenticate(user=get_user_model().objects.get(pk=self.operador.pk))

    def conceder(self, *codenames):
        self.grupo.permissions.set(Permission.objects.filter(
            content_type__app_label='equipos', codename__in=codenames
        ))
        self.login()

    def test_maquinaria_sin_permisos_devuelve_403(self):
        self.login()
        self.assertEqual(self.client.get('/api/equipos/').status_code, 403)
        self.assertEqual(self.client.post('/api/equipos/', {}, format='json').status_code, 403)
        self.assertEqual(self.client.patch(f'/api/equipos/{self.equipo.id}/', {}, format='json').status_code, 403)
        self.assertEqual(self.client.delete(f'/api/equipos/{self.equipo.id}/').status_code, 403)

    def test_consultar_no_permite_editar(self):
        self.conceder('view_equipo')
        self.assertEqual(self.client.get('/api/equipos/').status_code, 200)
        self.assertEqual(self.client.patch(f'/api/equipos/{self.equipo.id}/', {'nombre': 'Otro'}, format='json').status_code, 403)
        self.equipo.refresh_from_db()
        self.assertEqual(self.equipo.nombre, 'Equipo de prueba')

    def test_crear_y_editar_son_independientes(self):
        self.conceder('view_equipo', 'change_equipo')
        self.assertEqual(self.client.patch(f'/api/equipos/{self.equipo.id}/', {'nombre': 'Actualizado'}, format='json').status_code, 200)
        self.assertEqual(self.client.post('/api/equipos/', {}, format='json').status_code, 403)
        self.conceder('view_equipo', 'add_equipo')
        self.assertEqual(self.client.patch(f'/api/equipos/{self.equipo.id}/', {'nombre': 'No cambia'}, format='json').status_code, 403)
        # Petición incompleta: 400 validación significa que sí alcanzó la API.
        self.assertEqual(self.client.post('/api/equipos/', {}, format='json').status_code, 400)

    def test_retirar_permiso_se_aplica_en_siguiente_peticion(self):
        self.conceder('view_equipo')
        self.assertEqual(self.client.get('/api/equipos/').status_code, 200)
        self.conceder()
        self.assertEqual(self.client.get('/api/equipos/').status_code, 403)

    def test_editar_no_permite_dar_de_baja_sin_eliminar(self):
        self.conceder('view_equipo', 'change_equipo')
        response = self.client.patch(
            f'/api/equipos/{self.equipo.id}/', {'estado': 'Deshabilitada'}, format='json'
        )
        self.assertEqual(response.status_code, 403)
        self.equipo.refresh_from_db()
        self.assertFalse(self.equipo.is_deleted)

    

    def test_gps_solo_con_permiso_de_consultar(self):
        # Usuario con permiso para consultar GPS.
        self.conceder('view_logtelemetriagps')

        # Debe poder consultar.
        self.assertEqual(
            self.client.get('/api/telemetria/').status_code,
            200
        )

        # No debe poder crear registros GPS.
        self.assertEqual(
            self.client.post(
                '/api/telemetria/', {}, format='json'
            ).status_code,
            403
        )

        # Ni siquiera el administrador puede usar POST
        # porque el endpoint es de solo lectura.
        self.client.force_authenticate(user=self.admin)

        self.assertEqual(
            self.client.post(
                '/api/telemetria/', {}, format='json'
            ).status_code,
            405
        )

        # Al retirar el permiso GPS, debe bloquear la consulta.
        self.conceder('view_equipo')

        self.assertEqual(
            self.client.get('/api/telemetria/').status_code,
            403
        )



    def test_finalizar_requiere_editar_mantenciones(self):
        self.conceder('view_historialmantencion')
        self.assertEqual(self.client.post('/api/ordenes/123456/finalizar/').status_code, 403)
        self.conceder('view_historialmantencion', 'change_historialmantencion')
        # 404 = permiso concedido, pero orden ficticia no existe.
        self.assertEqual(self.client.post('/api/ordenes/123456/finalizar/').status_code, 404)

    def test_perfil_expone_permisos_guardados(self):
        self.conceder('view_equipo')
        response = self.client.get('/api/perfil/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('equipos.view_equipo', response.data['permisos'])
        self.assertNotIn('equipos.change_equipo', response.data['permisos'])

    def test_planificacion_no_puede_modificar_roles_usuarios(self):
        self.conceder('view_equipo')
        self.assertEqual(self.client.get('/api/admin/roles/').status_code, 403)
        self.assertEqual(self.client.get('/api/admin/usuarios/').status_code, 403)
        self.assertEqual(self.client.post('/api/registro/', {}, format='json').status_code, 403)

    def test_superusuario_conserva_administracion(self):
        self.client.force_authenticate(user=self.admin)
        self.assertEqual(self.client.get('/api/admin/usuarios/').status_code, 200)
        self.assertEqual(self.client.get('/api/admin/roles/').status_code, 200)
        self.assertEqual(self.client.get('/api/admin/permisos/').status_code, 200)
