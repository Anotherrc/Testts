from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('equipos', '0005_equipo_cliente_empresa')]
    operations = [
        migrations.AddField(model_name='equipo', name='ubicacion_registrada', field=models.BooleanField(default=False, help_text='Coordenadas introducidas manualmente, no telemetría confirmada')),
        migrations.AddField(model_name='historicalequipo', name='ubicacion_registrada', field=models.BooleanField(default=False, help_text='Coordenadas introducidas manualmente, no telemetría confirmada')),
    ]
