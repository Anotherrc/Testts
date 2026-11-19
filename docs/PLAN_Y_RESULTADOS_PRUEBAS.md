# Plan, Protocolo y Resultados de Pruebas — Vilas Motor

Documento de aseguramiento de calidad alineado con los criterios **3.1.5.9, 3.1.5.10, 3.1.5.11, 3.1.6.12 y 3.1.6.13** de la pauta de evaluación.

---

## 1. Alcance y Cobertura del Plan de Pruebas (3.1.5.9)

El plan cubre el 100% de los módulos operativos, controles de seguridad, casos de borde y pruebas de carga/estrés sobre el catálogo completo de 394 maquinarias:

| ID | Módulo / Tipo | Escenarios cubiertos |
| --- | --- | --- |
| **PR-01** | Seguridad y Criptografía (Unit) | Hash `scrypt` con salt único, comparación `timingSafeEqual`, política de contraseñas (`>= 12` chars, rechazo numérico), distinción `access` vs `refresh` JWT |
| **PR-02** | Lógica de Dominio (Unit) | Normalización de subcategorías (`retroexcabadora`, `alza hombre`, etc.) y semáforo de alertas (`ROJO`, `AMARILLO`, `VERDE`, `GRIS`) más exceso de contrato mensual |
| **PR-03** | Autenticación, Auditoría y BD (Integración) | Login exitoso/fallido, cabeceras `helmet`, refresh token, verificación de esquema SQLite (`foreign_keys = ON`, 18 tablas e índices) y registro en `audit_logs` |
| **PR-04** | Control de Acceso RBAC (Integración) | Restricciones reales en API por rol (`TECNICO`, `PLANIFICACION`, `ADMIN`), bloqueo `403` en acciones sin permiso y paginación `/api/equipos?page=1&page_size=10` |
| **PR-05** | Equipos y Casos Borde (Integración) | Alta de equipo, rechazo de código duplicado, rechazo de horómetro regresivo, coordenadas fuera de rango, *magic bytes* inválidos al subir imagen, baja lógica (`Deshabilitada`), filtro `incluir_deshabilitados=true`, persistencia tras reinicio SQLite y restauración |
| **PR-06** | Mantenciones e Insumos (Integración) | Rechazo de comentario corto (`< 8` chars) y stock insuficiente, flujo `Programada -> En curso -> Finalizar -> Historial` y cierre directo desde taller |
| **PR-07** | Clientes y Protección SQLi (Integración) | Registro de cliente, protección contra inyección SQL (`'; DROP TABLE equipos; --`) mediante consultas parametrizadas |
| **PR-08** | Carga y Estrés (Benchmark) | 150 solicitudes HTTP concurrentes (25 workers simultáneos) alternando endpoints críticos con catálogo de 394 maquinarias |
| **PR-09** | Interfaz Visual y E2E (Playwright) | Renderizado en navegador real (1440×900), login, modo oscuro de alto contraste y 0 errores de consola |

---

## 2. Protocolo y Evidencia de Ejecución (3.1.5.10)

* **Fecha de ejecución:** 2026-11-19
* **Entorno:** Node.js `v22.23.2`, Express 5 + `node:sqlite` (WAL), React 19 + Vite 8.
* **Comandos ejecutados:**
  1. `npm test` (`tsx --test server/tests/*.test.ts`)
  2. `npm run test:load` (`tsx server/tests/load.benchmark.ts`)
  3. `npm run lint` (`eslint --config frontend/eslint.config.js frontend/src`)
  4. `npm run build` (`tsc -p frontend/tsconfig.app.json && vite build frontend`)

### Resultados de Ejecución Real

| Prueba | Resultado | Tiempo / Métrica | Estado |
| --- | --- | --- | --- |
| Pruebas unitarias (`server/tests/unit.test.ts`) | **5 / 5 aprobadas** | `~209 ms` | **APROBADO** |
| Pruebas integración HTTP/SQLite (`server/tests/api.integration.test.ts`) | **5 / 5 aprobadas** | `~717 ms` | **APROBADO** |
| Total suite `npm test` | **10 / 10 aprobadas (0 fallos)** | `1920.9 ms` | **APROBADO** |
| Benchmark carga (`npm run test:load`) | **150 / 150 HTTP 200 (0 errores)** | `445.7 ms` totales · `336.6 req/s` · `p50: 37.08 ms` · `p95: 294.39 ms` · `máx: 360.91 ms` | **APROBADO** |

