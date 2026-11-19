# Vilas Motor — Sistema de Gestión de Flota y Mantenimiento

Aplicación web full-stack para administrar el catálogo de maquinarias (`394` equipos iniciales), controlar horómetros y kilometrajes, gestionar órdenes de mantención preventiva/correctiva, controlar bodega de insumos, administrar clientes y arriendos, visualizar ubicaciones GPS referenciales y gestionar roles/permisos (RBAC).

> **Alcance del modo demostración:** Las coordenadas base de los equipos sin registro manual son referenciales (Arica–Iquique–Tarapacá) para visualización cartográfica; no representa telemetría en vivo de dispositivos Teltonika. El envío real de correos de recuperación requiere configurar un servidor SMTP externo.

---

## 1. Stack Tecnológico Actual

| Capa | Tecnología |
| --- | --- |
| **Runtime & Servidor** | Node.js `v22+`, TypeScript (`tsx`), Express 5 |
| **Base de datos** | SQLite (`node:sqlite` nativo en modo WAL, llaves foráneas `ON`, esquema normalizado 3FN en `backend/data/vilas_motor.db`) |
| **Seguridad** | `scrypt` + salt aleatorio (`timingSafeEqual`), JWT (`access` + `refresh`), RBAC por rol/permiso, `helmet`, `cors`, `express-rate-limit`, `zod`, `audit_logs` |
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS 4, React Router 7, Axios, Leaflet (`react-leaflet`) |
| **Pruebas** | `node:test` (unitarias e integración HTTP/SQLite) + benchmark de carga concurrente + verificación visual Playwright |

---

## 2. Requisitos Previos

* **Node.js 22.12 o posterior** (incluye `npm` y soporte nativo `node:sqlite`).
* **Sistema operativo:** Windows 10/11 (ejecutable `.bat` incluido), macOS o Linux.

Verificar versión instalada:

```bash
node --version
npm --version
```

---

## 3. Instalación y Ejecución Rápida

### Opción A — Ejecución con un clic en Windows (`.bat`)
1. Descarga o clona el repositorio.
2. Haz doble clic en **`Iniciar_Vilas_Motor.bat`** en la raíz del proyecto.
3. El script verifica Node.js/npm, instala dependencias en el primer inicio (`npm install`), levanta el servidor en el puerto `3000` y abre automáticamente `http://localhost:3000` en el navegador.

### Opción B — Terminal (Windows / macOS / Linux)
1. Instalar dependencias:
   ```bash
   npm install
   ```
2. (Opcional) Copiar `.env.example` a `.env` y definir variables personalizadas (`JWT_SECRET`, `PORT`, `DB_PATH`, `CORS_ORIGINS`).
3. Iniciar en modo desarrollo (Express + Vite integrados en el puerto `3000`):
   ```bash
   npm run dev
   ```
4. Abrir `http://localhost:3000` en el navegador.

### Compilación y Producción
```bash
npm run build
npm start
```

---

## 4. Credenciales de Demostración

| Rol | Correo / Usuario | Contraseña | Alcance principal |
| --- | --- | --- | --- |
| **ADMIN** (Superusuario) | `admin@vilasmotor.cl` | `VilasAdmin2026!` | Control total, usuarios, roles, permisos, auditoría y BD |
| **PLANIFICACION** | `planificacion@vilasmotor.cl` | `VilasPlan2026!` | Gestión de maquinarias, clientes, insumos y mantenciones |
| **TECNICO** | `tecnico@vilasmotor.cl` | `VilasTec2026!` | Consulta de maquinarias, ejecución/cierre de mantenciones y GPS |

---

## 5. Scripts Disponibles

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Inicia Express + Vite en `http://localhost:3000` |
| `npm run build` | Compila TypeScript (`frontend/tsconfig.app.json`) y genera bundle de producción en `frontend/dist` |
| `npm start` | Inicia el servidor en modo producción (`cross-env NODE_ENV=production`) |
| `npm run lint` | Ejecuta ESLint sobre `frontend/src` |
| `npm test` | Ejecuta las pruebas unitarias y de integración API + SQLite (`backend/tests/*.test.ts`) |
| `npm run test:load` | Ejecuta la prueba de carga y estrés concurrente (`150` solicitudes concurrentes) |

---

## 6. Estructura del Proyecto

```text
.
├── Iniciar_Vilas_Motor.bat         # Lanzador ejecutable para Windows
├── package.json                    # Scripts y dependencias unificadas
├── server.ts                       # Lanzador raíz que delega en backend/server.ts
├── backend/
│   ├── server.ts                   # Servidor HTTP Express + Vite/static
│   ├── app.ts                      # Fábrica Express (helmet, cors, JSON, /api)
│   ├── auth.ts                     # scrypt, validación de contraseñas, JWT y RBAC
│   ├── db.ts                       # Esquema SQLite 3FN (18 tablas, FKs, índices, WAL)
│   ├── routes.ts                   # Endpoints REST + rate limit + zod + auditoría
│   ├── store.ts                    # Hidratación, serialización y lógica de alertas
│   ├── types.ts                    # Contratos TypeScript del dominio
│   ├── data/equipos_prueba.json    # Catálogo semilla de 394 maquinarias (y vilas_motor.db)
│   └── tests/                      # Pruebas unitarias, integración y carga
├── frontend/
│   ├── index.html
│   └── src/
│       ├── api/axios.ts            # Cliente HTTP con interceptor JWT y refresh
│       ├── assets/global.css       # Estilos Tailwind + tema oscuro alto contraste
│       ├── components/             # Layout (Navbar, Sidebar) y UI reutilizable
│       ├── context/                # AuthContext y AccessibilityContext (tema oscuro)
│       ├── features/               # Servicios API por módulo (admin, auth, equipos, operaciones)
│       ├── pages/                  # Vistas del sistema
│       └── routes/                 # Rutas protegidas por sesión, rol y permiso
└── docs/                           # Documentación técnica, BD, pruebas, defensa e informe
```

---

## 7. Documentación Técnica Complementaria

* [`docs/ARQUITECTURA_Y_BD.md`](docs/ARQUITECTURA_Y_BD.md): Arquitectura, modelo relacional 3FN, diagrama DER, diccionario de datos y API.
* [`docs/PLAN_Y_RESULTADOS_PRUEBAS.md`](docs/PLAN_Y_RESULTADOS_PRUEBAS.md): Plan de pruebas, protocolo ejecutado, resultados, comparación esperado vs. obtenido y recomendaciones.
* [`docs/GUIA_DEFENSA.md`](docs/GUIA_DEFENSA.md): Preguntas técnicas frecuentes y sustentación para defensa del proyecto.
* [`docs/INFORME_FINAL_BASE.md`](docs/INFORME_FINAL_BASE.md): Borrador completo estructurado del informe final profesional.
* [`CONTRIBUTING.md`](CONTRIBUTING.md) y [`CHANGELOG.md`](CHANGELOG.md): Normas de colaboración y registro de cambios.
