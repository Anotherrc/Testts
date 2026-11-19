# Guía de Defensa Técnica — Respuestas a Preguntas del Profesor

Material de respaldo con fundamentos técnicos directos del código implementado para responder con precisión durante la presentación.

---

### 1. ¿Cómo aseguraron la integridad y normalización de la base de datos?
* **Motor y restricciones:** Se utiliza SQLite en modo `WAL` con `PRAGMA foreign_keys = ON` y restricciones `CHECK` / `UNIQUE` en `server/db.ts`.
* **Normalización hasta 3FN:**
  * **1FN:** Eliminamos arreglos o cadenas concatenadas en tablas principales; los mecánicos de una orden viven en `orden_mecanicos` y los insumos consumidos en `orden_consumos`.
  * **2FN:** Las tablas puente (`rol_permisos`, `usuario_roles`, `orden_consumos`) dependen íntegramente de sus claves compuestas.
  * **3FN:** Se extrajeron `categorias_equipo` y `subcategorias_equipo` para evitar repetir categorías por texto en los 394+ equipos, y `orden_consumos` referencia `insumos(id)` en vez de duplicar nombre y unidad.
* **Optimización:** Se crearon **9 índices** sobre columnas de filtrado y ordenamiento frecuente (`is_deleted, estado`, `cliente_empresa_id`, `equipo_id, estado`, `fecha DESC`).

---

### 2. ¿Qué medidas de seguridad implementa la aplicación contra ataques comunes?
* **Fuerza bruta:** `express-rate-limit` sobre `/api/login` y recuperación de contraseña + auditoría de intentos fallidos en `audit_logs`.
* **Robo de contraseñas / Timing attacks:** `crypto.scryptSync` con salt aleatorio de 16 bytes por usuario y comparación en tiempo constante (`crypto.timingSafeEqual`).
* **Inyección SQL:** Todas las consultas en `server/db.ts` usan *prepared statements* parametrizados (`?`); además existe una prueba automatizada específica que envía un payload `'; DROP TABLE equipos; --` y verifica integridad total.
* **Escalada de privilegios:** Verificación en servidor mediante `requireAuth`, `requireAdmin` y `requirePermission(...)`, impidiendo que un rol `TECNICO` o `PLANIFICACION` acceda a endpoints administrativos o elimine cuentas/equipos sin permiso.
* **Subida maliciosa de archivos:** Validación real de *magic bytes* (`JPEG`, `PNG`, `WebP`) en el buffer y límite de `5 MB`, evitando confiar únicamente en la extensión del archivo.
* **Cabeceras HTTP y secretos:** Middleware `helmet` y validación de `JWT_SECRET` (sin credenciales fijas en producción).

---

### 3. ¿Cómo se controla la consistencia operativa de maquinarias e insumos?
* **Horómetros no regresivos:** El backend rechaza (`400 Bad Request`) cualquier lectura inferior al horómetro actual registrado.
* **Flujo de órdenes e inventario atómico:** Al crear una orden con consumos, se valida stock suficiente, se evita duplicar el mismo insumo en la orden, se descuenta stock y se registra trazabilidad negativa en `movimientos_insumo`.
* **Protección de estados:** No se permite dar de baja (`DELETE`) un equipo con una orden abierta ni desactivar un cliente con maquinarias activas asignadas.
* **Cierre en taller:** Al finalizar una mantención (con orden abierta o cierre directo desde taller), la máquina vuelve automáticamente a `Disponible` o `Arrendada` (si tiene cliente) y queda registrada en `historial_mantencion`.

---

### 4. ¿Cuál es el alcance real del módulo GPS y qué faltaría para producción en faena?
* **Alcance actual:** Las coordenadas iniciales de los equipos sin coordenada manual verificada son **posiciones referenciales** en el tramo Arica–Iquique–Tarapacá para demostración cartográfica; las zonas dibujadas se persisten localmente en el navegador y el campo `ubicacion_registrada` distingue coordenadas manuales de referenciales.
* **Evolución a producción:** Integrar un servicio receptor de paquetes TCP/HTTP para dispositivos GPS (p. ej. Teltonika), migrar SQLite a PostgreSQL/PostGIS para geovallas persistentes en servidor y configurar un proveedor SMTP real para envío de correos de recuperación.

---

### 5. ¿Cómo garantizaron la calidad antes de la entrega?
* Mediante compilación estricta TypeScript + Vite (`npm run build`), análisis estático ESLint con **0 errores** (`npm run lint`), **10 pruebas automatizadas** unitarias y de integración HTTP/SQLite (`npm test`), una **prueba de carga de 150 solicitudes concurrentes** (`npm run test:load`) e inspección visual en navegador real con Playwright (incluyendo el modo oscuro de alto contraste).