---

## 3. Validación de Resultados (3.1.5.11)

* **Integridad de datos:** Confirmada persistencia real en disco SQLite tras recargar `initStore()` desde archivo temporal aislado; todas las llaves foráneas e índices operan activos (`foreignKeysEnabled: true`).
* **Seguridad:** Bloqueo efectivo de accesos no autorizados (`401`/`403`), inmunidad ante payload SQLi y rechazo de archivos con cabecera falsa.
* **Rendimiento:** `336.6 req/s` bajo 25 peticiones concurrentes sin degradación ni errores HTTP, demostrando que los índices y el modo WAL soportan carga operativa holgadamente.

---

## 4. Comparación: Resultados Esperados vs. Obtenidos y Discrepancias (3.1.6.12)

Durante el ciclo de pruebas y validación se detectaron y documentaron discrepancias reales entre el comportamiento esperado y el observado inicialmente:

| Caso / Flujo | Resultado Esperado | Resultado Obtenido Inicialmente | Causa Raíz Identificada | Resolución Aplicada |
| --- | --- | --- | --- | --- |
| Confirmar nueva mantención sin pulsar "Agregar" mecánico | Validar o crear orden mostrando error si falta algún dato | El botón "Confirmar" no producía acción visible | Error de validación oculto fuera del viewport del modal y campo `nuevoMecanico` sin incluir al enviar | Inclusión automática de `nuevoMecanico` al enviar, fecha de hoy por defecto y alerta visible dentro del modal |
| Dar de baja maquinaria y filtrarla como deshabilitada | Aparecer en el filtro **Deshabilitada** con opción de restaurar | Desaparecía del listado al usar `DELETE` | `EquiposPage` no solicitaba `incluir_deshabilitados=true` y `handleDarDeBaja` removía la tarjeta del estado | Consulta con `incluir_deshabilitados=true`, actualización en sitio de la tarjeta y acción **Restaurar** |
| Legibilidad del modo oscuro | Textos blancos/claros con contraste >= 4.5:1 | Varios títulos y textos se veían oscuros e ilegibles sobre fondo oscuro | `global.css` no sobrescribía clases `text-slate-900/950`, `text-gray-*`, `text-black` ni tarjetas `-50` | Reglas de alto contraste (`#ffffff` / `#e2e8f0`) sobre superficies oscuras, inputs, popups y siluetas |
| Auditoría en `LOGIN_OK` (detectada por prueba `PR-03`) | Registrar evento `LOGIN_OK` en `audit_logs` | Test de integración falló (`audit.data.length < 2`) | Se clonó `req` con `{ ...req, user }`, perdiendo el prototipo de Express para `req.ip` | Asignación directa `req.user = user` antes de `recordAudit(req, ...)` |
| Análisis estático ESLint | `0` errores en todo `frontend/src` | 13 errores (`set-state-in-effect`, `any`, regex) | Efectos iniciales síncronos y tipado `any` en `catch` heredados | Refactorización limpia de efectos y tipado `unknown` + `isAxiosError` |

---

## 5. Recomendaciones Basadas en Comparación de Resultados (3.1.6.13)

1. **Automatizar pruebas en CI/CD:** Integrar `npm run lint && npm run build && npm test` en un workflow de GitHub Actions en cada Pull Request para impedir regresiones en lógica, permisos o reglas de ESLint.
2. **Migrar telemetría y geovallas al backend:** Persistir las zonas dibujadas en el mapa dentro de una tabla SQLite/PostGIS (`zonas_cobertura`) en lugar de `localStorage`, permitiendo compartir geovallas entre usuarios.
3. **Paginación en el catálogo visual:** Conectar `EquiposPage` al nuevo parámetro paginado `/api/equipos?page=&page_size=` cuando la flota supere los 1.000 equipos, reduciendo el payload inicial del navegador.
4. **SMTP y alertas programadas:** Configurar variables SMTP reales para el restablecimiento de contraseñas y alertas automáticas por correo cuando un equipo entre en estado `ROJO`.
