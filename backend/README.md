# Vilas Motor — Backend (Django REST API)

El backend utiliza Django 6.1.2, Django REST Framework, Simple JWT y SQLite para desarrollo. Está organizado en `usuarios`, `equipos` y `operaciones`.

> Para una instalación completa de frontend y backend, consulta también el [`README.md` principal](../README.md).

## Requisitos

- Python 3.12, 3.13 o 3.14.
- PowerShell en Windows (los ejemplos usan `py` y `.venv`).

## Primera instalación (desde `backend`)

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py inicializar_permisos_roles
.\.venv\Scripts\python.exe manage.py createsuperuser
```

Con `createsuperuser`, ingresar el correo también como `username` para que coincida con el inicio de sesión del frontend. Usar una contraseña de al menos 12 caracteres.

No se necesita ejecutar `makemigrations` durante la instalación normal: las migraciones existentes forman parte del repositorio. Solo se crea una migración nueva cuando se modifican modelos y se desea versionar esos cambios.

## Cargar maquinarias de demostración (opcional)

```powershell
.\.venv\Scripts\python.exe manage.py importar_equipos_prueba
```

Este comando carga las 394 maquinarias de demostración definidas en `equipos/data/equipos_prueba.json`. La implementación actual solo crea las faltantes y **no sobrescribe** datos que ya se editaron, incluidos horómetros. No son registros GPS reales.

Existe `generar_mantenciones_demo` para generar historial ficticio, pero **modifica equipos y usuarios de ejemplo**. Utilizarlo solo con una base nueva de pruebas y un respaldo previo.

## Iniciar el servidor

```powershell
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py runserver
```

El servidor estará en `http://127.0.0.1:8000/`; API en `http://127.0.0.1:8000/api/` y admin Django en `http://127.0.0.1:8000/admin/`.

## Ejecutar pruebas

```powershell
.\.venv\Scripts\python.exe manage.py test -v 2
```

La prueba de Django se ejecuta contra una base de pruebas aislada; no requiere borrar la base local de desarrollo.

## Autenticación y permisos

- `POST /api/login/`: inicio de sesión JWT.
- `POST /api/login/refresh/`: renovación del token.
- `GET /api/perfil/`: datos de la cuenta autenticada.
- `POST /api/registro/`: **solo para administradores autorizados**; no es un registro público.
- `POST /api/contrasena/solicitar/` y `POST /api/contrasena/restablecer/`: solicitud y confirmación de recuperación de contraseña.
- Administración de usuarios, roles y permisos desde el frontend bajo la ruta `/admin/usuarios`.

El comando `inicializar_permisos_roles` prepara `ADMIN`, `PLANIFICACION` y `TECNICO` únicamente si el grupo no tiene permisos. Las API aplican los permisos de Django para crear, editar, eliminar o consultar, según el módulo.

**Recuperación de contraseña:** por defecto, el enlace se imprime en la consola del servidor Django, no se envía a un correo real. Caduca en una hora. Para SMTP configurar `FRONTEND_BASE_URL`, `DJANGO_FROM_EMAIL`, `DJANGO_SMTP_HOST`, `DJANGO_SMTP_PORT`, `DJANGO_SMTP_USER`, `DJANGO_SMTP_PASSWORD` y `DJANGO_SMTP_TLS` en el entorno del servidor.

## Seguridad y datos locales

- Nunca subir `db.sqlite3`, `.venv`, `media/`, secretos ni credenciales.
- La configuración local usa `DJANGO_DEBUG=true`; fuera de desarrollo configurar como mínimo `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=false`, `DJANGO_ALLOWED_HOSTS`, CORS y HTTPS.
- `manage.py runserver` no es un servidor de producción.
- La integración de dispositivos Teltonika y la telemetría en vivo requieren desarrollo y pruebas adicionales.
