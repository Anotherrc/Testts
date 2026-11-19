from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):
    dependencies = [
        ("equipos", "0002_equipo_assets"),
    ]

    operations = [
        migrations.AddField(
            model_name="equipo",
            name="foto_archivo",
            field=models.FileField(blank=True, default="", upload_to="equipos/"),
        ),
        migrations.AddField(
            model_name="equipo",
            name="zona_operacion",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="equipo",
            name="senal_movil",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="equipo",
            name="categoria",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="equipo",
            name="subcategoria",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AlterField(
            model_name="historialmantencion",
            name="fecha_intervencion",
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
        migrations.AddField(
            model_name="historicalequipo",
            name="foto_archivo",
            field=models.FileField(blank=True, db_index=True, default="", max_length=100, upload_to="equipos/"),
        ),
        migrations.AddField(
            model_name="historicalequipo",
            name="zona_operacion",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="historicalequipo",
            name="senal_movil",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="historicalequipo",
            name="categoria",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="historicalequipo",
            name="subcategoria",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
    ]
