import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { z } from 'zod';
import {
  generateTokens,
  hashPassword,
  requireAdmin,
  requireAuth,
  requireOperacionesPermission,
  requirePermission,
  userHasPermission,
  validatePasswordStrength,
  verifyPassword,
  verifyRefreshToken,
  type AuthRequest,
} from './auth.js';
import {
  dbDeleteResetToken,
  dbDeleteRole,
  dbDeleteUser,
  dbGetDatabaseStats,
  dbInsertAuditLog,
  dbInsertMantencion,
  dbInsertMovimiento,
  dbListAuditLogs,
  dbSaveResetToken,
  dbUpsertCliente,
  dbUpsertEquipo,
  dbUpsertInsumo,
  dbUpsertOrden,
  dbUpsertRole,
  dbUpsertUser,
} from './db.js';
import {
  getUserPermissions,
  getUserRoles,
  serializeCliente,
  serializeEquipo,
  serializeInsumo,
  serializeMantencion,
  serializeMovimiento,
  serializeOrden,
  serializeUserAdmin,
  store,
} from './store.js';
import type { EquipoRecord } from './types.js';

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Ingresa usuario o correo.'),
  password: z.string().min(1, 'Ingresa tu contraseña.'),
});

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || (process.env.NODE_ENV === 'test' ? 500 : 30)),
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: 'Demasiados intentos de autenticación. Intenta nuevamente en unos minutos.' },
});

