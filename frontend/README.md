# Vilas Motor — Frontend (React + TypeScript + Vite)

Interfaz web para la gestión de maquinaria, horómetros, mantenciones, clientes y arriendos, inventario, GPS referencial y administración de usuarios.

> Las instrucciones de instalación completa están en el [`README.md` principal](../README.md).

## Requisitos

- **Node.js 22.12 o posterior**, o una versión compatible de Node.js 20.19+ para Vite 8.
- npm.
- Django ejecutándose en `http://localhost:8000/` para usar las funcionalidades de la API.

## Instalación (desde `frontend`)

```powershell
npm ci
```

`npm ci` usa el `package-lock.json` incluido en el repositorio para instalar dependencias. No hace falta subir ni copiar `node_modules`.

## Iniciar aplicación

```powershell
npm run dev
```

Abrir `http://localhost:5173/`. Se inicia sesión con el usuario administrador creado desde Django o con una cuenta autorizada por la administración.

## Comprobar el frontend

```powershell
npm run build
npm run lint
```

`npm run build` comprueba TypeScript y genera `dist/` para distribución. `npm run lint` ejecuta las reglas ESLint configuradas en el proyecto.

## Conexión con Django

La configuración está en `src/api/axios.ts`. En desarrollo, la dirección predeterminada de la API es `http://localhost:8000/api`; en otros entornos se puede definir `VITE_API_URL`.

Ejemplo para PowerShell antes de ejecutar `npm run dev`:

```powershell
$env:VITE_API_URL="http://localhost:8000/api"
npm run dev
```

El frontend no sustituye el control de permisos en el servidor: Django es quien autoriza las operaciones y devuelve `403` si el usuario no tiene permiso.

## Recursos de demostración

Las imágenes de respaldo están en `public/equipos/siluetas/` y representan tipos genéricos de maquinaria. Las fotografías propias subidas a Django tienen preferencia cuando están disponibles. Las ubicaciones GPS del catálogo demo no equivalen a telemetría Teltonika en tiempo real.

Los archivos `.env` con datos privados, `node_modules` y `dist` no deben subirse al repositorio.
