# Vilas Motor — Sistema de gestión de flota y mantenimiento

Aplicación web para registrar maquinarias, controlar horómetros y kilometrajes, gestionar mantenciones, clientes y arriendos, visualizar ubicaciones GPS y administrar usuarios con permisos por rol.

> **Alcance:** proyecto de desarrollo y demostración. Las ubicaciones del catálogo son referenciales; no se debe presentar el sistema como una integración activa con dispositivos Teltonika. El envío real de correos requiere configurar SMTP.

## Tecnologías

| Componente | Tecnología |
| --- | --- |
| Backend | Python, Django 6.1.2, Django REST Framework, Simple JWT |
| Base de datos local | SQLite |
| Frontend | React 19, TypeScript, Vite 8 y Tailwind CSS 4 |
| Autenticación y acceso | JWT, grupos de Django y permisos de Crear / Editar / Eliminar / Consultar |

## Requisitos previos

- **Python 3.12, 3.13 o 3.14**, compatible con la versión de Django declarada en `backend/requirements.txt`.
- **Node.js 22.12 o posterior**, junto con npm (o Node.js 20.19 o posterior, según la compatibilidad de Vite 8).
- Git, si se va a clonar o actualizar el repositorio.

Verificar las herramientas en PowerShell:

```powershell
py --version
node --version
npm --version
```

## Estructura

```text
VilasMotorsProject/
├── backend/
│   ├── backend/              # Configuración de Django
│   ├── usuarios/              # Autenticación, roles y permisos
│   ├── equipos/               # Equipos, horómetros, historial y catálogo demo
│   ├── operaciones/           # Operaciones, clientes y mantenciones
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── src/                  # Páginas, componentes, API y rutas
│   ├── public/equipos/       # Imágenes y siluetas referenciales
│   ├── package.json
│   └── package-lock.json
└── README.md
```

> Ejecutar los siguientes comandos desde la **raíz del repositorio**, es decir, la carpeta que contiene `backend` y `frontend`. No es necesario que esa carpeta tenga un nombre específico.

## 1. Instalar y preparar el backend (Windows / PowerShell)

**Primera instalación:**

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py inicializar_permisos_roles
.\.venv\Scripts\python.exe manage.py createsuperuser
```

- `migrate` crea o actualiza las tablas de la base SQLite local.
- `inicializar_permisos_roles` crea los grupos `ADMIN`, `PLANIFICACION` y `TECNICO` con una configuración inicial **solo si el grupo todavía no tiene permisos**. No sobrescribe los permisos previamente guardados desde la aplicación.
- `createsuperuser` crea una cuenta administrativa. Para usar el inicio de sesión del frontend, se recomienda completar el **nombre de usuario y correo** con la misma dirección de correo. La contraseña debe cumplir las reglas de Django (mínimo 12 caracteres).
- La base de datos `backend/db.sqlite3` es local y **no está incluida** en Git. Cada instalación comienza con su propia base hasta que se importen datos de demostración.

**Verificar e iniciar el backend:**

```powershell
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py runserver
```

API: `http://127.0.0.1:8000/api/`  
Administrador de Django: `http://127.0.0.1:8000/admin/`

Dejar abierta esta terminal mientras se utiliza la aplicación.

## 2. Instalar e iniciar el frontend (otra terminal)

Abrir una **segunda terminal** en la raíz del repositorio:

```powershell
cd frontend
npm ci
npm run dev
```

Abrir `http://localhost:5173/` en el navegador. Iniciar sesión con el superusuario creado en el paso anterior.

Si todavía no se tiene acceso a npm o falla `npm ci`, comprobar primero la versión de Node.js y que exista `frontend/package-lock.json`. No es necesario copiar `node_modules` desde otro equipo.

## 3. Cargar las 394 maquinarias de demostración (opcional)

Desde otra terminal en `backend`, con las migraciones ya ejecutadas:

```powershell
.\.venv\Scripts\python.exe manage.py importar_equipos_prueba
```

El comando carga las **394 filas de catálogo demo** del archivo `backend/equipos/data/equipos_prueba.json`, usando códigos internos con prefijo `XLS-`. La versión corregida **crea solo los registros faltantes y omite los existentes**, sin reemplazar horómetros, estados ni asignaciones que ya fueron modificados. No es necesario volver a ejecutarlo si la base ya tiene las 394 maquinarias.

