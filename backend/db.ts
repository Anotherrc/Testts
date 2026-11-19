import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import type {
  ClienteRecord,
  EquipoRecord,
  HistorialMantencionRecord,
  InsumoRecord,
  LogTelemetriaGPSRecord,
  MovimientoInsumoRecord,
  OrdenMantenimientoRecord,
  Permiso,
  RolRecord,
  UserRecord,
} from './types.js';

export interface SeedBundle {
  permisos: Permiso[];
  roles: RolRecord[];
  users: UserRecord[];
  clientes: ClienteRecord[];
  equipos: EquipoRecord[];
  insumos: InsumoRecord[];
  movimientosInsumos: MovimientoInsumoRecord[];
  ordenes: OrdenMantenimientoRecord[];
  mantenciones: HistorialMantencionRecord[];
  telemetria: LogTelemetriaGPSRecord[];
}

export interface AuditLogRecord {
  id: number;
  usuario_id: number | null;
  usuario_email: string;
  accion: string;
  entidad: string;
  entidad_id: string | null;
  detalle: string;
  ip: string;
  fecha: string;
}

let db: DatabaseSync | null = null;
let currentDbPath = '';

export function getDb(): DatabaseSync {
  if (!db) {
    throw new Error('La base de datos SQLite aún no ha sido inicializada.');
  }
  return db;
}

export function getCurrentDbPath(): string {
  return currentDbPath;
}

