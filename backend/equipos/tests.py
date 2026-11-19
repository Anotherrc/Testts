from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied, ValidationError
from django.test import TestCase
from django.utils import timezone

from .models import Equipo, LogTelemetriaGPS


class VilasMotorBackendTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='operador@example.com',
            email='operador@example.com',
            password='UnaPasswordSegura123!',
        )
        self.grua = Equipo.objects.create(
            codigo='GH-01',
            nombre='Grúa Horquilla',
            horometro_actual=2000.0,
            meta_proxima_mant=2050.0,
            unidad_medida='HORAS',
            horas_uso_mes=150.0,
            limite_contrato_mes=162.0,
        )

    def test_calculo_horas_restantes_y_alerta_preventiva_50hrs(self):
        self.assertEqual(self.grua.horas_restantes, 50.0)
        self.assertEqual(self.grua.estado_alerta, 'PRÓXIMO: Agendar mantenimiento')
        self.assertEqual(self.grua.color_semaforo, 'AMARILLO')

    def test_mantenimiento_vencido_semaforo_rojo(self):
        self.grua.horometro_actual = 2055.0
        self.grua.save()
        self.assertEqual(self.grua.horas_restantes, -5.0)
        self.assertEqual(self.grua.estado_alerta, 'URGENTE: Mantenimiento Vencido')
        self.assertEqual(self.grua.color_semaforo, 'ROJO')

    def test_mantenimiento_por_kilometraje_proximo_a_100km(self):
        camion = Equipo.objects.create(
            codigo='CAM-01',
            nombre='Camión',
            horometro_actual=10000.0,
            meta_proxima_mant=10100.0,
            unidad_medida='KM',
        )
        self.assertEqual(camion.color_semaforo, 'AMARILLO')

        camion.meta_proxima_mant = 10101.0
        camion.save()
        self.assertEqual(camion.color_semaforo, 'VERDE')

    def test_bloqueo_horometro_menor_al_historico(self):
        self.grua.horometro_actual = 1950.0
        with self.assertRaises(ValidationError):
            self.grua.save()

    def test_calculo_exceso_contrato_mensual(self):
        self.grua.meta_proxima_mant = 3000.0
        self.grua.horas_uso_mes = 180.0
        self.grua.save()
        self.assertEqual(self.grua.exceso_horas_contrato, 18.0)
        self.assertEqual(self.grua.color_semaforo, 'VERDE')

    def test_soft_delete_oculta_equipo_y_conserva_registro(self):
        self.grua.delete()
        self.assertFalse(Equipo.objects.filter(pk=self.grua.pk).exists())
        equipo_borrado = Equipo.all_objects.get(pk=self.grua.pk)
        self.assertTrue(equipo_borrado.is_deleted)
        self.assertEqual(equipo_borrado.estado, 'Deshabilitada')
        self.assertIsNotNone(equipo_borrado.fecha_baja)
        self.assertTrue(equipo_borrado.history.exists())

    def test_borrado_masivo_aplica_soft_delete(self):
        Equipo.objects.create(
            codigo='GH-02',
            nombre='Grúa Horquilla',
            meta_proxima_mant=100.0,
        )
        Equipo.objects.all().delete()
        self.assertEqual(Equipo.objects.count(), 0)
        self.assertEqual(Equipo.all_objects.filter(is_deleted=True).count(), 2)

    def test_restauracion_es_explicita(self):
        self.grua.delete()
        self.grua.estado = 'Disponible'
        with self.assertRaises(ValidationError):
            self.grua.save()
        self.grua.restore()
        self.assertTrue(Equipo.objects.filter(pk=self.grua.pk).exists())

    def test_estado_invalido_rechazado_por_modelo(self):
        self.grua.estado = 'FueraDeServicio'
        with self.assertRaises(ValidationError):
            self.grua.save()

    def test_inmutabilidad_logs_telemetria(self):
        log = LogTelemetriaGPS.objects.create(
            equipo=self.grua,
            timestamp_evento=timezone.now(),
            motor_encendido=True,
            horometro_reportado=2010.0,
        )
        with self.assertRaises(PermissionDenied):
            log.delete()


class ImportadorSeguroTests(TestCase):
    def test_reimportar_no_sobrescribe_maquinaria_modificada(self):
        from django.core.management import call_command

        original = Equipo.objects.create(
            codigo='XLS-0001',
            nombre='Máquina editada por el equipo',
            estado='Arrendada',
            horometro_actual=9999,
            meta_proxima_mant=10200,
            unidad_medida='HORAS',
            zona_operacion='Ubicación editada',
        )
        call_command('importar_equipos_prueba', verbosity=0)
        original.refresh_from_db()
        self.assertEqual(original.nombre, 'Máquina editada por el equipo')
        self.assertEqual(original.estado, 'Arrendada')
        self.assertEqual(original.horometro_actual, 9999)
        self.assertEqual(original.meta_proxima_mant, 10200)
        self.assertEqual(original.zona_operacion, 'Ubicación editada')
        self.assertEqual(Equipo.objects.count(), 394)

        call_command('importar_equipos_prueba', verbosity=0)
        self.assertEqual(Equipo.objects.count(), 394)
