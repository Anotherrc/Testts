"""Pruebas de integración sobre la BD temporal de Django: datos y permisos reales."""
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from rest_framework.test import APITestCase
from equipos.models import Equipo, HistorialMantencion
from .models import Cliente, Insumo, OrdenMantenimiento, ConsumoInsumo, MovimientoInsumo


class FlujosOperativosTest(APITestCase):
    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.plan = User.objects.create_user(username='plan@demo.cl', email='plan@demo.cl', password='PasswordSegura123!')
        cls.tecnico = User.objects.create_user(username='tec@demo.cl', email='tec@demo.cl', password='PasswordSegura123!')
        cls.admin = User.objects.create_superuser(username='admin@demo.cl', email='admin@demo.cl', password='PasswordSegura123!')
        cls.plan.groups.add(Group.objects.get_or_create(name='PLANIFICACION')[0])
        cls.tecnico.groups.add(Group.objects.get_or_create(name='TECNICO')[0])
        # Cada caso de prueba usa permisos reales, no acceso por nombre de grupo.
        plan_grupo = Group.objects.get(name='PLANIFICACION')
        tecnico_grupo = Group.objects.get(name='TECNICO')
        plan_grupo.permissions.set(Permission.objects.filter(
            content_type__app_label='equipos',
            content_type__model__in=['equipo', 'historialmantencion', 'logtelemetriagps'],
        ))
        tecnico_grupo.permissions.set(Permission.objects.filter(
            codename__in=['view_equipo', 'view_historialmantencion', 'change_historialmantencion', 'view_logtelemetriagps'],
            content_type__app_label='equipos',
        ))

        cls.equipo = Equipo.objects.create(codigo='TEST-001', nombre='Grúa horquilla', horometro_actual=80, meta_proxima_mant=100)
        cls.insumo = Insumo.objects.create(nombre='Filtro de aceite', stock=Decimal('10'), minimo=Decimal('2'))

    def autenticar(self, usuario):
        self.client.force_authenticate(user=usuario)

    def test_anonimo_no_ve_clientes_ni_inventario(self):
        for ruta in ['/api/clientes/', '/api/insumos/', '/api/ordenes/']:
            respuesta = self.client.get(ruta)
            self.assertIn(respuesta.status_code, (401, 403))

    def test_tecnico_solo_consulta_no_crea_cliente_o_insumo(self):
        self.autenticar(self.tecnico)
        self.assertEqual(self.client.get('/api/clientes/').status_code, 200)
        self.assertEqual(self.client.get('/api/ordenes/').status_code, 200)
        self.assertEqual(self.client.get('/api/insumos/').status_code, 200)
        self.assertEqual(self.client.post('/api/insumos/', {'nombre': 'Prueba', 'stock': 1, 'minimo': 0, 'unidad': 'unidades'}).status_code, 403)
        self.assertEqual(self.client.post('/api/clientes/', {'nombre': 'Prueba'}).status_code, 403)

    def test_cliente_y_asignacion_persisten(self):
        self.autenticar(self.plan)
        respuesta = self.client.post('/api/clientes/', {'nombre': 'Cliente Real', 'rut': '12.345.678-5', 'categoria': 'Minería'}, format='json')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        cliente_id = respuesta.data['id']
        asignacion = self.client.patch(f'/api/equipos/{self.equipo.pk}/', {'cliente_empresa': cliente_id, 'estado': 'Arrendada'}, format='json')
        self.assertEqual(asignacion.status_code, 200, asignacion.data)
        self.equipo.refresh_from_db()
        self.assertEqual(self.equipo.cliente_empresa_id, cliente_id)
        self.assertEqual(Cliente.objects.get(pk=cliente_id).equipos.count(), 1)
        self.assertEqual(self.client.patch(f'/api/clientes/{cliente_id}/', {'estado': 'Inactivo'}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(f'/api/equipos/{self.equipo.pk}/', {'cliente_empresa': None, 'estado': 'Disponible'}, format='json').status_code, 200)
        self.assertEqual(self.client.patch(f'/api/clientes/{cliente_id}/', {'estado': 'Inactivo'}, format='json').status_code, 200)

    def test_orden_descontar_y_finalizar_registra_historial(self):
        self.autenticar(self.plan)
        respuesta = self.client.post('/api/ordenes/', {
            'equipoId': self.equipo.pk,
            'fecha': '2026-11-20',
            'comentario': 'Cambio de filtros y revisión preventiva',
            'mecanicos': ['Técnico Uno'],
            'consumos': [{'insumo': self.insumo.pk, 'cantidad': 2}],
        }, format='json')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.insumo.refresh_from_db()
        self.equipo.refresh_from_db()
        self.assertEqual(self.insumo.stock, Decimal('8'))
        self.assertEqual(self.equipo.estado, 'Mantenimiento')
        self.assertEqual(ConsumoInsumo.objects.count(), 1)
        self.assertEqual(MovimientoInsumo.objects.count(), 1)
        self.assertEqual(self.client.post('/api/ordenes/', {
            'equipoId': self.equipo.pk, 'fecha': '2026-11-21',
            'comentario': 'Segunda orden simultánea', 'mecanicos': ['Técnico Uno'],
        }, format='json').status_code, 400)
        self.autenticar(self.tecnico)
        cierre = self.client.post(f'/api/ordenes/{respuesta.data["id"]}/finalizar/')
        self.assertEqual(cierre.status_code, 200, cierre.data)
        self.equipo.refresh_from_db()
        self.assertEqual(self.equipo.estado, 'Disponible')
        self.assertEqual(OrdenMantenimiento.objects.get(pk=respuesta.data['id']).estado, 'Finalizada')
        self.assertEqual(HistorialMantencion.objects.filter(equipo=self.equipo).count(), 1)
        self.assertEqual(self.client.post(f'/api/ordenes/{respuesta.data["id"]}/finalizar/').status_code, 400)

    def test_stock_insuficiente_rechaza_orden_sin_cambios(self):
        self.autenticar(self.plan)
        respuesta = self.client.post('/api/ordenes/', {
            'equipoId': self.equipo.pk,
            'fecha': '2026-11-20',
            'comentario': 'Orden con consumo inválido',
            'mecanicos': ['Técnico Uno'],
            'consumos': [{'insumo': self.insumo.pk, 'cantidad': 50}],
        }, format='json')
        self.assertEqual(respuesta.status_code, 400)
        self.assertEqual(OrdenMantenimiento.objects.count(), 0)
        self.insumo.refresh_from_db()
        self.equipo.refresh_from_db()
        self.assertEqual(self.insumo.stock, Decimal('10'))
        self.assertEqual(self.equipo.estado, 'Disponible')

    def test_ajuste_inventario_no_permite_stock_negativo(self):
        self.autenticar(self.plan)
        self.assertEqual(self.client.post(f'/api/insumos/{self.insumo.pk}/ajustar/', {'cantidad': -50}).status_code, 400)
        self.insumo.refresh_from_db()
        self.assertEqual(self.insumo.stock, Decimal('10'))
        respuesta = self.client.post(f'/api/insumos/{self.insumo.pk}/ajustar/', {'cantidad': -2})
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.insumo.refresh_from_db()
        self.assertEqual(self.insumo.stock, Decimal('8'))
        self.assertEqual(MovimientoInsumo.objects.count(), 1)

    def test_registro_solo_admin_y_contraseña_segura(self):
        self.autenticar(self.plan)
        datos = {'nombre_completo': 'Usuario Técnico', 'email': 'nuevo@demo.cl', 'password': 'PasswordSegura123!', 'role': 'TECNICO'}
        self.assertEqual(self.client.post('/api/registro/', datos).status_code, 403)
        self.autenticar(self.admin)
        self.assertEqual(self.client.post('/api/registro/', {**datos, 'password': '123'}).status_code, 400)
        self.assertEqual(self.client.post('/api/registro/', datos).status_code, 201)
        self.assertTrue(get_user_model().objects.get(email='nuevo@demo.cl').groups.filter(name='TECNICO').exists())

    def test_deshabilitacion_bloqueada_con_orden_abierta(self):
        self.autenticar(self.plan)
        OrdenMantenimiento.objects.create(equipo=self.equipo, fecha='2026-11-20', comentario='Mantención abierta', creado_por=self.plan)
        respuesta = self.client.delete(f'/api/equipos/{self.equipo.pk}/')
        self.assertEqual(respuesta.status_code, 400)
        self.assertTrue(Equipo.objects.filter(pk=self.equipo.pk).exists())

    def test_edicion_directa_stock_registra_auditoria_sin_duplicar(self):
        self.autenticar(self.plan)
        url = f'/api/insumos/{self.insumo.pk}/'

        respuesta = self.client.patch(url, {'stock': '15.00'}, format='json')
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.insumo.refresh_from_db()
        self.assertEqual(self.insumo.stock, Decimal('15.00'))
        self.assertEqual(MovimientoInsumo.objects.count(), 1)
        self.assertEqual(MovimientoInsumo.objects.first().cantidad, Decimal('5.00'))

        # Repetir el mismo valor no debe crear otro movimiento.
        respuesta = self.client.patch(url, {'stock': '15.00'}, format='json')
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(MovimientoInsumo.objects.count(), 1)

        respuesta = self.client.patch(url, {'stock': '12.00'}, format='json')
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(MovimientoInsumo.objects.count(), 2)
        self.assertEqual(MovimientoInsumo.objects.order_by('-id').first().cantidad, Decimal('-3.00'))

        respuesta = self.client.patch(url, {'stock': '-1.00'}, format='json')
        self.assertEqual(respuesta.status_code, 400)
        self.insumo.refresh_from_db()
        self.assertEqual(self.insumo.stock, Decimal('12.00'))
        self.assertEqual(MovimientoInsumo.objects.count(), 2)

    def test_usuario_staff_sin_grupo_admin_no_recibe_permiso_admin(self):
        User = get_user_model()
        staff = User.objects.create_user(
            username='staff@demo.cl', email='staff@demo.cl',
            password='PasswordSegura123!', is_staff=True,
        )
        self.autenticar(staff)
        self.assertEqual(self.client.get('/api/admin/usuarios/').status_code, 403)
        self.assertEqual(self.client.post('/api/registro/', {
            'nombre_completo': 'Cuenta de prueba',
            'email': 'extra@demo.cl', 'password': 'PasswordSegura123!',
        }, format='json').status_code, 403)
        perfil = self.client.get('/api/perfil/')
        self.assertEqual(perfil.status_code, 200)
        self.assertNotIn('ADMIN', perfil.data['roles'])

        from usuarios.serializers import CustomTokenObtainPairSerializer
        token = CustomTokenObtainPairSerializer.get_token(staff)
        self.assertNotIn('ADMIN', token['roles'])

    def test_importacion_no_sobrescribe_equipo_existente(self):
        from io import StringIO
        from django.core.management import call_command

        # La primera importación crea el catálogo demo.
        call_command('importar_equipos_prueba', stdout=StringIO())
        equipo = Equipo.objects.get(codigo='XLS-0001')
        lectura_editada = Decimal(str(equipo.horometro_actual)) + Decimal('321.00')
        equipo.horometro_actual = lectura_editada
        equipo.save()

        # Reimportar no debe reiniciar las lecturas editadas por el usuario.
        call_command('importar_equipos_prueba', stdout=StringIO())
        equipo.refresh_from_db()
        self.assertEqual(Decimal(str(equipo.horometro_actual)), lectura_editada)
        self.assertEqual(Equipo.objects.filter(codigo__startswith='XLS-').count(), 394)
