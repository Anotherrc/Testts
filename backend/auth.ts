import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { store, getUserRoles, getUserPermissions } from './store.js';
import type { UserRecord } from './types.js';

function resolveJwtSecret(): string {
  const configured = process.env.JWT_SECRET?.trim();
  if (configured && configured.length >= 16 && configured !== 'dev-only-change-me') {
    return configured;
  }
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_EPHEMERAL_SECRET !== 'true') {
    throw new Error('JWT_SECRET debe configurarse con al menos 16 caracteres en producción.');
  }
  return crypto.randomBytes(32).toString('hex');
}

const JWT_SECRET = resolveJwtSecret();

export interface AuthRequest extends Request {
  user?: UserRecord;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export function validatePasswordStrength(password: string): string[] {
  const errors: string[] = [];
  if (typeof password !== 'string' || password.length < 12) {
    errors.push('La contraseña debe tener al menos 12 caracteres.');
  }
  if (/^\d+$/.test(password)) {
    errors.push('La contraseña no puede ser completamente numérica.');
  }
  return errors;
}

export function generateTokens(user: UserRecord) {
  const roles = getUserRoles(user);
  const accessPayload = {
    token_type: 'access',
    user_id: user.id,
    username: user.username,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    roles,
  };
  const refreshPayload = {
    token_type: 'refresh',
    user_id: user.id,
  };
  const access = jwt.sign(accessPayload, JWT_SECRET, { expiresIn: '2h' });
  const refresh = jwt.sign(refreshPayload, JWT_SECRET, { expiresIn: '1d' });
  return { access, refresh };
}

export function verifyRefreshToken(token: string): UserRecord | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { token_type?: string; user_id?: number };
    if (decoded.token_type !== 'refresh' || !decoded.user_id) return null;
    const user = store.users.find((u) => u.id === decoded.user_id && u.is_active);
    return user || null;
  } catch {
    return null;
  }
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ detail: 'No se proporcionaron credenciales de autenticación.' });
  }
  const token = authHeader.slice(7).trim();
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { token_type?: string; user_id?: number };
    if (decoded.token_type !== 'access' || !decoded.user_id) {
      return res.status(401).json({ detail: 'Token inválido.' });
    }
    const user = store.users.find((u) => u.id === decoded.user_id);
    if (!user || !user.is_active) {
      return res.status(401).json({ detail: 'Usuario inactivo o no encontrado.' });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ detail: 'El token es inválido o ha expirado.' });
  }
}

export function userHasPermission(user: UserRecord, perm: string): boolean {
  if (!user.is_active) return false;
  if (user.is_superuser) return true;
  return getUserPermissions(user).includes(perm);
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user || !user.is_active) {
    return res.status(401).json({ detail: 'No autenticado.' });
  }
  const roles = getUserRoles(user);
  if (!user.is_superuser && !roles.includes('ADMIN')) {
    return res.status(403).json({ detail: 'No tienes permiso para realizar esta acción.' });
  }
  next();
}

export function requirePermission(perm: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user || !user.is_active) {
      return res.status(401).json({ detail: 'No autenticado.' });
    }
    if (!userHasPermission(user, perm)) {
      return res.status(403).json({ detail: 'No tienes permiso para realizar esta acción.' });
    }
    next();
  };
}

export function requireOperacionesPermission(req: AuthRequest, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user || !user.is_active) {
    return res.status(401).json({ detail: 'No autenticado.' });
  }
  if (user.is_superuser) {
    return next();
  }
  const roles = getUserRoles(user);
  const allowed = ['ADMIN', 'PLANIFICACION', 'JEFE DE PLANIFICACION'];
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())) {
    allowed.push('TECNICO');
  }
  if (!roles.some((r) => allowed.includes(r))) {
    return res.status(403).json({ detail: 'No tienes permiso para realizar esta acción.' });
  }
  next();
}