function getClientIp(req: import('express').Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function recordAudit(
  req: AuthRequest,
  accion: string,
  entidad: string,
  entidadId: string | number | null,
  detalle: string,
  overrideEmail?: string
) {
  try {
    dbInsertAuditLog({
      usuario_id: req.user?.id ?? null,
      usuario_email: overrideEmail || req.user?.email || 'anonimo',
      accion,
      entidad,
      entidad_id: entidadId !== null && entidadId !== undefined ? String(entidadId) : null,
      detalle,
      ip: getClientIp(req),
    });
  } catch {
    // Audit logging should never block primary business flow if DB closes during teardown
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mediaEquiposDir = path.resolve(__dirname, 'media', 'equipos');
fs.mkdirSync(mediaEquiposDir, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

function validateAndSaveImage(file?: Express.Multer.File): { filename?: string; error?: string } {
  if (!file) return {};
  const buf = file.buffer;
  const isJpeg = buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isPng =
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47;
  const isWebp =
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP';

  if (!isJpeg && !isPng && !isWebp) {
    return { error: 'Formato no permitido. Usa JPEG, PNG o WebP.' };
  }
  const ext = isPng ? '.png' : isWebp ? '.webp' : '.jpg';
  const name = `equipo_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(mediaEquiposDir, name), buf);
  return { filename: `/media/equipos/${name}` };
}

function parseBool(val: unknown, fallback?: boolean): boolean | undefined {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    if (s === 'true' || s === '1') return true;
    if (s === 'false' || s === '0') return false;
  }
  return fallback;
}

function parseNum(val: unknown): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  const n = Number(val);
  return Number.isFinite(n) ? n : NaN;
}

function parseNullableId(val: unknown): number | null | undefined {
  if (val === undefined) return undefined;
  if (val === null || val === '' || val === 'null') return null;
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export const apiRouter = Router();

// ===================== AUTH & PROFILE =====================

apiRouter.post('/login', authRateLimiter, (req: AuthRequest, res) => {
  const parsed = loginSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ detail: 'Ingresa usuario/correo y contraseña.' });
  }
  const { username, password } = parsed.data;
  const query = username.toLowerCase();
  const user = store.users.find(
    (u) => u.username.toLowerCase() === query || u.email.toLowerCase() === query
  );
  if (!user || !user.is_active || !verifyPassword(password, user.passwordHash)) {
    recordAudit(req, 'LOGIN_FALLIDO', 'usuarios', user?.id ?? null, `Intento fallido para ${query}`, query);
    return res.status(401).json({ detail: 'No active account found with the given credentials' });
  }
  req.user = user;
  recordAudit(req, 'LOGIN_OK', 'usuarios', user.id, 'Inicio de sesión exitoso', user.email);
  return res.json(generateTokens(user));
});

apiRouter.post('/login/refresh', (req, res) => {
  const { refresh } = req.body || {};
  if (!refresh) {
    return res.status(400).json({ detail: 'Refresh token requerido.' });
  }
  const user = verifyRefreshToken(String(refresh));
  if (!user) {
    return res.status(401).json({ detail: 'Token de refresco inválido o expirado.' });
  }
  return res.json(generateTokens(user));
});

apiRouter.get('/perfil', requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  return res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    roles: getUserRoles(user),
    is_active: user.is_active,
    is_superuser: user.is_superuser,
    permisos: getUserPermissions(user),
  });
});

apiRouter.post('/registro', requireAuth, requireAdmin, requirePermission('auth.add_user'), (req: AuthRequest, res) => {
  const { nombre_completo, email, password, role } = req.body || {};
  if (!nombre_completo || !email || !password) {
    return res.status(400).json({ detail: 'Completa nombre, correo y contraseña.' });
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  if (store.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
    return res.status(400).json({ email: ['Este correo ya está registrado en el sistema.'] });
  }
  const pwErrors = validatePasswordStrength(String(password));
  if (pwErrors.length > 0) {
    return res.status(400).json({ password: pwErrors });
  }
  const roleName = String(role || 'PLANIFICACION').toUpperCase();
  if (!['ADMIN', 'PLANIFICACION', 'TECNICO'].includes(roleName)) {
    return res.status(400).json({ role: ['Rol inválido.'] });
  }
  const parts = String(nombre_completo).trim().split(/\s+/);
  const first_name = parts[0] || '';
  const last_name = parts.slice(1).join(' ');
  const roleObj = store.roles.find((r) => r.name.toUpperCase() === roleName);

  const newUser = {
    id: store.nextIds.user++,
    username: normalizedEmail,
    email: normalizedEmail,
    first_name,
    last_name,
    passwordHash: hashPassword(String(password)),
    is_active: true,
    is_superuser: false,
    groups: roleObj ? [roleObj.id] : [],
  };
  store.users.push(newUser);
  dbUpsertUser(newUser);
  recordAudit(req, 'USUARIO_CREADO', 'usuarios', newUser.id, `Rol asignado: ${roleName}`);
  return res.status(201).json({
    message: 'Usuario registrado exitosamente en Vilas Motor',
    user: {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      first_name: newUser.first_name,
      last_name: newUser.last_name,
    },
  });
});

apiRouter.post('/contrasena/solicitar', authRateLimiter, (req: AuthRequest, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return res.status(400).json({ email: ['Ingresa un correo electrónico válido.'] });
  }
  const user = store.users.find((u) => u.email.toLowerCase() === email && u.is_active);
  if (user) {
    const uid = Buffer.from(String(user.id), 'utf-8').toString('base64url');
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + 60 * 60 * 1000;
    store.resetTokens.set(token, {
      userId: user.id,
      uid,
      expiresAt,
    });
    dbSaveResetToken(token, user.id, uid, expiresAt);
    recordAudit(req, 'PASSWORD_RESET_SOLICITUD', 'usuarios', user.id, 'Token de recuperación generado', user.email);
    const baseUrl = (process.env.FRONTEND_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
    console.info(`[Vilas Motor] Enlace de recuperación para ${user.email}: ${baseUrl}/restablecer-contrasena/${uid}/${token}`);
  }
  return res.json({
    message: 'Si existe una cuenta activa con ese correo, recibirás instrucciones para recuperar tu contraseña.',
  });
});

apiRouter.post('/contrasena/restablecer', authRateLimiter, (req: AuthRequest, res) => {
  const { uid, token, password, confirm_password } = req.body || {};
  if (!uid || !token || !password || !confirm_password) {
    return res.status(400).json({ detail: 'Completa todos los campos.' });
  }
  if (password !== confirm_password) {
    return res.status(400).json({ detail: 'Las contraseñas no coinciden.' });
  }
  const record = store.resetTokens.get(String(token));
  if (!record || record.uid !== uid || record.expiresAt < Date.now()) {
    return res.status(400).json({ detail: 'El enlace es inválido o ha expirado. Solicita uno nuevo.' });
  }
  const user = store.users.find((u) => u.id === record.userId && u.is_active);
  if (!user) {
    return res.status(400).json({ detail: 'El enlace es inválido o ha expirado. Solicita uno nuevo.' });
  }
  const pwErrors = validatePasswordStrength(String(password));
  if (pwErrors.length > 0) {
    return res.status(400).json({ password: pwErrors });
  }
  user.passwordHash = hashPassword(String(password));
  dbUpsertUser(user);
  store.resetTokens.delete(String(token));
  dbDeleteResetToken(String(token));
  recordAudit(req, 'PASSWORD_RESET_OK', 'usuarios', user.id, 'Contraseña actualizada mediante token', user.email);
  return res.json({ message: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
});

// ===================== ADMIN RBAC =====================

apiRouter.get('/admin/permisos', requireAuth, requireAdmin, requirePermission('auth.view_group'), (_req, res) => {
  return res.json(store.permisos);
});

apiRouter.get('/admin/roles', requireAuth, requireAdmin, requirePermission('auth.view_group'), (_req, res) => {
  return res.json(store.roles);
});

apiRouter.get('/admin/auditoria', requireAuth, requireAdmin, (_req, res) => {
  return res.json(dbListAuditLogs(100));
});

apiRouter.get('/admin/db-status', requireAuth, requireAdmin, (_req, res) => {
  return res.json(dbGetDatabaseStats());
});

apiRouter.post('/admin/roles', requireAuth, requireAdmin, requirePermission('auth.add_group'), (req: AuthRequest, res) => {
  const name = String(req.body?.name || '').trim().toUpperCase();
  if (!name) {
    return res.status(400).json({ name: ['El nombre del rol es obligatorio.'] });
  }
  if (store.roles.some((r) => r.name.toUpperCase() === name)) {
    return res.status(400).json({ name: ['Ya existe un rol con ese nombre.'] });
  }
  const permissions = Array.isArray(req.body?.permissions)
    ? req.body.permissions.map(Number).filter((id: number) => store.permisos.some((p) => p.id === id))
    : [];
  const rol = { id: store.nextIds.rol++, name, permissions };
  store.roles.push(rol);
  dbUpsertRole(rol);
  recordAudit(req, 'ROL_CREADO', 'roles', rol.id, `Rol ${rol.name}`);
  return res.status(201).json(rol);
});

apiRouter.patch('/admin/roles/:id', requireAuth, requireAdmin, requirePermission('auth.change_group'), (req: AuthRequest, res) => {
  const rol = store.roles.find((r) => r.id === Number(req.params.id));
  if (!rol) return res.status(404).json({ detail: 'Rol no encontrado.' });
  if (rol.name === 'ADMIN' && !req.user!.is_superuser) {
    return res.status(403).json({ detail: 'Solo un superusuario puede modificar ADMIN.' });
  }
  if (req.body?.name !== undefined) {
    const nuevoNombre = String(req.body.name).trim().toUpperCase();
    if (nuevoNombre) rol.name = nuevoNombre;
  }
  if (Array.isArray(req.body?.permissions)) {
    rol.permissions = req.body.permissions
      .map(Number)
      .filter((id: number) => store.permisos.some((p) => p.id === id));
  }
  dbUpsertRole(rol);
  recordAudit(req, 'ROL_ACTUALIZADO', 'roles', rol.id, `Rol ${rol.name} (${rol.permissions.length} permisos)`);
  return res.json(rol);
});

apiRouter.put('/admin/roles/:id', requireAuth, requireAdmin, requirePermission('auth.change_group'), (req: AuthRequest, res) => {
  const rol = store.roles.find((r) => r.id === Number(req.params.id));
  if (!rol) return res.status(404).json({ detail: 'Rol no encontrado.' });
  if (rol.name === 'ADMIN' && !req.user!.is_superuser) {
    return res.status(403).json({ detail: 'Solo un superusuario puede modificar ADMIN.' });
  }
  if (req.body?.name !== undefined) {
    const nuevoNombre = String(req.body.name).trim().toUpperCase();
    if (nuevoNombre) rol.name = nuevoNombre;
  }
  if (Array.isArray(req.body?.permissions)) {
    rol.permissions = req.body.permissions
      .map(Number)
      .filter((id: number) => store.permisos.some((p) => p.id === id));
  }
  dbUpsertRole(rol);
  recordAudit(req, 'ROL_ACTUALIZADO', 'roles', rol.id, `Rol ${rol.name}`);
  return res.json(rol);
});

apiRouter.delete('/admin/roles/:id', requireAuth, requireAdmin, requirePermission('auth.delete_group'), (req: AuthRequest, res) => {
  const idx = store.roles.findIndex((r) => r.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ detail: 'Rol no encontrado.' });
  const rol = store.roles[idx];
  if (rol.name === 'ADMIN') {
    return res.status(403).json({ detail: 'El rol ADMIN no se puede eliminar.' });
  }
  store.roles.splice(idx, 1);
  for (const user of store.users) {
    user.groups = user.groups.filter((gid) => gid !== rol.id);
  }
  dbDeleteRole(rol.id);
  recordAudit(req, 'ROL_ELIMINADO', 'roles', rol.id, `Rol ${rol.name}`);
  return res.status(204).send();
});

apiRouter.get('/admin/usuarios', requireAuth, requireAdmin, requirePermission('auth.view_user'), (_req, res) => {
  return res.json(store.users.map(serializeUserAdmin));
});

apiRouter.patch('/admin/usuarios/:id', requireAuth, requireAdmin, requirePermission('auth.change_user'), (req: AuthRequest, res) => {
  const target = store.users.find((u) => u.id === Number(req.params.id));
  if (!target) return res.status(404).json({ detail: 'Usuario no encontrado.' });
  if (target.is_superuser && !req.user!.is_superuser) {
    return res.status(403).json({ detail: 'Operación exclusiva de superusuarios.' });
  }
  if ('grupos_ids' in (req.body || {}) && !userHasPermission(req.user!, 'auth.change_group')) {
    return res.status(403).json({ detail: 'Falta el permiso Editar Roles.' });
  }
  if (target.id === req.user!.id && req.body?.is_active === false) {
    return res.status(400).json({ detail: 'No puedes bloquear tu propia cuenta.' });
  }
  if (req.body?.first_name !== undefined) target.first_name = String(req.body.first_name).trim();
  if (req.body?.last_name !== undefined) target.last_name = String(req.body.last_name).trim();
  if (req.body?.email !== undefined) {
    const newEmail = String(req.body.email).trim().toLowerCase();
    if (store.users.some((u) => u.id !== target.id && u.email.toLowerCase() === newEmail)) {
      return res.status(400).json({ email: ['Este correo ya está en uso.'] });
    }
    target.email = newEmail;
    target.username = newEmail;
  }
  if (req.body?.is_active !== undefined) {
    target.is_active = Boolean(req.body.is_active);
  }
  if (Array.isArray(req.body?.grupos_ids)) {
    target.groups = req.body.grupos_ids
      .map(Number)
      .filter((gid: number) => store.roles.some((r) => r.id === gid));
  }
  dbUpsertUser(target);
  recordAudit(req, 'USUARIO_ACTUALIZADO', 'usuarios', target.id, `Estado activo: ${target.is_active}`);
  return res.json(serializeUserAdmin(target));
});

apiRouter.delete('/admin/usuarios/:id', requireAuth, requireAdmin, requirePermission('auth.delete_user'), (req: AuthRequest, res) => {
  const idx = store.users.findIndex((u) => u.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ detail: 'Usuario no encontrado.' });
  const target = store.users[idx];
  if (target.id === req.user!.id || target.is_superuser) {
    return res.status(403).json({ detail: 'No puedes eliminar esta cuenta.' });
  }
  store.users.splice(idx, 1);
  dbDeleteUser(target.id);
  recordAudit(req, 'USUARIO_ELIMINADO', 'usuarios', target.id, target.email);
  return res.status(204).send();
});

// ===================== EQUIPOS =====================

apiRouter.get('/equipos', requireAuth, requirePermission('equipos.view_equipo'), (req, res) => {
  const incluirDeshabilitados = String(req.query.incluir_deshabilitados || 'false').toLowerCase() === 'true';
  const list = incluirDeshabilitados
    ? store.equipos
    : store.equipos.filter((e) => !e.is_deleted);

  if (req.query.page !== undefined) {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(req.query.page_size) || 24));
    const total = list.length;
    const offset = (page - 1) * pageSize;
    return res.json({
      count: total,
      page,
      page_size: pageSize,
      results: list.slice(offset, offset + pageSize).map(serializeEquipo),
    });
  }
  return res.json(list.map(serializeEquipo));
});

apiRouter.get('/equipos/:id', requireAuth, requirePermission('equipos.view_equipo'), (req, res) => {
  const equipo = store.equipos.find((e) => e.id === Number(req.params.id));
  if (!equipo) return res.status(404).json({ detail: 'Equipo no encontrado.' });
  return res.json(serializeEquipo(equipo));
});

apiRouter.post(
  '/equipos',
  requireAuth,
  requirePermission('equipos.add_equipo'),
  upload.single('foto_archivo'),
  (req, res) => {
    const body = req.body || {};
    const codigo = String(body.codigo || '').trim();
    const nombre = String(body.nombre || '').trim();
    if (!codigo || !nombre) {
      return res.status(400).json({ detail: 'Código y nombre son obligatorios.' });
    }
    if (store.equipos.some((e) => e.codigo.toUpperCase() === codigo.toUpperCase())) {
      return res.status(400).json({ codigo: ['Ya existe un equipo con este código.'] });
    }

    const horometro_actual = parseNum(body.horometro_actual) ?? 0;
    const meta_proxima_mant = parseNum(body.meta_proxima_mant) ?? 0;
    const horas_uso_mes = parseNum(body.horas_uso_mes) ?? 0;
    const limite_contrato_mes = parseNum(body.limite_contrato_mes) ?? 162;

    for (const [k, v] of [
      ['horometro_actual', horometro_actual],
      ['meta_proxima_mant', meta_proxima_mant],
      ['horas_uso_mes', horas_uso_mes],
      ['limite_contrato_mes', limite_contrato_mes],
    ] as const) {
      if (!Number.isFinite(v) || v < 0) {
        return res.status(400).json({ [k]: ['Ingresa un número válido mayor o igual a cero.'] });
      }
    }

    const imgCheck = validateAndSaveImage(req.file);
    if (imgCheck.error) {
      return res.status(400).json({ foto_archivo: [imgCheck.error] });
    }

    const estadoRaw = String(body.estado || 'Disponible') as EquipoRecord['estado'];
    const validEstados = ['Disponible', 'Mantenimiento', 'Arrendada', 'Deshabilitada'];
    if (!validEstados.includes(estadoRaw)) {
      return res.status(400).json({ estado: ['Estado inválido.'] });
    }

    const isDeleted = estadoRaw === 'Deshabilitada';
    const nuevo: EquipoRecord = {
      id: store.nextIds.equipo++,
      codigo,
      nombre,
      marca: String(body.marca || '').trim(),
      modelo: String(body.modelo || '').trim(),
      foto_url: String(body.foto_url || '').trim(),
      foto_archivo: imgCheck.filename || '',
      latitud: parseNum(body.latitud) ?? -20.2141,
      longitud: parseNum(body.longitud) ?? -70.1524,
      ubicacion_registrada: body.latitud !== undefined && body.longitud !== undefined,
      zona_operacion: String(body.zona_operacion || '').trim(),
      senal_movil: parseBool(body.senal_movil, true) ?? true,
      categoria: String(body.categoria || '').trim(),
      subcategoria: String(body.subcategoria || '').trim(),
      estado: estadoRaw,
      is_deleted: isDeleted,
      fecha_baja: isDeleted ? new Date().toISOString() : null,
      horometro_actual,
      meta_proxima_mant,
      unidad_medida: body.unidad_medida === 'KM' ? 'KM' : 'HORAS',
      horas_uso_mes,
      limite_contrato_mes,
      encendido_gps: parseBool(body.encendido_gps, false) ?? false,
      cliente_asignado: parseNullableId(body.cliente_asignado) ?? null,
      cliente_empresa: parseNullableId(body.cliente_empresa) ?? null,
    };

    store.equipos.push(nuevo);
    dbUpsertEquipo(nuevo);
    recordAudit(req as AuthRequest, 'EQUIPO_CREADO', 'equipos', nuevo.id, `${nuevo.codigo} - ${nuevo.nombre}`);
    return res.status(201).json(serializeEquipo(nuevo));
  }
);

function handleUpdateEquipo(req: AuthRequest, res: import('express').Response) {
  const equipo = store.equipos.find((e) => e.id === Number(req.params.id));
  if (!equipo) return res.status(404).json({ detail: 'Equipo no encontrado.' });

  const body = req.body || {};
  if (body.estado === 'Deshabilitada' && !userHasPermission(req.user!, 'equipos.delete_equipo')) {
    return res.status(403).json({ detail: 'Para dar de baja necesitas el permiso Eliminar Maquinarias.' });
  }

  const imgCheck = validateAndSaveImage(req.file);
  if (imgCheck.error) {
    return res.status(400).json({ foto_archivo: [imgCheck.error] });
  }

  const nextHorometro = body.horometro_actual !== undefined ? parseNum(body.horometro_actual) : equipo.horometro_actual;
  const nextMeta = body.meta_proxima_mant !== undefined ? parseNum(body.meta_proxima_mant) : equipo.meta_proxima_mant;
  const nextUsoMes = body.horas_uso_mes !== undefined ? parseNum(body.horas_uso_mes) : equipo.horas_uso_mes;
  const nextLimite = body.limite_contrato_mes !== undefined ? parseNum(body.limite_contrato_mes) : equipo.limite_contrato_mes;

  for (const [k, v] of [
    ['horometro_actual', nextHorometro],
    ['meta_proxima_mant', nextMeta],
    ['horas_uso_mes', nextUsoMes],
    ['limite_contrato_mes', nextLimite],
  ] as const) {
    if (v === undefined || !Number.isFinite(v) || v < 0) {
      return res.status(400).json({ [k]: ['Ingresa un número válido mayor o igual a cero.'] });
    }
  }

  if (nextHorometro! < equipo.horometro_actual) {
    return res.status(400).json({
      horometro_actual: ['La lectura no puede disminuir respecto al último registro.'],
    });
  }

  const nextLat = body.latitud !== undefined ? parseNum(body.latitud) : equipo.latitud;
  const nextLon = body.longitud !== undefined ? parseNum(body.longitud) : equipo.longitud;
  if (nextLat === undefined || !Number.isFinite(nextLat) || nextLat < -90 || nextLat > 90) {
    return res.status(400).json({ latitud: ['Coordenada fuera del rango válido.'] });
  }
  if (nextLon === undefined || !Number.isFinite(nextLon) || nextLon < -180 || nextLon > 180) {
    return res.status(400).json({ longitud: ['Coordenada fuera del rango válido.'] });
  }

  const nextEstado = (body.estado ?? equipo.estado) as EquipoRecord['estado'];
  if (!['Disponible', 'Mantenimiento', 'Arrendada', 'Deshabilitada'].includes(nextEstado)) {
    return res.status(400).json({ estado: ['Estado inválido.'] });
  }

  const hasOpenOrder = store.ordenes.some((o) => o.equipoId === equipo.id && o.estado !== 'Finalizada');
  if (nextEstado !== 'Mantenimiento' && hasOpenOrder) {
    return res.status(400).json({
      estado: ['No puedes sacar el equipo de mantenimiento mientras tenga una orden abierta.'],
    });
  }

  const nextClienteEmpresa =
    body.cliente_empresa !== undefined ? parseNullableId(body.cliente_empresa) ?? null : equipo.cliente_empresa;
  if (nextClienteEmpresa && nextEstado === 'Disponible') {
    return res.status(400).json({
      estado: ['Desasigna primero el cliente antes de marcar la máquina disponible.'],
    });
  }
  if (nextClienteEmpresa) {
    const clienteObj = store.clientes.find((c) => c.id === nextClienteEmpresa);
    if (!clienteObj) return res.status(400).json({ cliente_empresa: ['Cliente no encontrado.'] });
    if (clienteObj.estado !== 'Activo') {
      return res.status(400).json({ cliente_empresa: ['El cliente está inactivo.'] });
    }
    if ((nextEstado === 'Mantenimiento' || nextEstado === 'Deshabilitada') && nextClienteEmpresa !== equipo.cliente_empresa) {
      return res.status(400).json({ cliente_empresa: ['La máquina no está disponible para arriendo.'] });
    }
  }

  if (equipo.is_deleted && nextEstado !== 'Deshabilitada') {
    return res.status(400).json({
      detail: "Un equipo eliminado debe permanecer en estado 'Deshabilitada'. Use el endpoint de restauración para reactivarlo.",
    });
  }

  if (body.codigo !== undefined) equipo.codigo = String(body.codigo).trim();
  if (body.nombre !== undefined) equipo.nombre = String(body.nombre).trim();
  if (body.marca !== undefined) equipo.marca = String(body.marca).trim();
  if (body.modelo !== undefined) equipo.modelo = String(body.modelo).trim();
  if (body.categoria !== undefined) equipo.categoria = String(body.categoria).trim();
  if (body.subcategoria !== undefined) equipo.subcategoria = String(body.subcategoria).trim();
  if (body.zona_operacion !== undefined) equipo.zona_operacion = String(body.zona_operacion).trim();
  if (body.foto_url !== undefined) equipo.foto_url = String(body.foto_url).trim();
  if (imgCheck.filename) equipo.foto_archivo = imgCheck.filename;
  if (body.latitud !== undefined && body.longitud !== undefined) {
    equipo.latitud = nextLat;
    equipo.longitud = nextLon;
    equipo.ubicacion_registrada = true;
  }
  if (body.senal_movil !== undefined) equipo.senal_movil = parseBool(body.senal_movil, equipo.senal_movil)!;
  if (body.encendido_gps !== undefined) equipo.encendido_gps = parseBool(body.encendido_gps, equipo.encendido_gps)!;
  if (body.unidad_medida !== undefined) equipo.unidad_medida = body.unidad_medida === 'KM' ? 'KM' : 'HORAS';
  if (body.cliente_asignado !== undefined) equipo.cliente_asignado = parseNullableId(body.cliente_asignado) ?? null;

  equipo.horometro_actual = nextHorometro!;
  equipo.meta_proxima_mant = nextMeta!;
  equipo.horas_uso_mes = nextUsoMes!;
  equipo.limite_contrato_mes = nextLimite!;
  equipo.cliente_empresa = nextClienteEmpresa;
  equipo.estado = nextEstado;

  if (nextEstado === 'Deshabilitada' && !equipo.is_deleted) {
    equipo.is_deleted = true;
    equipo.fecha_baja = new Date().toISOString();
  }

  dbUpsertEquipo(equipo);
  return res.json(serializeEquipo(equipo));
}

apiRouter.patch(
  '/equipos/:id',
  requireAuth,
  requirePermission('equipos.change_equipo'),
  upload.single('foto_archivo'),
  handleUpdateEquipo
);

apiRouter.put(
  '/equipos/:id',
  requireAuth,
  requirePermission('equipos.change_equipo'),
  upload.single('foto_archivo'),
  handleUpdateEquipo
);

apiRouter.delete('/equipos/:id', requireAuth, requirePermission('equipos.delete_equipo'), (req: AuthRequest, res) => {
  const equipo = store.equipos.find((e) => e.id === Number(req.params.id) && !e.is_deleted);
  if (!equipo) return res.status(404).json({ detail: 'Equipo no encontrado.' });
  const hasOpenOrder = store.ordenes.some((o) => o.equipoId === equipo.id && o.estado !== 'Finalizada');
  if (hasOpenOrder) {
    return res.status(400).json({ detail: 'Finaliza la orden abierta antes de dar de baja el equipo.' });
  }
  equipo.is_deleted = true;
  equipo.estado = 'Deshabilitada';
  equipo.fecha_baja = new Date().toISOString();
  dbUpsertEquipo(equipo);
  recordAudit(req, 'EQUIPO_BAJA', 'equipos', equipo.id, `Soft delete ${equipo.codigo}`);
  return res.json({
    message: `Equipo ${equipo.codigo} deshabilitado correctamente (Soft Delete).`,
    estado: equipo.estado,
    is_deleted: equipo.is_deleted,
  });
});

apiRouter.post('/equipos/:id/restaurar', requireAuth, requirePermission('equipos.change_equipo'), (req: AuthRequest, res) => {
  const equipo = store.equipos.find((e) => e.id === Number(req.params.id));
  if (!equipo) return res.status(404).json({ detail: 'Equipo no encontrado.' });
  if (!equipo.is_deleted) {
    return res.status(400).json({ detail: 'El equipo no está deshabilitado.' });
  }
  equipo.is_deleted = false;
  equipo.estado = 'Disponible';
  equipo.fecha_baja = null;
  dbUpsertEquipo(equipo);
  recordAudit(req, 'EQUIPO_RESTAURADO', 'equipos', equipo.id, `Restaurado ${equipo.codigo}`);
  return res.json(serializeEquipo(equipo));
});

// Finalizar mantenimiento directo para una máquina en taller (con o sin orden previa) y agregarlo al historial
apiRouter.post('/equipos/:id/finalizar-mantenimiento', requireAuth, requirePermission('equipos.change_historialmantencion'), (req: AuthRequest, res) => {
  const equipo = store.equipos.find((e) => e.id === Number(req.params.id) && !e.is_deleted);
  if (!equipo) return res.status(404).json({ detail: 'Equipo no encontrado.' });

  const openOrder = store.ordenes.find((o) => o.equipoId === equipo.id && o.estado !== 'Finalizada');
  if (openOrder) {
    openOrder.estado = 'Finalizada';
    openOrder.finalizadoPorId = req.user!.id;
    openOrder.finalizado_en = new Date().toISOString();
    const responsables = openOrder.mecanicos.join(', ');
    const insumosUsados = openOrder.consumos
      .map((c) => `${c.insumoNombre}: ${c.cantidad} ${c.unidad}`)
      .join(', ')
      .slice(0, 255);
    const esTecnico = getUserRoles(req.user!).includes('TECNICO');

    const nuevoHistorial = {
      id: store.nextIds.mantencion++,
      equipo: equipo.id,
      mecanico_responsable: esTecnico ? req.user!.id : null,
      fecha_intervencion: new Date().toISOString(),
      horometro_al_momento: equipo.horometro_actual,
      descripcion_falla_o_trabajo: `${openOrder.comentario} | Responsables: ${responsables}`,
      insumos_utilizados: insumosUsados,
    };
    store.mantenciones.unshift(nuevoHistorial);
    equipo.estado = equipo.cliente_empresa ? 'Arrendada' : 'Disponible';
    dbUpsertOrden(openOrder, store.users);
    dbInsertMantencion(nuevoHistorial);
    dbUpsertEquipo(equipo);
    recordAudit(req, 'MANTENCION_FINALIZADA', 'equipos', equipo.id, `OT-${openOrder.id} finalizada`);
    return res.json({ orden: serializeOrden(openOrder), equipo: serializeEquipo(equipo) });
  }

  if (equipo.estado !== 'Mantenimiento') {
    return res.status(400).json({ detail: 'El equipo no se encuentra en mantenimiento.' });
  }

  const comentario = String(req.body?.comentario || '').trim() || 'Mantenimiento finalizado desde taller';
  const userName = `${req.user!.first_name} ${req.user!.last_name}`.trim() || req.user!.username;
  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();
  const esTecnico = getUserRoles(req.user!).includes('TECNICO');

  const nuevaOrden = {
    id: store.nextIds.orden++,
    equipoId: equipo.id,
    fecha: today,
    comentario,
    estado: 'Finalizada' as const,
    mecanicos: [userName],
    consumos: [],
    creadoPorId: req.user!.id,
    finalizadoPorId: req.user!.id,
    creado_en: nowIso,
    finalizado_en: nowIso,
  };
  store.ordenes.unshift(nuevaOrden);

  const nuevoHistorial = {
    id: store.nextIds.mantencion++,
    equipo: equipo.id,
    mecanico_responsable: esTecnico ? req.user!.id : req.user!.id,
    fecha_intervencion: nowIso,
    horometro_al_momento: equipo.horometro_actual,
    descripcion_falla_o_trabajo: `${comentario} | Responsables: ${userName}`,
    insumos_utilizados: 'Sin insumos utilizados',
  };
  store.mantenciones.unshift(nuevoHistorial);

  equipo.estado = equipo.cliente_empresa ? 'Arrendada' : 'Disponible';
  dbUpsertOrden(nuevaOrden, store.users);
  dbInsertMantencion(nuevoHistorial);
  dbUpsertEquipo(equipo);
  recordAudit(req, 'MANTENCION_FINALIZADA', 'equipos', equipo.id, `Cierre directo OT-${nuevaOrden.id}`);
  return res.json({ orden: serializeOrden(nuevaOrden), equipo: serializeEquipo(equipo) });
});

// ===================== MANTENCIONES & TELEMETRIA =====================

apiRouter.get('/mantenciones', requireAuth, requirePermission('equipos.view_historialmantencion'), (_req, res) => {
  const list = [...store.mantenciones].sort(
    (a, b) => new Date(b.fecha_intervencion).getTime() - new Date(a.fecha_intervencion).getTime()
  );
  return res.json(list.map(serializeMantencion));
});

apiRouter.post('/mantenciones', requireAuth, requirePermission('equipos.add_historialmantencion'), (req: AuthRequest, res) => {
  const { equipo, mecanico_responsable, fecha_intervencion, horometro_al_momento, descripcion_falla_o_trabajo, insumos_utilizados } =
    req.body || {};
  const eq = store.equipos.find((e) => e.id === Number(equipo));
  if (!eq) return res.status(400).json({ equipo: ['Equipo no encontrado.'] });
  const item = {
    id: store.nextIds.mantencion++,
    equipo: eq.id,
    mecanico_responsable: mecanico_responsable ? Number(mecanico_responsable) : req.user!.id,
    fecha_intervencion: fecha_intervencion || new Date().toISOString(),
    horometro_al_momento: Number(horometro_al_momento ?? eq.horometro_actual),
    descripcion_falla_o_trabajo: String(descripcion_falla_o_trabajo || '').trim(),
    insumos_utilizados: String(insumos_utilizados || '').trim(),
  };
  store.mantenciones.unshift(item);
  dbInsertMantencion(item);
  return res.status(201).json(serializeMantencion(item));
});

apiRouter.get('/telemetria', requireAuth, requirePermission('equipos.view_logtelemetriagps'), (_req, res) => {
  const list = [...store.telemetria].sort(
    (a, b) => new Date(b.timestamp_evento).getTime() - new Date(a.timestamp_evento).getTime()
  );
  return res.json(list);
});

// ===================== CLIENTES =====================

apiRouter.get('/clientes', requireAuth, requireOperacionesPermission, (_req, res) => {
  const list = [...store.clientes].sort((a, b) => a.nombre.localeCompare(b.nombre) || a.id - b.id);
  return res.json(list.map(serializeCliente));
});

apiRouter.post('/clientes', requireAuth, requireOperacionesPermission, (req, res) => {
  const body = req.body || {};
  const nombre = String(body.nombre || '').trim();
  if (!nombre) return res.status(400).json({ nombre: ['El nombre es obligatorio.'] });
  const rut = body.rut ? String(body.rut).trim().toUpperCase() || null : null;
  if (rut && store.clientes.some((c) => c.rut === rut)) {
    return res.status(400).json({ rut: ['Ya existe un cliente con este RUT.'] });
  }
  const cliente = {
    id: store.nextIds.cliente++,
    nombre,
    rut,
    telefono: String(body.telefono || '').trim(),
    correo: String(body.correo || '').trim(),
    direccion: String(body.direccion || '').trim(),
    fechaCliente: body.fechaCliente || null,
    categoria: String(body.categoria || '').trim(),
    subcategoria: String(body.subcategoria || '').trim(),
    estado: 'Activo' as const,
    creado_en: new Date().toISOString(),
  };
  store.clientes.push(cliente);
  dbUpsertCliente(cliente);
  return res.status(201).json(serializeCliente(cliente));
});

apiRouter.patch('/clientes/:id', requireAuth, requireOperacionesPermission, (req, res) => {
  const cliente = store.clientes.find((c) => c.id === Number(req.params.id));
  if (!cliente) return res.status(404).json({ detail: 'Cliente no encontrado.' });
  const body = req.body || {};
  if (body.estado === 'Inactivo') {
    const hasActiveEquipos = store.equipos.some((e) => !e.is_deleted && e.cliente_empresa === cliente.id);
    if (hasActiveEquipos) {
      return res.status(400).json({ estado: ['No puedes desactivar un cliente con equipos asignados.'] });
    }
  }
  if (body.nombre !== undefined) cliente.nombre = String(body.nombre).trim();
  if (body.rut !== undefined) cliente.rut = body.rut ? String(body.rut).trim().toUpperCase() || null : null;
  if (body.telefono !== undefined) cliente.telefono = String(body.telefono).trim();
  if (body.correo !== undefined) cliente.correo = String(body.correo).trim();
  if (body.direccion !== undefined) cliente.direccion = String(body.direccion).trim();
  if (body.fechaCliente !== undefined) cliente.fechaCliente = body.fechaCliente || null;
  if (body.categoria !== undefined) cliente.categoria = String(body.categoria).trim();
  if (body.subcategoria !== undefined) cliente.subcategoria = String(body.subcategoria).trim();
  if (body.estado === 'Activo' || body.estado === 'Inactivo') cliente.estado = body.estado;
  dbUpsertCliente(cliente);
  return res.json(serializeCliente(cliente));
});

// ===================== INSUMOS & MOVIMIENTOS =====================

apiRouter.get('/insumos', requireAuth, requireOperacionesPermission, (_req, res) => {
  const list = store.insumos
    .filter((i) => i.activo)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  return res.json(list.map(serializeInsumo));
});

apiRouter.post('/insumos', requireAuth, requireOperacionesPermission, (req: AuthRequest, res) => {
  const body = req.body || {};
  const nombre = String(body.nombre || '').trim();
  if (!nombre) return res.status(400).json({ nombre: ['El nombre del insumo es obligatorio.'] });
  const stock = Number(body.stock ?? 0);
  const minimo = Number(body.minimo ?? 0);
  if (!Number.isFinite(stock) || stock < 0) return res.status(400).json({ stock: ['El stock no puede ser negativo.'] });
  if (!Number.isFinite(minimo) || minimo < 0) return res.status(400).json({ minimo: ['El mínimo no puede ser negativo.'] });

  const now = new Date().toISOString();
  const insumo = {
    id: store.nextIds.insumo++,
    nombre,
    categoria: String(body.categoria || 'General').trim() || 'General',
    stock,
    minimo,
    unidad: String(body.unidad || 'unidades').trim() || 'unidades',
    activo: true,
    modificado_por: req.user!.id,
    actualizado_en: now,
  };
  store.insumos.push(insumo);
  dbUpsertInsumo(insumo);
  if (stock > 0) {
    const mov = {
      id: store.nextIds.movimiento++,
      insumo: insumo.id,
      cantidad: stock,
      motivo: 'Ingreso inicial',
      orden: null,
      usuario: req.user!.id,
      fecha: now,
    };
    store.movimientosInsumos.unshift(mov);
    dbInsertMovimiento(mov);
  }
  return res.status(201).json(serializeInsumo(insumo));
});

apiRouter.patch('/insumos/:id', requireAuth, requireOperacionesPermission, (req: AuthRequest, res) => {
  const insumo = store.insumos.find((i) => i.id === Number(req.params.id) && i.activo);
  if (!insumo) return res.status(404).json({ detail: 'Insumo no encontrado.' });
  const body = req.body || {};
  const stockAnterior = insumo.stock;
  const nuevoStock = body.stock !== undefined ? Number(body.stock) : stockAnterior;
  if (!Number.isFinite(nuevoStock) || nuevoStock < 0) {
    return res.status(400).json({ stock: 'El stock no puede ser negativo.' });
  }
  const nuevaUnidad = body.unidad !== undefined ? String(body.unidad).trim() : insumo.unidad;
  const tieneMovimientos = store.movimientosInsumos.some((m) => m.insumo === insumo.id);
  if (nuevaUnidad !== insumo.unidad && tieneMovimientos) {
    return res.status(400).json({
      unidad: 'El material tiene movimientos. Registra otro insumo para cambiar la unidad.',
    });
  }
  if (body.nombre !== undefined) insumo.nombre = String(body.nombre).trim();
  if (body.categoria !== undefined) insumo.categoria = String(body.categoria).trim();
  if (body.minimo !== undefined) insumo.minimo = Math.max(0, Number(body.minimo));
  insumo.unidad = nuevaUnidad;
  insumo.stock = nuevoStock;
  insumo.modificado_por = req.user!.id;
  insumo.actualizado_en = new Date().toISOString();
  dbUpsertInsumo(insumo);

  const delta = nuevoStock - stockAnterior;
  if (delta !== 0) {
    const mov = {
      id: store.nextIds.movimiento++,
      insumo: insumo.id,
      cantidad: delta,
      motivo: 'Corrección de inventario',
      orden: null,
      usuario: req.user!.id,
      fecha: insumo.actualizado_en,
    };
    store.movimientosInsumos.unshift(mov);
    dbInsertMovimiento(mov);
  }
  return res.json(serializeInsumo(insumo));
});

apiRouter.delete('/insumos/:id', requireAuth, requireOperacionesPermission, (req: AuthRequest, res) => {
  const insumo = store.insumos.find((i) => i.id === Number(req.params.id) && i.activo);
  if (!insumo) return res.status(404).json({ detail: 'Insumo no encontrado.' });
  insumo.activo = false;
  insumo.modificado_por = req.user!.id;
  insumo.actualizado_en = new Date().toISOString();
  dbUpsertInsumo(insumo);
  return res.status(204).send();
});

apiRouter.post('/insumos/:id/ajustar', requireAuth, requireOperacionesPermission, (req: AuthRequest, res) => {
  const insumo = store.insumos.find((i) => i.id === Number(req.params.id) && i.activo);
  if (!insumo) return res.status(404).json({ detail: 'Insumo no encontrado.' });
  const delta = Number(req.body?.cantidad);
  const motivo = String(req.body?.motivo || 'Ajuste manual').trim();
  if (!Number.isFinite(delta) || delta === 0 || insumo.stock + delta < 0) {
    return res.status(400).json({
      cantidad: 'El ajuste debe ser distinto de cero y no puede generar stock negativo.',
    });
  }
  insumo.stock = Number((insumo.stock + delta).toFixed(2));
  insumo.modificado_por = req.user!.id;
  insumo.actualizado_en = new Date().toISOString();
  dbUpsertInsumo(insumo);
  const mov = {
    id: store.nextIds.movimiento++,
    insumo: insumo.id,
    cantidad: delta,
    motivo,
    orden: null,
    usuario: req.user!.id,
    fecha: insumo.actualizado_en,
  };
  store.movimientosInsumos.unshift(mov);
  dbInsertMovimiento(mov);
  return res.json(serializeInsumo(insumo));
});

apiRouter.get('/movimientos-insumos', requireAuth, requireOperacionesPermission, (_req, res) => {
  const list = [...store.movimientosInsumos]
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime() || b.id - a.id)
    .slice(0, 200);
  return res.json(list.map(serializeMovimiento));
});

// ===================== ORDENES DE MANTENIMIENTO =====================

apiRouter.get('/ordenes', requireAuth, requirePermission('equipos.view_historialmantencion'), (_req, res) => {
  const list = [...store.ordenes].sort(
    (a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id
  );
  return res.json(list.map(serializeOrden));
});

apiRouter.post('/ordenes', requireAuth, requirePermission('equipos.add_historialmantencion'), (req: AuthRequest, res) => {
  const body = req.body || {};
  const equipoId = Number(body.equipoId);
  const fecha = String(body.fecha || '').trim();
  const comentario = String(body.comentario || '').trim();
  const estadoInicial = body.estado === 'Programada' ? 'Programada' : 'En curso';
  const mecanicosRaw: string[] = Array.isArray(body.mecanicos)
    ? body.mecanicos.map((m: unknown) => String(m).trim()).filter(Boolean)
    : [];
  const consumosRaw: Array<{ insumo: number; cantidad: number }> = Array.isArray(body.consumos) ? body.consumos : [];

  if (!equipoId || !fecha) {
    return res.status(400).json({ detail: 'Equipo y fecha son obligatorios.' });
  }
  if (comentario.length < 8) {
    return res.status(400).json({ comentario: ['El comentario debe tener al menos 8 caracteres.'] });
  }
  if (mecanicosRaw.length === 0) {
    return res.status(400).json({ mecanicos: ['Indica al menos un responsable real.'] });
  }
  const uniqueLower = new Set(mecanicosRaw.map((m) => m.toLowerCase()));
  if (uniqueLower.size !== mecanicosRaw.length) {
    return res.status(400).json({ mecanicos: ['No repitas el mismo responsable.'] });
  }

  const equipo = store.equipos.find((e) => e.id === equipoId && !e.is_deleted);
  if (!equipo) {
    return res.status(404).json({ equipoId: 'Equipo no encontrado.' });
  }
  if (equipo.estado === 'Mantenimiento' || equipo.estado === 'Deshabilitada') {
    return res.status(400).json({ equipoId: 'Esta máquina no está disponible para iniciar una orden.' });
  }
  if (store.ordenes.some((o) => o.equipoId === equipo.id && o.estado !== 'Finalizada')) {
    return res.status(400).json({ equipoId: 'Ya existe una orden abierta para esta máquina.' });
  }

  const insumoIds = new Set<number>();
  const resolvedConsumos: Array<{ insumo: typeof store.insumos[number]; cantidad: number }> = [];
  for (const item of consumosRaw) {
    const insumoId = Number(item.insumo);
    const cantidad = Number(item.cantidad);
    if (insumoIds.has(insumoId)) {
      return res.status(400).json({ consumos: 'Cada insumo se registra solo una vez por orden.' });
    }
    insumoIds.add(insumoId);
    const insumo = store.insumos.find((i) => i.id === insumoId && i.activo);
    if (!insumo) {
      return res.status(404).json({ consumos: 'Insumo no encontrado.' });
    }
    if (!Number.isFinite(cantidad) || cantidad <= 0 || cantidad > insumo.stock) {
      return res.status(400).json({ consumos: `Stock insuficiente para ${insumo.nombre}.` });
    }
    resolvedConsumos.push({ insumo, cantidad });
  }

  const nowIso = new Date().toISOString();
  const ordenId = store.nextIds.orden++;
  const nuevaOrden = {
    id: ordenId,
    equipoId: equipo.id,
    fecha,
    comentario,
    estado: estadoInicial as 'Programada' | 'En curso',
    mecanicos: mecanicosRaw,
    consumos: resolvedConsumos.map(({ insumo, cantidad }) => ({
      insumoId: insumo.id,
      insumoNombre: insumo.nombre,
      cantidad,
      unidad: insumo.unidad,
    })),
    creadoPorId: req.user!.id,
    finalizadoPorId: null,
    creado_en: nowIso,
    finalizado_en: null,
  };

  if (estadoInicial === 'En curso') {
    equipo.estado = 'Mantenimiento';
    dbUpsertEquipo(equipo);
  }
  store.ordenes.unshift(nuevaOrden);
  dbUpsertOrden(nuevaOrden, store.users);

  for (const { insumo, cantidad } of resolvedConsumos) {
    insumo.stock = Number((insumo.stock - cantidad).toFixed(2));
    insumo.modificado_por = req.user!.id;
    insumo.actualizado_en = nowIso;
    dbUpsertInsumo(insumo);
    const mov = {
      id: store.nextIds.movimiento++,
      insumo: insumo.id,
      cantidad: -cantidad,
      motivo: `Consumo en OT-${ordenId}`,
      orden: ordenId,
      usuario: req.user!.id,
      fecha: nowIso,
    };
    store.movimientosInsumos.unshift(mov);
    dbInsertMovimiento(mov);
  }

  recordAudit(req, 'ORDEN_CREADA', 'ordenes', nuevaOrden.id, `Equipo ${equipo.codigo} (${estadoInicial})`);
  return res.status(201).json(serializeOrden(nuevaOrden));
});

apiRouter.post('/ordenes/:id/iniciar', requireAuth, requirePermission('equipos.change_historialmantencion'), (req: AuthRequest, res) => {
  const orden = store.ordenes.find((o) => o.id === Number(req.params.id));
  if (!orden) return res.status(404).json({ detail: 'Orden no encontrada.' });
  if (orden.estado === 'Finalizada') {
    return res.status(400).json({ detail: 'La orden ya fue finalizada.' });
  }
  const equipo = store.equipos.find((e) => e.id === orden.equipoId);
  if (!equipo || equipo.is_deleted) {
    return res.status(404).json({ detail: 'Equipo asociado no disponible.' });
  }
  orden.estado = 'En curso';
  equipo.estado = 'Mantenimiento';
  dbUpsertOrden(orden, store.users);
  dbUpsertEquipo(equipo);
  recordAudit(req, 'ORDEN_INICIADA', 'ordenes', orden.id, `Equipo ${equipo.codigo}`);
  return res.json(serializeOrden(orden));
});

apiRouter.post('/ordenes/:id/finalizar', requireAuth, requirePermission('equipos.change_historialmantencion'), (req: AuthRequest, res) => {
  const orden = store.ordenes.find((o) => o.id === Number(req.params.id));
  if (!orden) return res.status(404).json({ detail: 'Orden no encontrada.' });
  if (orden.estado === 'Finalizada') {
    return res.status(400).json({ detail: 'La orden ya fue finalizada.' });
  }
  const equipo = store.equipos.find((e) => e.id === orden.equipoId);
  if (!equipo) return res.status(404).json({ detail: 'Equipo asociado no encontrado.' });

  const nowIso = new Date().toISOString();
  orden.estado = 'Finalizada';
  orden.finalizadoPorId = req.user!.id;
  orden.finalizado_en = nowIso;

  const responsables = orden.mecanicos.join(', ');
  const insumosUsados = orden.consumos
    .map((c) => `${c.insumoNombre}: ${c.cantidad} ${c.unidad}`)
    .join(', ')
    .slice(0, 255);
  const esTecnico = getUserRoles(req.user!).includes('TECNICO');

  const nuevoHistorial = {
    id: store.nextIds.mantencion++,
    equipo: equipo.id,
    mecanico_responsable: esTecnico ? req.user!.id : null,
    fecha_intervencion: nowIso,
    horometro_al_momento: equipo.horometro_actual,
    descripcion_falla_o_trabajo: `${orden.comentario} | Responsables: ${responsables}`,
    insumos_utilizados: insumosUsados,
  };
  store.mantenciones.unshift(nuevoHistorial);

  equipo.estado = equipo.cliente_empresa ? 'Arrendada' : 'Disponible';
  dbUpsertOrden(orden, store.users);
  dbInsertMantencion(nuevoHistorial);
  dbUpsertEquipo(equipo);
  recordAudit(req, 'ORDEN_FINALIZADA', 'ordenes', orden.id, `Equipo ${equipo.codigo}`);
  return res.json(serializeOrden(orden));
});
