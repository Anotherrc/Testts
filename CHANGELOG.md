# Historial de Cambios (CHANGELOG)

Registro cronológico de hitos técnicos, correcciones y mejoras implementadas en el proyecto **Vilas Motor**.

## [1.2.0] — Base de Datos SQLite 3FN, Seguridad, Pruebas y Documentación
### Agregado
* Persistencia relacional normalizada (3FN) en SQLite (`node:sqlite` en modo WAL) con 18 tablas, llaves foráneas activas (`PRAGMA foreign_keys = ON`) e índices de consulta.
* Tablas maestras normalizadas `categorias_equipo`, `subcategorias_equipo`, tablas puente `orden_mecanicos`, `orden_consumos`, `rol_permisos`, `usuario_roles`, y tabla de auditoría `audit_logs`.
* Endurecimiento de seguridad con `helmet`, `cors`, `express-rate-limit` en autenticación/recuperación, validación `zod` en login y generación CSPRNG de secreto JWT en ausencia de `.env` de desarrollo.
* Endpoints administrativos `/api/admin/auditoria` y `/api/admin/db-status`, además de paginación opcional en `/api/equipos?page=&page_size=`.
* Suite de pruebas automatizadas (`npm test` con `node:test`) y benchmark de carga concurrente (`npm run test:load`).
* Ejecutable de escritorio para Windows (`Iniciar_Vilas_Motor.bat`) con verificación de entorno, instalación automática y apertura del navegador.
* Documentación técnica completa (`README.md`, `CONTRIBUTING.md`, `docs/ARQUITECTURA_Y_BD.md`, `docs/PLAN_Y_RESULTADOS_PRUEBAS.md`, `docs/GUIA_DEFENSA.md`, `docs/INFORME_FINAL_BASE.md`).

### Corregido
* Limpieza total de los 13 errores previos de ESLint en páginas React (`0 errors, 0 warnings`).
* Corrección de script `start` multiplataforma mediante `cross-env`.

## [1.1.0] — Flujo de Mantenciones, Baja de Maquinarias y Modo Oscuro
### Agregado
* Botón **Finalizar mantenimiento** en tarjetas del taller (para órdenes abiertas y equipos en taller sin orden previa) con registro automático en **Historial**.
* Separación de **Órdenes pendientes** en dos bloques: *Ya en mantenimiento* y *Aún no están en mantenimiento* (programadas y alertas urgentes/próximas), junto con acción **Iniciar mantenimiento**.
* Opción de restaurar maquinarias dadas de baja desde catálogo y ficha de detalle.

### Corregido
* Confirmación de nuevas mantenciones sin necesidad de pulsar "Agregar" manualmente tras escribir el mecánico, con mensajes de error visibles en el modal y fecha inicial por defecto.
* Visibilidad de máquinas dadas de baja en el filtro **Deshabilitada** del catálogo.
* Contraste completo del **Modo Oscuro** con tipografía blanca (`#ffffff`) y clara de alta legibilidad en todas las vistas, modales, desplegables y mapa.

## [1.0.0] — Unificación Full-Stack Node.js / Express + React / Vite
### Cambiado
* Migración del backend REST a TypeScript/Express unificado con Vite en el puerto `3000`.
* Carga inicial determinística del catálogo de 394 maquinarias, usuarios demo por rol (`ADMIN`, `PLANIFICACION`, `TECNICO`), clientes, insumos e historial inicial.
