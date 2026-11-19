import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createApp } from '../app.js';
import { initStore } from '../store.js';

process.env.NODE_ENV = 'test';

const testDbPath = path.join(os.tmpdir(), `vilas_integration_${Date.now()}.db`);
let server: http.Server;
let baseUrl = '';

async function api(
  pathname: string,
  options: { method?: string; token?: string; body?: unknown; rawForm?: FormData } = {}
) {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  let body: BodyInit | undefined;
  if (options.rawForm) {
    body = options.rawForm;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  const res = await fetch(`${baseUrl}${pathname}`, {
    method: options.method || 'GET',
    headers,
    body,
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, headers: res.headers, data: json as Record<string, unknown> & unknown[] };
}

async function login(username: string, password: string) {
  const res = await api('/api/login', {
    method: 'POST',
    body: { username, password },
  });
  return res;
}

test.before(async () => {
  initStore(testDbPath);
  const app = createApp();
  server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const addr = server.address();
  assert.ok(addr && typeof addr === 'object');
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

test.after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const suffix of ['', '-wal', '-shm']) {
    const p = `${testDbPath}${suffix}`;
    if (fs.existsSync(p)) fs.rmSync(p, { force: true });
  }
});

test('Seguridad HTTP, autenticacion JWT, perfil y esquema SQLite normalizado', async () => {
  const failLogin = await login('admin@vilasmotor.cl', 'ClaveMala999!');
  assert.equal(failLogin.status, 401);

  const okLogin = await login('admin@vilasmotor.cl', 'VilasAdmin2026!');
  assert.equal(okLogin.status, 200);
  assert.ok(okLogin.headers.get('x-content-type-options') === 'nosniff');
  const access = String(okLogin.data.access);
  const refresh = String(okLogin.data.refresh);

  const perfil = await api('/api/perfil', { token: access });
  assert.equal(perfil.status, 200);
  assert.equal(perfil.data.email, 'admin@vilasmotor.cl');

  const refreshed = await api('/api/login/refresh', {
    method: 'POST',
    body: { refresh },
  });
  assert.equal(refreshed.status, 200);

  const dbStatus = await api('/api/admin/db-status', { token: access });
  assert.equal(dbStatus.status, 200);
  assert.equal(dbStatus.data.foreignKeysEnabled, true);
  assert.ok((dbStatus.data.tables as string[]).includes('equipos'));
  assert.ok((dbStatus.data.tables as string[]).includes('categorias_equipo'));
  assert.ok((dbStatus.data.tables as string[]).includes('subcategorias_equipo'));
  assert.ok((dbStatus.data.tables as string[]).includes('orden_mecanicos'));
  assert.ok((dbStatus.data.tables as string[]).includes('audit_logs'));
  assert.ok((dbStatus.data.indexes as string[]).includes('idx_equipos_estado_deleted'));

  const audit = await api('/api/admin/auditoria', { token: access });
  assert.equal(audit.status, 200);
  assert.ok(Array.isArray(audit.data) && audit.data.length >= 2);
});

test('Control de acceso RBAC restringe por rol (TECNICO, PLANIFICACION, ADMIN)', async () => {
  const tec = await login('tecnico@vilasmotor.cl', 'VilasTec2026!');
  const plan = await login('planificacion@vilasmotor.cl', 'VilasPlan2026!');
  assert.equal(tec.status, 200);
  assert.equal(plan.status, 200);

  const tecAdmin = await api('/api/admin/usuarios', { token: String(tec.data.access) });
  assert.equal(tecAdmin.status, 403);

  const tecCreateEq = await api('/api/equipos', {
    method: 'POST',
    token: String(tec.data.access),
    body: { codigo: 'XLS-9991', nombre: 'NO PERMITIDO' },
  });
  assert.equal(tecCreateEq.status, 403);

  const planAdmin = await api('/api/admin/usuarios', { token: String(plan.data.access) });
  assert.equal(planAdmin.status, 403);

  const planView = await api('/api/equipos?page=1&page_size=10', { token: String(plan.data.access) });
  assert.equal(planView.status, 200);
  assert.equal(planView.data.count, 394);
  assert.equal((planView.data.results as unknown[]).length, 10);
});

test('Equipos: validaciones de borde, horometro regresivo, baja, filtro deshabilitadas, restauracion y persistencia SQLite', async () => {
  const admin = await login('admin@vilasmotor.cl', 'VilasAdmin2026!');
  const token = String(admin.data.access);

  const creado = await api('/api/equipos', {
    method: 'POST',
    token,
    body: {
      codigo: 'XLS-TEST-01',
      nombre: 'EXCAVADORA PRUEBA',
      categoria: 'Movimiento de tierra',
      subcategoria: 'Excavadoras',
      marca: 'CAT',
      modelo: '320D',
      horometro_actual: 500,
      meta_proxima_mant: 750,
      unidad_medida: 'HORAS',
    },
  });
  assert.equal(creado.status, 201);
  const eqId = Number(creado.data.id);

  // Duplicado
  const dup = await api('/api/equipos', {
    method: 'POST',
    token,
    body: { codigo: 'XLS-TEST-01', nombre: 'DUPLICADO' },
  });
  assert.equal(dup.status, 400);

  // Horometro regresivo rechazado
  const regresivo = await api(`/api/equipos/${eqId}`, {
    method: 'PATCH',
    token,
    body: { horometro_actual: 450 },
  });
  assert.equal(regresivo.status, 400);

  // Coordenada fuera de rango rechazada
  const coordMala = await api(`/api/equipos/${eqId}`, {
    method: 'PATCH',
    token,
    body: { latitud: 120, longitud: -70 },
  });
  assert.equal(coordMala.status, 400);

  // Archivo no imagen rechazado por magic bytes
  const badForm = new FormData();
  badForm.append('horometro_actual', '510');
  badForm.append('foto_archivo', new Blob(['texto-falso-no-es-imagen'], { type: 'image/jpeg' }), 'fake.jpg');
  const badImg = await api(`/api/equipos/${eqId}`, {
    method: 'PATCH',
    token,
    rawForm: badForm,
  });
  assert.equal(badImg.status, 400);

  // Avance valido de horometro
  const okUpdate = await api(`/api/equipos/${eqId}`, {
    method: 'PATCH',
    token,
    body: { horometro_actual: 525 },
  });
  assert.equal(okUpdate.status, 200);
  assert.equal(okUpdate.data.horometro_actual, 525);

  // Baja logica y visibilidad en incluir_deshabilitados=true
  const baja = await api(`/api/equipos/${eqId}`, { method: 'DELETE', token });
  assert.equal(baja.status, 200);
  assert.equal(baja.data.estado, 'Deshabilitada');

  const activos = await api('/api/equipos', { token });
  assert.equal((activos.data as Array<{ id: number }>).some((e) => e.id === eqId), false);

  const conDeshab = await api('/api/equipos?incluir_deshabilitados=true', { token });
  const deshabFound = (conDeshab.data as Array<{ id: number; estado: string }>).find((e) => e.id === eqId);
  assert.equal(deshabFound?.estado, 'Deshabilitada');

  // Re-hidratar desde SQLite para comprobar persistencia real en disco
  initStore(testDbPath);
  const trasReinicio = await api(`/api/equipos/${eqId}`, { token });
  assert.equal(trasReinicio.status, 200);
  assert.equal(trasReinicio.data.horometro_actual, 525);
  assert.equal(trasReinicio.data.estado, 'Deshabilitada');

  // Restaurar
  const restaurado = await api(`/api/equipos/${eqId}/restaurar`, { method: 'POST', token });
  assert.equal(restaurado.status, 200);
  assert.equal(restaurado.data.estado, 'Disponible');
});

test('Mantenciones e insumos: flujo Programada -> En curso -> Finalizar -> Historial y control de stock', async () => {
  const admin = await login('admin@vilasmotor.cl', 'VilasAdmin2026!');
  const token = String(admin.data.access);

  const eqRes = await api('/api/equipos', {
    method: 'POST',
    token,
    body: {
      codigo: 'XLS-TEST-MANT',
      nombre: 'CARGADOR FRONTAL PRUEBA',
      horometro_actual: 200,
      meta_proxima_mant: 250,
    },
  });
  assert.equal(eqRes.status, 201);
  const equipoId = Number(eqRes.data.id);

  // Validacion de borde: comentario corto o stock excesivo rechazados
  const badOrder = await api('/api/ordenes', {
    method: 'POST',
    token,
    body: {
      equipoId,
      fecha: '2026-11-19',
      comentario: 'corto',
      mecanicos: ['Carlos Muñoz'],
      consumos: [],
    },
  });
  assert.equal(badOrder.status, 400);

  const stockExcedido = await api('/api/ordenes', {
    method: 'POST',
    token,
    body: {
      equipoId,
      fecha: '2026-11-19',
      comentario: 'Cambio completo de aceite hidraulico',
      mecanicos: ['Carlos Muñoz'],
      consumos: [{ insumo: 1, cantidad: 99999 }],
    },
  });
  assert.equal(stockExcedido.status, 400);

  // Orden programada
  const progOrder = await api('/api/ordenes', {
    method: 'POST',
    token,
    body: {
      equipoId,
      fecha: '2026-11-22',
      estado: 'Programada',
      comentario: 'Mantencion programada de 250 horas',
      mecanicos: ['Carlos Muñoz'],
      consumos: [{ insumo: 1, cantidad: 5 }],
    },
  });
  assert.equal(progOrder.status, 201);
  assert.equal(progOrder.data.estado, 'Programada');
  const orderId = Number(progOrder.data.id);

  // Iniciar orden -> equipo pasa a Mantenimiento
  const started = await api(`/api/ordenes/${orderId}/iniciar`, { method: 'POST', token });
  assert.equal(started.status, 200);
  assert.equal(started.data.estado, 'En curso');

  const eqMid = await api(`/api/equipos/${equipoId}`, { token });
  assert.equal(eqMid.data.estado, 'Mantenimiento');

  // Finalizar directo desde taller -> equipo vuelve a Disponible y se agrega al historial
  const fin = await api(`/api/equipos/${equipoId}/finalizar-mantenimiento`, {
    method: 'POST',
    token,
    body: {},
  });
  assert.equal(fin.status, 200);
  assert.equal((fin.data.equipo as { estado: string }).estado, 'Disponible');

  const historial = await api('/api/mantenciones', { token });
  assert.equal(
    (historial.data as Array<{ equipo: number }>).some((h) => h.equipo === equipoId),
    true
  );
});

test('Clientes e inyeccion SQL parametrizada de forma segura', async () => {
  const admin = await login('admin@vilasmotor.cl', 'VilasAdmin2026!');
  const token = String(admin.data.access);

  const sqli = await api('/api/clientes', {
    method: 'POST',
    token,
    body: {
      nombre: "Empresa'; DROP TABLE equipos; --",
      rut: '79.111.222-3',
      categoria: 'Minería',
    },
  });
  assert.equal(sqli.status, 201);

  const equiposStillExist = await api('/api/equipos', { token });
  assert.equal(equiposStillExist.status, 200);
  assert.ok((equiposStillExist.data as unknown[]).length >= 394);
});
