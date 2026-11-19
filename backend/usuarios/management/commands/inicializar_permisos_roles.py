"""Asignar configuración base solo a roles sin permisos. Nunca sobrescribe casillas ya guardadas."""
from django.contrib.auth.models import Group, Permission
from django.core.management.base import BaseCommand


BASICOS = {
    'ADMIN': {
        'auth': {'user': ['add','change','delete','view'], 'group': ['add','change','delete','view']},
        'equipos': {
            'equipo': ['add','change','delete','view'],
            'historialmantencion': ['add','change','delete','view'],
            'logtelemetriagps': ['view'],
        },
    },
    'PLANIFICACION': {
        'equipos': {
            'equipo': ['add','change','delete','view'],
            'historialmantencion': ['add','change','delete','view'],
            'logtelemetriagps': ['view'],
        },
    },
    'TECNICO': {
        'equipos': {
            'equipo': ['view'],
            'historialmantencion': ['view', 'change'],
            'logtelemetriagps': ['view'],
        },
    },
}


class Command(BaseCommand):
    help = 'Inicializa permisos de ADMIN/PLANIFICACION/TECNICO si el rol no tiene permisos; no sobrescribe cambios manuales.'

    def handle(self, *args, **kwargs):
        for nombre, apps in BASICOS.items():
            grupo, _ = Group.objects.get_or_create(name=nombre)
            if grupo.permissions.exists():
                self.stdout.write(f'{nombre}: ya configurado; no se cambió.')
                continue
            permisos = []
            for app_label, models in apps.items():
                for model_name, verbs in models.items():
                    for verb in verbs:
                        codename = f'{verb}_{model_name}'
                        permiso = Permission.objects.filter(
                            content_type__app_label=app_label,
                            content_type__model=model_name,
                            codename=codename,
                        ).first()
                        if permiso is not None:
                            permisos.append(permiso)
            grupo.permissions.set(permisos)
            self.stdout.write(self.style.SUCCESS(f'{nombre}: {len(permisos)} permisos inicializados.'))
