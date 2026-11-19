from django.db import migrations


def crear_roles(apps, schema_editor):
    Grupo = apps.get_model('auth', 'Group')
    for nombre in ('ADMIN', 'PLANIFICACION', 'TECNICO'):
        Grupo.objects.using(schema_editor.connection.alias).get_or_create(name=nombre)


class Migration(migrations.Migration):
    dependencies = [('operaciones', '0001_initial')]
    operations = [migrations.RunPython(crear_roles, migrations.RunPython.noop)]
