# Informe Final — Sistema de Gestión de Flota y Mantenimiento (Vilas Motor)

> **Nota de formato (criterio 3.1.6.15):** Este documento reúne todos los capítulos técnicos exigidos en un informe profesional de proyecto con datos verificados del repositorio. Si tu asignatura entrega una portada o plantilla Word institucional específica, copia estas secciones dentro de dicha plantilla base.

---

## Portada (Completar según plantilla institucional)
* **Título del Proyecto:** Sistema Web de Gestión de Flota, Horómetros, Mantenciones y Control Operativo — Vilas Motor
* **Integrantes:** *(Completar nombres)*
* **Docente / Asignatura:** *(Completar)*
* **Fecha:** Noviembre 2026

---

## 1. Resumen Ejecutivo e Introducción
Vilas Motor requiere centralizar el control operativo de su flota de maquinaria pesada y liviana (`394` equipos catalogados), evitar vencimientos de mantención preventiva por falta de seguimiento de horómetros/kilometrajes, controlar el inventario de repuestos e insumos asociados a órdenes de trabajo y gestionar el arriendo hacia empresas clientes bajo un control de acceso por roles (RBAC).

El sistema implementado unifica un backend REST en **Node.js + Express 5 + SQLite (3FN)** y una interfaz SPA en **React 19 + TypeScript + Vite 8 + Tailwind CSS 4**, ejecutándose de forma integrada en el puerto `3000` (con lanzador automático `.bat` para Windows).

## 2. Objetivos del Proyecto
* **Objetivo General:** Desarrollar e implementar una plataforma web segura y persistente para la gestión integral de flota, mantenciones, insumos, clientes y monitoreo geográfico referencial de Vilas Motor.
* **Objetivos Específicos:**
  1. Modelar y normalizar (3FN) la base de datos relacional con integridad referencial e índices de optimización.
  2. Implementar módulos web intuitivos para catálogo de maquinarias, cálculo automático de semáforos preventivos, taller de mantenciones, stock de insumos, clientes y geolocalización.
  3. Aplicar patrones de seguridad para autenticación JWT, hash robusto de contraseñas, RBAC, limitación de tasa y auditoría.
  4. Validar calidad mediante protocolo completo de pruebas unitarias, de integración, casos borde, carga y verificación visual.

## 3. Requerimientos y Coherencia Funcional
* **Dashboard Operativo:** Indicadores en tiempo real de equipos totales, operativos, GPS encendidos, próximos (`AMARILLO`), urgentes (`ROJO`) y en taller.
* **Control de Flota y Horómetros:** Búsqueda avanzada multicriterio, rechazo de lecturas regresivas, alta con imagen validada por *magic bytes*, baja lógica (`Deshabilitada`) y restauración.
* **Gestión de Mantenciones:** Creación de órdenes *En curso* o *Programadas*, agrupación de *Órdenes pendientes* (*Ya en mantenimiento* vs. *Aún no están en mantenimiento*), inicio de órdenes programadas, descuento automático de stock y finalización directa desde taller con registro en **Historial**.
* **Insumos, Clientes y GPS:** Trazabilidad de movimientos de inventario, asignación de maquinarias a clientes activos, visualización en mapa Leaflet (modo demostración referencial) y reporte imprimible PDF.
* **Accesibilidad:** Alternancia de modo claro / modo oscuro de alto contraste persistente.

## 4. Arquitectura y Base de Datos (3FN)
*(Ver detalle completo y diagramas en [`docs/ARQUITECTURA_Y_BD.md`](ARQUITECTURA_Y_BD.md)).*
* Base de datos **SQLite en modo WAL** (`data/vilas_motor.db`) con `PRAGMA foreign_keys = ON`.
* **18 tablas normalizadas hasta 3FN** (incluyendo tablas maestras `categorias_equipo` y `subcategorias_equipo`, tablas puente `orden_mecanicos`, `orden_consumos`, `rol_permisos`, `usuario_roles`, y auditoría `audit_logs`) y **9 índices** de consulta.

## 5. Patrones de Seguridad Implementados
* Hash `scrypt` + salt de 16 bytes + comparación `timingSafeEqual`.
* JWT (`access` + `refresh`) con validación de tipo de token y secreto gestionado por entorno.
* RBAC con permisos granulares (`ADMIN`, `PLANIFICACION`, `TECNICO`).
* `helmet`, `cors`, `express-rate-limit` (mitigación fuerza bruta), validación `zod`, validación binaria de imágenes y consultas SQL parametrizadas.

## 6. Configuración del Entorno de Trabajo
* **Instalación estándar:** `npm install` + `npm run dev` (puerto `3000`).
* **Ejecutable Windows:** Doble clic en `Iniciar_Vilas_Motor.bat` (verifica Node.js, instala dependencias si faltan, levanta el servidor y abre el navegador).
* **Compilación producción:** `npm run build` y `npm start` (`cross-env`).

## 7. Protocolo de Pruebas, Comparación y Recomendaciones
*(Ver detalle completo en [`docs/PLAN_Y_RESULTADOS_PRUEBAS.md`](PLAN_Y_RESULTADOS_PRUEBAS.md)).*
* **Pruebas automatizadas (`npm test`):** `10 / 10` aprobadas (`5` unitarias + `5` integración HTTP/SQLite) en `1.92 s`.
* **Prueba de carga (`npm run test:load`):** `150` solicitudes concurrentes (25 simultáneas), `0` errores HTTP, `336.6 req/s`, latencia mediana `37.08 ms` y p95 `294.39 ms`.
* **Análisis Esperado vs. Obtenido:** Se identificaron y resolvieron 5 discrepancias reales (confirmación silenciosa de mantenciones, visibilidad de máquinas deshabilitadas, contraste en modo oscuro, pérdida de prototipo `req` en auditoría de login y limpieza de 13 reglas ESLint).
* **Recomendaciones:** CI/CD automático para pruebas, persistencia de geovallas en SQL/PostGIS, paginación progresiva en catálogo y servidor SMTP en producción.

## 8. Conclusiones
El sistema **Vilas Motor** logra resolver integralmente la trazabilidad operativa de maquinarias, alertas preventivas, taller e inventario con persistencia relacional normalizada, seguridad verificada y pruebas reproducibles listas para entorno de demostración y evolución productiva.
