import random
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from equipos.models import Equipo, HistorialMantencion


class Command(BaseCommand):
    help = "Genera historial de mantenciones realista para probar alertas y fichas."

    def handle(self, *args, **options):
        User = get_user_model()
        mecanicos = []
        for nombre in ("Carlos Muñoz", "Daniela Rojas", "Luis Araya", "Marcelo Pérez"):
            username = f"mecanico.{nombre.split()[0].lower()}"
            user, _ = User.objects.get_or_create(
                username=username,
                defaults={
                    "first_name": nombre.split()[0],
                    "last_name": nombre.split()[1],
                    "email": f"{username}@vilasmotor.demo",
                },
            )
            user.set_password("DemoMantencion123!")
            user.save(update_fields=["password"])
            mecanicos.append(user)

        creadas = 0
        random.seed(20261105)
        for equipo in Equipo.objects.all():
            if equipo.mantenciones.exists():
                continue
            cantidad = 1 + (equipo.id % 3)
            for numero in range(cantidad):
                fecha = timezone.now() - timedelta(days=90 + equipo.id % 600 - numero * 45)
                equipo.horometro_actual = max(equipo.horometro_actual, 300 + equipo.id * 4)
                equipo.meta_proxima_mant = equipo.horometro_actual + (25 if equipo.id % 7 == 0 else 180)
                equipo.horas_uso_mes = 170 if equipo.id % 11 == 0 else 60 + (equipo.id % 80)
                equipo.estado = "Mantenimiento" if equipo.id % 17 == 0 else equipo.estado
                equipo.save()
                HistorialMantencion.objects.create(
                    equipo=equipo,
                    mecanico_responsable=mecanicos[(equipo.id + numero) % len(mecanicos)],
                    fecha_intervencion=fecha,
                    horometro_al_momento=max(0, equipo.horometro_actual - 100 - numero * 50),
                    descripcion_falla_o_trabajo=random.choice([
                        "Mantención preventiva general",
                        "Cambio de aceite y filtros",
                        "Revisión de frenos y sistema hidráulico",
                        "Inspección de seguridad y lubricación",
                    ]),
                    insumos_utilizados=random.choice([
                        "Aceite hidráulico, filtro de aceite",
                        "Grasa multipropósito, filtro de aire",
                        "Pastillas de freno, limpiador industrial",
                        "Sin insumos adicionales",
                    ]),
                )
                creadas += 1

        self.stdout.write(self.style.SUCCESS(f"Historial demo creado: {creadas} mantenciones."))
