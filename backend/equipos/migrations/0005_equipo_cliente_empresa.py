from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('operaciones', '0001_initial'),
        ('equipos', '0004_alter_historicalequipo_foto_archivo_and_more'),
    ]
    operations = [
        migrations.AddField(
            model_name='equipo', name='cliente_empresa',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='equipos', to='operaciones.cliente'),
        ),
        migrations.AddField(
            model_name='historicalequipo', name='cliente_empresa',
            field=models.ForeignKey(blank=True, null=True, db_constraint=False, on_delete=django.db.models.deletion.DO_NOTHING, related_name='+', to='operaciones.cliente'),
        ),
    ]
