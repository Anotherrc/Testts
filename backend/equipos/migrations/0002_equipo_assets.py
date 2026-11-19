from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("equipos", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="equipo",
            name="marca",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.AddField(
            model_name="equipo",
            name="modelo",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="equipo",
            name="foto_url",
            field=models.URLField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="equipo",
            name="latitud",
            field=models.FloatField(default=-20.2141),
        ),
        migrations.AddField(
            model_name="equipo",
            name="longitud",
            field=models.FloatField(default=-70.1524),
        ),
        migrations.AddField(
            model_name="historicalequipo",
            name="marca",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.AddField(
            model_name="historicalequipo",
            name="modelo",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="historicalequipo",
            name="foto_url",
            field=models.URLField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="historicalequipo",
            name="latitud",
            field=models.FloatField(default=-20.2141),
        ),
        migrations.AddField(
            model_name="historicalequipo",
            name="longitud",
            field=models.FloatField(default=-70.1524),
        ),
    ]