Para verificar la cantidad:

```powershell
.\.venv\Scripts\python.exe manage.py shell -c "from equipos.models import Equipo; print('Total de equipos:', Equipo.objects.count())"
```

**Precaución:** estos datos no equivalen a una flota validada con horómetros reales o GPS en vivo. El comando `generar_mantenciones_demo` también existe, pero modifica información de prueba de los equipos; úsalo únicamente en una base nueva destinada a demostraciones y con respaldo previo.

## 4. Usuarios y permisos

- El usuario creado con `createsuperuser` puede administrar usuarios y roles.
- Los demás usuarios se crean desde **Módulo Administrador → Usuarios**, no desde un registro público.
- Los permisos de `PLANIFICACION` y `TECNICO` se configuran en **Módulo Administrador → Permisos de roles** y se aplican en el backend para los módulos habilitados.
- Los permisos de usuarios y roles quedan restringidos a la administración; los permisos de maquinarias, mantenciones y consulta GPS se verifican mediante las operaciones autorizadas.

| Rol | Configuración inicial de ejemplo |
| --- | --- |
| `ADMIN` | Administración completa; el superusuario posee permisos globales |
| `PLANIFICACION` | Crear, editar, eliminar y consultar maquinarias y mantenciones; consultar GPS |
| `TECNICO` | Consultar maquinarias; editar/consultar mantenciones; consultar GPS |

La configuración puede modificarse desde la interfaz por un administrador autorizado. **Los permisos finales dependen de lo que quede guardado en la base de datos**, no solamente del nombre del rol.

## 5. Recuperación de contraseña

Desde la pantalla de login, seleccionar **¿Olvidaste tu contraseña?**. En desarrollo, la configuración predeterminada de Django imprime el correo y el enlace de recuperación en la terminal del backend; **no se envía automáticamente a un buzón real**. El enlace caduca después de una hora.

Variables opcionales del servidor (establecerlas antes de ejecutar Django): `FRONTEND_BASE_URL`, `DJANGO_FROM_EMAIL`, `DJANGO_SMTP_HOST`, `DJANGO_SMTP_PORT`, `DJANGO_SMTP_USER`, `DJANGO_SMTP_PASSWORD` y `DJANGO_SMTP_TLS`. Nunca incluir contraseñas SMTP ni claves secretas en Git.

## 6. Pruebas y verificación

**Backend** — ejecutar desde `backend`:

```powershell
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py test -v 2
```

Las pruebas utilizan una base de datos de prueba separada de la base SQLite local del desarrollo.

**Frontend** — ejecutar desde `frontend`:

```powershell
npm run build
```

Si se necesita revisar el estilo y las reglas del frontend:

```powershell
npm run lint
```

Validaciones manuales recomendadas: iniciar sesión con distintos roles, comprobar restricciones de permisos; crear un equipo, modificar horómetro y rechazar lecturas inferiores; crear un cliente y asignar una maquinaria; gestionar una mantención y sus insumos; revisar el mapa y comprobar la recuperación de contraseña.

## 7. Uso diario (instalación ya preparada)

No hay que reinstalar dependencias ni volver a importar las maquinarias cada vez. Basta con levantar dos terminales:

**Terminal 1:**

```powershell
cd backend
.\.venv\Scripts\python.exe manage.py runserver
```

**Terminal 2:**

```powershell
cd frontend
npm run dev
```

## 8. Seguridad y límites del entorno de desarrollo

- `backend/db.sqlite3`, `.venv`, `frontend/node_modules`, archivos `.env`, fotos subidas a `backend/media` y claves personales **no deben subirse al repositorio**.
- El servidor `runserver`, SQLite y el servidor de desarrollo Vite se usan para **desarrollo y demostraciones**, no constituyen un despliegue empresarial de producción.
- El GPS del catálogo demo es referencial: la integración real con Teltonika, la recepción de telemetría, la entrega de correo SMTP y el despliegue seguro requieren configuración y pruebas adicionales.
- Para despliegues fuera de localhost configurar `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, CORS, HTTPS y las demás variables pertinentes en el entorno del servidor, nunca en archivos versionados con secretos.
