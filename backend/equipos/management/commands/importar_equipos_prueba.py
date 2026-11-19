import json
import math
import random
import unicodedata
from pathlib import Path

from django.core.management.base import BaseCommand

from equipos.models import Equipo


def normalizar_subcategoria(nombre):
    nombre = (nombre or "").strip()
    clave = unicodedata.normalize("NFKD", nombre)
    clave = "".join(caracter for caracter in clave if not unicodedata.combining(caracter))
    clave = " ".join(clave.lower().replace("-", " ").split())

    if clave.startswith("alza hombre"):
        return "Alza Hombre"
    if clave in ("retro excavadora", "retroexcavadora", "retroexcabadora"):
        return "Retroexcavadora"
    if clave.startswith("plataforma tijera"):
        return "Plataforma Tijera"
    if clave.startswith("camioneta"):
        return "Camionetas"
    if clave.startswith("camion tolva"):
        return "Camión Tolva"
    if clave.startswith("camion pluma"):
        return "Camión Pluma"
    if clave.startswith("camion aljibe"):
        return "Camión Aljibe"
    if clave.startswith("camion combustible"):
        return "Camión Combustible"
    if clave.startswith("camion lubricador"):
        return "Camión Lubricador"
    if clave.startswith("camion pantalla"):
        return "Camión Pantalla"
    if clave.startswith("camion plano"):
        return "Camión Plano"
    if clave.startswith("camion plataforma"):
        return "Camión Plataforma"
    if clave.startswith("camion rescate"):
        return "Camión Rescate"
    if clave.startswith("tracto camion"):
        return "Tracto Camión"
    if clave in ("camion", "camiones"):
        return "Camiones"
    return nombre


class Command(BaseCommand):
    help = "Importa los 394 equipos de prueba extraídos de Equipos.xlsx."

    def handle(self, *args, **options):
        fixture_path = Path(__file__).resolve().parents[2] / "data" / "equipos_prueba.json"
        equipos = json.loads(fixture_path.read_text(encoding="utf-8"))
        creados = 0
        omitidos = 0
        azar = random.Random(20261119)

        for datos_originales in equipos:
            datos = datos_originales.copy()
            codigo = datos.pop("codigo")

            # Solo insertar los que faltan: conservar horómetros, metas,
            # asignaciones, estados, GPS y borrados lógicos existentes.
            if Equipo.all_objects.filter(codigo=codigo).exists():
                omitidos += 1
                continue
            index = int(codigo.split("-")[-1])
            nombre = datos.get("nombre", "")
            if "GRUA" in nombre:
                categoria, subcategoria = "Izaje", "Grúas horquilla"
            elif "CAMIONETA" in nombre:
                categoria, subcategoria = "Transporte", "Camionetas"
            elif "CAMION TOLVA" in nombre:
                categoria, subcategoria = "Transporte", "Camión Tolva"
            elif "CAMION PLUMA" in nombre:
                categoria, subcategoria = "Transporte", "Camión Pluma"
            elif "CAMION ALJIBE" in nombre:
                categoria, subcategoria = "Transporte", "Camión Aljibe"
            elif "CAMION COMBUSTIBLE" in nombre:
                categoria, subcategoria = "Transporte", "Camión Combustible"
            elif "CAMION LUBRICADOR" in nombre:
                categoria, subcategoria = "Transporte", "Camión Lubricador"
            elif "CAMION PANTALLA" in nombre:
                categoria, subcategoria = "Transporte", "Camión Pantalla"
            elif "CAMION PLANO" in nombre:
                categoria, subcategoria = "Transporte", "Camión Plano"
            elif "CAMION PLATAFORMA" in nombre:
                categoria, subcategoria = "Transporte", "Camión Plataforma"
            elif "CAMION RESCATE" in nombre:
                categoria, subcategoria = "Transporte", "Camión Rescate"
            elif "TRACTO CAMION" in nombre:
                categoria, subcategoria = "Transporte", "Tracto Camión"
            elif "CAMION" in nombre or "TRACTO" in nombre:
                categoria, subcategoria = "Transporte", "Camiones"
            elif "LUMINARIA" in nombre or "GENERADOR" in nombre:
                categoria, subcategoria = "Energía", "Generación e iluminación"
            elif "COMPRESOR" in nombre or "SOLDADORA" in nombre:
                categoria, subcategoria = "Taller", "Equipos de apoyo"
            else:
                categoria, subcategoria = "Movimiento de tierra", nombre.title()

            # Datos de prueba repartidos entre Arica, Iquique y rutas interiores.
            tramo = index % 4
            rutas = [
                (-18.4783, -70.3126, "Arica"),
                (-19.5000, -70.2500, "Ruta 5 Arica-Iquique"),
                (-20.2141, -70.1524, "Iquique"),
                (-20.9500, -69.5000, "Interior de Tarapacá"),
            ]
            base_lat, base_lon, zona = rutas[tramo]
            unidad_medida = datos.get("unidad_medida", "HORAS")
            roll = azar.randrange(100)

            if unidad_medida == "KM":
                horometro_actual = azar.randint(5000, 48000)
                limite = azar.choice((162.0, 176.0))
            else:
                horometro_actual = azar.randint(100, 1800)
                limite = azar.choice((162.0, 176.0))

            if roll < 12:
                estado = "Mantenimiento"
                restante = azar.randint(-120, 0)
            elif roll < 20:
                estado = "Arrendada"
                restante = azar.randint(100, 600)
            elif roll < 28:
                estado = "Disponible"
                restante = azar.randint(-30, 0)
            elif roll < 46:
                estado = "Disponible"
                restante = azar.randint(10, 45)
            else:
                estado = "Disponible"
                restante = azar.randint(80, 600)

            meta_proxima_mant = horometro_actual + restante

            datos.update({
                "categoria": categoria,
                "subcategoria": normalizar_subcategoria(subcategoria),
                "zona_operacion": zona,
                "latitud": base_lat + math.sin(index) * 0.05,
                "longitud": base_lon + math.cos(index) * 0.06,
                "senal_movil": tramo in (0, 2),
                "estado": estado,
                "horometro_actual": horometro_actual,
                "meta_proxima_mant": meta_proxima_mant,
                "horas_uso_mes": round(azar.uniform(0, limite), 1),
                "limite_contrato_mes": limite,
                "encendido_gps": azar.randrange(100) < 35,
            })
            Equipo.objects.create(codigo=codigo, **datos)
            creados += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Importación terminada: {creados} creados, {omitidos} existentes omitidos."
            )
        )
