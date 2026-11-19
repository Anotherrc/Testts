import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  generateTokens,
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
  verifyRefreshToken,
} from '../auth.js';
import { computeEquipoAlertas, initStore, normalizarSubcategoria, store } from '../store.js';

const testDbPath = path.join(os.tmpdir(), `vilas_unit_${Date.now()}.db`);

test.before(() => {
  initStore(testDbPath);
});

test.after(() => {
  for (const suffix of ['', '-wal', '-shm']) {
    const p = `${testDbPath}${suffix}`;
    if (fs.existsSync(p)) fs.rmSync(p, { force: true });
  }
});

test('hashPassword y verifyPassword usan scrypt con salt unico y verificacion segura', () => {
  const hash1 = hashPassword('VilasClaveSegura#2026');
  const hash2 = hashPassword('VilasClaveSegura#2026');

  assert.notEqual(hash1, hash2, 'Cada hash debe generar un salt aleatorio distinto');
  assert.equal(verifyPassword('VilasClaveSegura#2026', hash1), true);
  assert.equal(verifyPassword('ClaveIncorrecta!123', hash1), false);
  assert.equal(verifyPassword('cualquiera', 'formato_invalido'), false);
});

test('validatePasswordStrength exige minimo 12 caracteres y rechaza solo numeros', () => {
  assert.ok(validatePasswordStrength('corta123').length > 0);
  assert.ok(validatePasswordStrength('12345678901234').length > 0);
  assert.deepEqual(validatePasswordStrength('VilasMotor2026!'), []);
});

test('normalizarSubcategoria unifica variantes tipograficas del catalogo', () => {
  assert.equal(normalizarSubcategoria('retroexcabadora'), 'Retroexcavadora');
  assert.equal(normalizarSubcategoria('retro-excavadora'), 'Retroexcavadora');
  assert.equal(normalizarSubcategoria('Alza Hombre Electrico'), 'Alza Hombre');
  assert.equal(normalizarSubcategoria('camion tolva 15m3'), 'Camión Tolva');
  assert.equal(normalizarSubcategoria('camioneta 4x4'), 'Camionetas');
});

test('computeEquipoAlertas calcula semaforo ROJO, AMARILLO, VERDE, GRIS y exceso de contrato', () => {
  const verde = computeEquipoAlertas({
    estado: 'Disponible',
    is_deleted: false,
    meta_proxima_mant: 500,
    horometro_actual: 400,
    unidad_medida: 'HORAS',
    limite_contrato_mes: 162,
    horas_uso_mes: 120,
  });
  assert.equal(verde.color_semaforo, 'VERDE');
  assert.equal(verde.horas_restantes, 100);
  assert.equal(verde.horas_contrato_disponibles, 42);
  assert.equal(verde.exceso_horas_contrato, 0);

  const amarilloKm = computeEquipoAlertas({
    estado: 'Arrendada',
    is_deleted: false,
    meta_proxima_mant: 10080,
    horometro_actual: 10000,
    unidad_medida: 'KM',
    limite_contrato_mes: 176,
    horas_uso_mes: 190.5,
  });
  assert.equal(amarilloKm.color_semaforo, 'AMARILLO');
  assert.equal(amarilloKm.exceso_horas_contrato, 14.5);

  const rojoVencido = computeEquipoAlertas({
    estado: 'Disponible',
    is_deleted: false,
    meta_proxima_mant: 300,
    horometro_actual: 305,
    unidad_medida: 'HORAS',
    limite_contrato_mes: 162,
    horas_uso_mes: 0,
  });
  assert.equal(rojoVencido.color_semaforo, 'ROJO');
  assert.match(rojoVencido.estado_alerta, /URGENTE/);

  const gris = computeEquipoAlertas({
    estado: 'Deshabilitada',
    is_deleted: true,
    meta_proxima_mant: 500,
    horometro_actual: 100,
    unidad_medida: 'HORAS',
    limite_contrato_mes: 162,
    horas_uso_mes: 0,
  });
  assert.equal(gris.color_semaforo, 'GRIS');
});

test('generateTokens y verifyRefreshToken distinguen access y refresh tokens', () => {
  const admin = store.users.find((u) => u.email === 'admin@vilasmotor.cl');
  assert.ok(admin);
  const { access, refresh } = generateTokens(admin);

  assert.equal(verifyRefreshToken(access), null, 'Un access token no debe servir como refresh');
  assert.equal(verifyRefreshToken('token.invalido.jwt'), null);
  const verified = verifyRefreshToken(refresh);
  assert.equal(verified?.id, admin.id);
});
