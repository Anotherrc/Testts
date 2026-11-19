from decimal import Decimal
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.core.validators
import django.utils.timezone
from django.db.models import Q


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        ('equipos', '0004_alter_historicalequipo_foto_archivo_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]
    operations = [
        migrations.CreateModel(name='Cliente', fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('nombre', models.CharField(max_length=180)),
            ('rut', models.CharField(max_length=20, unique=True, blank=True, null=True)),
            ('telefono', models.CharField(max_length=45, blank=True)),
            ('correo', models.EmailField(blank=True, max_length=254)),
            ('direccion', models.CharField(max_length=250, blank=True)),
            ('fechaCliente', models.DateField(blank=True, null=True, db_column='fecha_cliente')),
            ('categoria', models.CharField(max_length=80, blank=True)),
            ('subcategoria', models.CharField(max_length=100, blank=True)),
            ('estado', models.CharField(choices=[('Activo','Activo'),('Inactivo','Inactivo')], default='Activo', max_length=10)),
            ('creado_en', models.DateTimeField(auto_now_add=True)),
        ], options={'ordering': ['nombre', 'id']}),
        migrations.CreateModel(name='Insumo', fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('nombre', models.CharField(max_length=150)),
            ('categoria', models.CharField(blank=True, default='General', max_length=80)),
            ('stock', models.DecimalField(decimal_places=2, default=0, max_digits=12, validators=[django.core.validators.MinValueValidator(Decimal('0'))])),
            ('minimo', models.DecimalField(decimal_places=2, default=0, max_digits=12, validators=[django.core.validators.MinValueValidator(Decimal('0'))])),
            ('unidad', models.CharField(default='unidades', max_length=30)),
            ('activo', models.BooleanField(default=True)),
            ('actualizado_en', models.DateTimeField(auto_now=True)),
            ('modificado_por', models.ForeignKey(null=True, blank=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
        ], options={'ordering': ['nombre','id']}),
        migrations.CreateModel(name='OrdenMantenimiento', fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('fecha', models.DateField()),
            ('comentario', models.TextField()),
            ('estado', models.CharField(choices=[('Programada','Programada'),('En curso','En curso'),('Finalizada','Finalizada')], default='En curso', max_length=15)),
            ('creado_en', models.DateTimeField(auto_now_add=True)),
            ('finalizado_en', models.DateTimeField(blank=True, null=True)),
            ('equipo', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='ordenes_trabajo', to='equipos.equipo')),
            ('creado_por', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='ordenes_creadas', to=settings.AUTH_USER_MODEL)),
            ('finalizado_por', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='ordenes_finalizadas', to=settings.AUTH_USER_MODEL)),
        ], options={'ordering': ['-fecha','-id']}),
        migrations.CreateModel(name='OrdenMecanico', fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('nombre', models.CharField(max_length=120)),
            ('orden', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='responsables', to='operaciones.ordenmantenimiento')),
        ]),
        migrations.CreateModel(name='ConsumoInsumo', fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('cantidad', models.DecimalField(decimal_places=2, max_digits=12, validators=[django.core.validators.MinValueValidator(Decimal('0.01'))])),
            ('unidad_registrada', models.CharField(max_length=30)),
            ('insumo', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='operaciones.insumo')),
            ('orden', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='consumos', to='operaciones.ordenmantenimiento')),
        ]),
        migrations.CreateModel(name='MovimientoInsumo', fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('cantidad', models.DecimalField(decimal_places=2, max_digits=12)),
            ('motivo', models.CharField(max_length=160)),
            ('fecha', models.DateTimeField(default=django.utils.timezone.now)),
            ('insumo', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='movimientos', to='operaciones.insumo')),
            ('orden', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, to='operaciones.ordenmantenimiento')),
            ('usuario', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
        ], options={'ordering': ['-fecha','-id']}),
        migrations.AddIndex(model_name='cliente', index=models.Index(fields=['nombre'], name='idx_cliente_nombre')),
        migrations.AddIndex(model_name='insumo', index=models.Index(fields=['nombre'], name='idx_insumo_nombre')),
        migrations.AddIndex(model_name='ordenmantenimiento', index=models.Index(fields=['estado','fecha'], name='idx_orden_estado_fecha')),
        migrations.AddIndex(model_name='movimientoinsumo', index=models.Index(fields=['-fecha'], name='idx_mov_insumo_fecha')),
        migrations.AddConstraint(model_name='ordenmantenimiento', constraint=models.UniqueConstraint(fields=['equipo'], condition=~Q(estado='Finalizada'), name='unica_orden_abierta_equipo')),
        migrations.AddConstraint(model_name='ordenmecanico', constraint=models.UniqueConstraint(fields=['orden','nombre'], name='unico_responsable_orden')),
        migrations.AddConstraint(model_name='consumoinsumo', constraint=models.UniqueConstraint(fields=['orden','insumo'], name='unico_insumo_por_orden')),
    ]
