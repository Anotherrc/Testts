from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('equipos', '0006_equipo_ubicacion_registrada')]
    operations = [
        migrations.AddIndex(model_name='equipo', index=models.Index(fields=['is_deleted', 'estado'], name='idx_equipo_activo_estado')),
    ]
