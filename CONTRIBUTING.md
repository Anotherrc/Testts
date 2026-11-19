# Guía de Colaboración — Vilas Motor

Este documento define las convenciones de trabajo en equipo, flujo de ramas, estándar de commits y checklist previo a integrar código.

## 1. Flujo de Ramas (Git Flow Simplificado)

* `main`: rama estable lista para demostración o entrega; todo cambio entra vía Pull Request validado.
* `develop`: rama de integración continua del equipo.
* `feat/<modulo>`: nuevas funcionalidades (ej. `feat/mantenciones-historial`).
* `fix/<problema>`: corrección de errores (ej. `fix/modo-oscuro-contraste`).
* `docs/<tema>`: documentación técnica, diagramas y reportes.

## 2. Convención de Commits (*Conventional Commits*)

Formato: `<tipo>(<alcance>): <descripción breve en imperativo>`

* `feat`: nueva funcionalidad para el usuario o API.
* `fix`: corrección de fallo en lógica, base de datos o interfaz.
* `security`: mejoras de autenticación, autorización o endurecimiento HTTP.
* `perf`: optimización de consultas, índices o rendimiento.
* `test`: incorporación o mejora de pruebas unitarias, integración o carga.
* `docs`: cambios en README, diagramas o protocolos.
* `chore`: configuración de entorno, scripts o dependencias.

Ejemplos:
* `feat(db): normalizar categorias y subcategorias en SQLite`
* `fix(mantenciones): permitir finalizar equipo sin orden abierta previa`
* `test(api): validar rechazo de horometro regresivo y RBAC por rol`

## 3. Checklist Obligatorio antes de Pull Request

1. `npm run lint` sin errores ni advertencias (`0 errors, 0 warnings`).
2. `npm run build` compilando TypeScript y Vite sin errores.
3. `npm test` aprobando el 100% de las pruebas unitarias y de integración.
4. Si se modifican endpoints o tablas de base de datos, actualizar [`docs/ARQUITECTURA_Y_BD.md`](docs/ARQUITECTURA_Y_BD.md) y [`CHANGELOG.md`](CHANGELOG.md).
5. No incluir archivos locales sensibles (`.env`, `data/*.db`, `media/`) ni secretos en el commit.