function initSchema(database: DatabaseSync) {
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS permisos (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      codename TEXT NOT NULL,
      app_label TEXT NOT NULL,
      modelo TEXT NOT NULL,
      UNIQUE (app_label, codename)
    );

    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS rol_permisos (
      rol_id INTEGER NOT NULL,
      permiso_id INTEGER NOT NULL,
      PRIMARY KEY (rol_id, permiso_id),
      FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY (permiso_id) REFERENCES permisos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      is_superuser INTEGER NOT NULL DEFAULT 0 CHECK (is_superuser IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS usuario_roles (
      usuario_id INTEGER NOT NULL,
      rol_id INTEGER NOT NULL,
      PRIMARY KEY (usuario_id, rol_id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY,
      nombre TEXT NOT NULL,
      rut TEXT UNIQUE,
      telefono TEXT NOT NULL DEFAULT '',
      correo TEXT NOT NULL DEFAULT '',
      direccion TEXT NOT NULL DEFAULT '',
      fecha_cliente TEXT,
      categoria TEXT NOT NULL DEFAULT '',
      subcategoria TEXT NOT NULL DEFAULT '',
      estado TEXT NOT NULL DEFAULT 'Activo' CHECK (estado IN ('Activo', 'Inactivo')),
      creado_en TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categorias_equipo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS subcategorias_equipo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      categoria_id INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      UNIQUE (categoria_id, nombre),
      FOREIGN KEY (categoria_id) REFERENCES categorias_equipo(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS equipos (
      id INTEGER PRIMARY KEY,
      codigo TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      marca TEXT NOT NULL DEFAULT '',
      modelo TEXT NOT NULL DEFAULT '',
      foto_url TEXT NOT NULL DEFAULT '',
      foto_archivo TEXT NOT NULL DEFAULT '',
      latitud REAL NOT NULL DEFAULT -20.2141,
      longitud REAL NOT NULL DEFAULT -70.1524,
      ubicacion_registrada INTEGER NOT NULL DEFAULT 0 CHECK (ubicacion_registrada IN (0, 1)),
      zona_operacion TEXT NOT NULL DEFAULT '',
      senal_movil INTEGER NOT NULL DEFAULT 1 CHECK (senal_movil IN (0, 1)),
      subcategoria_id INTEGER,
      estado TEXT NOT NULL DEFAULT 'Disponible' CHECK (estado IN ('Disponible', 'Mantenimiento', 'Arrendada', 'Deshabilitada')),
      is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
      fecha_baja TEXT,
      horometro_actual REAL NOT NULL DEFAULT 0 CHECK (horometro_actual >= 0),
      meta_proxima_mant REAL NOT NULL DEFAULT 0 CHECK (meta_proxima_mant >= 0),
      unidad_medida TEXT NOT NULL DEFAULT 'HORAS' CHECK (unidad_medida IN ('HORAS', 'KM')),
      horas_uso_mes REAL NOT NULL DEFAULT 0 CHECK (horas_uso_mes >= 0),
      limite_contrato_mes REAL NOT NULL DEFAULT 162 CHECK (limite_contrato_mes >= 0),
      encendido_gps INTEGER NOT NULL DEFAULT 0 CHECK (encendido_gps IN (0, 1)),
      cliente_asignado INTEGER,
      cliente_empresa_id INTEGER,
      FOREIGN KEY (subcategoria_id) REFERENCES subcategorias_equipo(id) ON DELETE SET NULL,
      FOREIGN KEY (cliente_empresa_id) REFERENCES clientes(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS insumos (
      id INTEGER PRIMARY KEY,
      nombre TEXT NOT NULL,
      categoria TEXT NOT NULL DEFAULT 'General',
      stock REAL NOT NULL DEFAULT 0 CHECK (stock >= 0),
      minimo REAL NOT NULL DEFAULT 0 CHECK (minimo >= 0),
      unidad TEXT NOT NULL DEFAULT 'unidades',
      activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
      modificado_por_id INTEGER,
      actualizado_en TEXT NOT NULL,
      FOREIGN KEY (modificado_por_id) REFERENCES usuarios(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS ordenes_mantenimiento (
      id INTEGER PRIMARY KEY,
      equipo_id INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      comentario TEXT NOT NULL,
      estado TEXT NOT NULL CHECK (estado IN ('Programada', 'En curso', 'Finalizada')),
      creado_por_id INTEGER,
      finalizado_por_id INTEGER,
      creado_en TEXT NOT NULL,
      finalizado_en TEXT,
      FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE,
      FOREIGN KEY (creado_por_id) REFERENCES usuarios(id) ON DELETE SET NULL,
      FOREIGN KEY (finalizado_por_id) REFERENCES usuarios(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS orden_mecanicos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orden_id INTEGER NOT NULL,
      usuario_id INTEGER,
      nombre_mecanico TEXT NOT NULL,
      FOREIGN KEY (orden_id) REFERENCES ordenes_mantenimiento(id) ON DELETE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS orden_consumos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orden_id INTEGER NOT NULL,
      insumo_id INTEGER NOT NULL,
      cantidad REAL NOT NULL CHECK (cantidad > 0),
      UNIQUE (orden_id, insumo_id),
      FOREIGN KEY (orden_id) REFERENCES ordenes_mantenimiento(id) ON DELETE CASCADE,
      FOREIGN KEY (insumo_id) REFERENCES insumos(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS movimientos_insumo (
      id INTEGER PRIMARY KEY,
      insumo_id INTEGER NOT NULL,
      cantidad REAL NOT NULL,
      motivo TEXT NOT NULL,
      orden_id INTEGER,
      usuario_id INTEGER,
      fecha TEXT NOT NULL,
      FOREIGN KEY (insumo_id) REFERENCES insumos(id) ON DELETE CASCADE,
      FOREIGN KEY (orden_id) REFERENCES ordenes_mantenimiento(id) ON DELETE SET NULL,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS historial_mantencion (
      id INTEGER PRIMARY KEY,
      equipo_id INTEGER NOT NULL,
      mecanico_responsable_id INTEGER,
      fecha_intervencion TEXT NOT NULL,
      horometro_al_momento REAL NOT NULL DEFAULT 0,
      descripcion_falla_o_trabajo TEXT NOT NULL,
      insumos_utilizados TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE,
      FOREIGN KEY (mecanico_responsable_id) REFERENCES usuarios(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS logs_telemetria_gps (
      id INTEGER PRIMARY KEY,
      equipo_id INTEGER NOT NULL,
      timestamp_evento TEXT NOT NULL,
      motor_encendido INTEGER NOT NULL DEFAULT 0 CHECK (motor_encendido IN (0, 1)),
      horometro_reportado REAL NOT NULL DEFAULT 0,
      sincronizado_offline INTEGER NOT NULL DEFAULT 0 CHECK (sincronizado_offline IN (0, 1)),
      FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      usuario_email TEXT NOT NULL DEFAULT '',
      accion TEXT NOT NULL,
      entidad TEXT NOT NULL,
      entidad_id TEXT,
      detalle TEXT NOT NULL DEFAULT '',
      ip TEXT NOT NULL DEFAULT '',
      fecha TEXT NOT NULL,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      uid TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_equipos_estado_deleted ON equipos(is_deleted, estado);
    CREATE INDEX IF NOT EXISTS idx_equipos_cliente ON equipos(cliente_empresa_id);
    CREATE INDEX IF NOT EXISTS idx_equipos_subcategoria ON equipos(subcategoria_id);
    CREATE INDEX IF NOT EXISTS idx_ordenes_equipo_estado ON ordenes_mantenimiento(equipo_id, estado);
    CREATE INDEX IF NOT EXISTS idx_ordenes_fecha ON ordenes_mantenimiento(fecha DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_historial_equipo_fecha ON historial_mantencion(equipo_id, fecha_intervencion DESC);
    CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos_insumo(fecha DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_telemetria_equipo_ts ON logs_telemetria_gps(equipo_id, timestamp_evento DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_fecha ON audit_logs(fecha DESC);
  `);
}

function ensureSubcategoriaId(database: DatabaseSync, categoriaNombre: string, subcategoriaNombre: string): number | null {
  const cat = (categoriaNombre || 'General').trim() || 'General';
  const sub = (subcategoriaNombre || 'Sin subcategoría').trim() || 'Sin subcategoría';

  database.prepare('INSERT OR IGNORE INTO categorias_equipo (nombre) VALUES (?)').run(cat);
  const catRow = database.prepare('SELECT id FROM categorias_equipo WHERE nombre = ?').get(cat) as { id: number };

  database
    .prepare('INSERT OR IGNORE INTO subcategorias_equipo (categoria_id, nombre) VALUES (?, ?)')
    .run(catRow.id, sub);
  const subRow = database
    .prepare('SELECT id FROM subcategorias_equipo WHERE categoria_id = ? AND nombre = ?')
    .get(catRow.id, sub) as { id: number };

  return subRow.id;
}

function runTransaction(database: DatabaseSync, fn: () => void) {
  database.exec('BEGIN IMMEDIATE');
  try {
    fn();
    database.exec('COMMIT');
  } catch (err) {
    try {
      database.exec('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    throw err;
  }
}

function insertSeedBundle(database: DatabaseSync, seed: SeedBundle) {
  runTransaction(database, () => {
    const stmtPerm = database.prepare(
      'INSERT INTO permisos (id, name, codename, app_label, modelo) VALUES (?, ?, ?, ?, ?)'
    );
    for (const p of seed.permisos) {
      stmtPerm.run(p.id, p.name, p.codename, p.app_label, p.modelo);
    }

    const stmtRol = database.prepare('INSERT INTO roles (id, name) VALUES (?, ?)');
    const stmtRolPerm = database.prepare('INSERT INTO rol_permisos (rol_id, permiso_id) VALUES (?, ?)');
    for (const r of seed.roles) {
      stmtRol.run(r.id, r.name);
      for (const pid of r.permissions) {
        stmtRolPerm.run(r.id, pid);
      }
    }

    const stmtUser = database.prepare(
      'INSERT INTO usuarios (id, username, email, first_name, last_name, password_hash, is_active, is_superuser) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const stmtUserRol = database.prepare('INSERT INTO usuario_roles (usuario_id, rol_id) VALUES (?, ?)');
    for (const u of seed.users) {
      stmtUser.run(
        u.id,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.passwordHash,
        u.is_active ? 1 : 0,
        u.is_superuser ? 1 : 0
      );
      for (const gid of u.groups) {
        stmtUserRol.run(u.id, gid);
      }
    }

    const stmtCliente = database.prepare(
      'INSERT INTO clientes (id, nombre, rut, telefono, correo, direccion, fecha_cliente, categoria, subcategoria, estado, creado_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    for (const c of seed.clientes) {
      stmtCliente.run(
        c.id,
        c.nombre,
        c.rut ?? null,
        c.telefono,
        c.correo,
        c.direccion,
        c.fechaCliente ?? null,
        c.categoria,
        c.subcategoria,
        c.estado,
        c.creado_en
      );
    }

    const stmtEquipo = database.prepare(
      `INSERT INTO equipos (
        id, codigo, nombre, marca, modelo, foto_url, foto_archivo, latitud, longitud,
        ubicacion_registrada, zona_operacion, senal_movil, subcategoria_id, estado,
        is_deleted, fecha_baja, horometro_actual, meta_proxima_mant, unidad_medida,
        horas_uso_mes, limite_contrato_mes, encendido_gps, cliente_asignado, cliente_empresa_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const eq of seed.equipos) {
      const subId = ensureSubcategoriaId(database, eq.categoria, eq.subcategoria);
      stmtEquipo.run(
        eq.id,
        eq.codigo,
        eq.nombre,
        eq.marca,
        eq.modelo,
        eq.foto_url,
        eq.foto_archivo,
        eq.latitud,
        eq.longitud,
        eq.ubicacion_registrada ? 1 : 0,
        eq.zona_operacion,
        eq.senal_movil ? 1 : 0,
        subId,
        eq.estado,
        eq.is_deleted ? 1 : 0,
        eq.fecha_baja ?? null,
        eq.horometro_actual,
        eq.meta_proxima_mant,
        eq.unidad_medida,
        eq.horas_uso_mes,
        eq.limite_contrato_mes,
        eq.encendido_gps ? 1 : 0,
        eq.cliente_asignado ?? null,
        eq.cliente_empresa ?? null
      );
    }

    const stmtInsumo = database.prepare(
      'INSERT INTO insumos (id, nombre, categoria, stock, minimo, unidad, activo, modificado_por_id, actualizado_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    for (const i of seed.insumos) {
      stmtInsumo.run(
        i.id,
        i.nombre,
        i.categoria,
        i.stock,
        i.minimo,
        i.unidad,
        i.activo ? 1 : 0,
        i.modificado_por ?? null,
        i.actualizado_en
      );
    }

    const stmtOrden = database.prepare(
      'INSERT INTO ordenes_mantenimiento (id, equipo_id, fecha, comentario, estado, creado_por_id, finalizado_por_id, creado_en, finalizado_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const stmtOrdenMec = database.prepare(
      'INSERT INTO orden_mecanicos (orden_id, usuario_id, nombre_mecanico) VALUES (?, ?, ?)'
    );
    const stmtOrdenConsumo = database.prepare(
      'INSERT INTO orden_consumos (orden_id, insumo_id, cantidad) VALUES (?, ?, ?)'
    );

    const findUserByName = (name: string): number | null => {
      const lower = name.trim().toLowerCase();
      const found = seed.users.find(
        (u) => `${u.first_name} ${u.last_name}`.trim().toLowerCase() === lower || u.username.toLowerCase() === lower
      );
      return found ? found.id : null;
    };

    for (const o of seed.ordenes) {
      stmtOrden.run(
        o.id,
        o.equipoId,
        o.fecha,
        o.comentario,
        o.estado,
        o.creadoPorId ?? null,
        o.finalizadoPorId ?? null,
        o.creado_en,
        o.finalizado_en ?? null
      );
      for (const mec of o.mecanicos) {
        stmtOrdenMec.run(o.id, findUserByName(mec), mec);
      }
      for (const c of o.consumos) {
        stmtOrdenConsumo.run(o.id, c.insumoId, c.cantidad);
      }
    }

    const stmtMov = database.prepare(
      'INSERT INTO movimientos_insumo (id, insumo_id, cantidad, motivo, orden_id, usuario_id, fecha) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    for (const m of seed.movimientosInsumos) {
      stmtMov.run(m.id, m.insumo, m.cantidad, m.motivo, m.orden ?? null, m.usuario ?? null, m.fecha);
    }

    const stmtMant = database.prepare(
      'INSERT INTO historial_mantencion (id, equipo_id, mecanico_responsable_id, fecha_intervencion, horometro_al_momento, descripcion_falla_o_trabajo, insumos_utilizados) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    for (const m of seed.mantenciones) {
      stmtMant.run(
        m.id,
        m.equipo,
        m.mecanico_responsable ?? null,
        m.fecha_intervencion,
        m.horometro_al_momento,
        m.descripcion_falla_o_trabajo,
        m.insumos_utilizados
      );
    }

    const stmtTel = database.prepare(
      'INSERT INTO logs_telemetria_gps (id, equipo_id, timestamp_evento, motor_encendido, horometro_reportado, sincronizado_offline) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const t of seed.telemetria) {
      stmtTel.run(
        t.id,
        t.equipo,
        t.timestamp_evento,
        t.motor_encendido ? 1 : 0,
        t.horometro_reportado,
        t.sincronizado_offline ? 1 : 0
      );
    }
  });
}

export function loadHydratedData(database: DatabaseSync) {
  const permisos = database
    .prepare('SELECT id, name, codename, app_label, modelo FROM permisos ORDER BY id ASC')
    .all() as unknown as Permiso[];

  const rolRows = database.prepare('SELECT id, name FROM roles ORDER BY id ASC').all() as Array<{
    id: number;
    name: string;
  }>;
  const rolPermRows = database.prepare('SELECT rol_id, permiso_id FROM rol_permisos').all() as Array<{
    rol_id: number;
    permiso_id: number;
  }>;
  const roles: RolRecord[] = rolRows.map((r) => ({
    id: r.id,
    name: r.name,
    permissions: rolPermRows.filter((rp) => rp.rol_id === r.id).map((rp) => rp.permiso_id),
  }));

  const userRows = database
    .prepare(
      'SELECT id, username, email, first_name, last_name, password_hash, is_active, is_superuser FROM usuarios ORDER BY id ASC'
    )
    .all() as Array<{
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    password_hash: string;
    is_active: number;
    is_superuser: number;
  }>;
  const userRoleRows = database.prepare('SELECT usuario_id, rol_id FROM usuario_roles').all() as Array<{
    usuario_id: number;
    rol_id: number;
  }>;
  const users: UserRecord[] = userRows.map((u) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    first_name: u.first_name,
    last_name: u.last_name,
    passwordHash: u.password_hash,
    is_active: Boolean(u.is_active),
    is_superuser: Boolean(u.is_superuser),
    groups: userRoleRows.filter((ur) => ur.usuario_id === u.id).map((ur) => ur.rol_id),
  }));

  const clienteRows = database
    .prepare(
      'SELECT id, nombre, rut, telefono, correo, direccion, fecha_cliente, categoria, subcategoria, estado, creado_en FROM clientes ORDER BY id ASC'
    )
    .all() as Array<{
    id: number;
    nombre: string;
    rut: string | null;
    telefono: string;
    correo: string;
    direccion: string;
    fecha_cliente: string | null;
    categoria: string;
    subcategoria: string;
    estado: 'Activo' | 'Inactivo';
    creado_en: string;
  }>;
  const clientes: ClienteRecord[] = clienteRows.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    rut: c.rut,
    telefono: c.telefono,
    correo: c.correo,
    direccion: c.direccion,
    fechaCliente: c.fecha_cliente,
    categoria: c.categoria,
    subcategoria: c.subcategoria,
    estado: c.estado,
    creado_en: c.creado_en,
  }));

  const equipoRows = database
    .prepare(
      `SELECT e.*, COALESCE(c.nombre, '') AS categoria_nombre, COALESCE(s.nombre, '') AS subcategoria_nombre
       FROM equipos e
       LEFT JOIN subcategorias_equipo s ON s.id = e.subcategoria_id
       LEFT JOIN categorias_equipo c ON c.id = s.categoria_id
       ORDER BY e.id ASC`
    )
    .all() as Array<{
    id: number;
    codigo: string;
    nombre: string;
    marca: string;
    modelo: string;
    foto_url: string;
    foto_archivo: string;
    latitud: number;
    longitud: number;
    ubicacion_registrada: number;
    zona_operacion: string;
    senal_movil: number;
    categoria_nombre: string;
    subcategoria_nombre: string;
    estado: EquipoRecord['estado'];
    is_deleted: number;
    fecha_baja: string | null;
    horometro_actual: number;
    meta_proxima_mant: number;
    unidad_medida: 'HORAS' | 'KM';
    horas_uso_mes: number;
    limite_contrato_mes: number;
    encendido_gps: number;
    cliente_asignado: number | null;
    cliente_empresa_id: number | null;
  }>;
  const equipos: EquipoRecord[] = equipoRows.map((e) => ({
    id: e.id,
    codigo: e.codigo,
    nombre: e.nombre,
    marca: e.marca,
    modelo: e.modelo,
    foto_url: e.foto_url,
    foto_archivo: e.foto_archivo,
    latitud: e.latitud,
    longitud: e.longitud,
    ubicacion_registrada: Boolean(e.ubicacion_registrada),
    zona_operacion: e.zona_operacion,
    senal_movil: Boolean(e.senal_movil),
    categoria: e.categoria_nombre,
    subcategoria: e.subcategoria_nombre,
    estado: e.estado,
    is_deleted: Boolean(e.is_deleted),
    fecha_baja: e.fecha_baja,
    horometro_actual: e.horometro_actual,
    meta_proxima_mant: e.meta_proxima_mant,
    unidad_medida: e.unidad_medida,
    horas_uso_mes: e.horas_uso_mes,
    limite_contrato_mes: e.limite_contrato_mes,
    encendido_gps: Boolean(e.encendido_gps),
    cliente_asignado: e.cliente_asignado,
    cliente_empresa: e.cliente_empresa_id,
  }));

  const insumoRows = database
    .prepare(
      'SELECT id, nombre, categoria, stock, minimo, unidad, activo, modificado_por_id, actualizado_en FROM insumos ORDER BY id ASC'
    )
    .all() as Array<{
    id: number;
    nombre: string;
    categoria: string;
    stock: number;
    minimo: number;
    unidad: string;
    activo: number;
    modificado_por_id: number | null;
    actualizado_en: string;
  }>;
  const insumos: InsumoRecord[] = insumoRows.map((i) => ({
    id: i.id,
    nombre: i.nombre,
    categoria: i.categoria,
    stock: i.stock,
    minimo: i.minimo,
    unidad: i.unidad,
    activo: Boolean(i.activo),
    modificado_por: i.modificado_por_id,
    actualizado_en: i.actualizado_en,
  }));

  const ordenRows = database
    .prepare(
      'SELECT id, equipo_id, fecha, comentario, estado, creado_por_id, finalizado_por_id, creado_en, finalizado_en FROM ordenes_mantenimiento ORDER BY fecha DESC, id DESC'
    )
    .all() as Array<{
    id: number;
    equipo_id: number;
    fecha: string;
    comentario: string;
    estado: 'Programada' | 'En curso' | 'Finalizada';
    creado_por_id: number | null;
    finalizado_por_id: number | null;
    creado_en: string;
    finalizado_en: string | null;
  }>;
  const mecRows = database
    .prepare('SELECT orden_id, nombre_mecanico FROM orden_mecanicos ORDER BY id ASC')
    .all() as Array<{ orden_id: number; nombre_mecanico: string }>;
  const consumoRows = database
    .prepare(
      `SELECT oc.orden_id, oc.insumo_id, oc.cantidad, i.nombre AS insumo_nombre, i.unidad AS insumo_unidad
       FROM orden_consumos oc
       JOIN insumos i ON i.id = oc.insumo_id
       ORDER BY oc.id ASC`
    )
    .all() as Array<{
    orden_id: number;
    insumo_id: number;
    cantidad: number;
    insumo_nombre: string;
    insumo_unidad: string;
  }>;
  const ordenes: OrdenMantenimientoRecord[] = ordenRows.map((o) => ({
    id: o.id,
    equipoId: o.equipo_id,
    fecha: o.fecha,
    comentario: o.comentario,
    estado: o.estado,
    mecanicos: mecRows.filter((m) => m.orden_id === o.id).map((m) => m.nombre_mecanico),
    consumos: consumoRows
      .filter((c) => c.orden_id === o.id)
      .map((c) => ({
        insumoId: c.insumo_id,
        insumoNombre: c.insumo_nombre,
        cantidad: c.cantidad,
        unidad: c.insumo_unidad,
      })),
    creadoPorId: o.creado_por_id,
    finalizadoPorId: o.finalizado_por_id,
    creado_en: o.creado_en,
    finalizado_en: o.finalizado_en,
  }));

  const movRows = database
    .prepare('SELECT id, insumo_id, cantidad, motivo, orden_id, usuario_id, fecha FROM movimientos_insumo ORDER BY fecha DESC, id DESC')
    .all() as Array<{
    id: number;
    insumo_id: number;
    cantidad: number;
    motivo: string;
    orden_id: number | null;
    usuario_id: number | null;
    fecha: string;
  }>;
  const movimientosInsumos: MovimientoInsumoRecord[] = movRows.map((m) => ({
    id: m.id,
    insumo: m.insumo_id,
    cantidad: m.cantidad,
    motivo: m.motivo,
    orden: m.orden_id,
    usuario: m.usuario_id,
    fecha: m.fecha,
  }));

  const mantRows = database
    .prepare(
      'SELECT id, equipo_id, mecanico_responsable_id, fecha_intervencion, horometro_al_momento, descripcion_falla_o_trabajo, insumos_utilizados FROM historial_mantencion ORDER BY fecha_intervencion DESC, id DESC'
    )
    .all() as Array<{
    id: number;
    equipo_id: number;
    mecanico_responsable_id: number | null;
    fecha_intervencion: string;
    horometro_al_momento: number;
    descripcion_falla_o_trabajo: string;
    insumos_utilizados: string;
  }>;
  const mantenciones: HistorialMantencionRecord[] = mantRows.map((m) => ({
    id: m.id,
    equipo: m.equipo_id,
    mecanico_responsable: m.mecanico_responsable_id,
    fecha_intervencion: m.fecha_intervencion,
    horometro_al_momento: m.horometro_al_momento,
    descripcion_falla_o_trabajo: m.descripcion_falla_o_trabajo,
    insumos_utilizados: m.insumos_utilizados,
  }));

  const telRows = database
    .prepare(
      'SELECT id, equipo_id, timestamp_evento, motor_encendido, horometro_reportado, sincronizado_offline FROM logs_telemetria_gps ORDER BY timestamp_evento DESC, id DESC'
    )
    .all() as Array<{
    id: number;
    equipo_id: number;
    timestamp_evento: string;
    motor_encendido: number;
    horometro_reportado: number;
    sincronizado_offline: number;
  }>;
  const telemetria: LogTelemetriaGPSRecord[] = telRows.map((t) => ({
    id: t.id,
    equipo: t.equipo_id,
    timestamp_evento: t.timestamp_evento,
    motor_encendido: Boolean(t.motor_encendido),
    horometro_reportado: t.horometro_reportado,
    sincronizado_offline: Boolean(t.sincronizado_offline),
  }));

  const resetRows = database
    .prepare('SELECT token, user_id, uid, expires_at FROM password_reset_tokens')
    .all() as Array<{ token: string; user_id: number; uid: string; expires_at: number }>;
  const resetTokens = new Map<string, { userId: number; uid: string; expiresAt: number }>();
  for (const r of resetRows) {
    resetTokens.set(r.token, { userId: r.user_id, uid: r.uid, expiresAt: r.expires_at });
  }

  return {
    permisos,
    roles,
    users,
    clientes,
    equipos,
    insumos,
    ordenes,
    movimientosInsumos,
    mantenciones,
    telemetria,
    resetTokens,
  };
}

export function bootstrapDatabase(seed: SeedBundle, customDbPath?: string) {
  const targetPath = customDbPath || process.env.DB_PATH || path.resolve(__dirname, 'data', 'vilas_motor.db');
  if (db) {
    try {
      db.close();
    } catch {
      // ignore close errors
    }
    db = null;
  }

  if (targetPath !== ':memory:') {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  }
  currentDbPath = targetPath;
  db = new DatabaseSync(targetPath);
  initSchema(db);

  const countRow = db.prepare('SELECT COUNT(*) AS count FROM permisos').get() as { count: number };
  if (countRow.count === 0) {
    insertSeedBundle(db, seed);
  }

  return loadHydratedData(db);
}

export function dbUpsertRole(rol: RolRecord) {
  const database = getDb();
  runTransaction(database, () => {
    database
      .prepare('INSERT INTO roles (id, name) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name')
      .run(rol.id, rol.name);
    database.prepare('DELETE FROM rol_permisos WHERE rol_id = ?').run(rol.id);
    const stmt = database.prepare('INSERT OR IGNORE INTO rol_permisos (rol_id, permiso_id) VALUES (?, ?)');
    for (const pid of rol.permissions) {
      stmt.run(rol.id, pid);
    }
  });
}

export function dbDeleteRole(id: number) {
  const database = getDb();
  database.prepare('DELETE FROM roles WHERE id = ?').run(id);
}

export function dbUpsertUser(user: UserRecord) {
  const database = getDb();
  runTransaction(database, () => {
    database
      .prepare(
        `INSERT INTO usuarios (id, username, email, first_name, last_name, password_hash, is_active, is_superuser)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           username = excluded.username,
           email = excluded.email,
           first_name = excluded.first_name,
           last_name = excluded.last_name,
           password_hash = excluded.password_hash,
           is_active = excluded.is_active,
           is_superuser = excluded.is_superuser`
      )
      .run(
        user.id,
        user.username,
        user.email,
        user.first_name,
        user.last_name,
        user.passwordHash,
        user.is_active ? 1 : 0,
        user.is_superuser ? 1 : 0
      );
    database.prepare('DELETE FROM usuario_roles WHERE usuario_id = ?').run(user.id);
    const stmt = database.prepare('INSERT OR IGNORE INTO usuario_roles (usuario_id, rol_id) VALUES (?, ?)');
    for (const gid of user.groups) {
      stmt.run(user.id, gid);
    }
  });
}

export function dbDeleteUser(id: number) {
  const database = getDb();
  database.prepare('DELETE FROM usuarios WHERE id = ?').run(id);
}

export function dbUpsertEquipo(eq: EquipoRecord) {
  const database = getDb();
  runTransaction(database, () => {
    const subId = ensureSubcategoriaId(database, eq.categoria, eq.subcategoria);
    database
      .prepare(
        `INSERT INTO equipos (
          id, codigo, nombre, marca, modelo, foto_url, foto_archivo, latitud, longitud,
          ubicacion_registrada, zona_operacion, senal_movil, subcategoria_id, estado,
          is_deleted, fecha_baja, horometro_actual, meta_proxima_mant, unidad_medida,
          horas_uso_mes, limite_contrato_mes, encendido_gps, cliente_asignado, cliente_empresa_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          codigo = excluded.codigo,
          nombre = excluded.nombre,
          marca = excluded.marca,
          modelo = excluded.modelo,
          foto_url = excluded.foto_url,
          foto_archivo = excluded.foto_archivo,
          latitud = excluded.latitud,
          longitud = excluded.longitud,
          ubicacion_registrada = excluded.ubicacion_registrada,
          zona_operacion = excluded.zona_operacion,
          senal_movil = excluded.senal_movil,
          subcategoria_id = excluded.subcategoria_id,
          estado = excluded.estado,
          is_deleted = excluded.is_deleted,
          fecha_baja = excluded.fecha_baja,
          horometro_actual = excluded.horometro_actual,
          meta_proxima_mant = excluded.meta_proxima_mant,
          unidad_medida = excluded.unidad_medida,
          horas_uso_mes = excluded.horas_uso_mes,
          limite_contrato_mes = excluded.limite_contrato_mes,
          encendido_gps = excluded.encendido_gps,
          cliente_asignado = excluded.cliente_asignado,
          cliente_empresa_id = excluded.cliente_empresa_id`
      )
      .run(
        eq.id,
        eq.codigo,
        eq.nombre,
        eq.marca,
        eq.modelo,
        eq.foto_url,
        eq.foto_archivo,
        eq.latitud,
        eq.longitud,
        eq.ubicacion_registrada ? 1 : 0,
        eq.zona_operacion,
        eq.senal_movil ? 1 : 0,
        subId,
        eq.estado,
        eq.is_deleted ? 1 : 0,
        eq.fecha_baja ?? null,
        eq.horometro_actual,
        eq.meta_proxima_mant,
        eq.unidad_medida,
        eq.horas_uso_mes,
        eq.limite_contrato_mes,
        eq.encendido_gps ? 1 : 0,
        eq.cliente_asignado ?? null,
        eq.cliente_empresa ?? null
      );
  });
}

export function dbUpsertCliente(c: ClienteRecord) {
  const database = getDb();
  database
    .prepare(
      `INSERT INTO clientes (id, nombre, rut, telefono, correo, direccion, fecha_cliente, categoria, subcategoria, estado, creado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         nombre = excluded.nombre,
         rut = excluded.rut,
         telefono = excluded.telefono,
         correo = excluded.correo,
         direccion = excluded.direccion,
         fecha_cliente = excluded.fecha_cliente,
         categoria = excluded.categoria,
         subcategoria = excluded.subcategoria,
         estado = excluded.estado`
    )
    .run(
      c.id,
      c.nombre,
      c.rut ?? null,
      c.telefono,
      c.correo,
      c.direccion,
      c.fechaCliente ?? null,
      c.categoria,
      c.subcategoria,
      c.estado,
      c.creado_en
    );
}

export function dbUpsertInsumo(i: InsumoRecord) {
  const database = getDb();
  database
    .prepare(
      `INSERT INTO insumos (id, nombre, categoria, stock, minimo, unidad, activo, modificado_por_id, actualizado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         nombre = excluded.nombre,
         categoria = excluded.categoria,
         stock = excluded.stock,
         minimo = excluded.minimo,
         unidad = excluded.unidad,
         activo = excluded.activo,
         modificado_por_id = excluded.modificado_por_id,
         actualizado_en = excluded.actualizado_en`
    )
    .run(
      i.id,
      i.nombre,
      i.categoria,
      i.stock,
      i.minimo,
      i.unidad,
      i.activo ? 1 : 0,
      i.modificado_por ?? null,
      i.actualizado_en
    );
}

export function dbInsertMovimiento(m: MovimientoInsumoRecord) {
  const database = getDb();
  database
    .prepare(
      'INSERT OR REPLACE INTO movimientos_insumo (id, insumo_id, cantidad, motivo, orden_id, usuario_id, fecha) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(m.id, m.insumo, m.cantidad, m.motivo, m.orden ?? null, m.usuario ?? null, m.fecha);
}

export function dbUpsertOrden(o: OrdenMantenimientoRecord, users: UserRecord[]) {
  const database = getDb();
  runTransaction(database, () => {
    database
      .prepare(
        `INSERT INTO ordenes_mantenimiento (id, equipo_id, fecha, comentario, estado, creado_por_id, finalizado_por_id, creado_en, finalizado_en)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           equipo_id = excluded.equipo_id,
           fecha = excluded.fecha,
           comentario = excluded.comentario,
           estado = excluded.estado,
           creado_por_id = excluded.creado_por_id,
           finalizado_por_id = excluded.finalizado_por_id,
           creado_en = excluded.creado_en,
           finalizado_en = excluded.finalizado_en`
      )
      .run(
        o.id,
        o.equipoId,
        o.fecha,
        o.comentario,
        o.estado,
        o.creadoPorId ?? null,
        o.finalizadoPorId ?? null,
        o.creado_en,
        o.finalizado_en ?? null
      );

    database.prepare('DELETE FROM orden_mecanicos WHERE orden_id = ?').run(o.id);
    const stmtMec = database.prepare(
      'INSERT INTO orden_mecanicos (orden_id, usuario_id, nombre_mecanico) VALUES (?, ?, ?)'
    );
    for (const mec of o.mecanicos) {
      const lower = mec.trim().toLowerCase();
      const matched = users.find(
        (u) => `${u.first_name} ${u.last_name}`.trim().toLowerCase() === lower || u.username.toLowerCase() === lower
      );
      stmtMec.run(o.id, matched ? matched.id : null, mec);
    }

    database.prepare('DELETE FROM orden_consumos WHERE orden_id = ?').run(o.id);
    const stmtConsumo = database.prepare(
      'INSERT INTO orden_consumos (orden_id, insumo_id, cantidad) VALUES (?, ?, ?)'
    );
    for (const c of o.consumos) {
      stmtConsumo.run(o.id, c.insumoId, c.cantidad);
    }
  });
}

export function dbInsertMantencion(m: HistorialMantencionRecord) {
  const database = getDb();
  database
    .prepare(
      'INSERT OR REPLACE INTO historial_mantencion (id, equipo_id, mecanico_responsable_id, fecha_intervencion, horometro_al_momento, descripcion_falla_o_trabajo, insumos_utilizados) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      m.id,
      m.equipo,
      m.mecanico_responsable ?? null,
      m.fecha_intervencion,
      m.horometro_al_momento,
      m.descripcion_falla_o_trabajo,
      m.insumos_utilizados
    );
}

export function dbSaveResetToken(token: string, userId: number, uid: string, expiresAt: number) {
  const database = getDb();
  database
    .prepare(
      'INSERT OR REPLACE INTO password_reset_tokens (token, user_id, uid, expires_at) VALUES (?, ?, ?, ?)'
    )
    .run(token, userId, uid, expiresAt);
}

export function dbDeleteResetToken(token: string) {
  const database = getDb();
  database.prepare('DELETE FROM password_reset_tokens WHERE token = ?').run(token);
}

export function dbInsertAuditLog(entry: Omit<AuditLogRecord, 'id' | 'fecha'>) {
  const database = getDb();
  database
    .prepare(
      'INSERT INTO audit_logs (usuario_id, usuario_email, accion, entidad, entidad_id, detalle, ip, fecha) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      entry.usuario_id ?? null,
      entry.usuario_email,
      entry.accion,
      entry.entidad,
      entry.entidad_id ?? null,
      entry.detalle,
      entry.ip,
      new Date().toISOString()
    );
}

export function dbListAuditLogs(limit = 100): AuditLogRecord[] {
  const database = getDb();
  return database
    .prepare('SELECT id, usuario_id, usuario_email, accion, entidad, entidad_id, detalle, ip, fecha FROM audit_logs ORDER BY id DESC LIMIT ?')
    .all(limit) as unknown as AuditLogRecord[];
}

export function dbGetDatabaseStats() {
  const database = getDb();
  const tables = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as Array<{ name: string }>;
  const indexes = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as Array<{ name: string }>;
  const fkEnabled = database.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number };

  return {
    path: currentDbPath,
    foreignKeysEnabled: Boolean(fkEnabled?.foreign_keys),
    tables: tables.map((t) => t.name),
    indexes: indexes.map((i) => i.name),
  };
}
