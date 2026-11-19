import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { bootstrapDatabase, type SeedBundle } from './db.js';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function hashSeedPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

// Seeded PRNG (Mulberry32) for deterministic demo fleet data
function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function normalizarSubcategoria(nombre: string): string {
  const limpio = (nombre || '').trim();
  const clave = limpio
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (clave.startsWith('alza hombre')) return 'Alza Hombre';
  if (['retro excavadora', 'retroexcavadora', 'retroexcabadora'].includes(clave)) return 'Retroexcavadora';
  if (clave.startsWith('plataforma tijera')) return 'Plataforma Tijera';
  if (clave.startsWith('camioneta')) return 'Camionetas';
  if (clave.startsWith('camion tolva')) return 'Camión Tolva';
  if (clave.startsWith('camion pluma')) return 'Camión Pluma';
  if (clave.startsWith('camion aljibe')) return 'Camión Aljibe';
  if (clave.startsWith('camion combustible')) return 'Camión Combustible';
  if (clave.startsWith('camion lubricador')) return 'Camión Lubricador';
  if (clave.startsWith('camion pantalla')) return 'Camión Pantalla';
  if (clave.startsWith('camion plano')) return 'Camión Plano';
  if (clave.startsWith('camion plataforma')) return 'Camión Plataforma';
  if (clave.startsWith('camion rescate')) return 'Camión Rescate';
  if (clave.startsWith('tracto camion')) return 'Tracto Camión';
  if (clave === 'camion' || clave === 'camiones') return 'Camiones';
  return limpio;
}

function titleCase(str: string): string {
  return str
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const PERMISOS_BASE: Permiso[] = [
  { id: 1, name: 'Can add user', codename: 'add_user', app_label: 'auth', modelo: 'user' },
  { id: 2, name: 'Can change user', codename: 'change_user', app_label: 'auth', modelo: 'user' },
  { id: 3, name: 'Can delete user', codename: 'delete_user', app_label: 'auth', modelo: 'user' },
  { id: 4, name: 'Can view user', codename: 'view_user', app_label: 'auth', modelo: 'user' },
  { id: 5, name: 'Can add group', codename: 'add_group', app_label: 'auth', modelo: 'group' },
  { id: 6, name: 'Can change group', codename: 'change_group', app_label: 'auth', modelo: 'group' },
  { id: 7, name: 'Can delete group', codename: 'delete_group', app_label: 'auth', modelo: 'group' },
  { id: 8, name: 'Can view group', codename: 'view_group', app_label: 'auth', modelo: 'group' },
  { id: 9, name: 'Can add equipo', codename: 'add_equipo', app_label: 'equipos', modelo: 'equipo' },
  { id: 10, name: 'Can change equipo', codename: 'change_equipo', app_label: 'equipos', modelo: 'equipo' },
  { id: 11, name: 'Can delete equipo', codename: 'delete_equipo', app_label: 'equipos', modelo: 'equipo' },
  { id: 12, name: 'Can view equipo', codename: 'view_equipo', app_label: 'equipos', modelo: 'equipo' },
  { id: 13, name: 'Can add historial mantencion', codename: 'add_historialmantencion', app_label: 'equipos', modelo: 'historialmantencion' },
  { id: 14, name: 'Can change historial mantencion', codename: 'change_historialmantencion', app_label: 'equipos', modelo: 'historialmantencion' },
  { id: 15, name: 'Can delete historial mantencion', codename: 'delete_historialmantencion', app_label: 'equipos', modelo: 'historialmantencion' },
  { id: 16, name: 'Can view historial mantencion', codename: 'view_historialmantencion', app_label: 'equipos', modelo: 'historialmantencion' },
  { id: 17, name: 'Can view log telemetria gps', codename: 'view_logtelemetriagps', app_label: 'equipos', modelo: 'logtelemetriagps' },
];

const ROLES_BASE: RolRecord[] = [
  { id: 1, name: 'ADMIN', permissions: PERMISOS_BASE.map((p) => p.id) },
  { id: 2, name: 'PLANIFICACION', permissions: [9, 10, 11, 12, 13, 14, 15, 16, 17] },
  { id: 3, name: 'TECNICO', permissions: [12, 14, 16, 17] },
];

const USERS_BASE: UserRecord[] = [
  {
    id: 1,
    username: 'admin@vilasmotor.cl',
    email: 'admin@vilasmotor.cl',
    first_name: 'Administrador',
    last_name: 'Vilas Motor',
    passwordHash: hashSeedPassword('VilasAdmin2026!'),
    is_active: true,
    is_superuser: true,
    groups: [1],
  },
  {
    id: 2,
    username: 'planificacion@vilasmotor.cl',
    email: 'planificacion@vilasmotor.cl',
    first_name: 'Laura',
    last_name: 'Soto',
    passwordHash: hashSeedPassword('VilasPlan2026!'),
    is_active: true,
    is_superuser: false,
    groups: [2],
  },
  {
    id: 3,
    username: 'tecnico@vilasmotor.cl',
    email: 'tecnico@vilasmotor.cl',
    first_name: 'Carlos',
    last_name: 'Muñoz',
    passwordHash: hashSeedPassword('VilasTec2026!'),
    is_active: true,
    is_superuser: false,
    groups: [3],
  },
];

interface RawSeedEquipo {
  codigo: string;
  nombre: string;
  marca?: string;
  modelo?: string;
  meta_proxima_mant?: number;
  unidad_medida?: 'HORAS' | 'KM';
  horometro_actual?: number;
  horas_uso_mes?: number;
  limite_contrato_mes?: number;
  encendido_gps?: boolean;
  estado?: string;
  latitud?: number;
  longitud?: number;
  foto_url?: string;
}

function loadSeedEquipos(): EquipoRecord[] {
  const jsonPath = path.resolve(__dirname, 'data', 'equipos_prueba.json');
  if (!fs.existsSync(jsonPath)) return [];
  const rawList: RawSeedEquipo[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const rng = createRng(20261119);

  const rutas: Array<[number, number, string]> = [
    [-18.4783, -70.3126, 'Arica'],
    [-19.5, -70.25, 'Ruta 5 Arica-Iquique'],
    [-20.2141, -70.1524, 'Iquique'],
    [-20.95, -69.5, 'Interior de Tarapacá'],
  ];

  return rawList.map((raw, idx) => {
    const id = idx + 1;
    const codigoParts = raw.codigo.split('-');
    const codeIndex = Number(codigoParts[codigoParts.length - 1]) || id;
    const nombre = raw.nombre || '';

    let categoria = 'Movimiento de tierra';
    let subcategoria = titleCase(nombre);

    if (nombre.includes('GRUA')) {
      categoria = 'Izaje';
      subcategoria = 'Grúas horquilla';
    } else if (nombre.includes('CAMIONETA')) {
      categoria = 'Transporte';
      subcategoria = 'Camionetas';
    } else if (nombre.includes('CAMION TOLVA')) {
      categoria = 'Transporte';
      subcategoria = 'Camión Tolva';
    } else if (nombre.includes('CAMION PLUMA')) {
      categoria = 'Transporte';
      subcategoria = 'Camión Pluma';
    } else if (nombre.includes('CAMION ALJIBE')) {
      categoria = 'Transporte';
      subcategoria = 'Camión Aljibe';
    } else if (nombre.includes('CAMION COMBUSTIBLE')) {
      categoria = 'Transporte';
      subcategoria = 'Camión Combustible';
    } else if (nombre.includes('CAMION LUBRICADOR')) {
      categoria = 'Transporte';
      subcategoria = 'Camión Lubricador';
    } else if (nombre.includes('CAMION PANTALLA')) {
      categoria = 'Transporte';
      subcategoria = 'Camión Pantalla';
    } else if (nombre.includes('CAMION PLANO')) {
      categoria = 'Transporte';
      subcategoria = 'Camión Plano';
    } else if (nombre.includes('CAMION PLATAFORMA')) {
      categoria = 'Transporte';
      subcategoria = 'Camión Plataforma';
    } else if (nombre.includes('CAMION RESCATE')) {
      categoria = 'Transporte';
      subcategoria = 'Camión Rescate';
    } else if (nombre.includes('TRACTO CAMION')) {
      categoria = 'Transporte';
      subcategoria = 'Tracto Camión';
    } else if (nombre.includes('CAMION') || nombre.includes('TRACTO')) {
      categoria = 'Transporte';
      subcategoria = 'Camiones';
    } else if (nombre.includes('LUMINARIA') || nombre.includes('GENERADOR')) {
      categoria = 'Energía';
      subcategoria = 'Generación e iluminación';
    } else if (nombre.includes('COMPRESOR') || nombre.includes('SOLDADORA')) {
      categoria = 'Taller';
      subcategoria = 'Equipos de apoyo';
    }

    const tramo = codeIndex % 4;
    const [baseLat, baseLon, zona] = rutas[tramo];
    const unidadMedida: 'HORAS' | 'KM' = raw.unidad_medida === 'KM' ? 'KM' : 'HORAS';
    const roll = Math.floor(rng() * 100);

    const horometroActual =
      unidadMedida === 'KM'
        ? Math.floor(5000 + rng() * 43000)
        : Math.floor(100 + rng() * 1700);
    const limite = rng() < 0.5 ? 162.0 : 176.0;

    let estado: EquipoRecord['estado'] = 'Disponible';
    let restante = 0;

    if (roll < 8) {
      estado = 'Mantenimiento';
      restante = -Math.floor(rng() * 120);
    } else if (roll < 18) {
      estado = 'Arrendada';
      restante = Math.floor(100 + rng() * 500);
    } else if (roll < 26) {
      estado = 'Disponible';
      restante = -Math.floor(rng() * 30);
    } else if (roll < 44) {
      estado = 'Disponible';
      restante = Math.floor(10 + rng() * 35);
    } else {
      estado = 'Disponible';
      restante = Math.floor(80 + rng() * 520);
    }

    const metaProximaMant = Math.max(0, horometroActual + restante);

    return {
      id,
      codigo: raw.codigo,
      nombre,
      marca: raw.marca || '',
      modelo: raw.modelo || '',
      foto_url: raw.foto_url || '',
      foto_archivo: '',
      latitud: Number((baseLat + Math.sin(codeIndex) * 0.05).toFixed(6)),
      longitud: Number((baseLon + Math.cos(codeIndex) * 0.06).toFixed(6)),
      ubicacion_registrada: false,
      zona_operacion: zona,
      senal_movil: tramo === 0 || tramo === 2,
      categoria,
      subcategoria: normalizarSubcategoria(subcategoria),
      estado,
      is_deleted: false,
      fecha_baja: null,
      horometro_actual: horometroActual,
      meta_proxima_mant: metaProximaMant,
      unidad_medida: unidadMedida,
      horas_uso_mes: Number((rng() * limite).toFixed(1)),
      limite_contrato_mes: limite,
      encendido_gps: rng() * 100 < 35,
      cliente_asignado: null,
      cliente_empresa: null,
    };
  });
}

const seedEquipos = loadSeedEquipos();

const seedClientes: ClienteRecord[] = [
  {
    id: 1,
    nombre: 'Minera Quebrada Blanca S.A.',
    rut: '76.123.456-7',
    telefono: '+56 57 240 1100',
    correo: 'operaciones@quebradablanca.cl',
    direccion: 'Av. Arturo Prat 1080, Iquique',
    fechaCliente: '2025-03-15',
    categoria: 'Minería',
    subcategoria: 'Gran Minería',
    estado: 'Activo',
    creado_en: '2025-03-15T10:00:00.000Z',
  },
  {
    id: 2,
    nombre: 'Constructora Norte Grande Ltda.',
    rut: '77.654.321-K',
    telefono: '+56 58 221 4400',
    correo: 'arriendos@nortegrande.cl',
    direccion: 'Av. Santa María 2450, Arica',
    fechaCliente: '2025-08-22',
    categoria: 'Construcción',
    subcategoria: 'Obras Civiles',
    estado: 'Activo',
    creado_en: '2025-08-22T14:30:00.000Z',
  },
  {
    id: 3,
    nombre: 'Servicios Logísticos Tarapacá',
    rut: '78.901.234-5',
    telefono: '+56 57 232 9000',
    correo: 'flota@logisticatarapaca.cl',
    direccion: 'Ruta A-16 Km 12, Alto Hospicio',
    fechaCliente: '2026-01-10',
    categoria: 'Transporte y Logística',
    subcategoria: 'Movimiento de Carga',
    estado: 'Activo',
    creado_en: '2026-01-10T09:15:00.000Z',
  },
];

// Link Arrendada machines to seeded clients
let clientCursor = 0;
for (const eq of seedEquipos) {
  if (eq.estado === 'Arrendada') {
    eq.cliente_empresa = seedClientes[clientCursor % seedClientes.length].id;
    clientCursor += 1;
  }
}

const seedInsumos: InsumoRecord[] = [
  {
    id: 1,
    nombre: 'Aceite Hidráulico ISO VG 68',
    categoria: 'Lubricantes',
    stock: 240,
    minimo: 60,
    unidad: 'litros',
    activo: true,
    modificado_por: 1,
    actualizado_en: '2026-11-10T10:00:00.000Z',
  },
  {
    id: 2,
    nombre: 'Filtro de Aceite Motor Diesel',
    categoria: 'Filtros',
    stock: 28,
    minimo: 10,
    unidad: 'unidades',
    activo: true,
    modificado_por: 1,
    actualizado_en: '2026-11-10T10:00:00.000Z',
  },
  {
    id: 3,
    nombre: 'Grasa Multipropósito EP2',
    categoria: 'Lubricantes',
    stock: 45,
    minimo: 15,
    unidad: 'kg',
    activo: true,
    modificado_por: 2,
    actualizado_en: '2026-11-12T15:20:00.000Z',
  },
  {
    id: 4,
    nombre: 'Filtro de Aire Primario',
    categoria: 'Filtros',
    stock: 16,
    minimo: 8,
    unidad: 'unidades',
    activo: true,
    modificado_por: 2,
    actualizado_en: '2026-11-14T11:10:00.000Z',
  },
  {
    id: 5,
    nombre: 'Pastillas de Freno Servicio Pesado',
    categoria: 'Frenos',
    stock: 12,
    minimo: 6,
    unidad: 'juegos',
    activo: true,
    modificado_por: 1,
    actualizado_en: '2026-11-15T09:00:00.000Z',
  },
  {
    id: 6,
    nombre: 'Refrigerante Anticorrosivo 50/50',
    categoria: 'Fluidos',
    stock: 95,
    minimo: 30,
    unidad: 'litros',
    activo: true,
    modificado_por: 1,
    actualizado_en: '2026-11-16T08:40:00.000Z',
  },
];

const seedMovimientos: MovimientoInsumoRecord[] = seedInsumos.map((insumo, idx) => ({
  id: idx + 1,
  insumo: insumo.id,
  cantidad: insumo.stock,
  motivo: 'Ingreso inicial',
  orden: null,
  usuario: insumo.modificado_por,
  fecha: insumo.actualizado_en,
}));

const seedOrdenes: OrdenMantenimientoRecord[] = [];
const seedMantenciones: HistorialMantencionRecord[] = [];

// Create open orders for the first few machines in Mantenimiento, leaving some in Mantenimiento without order to verify both flows
const enMantenimientoInicial = seedEquipos.filter((e) => e.estado === 'Mantenimiento');
enMantenimientoInicial.slice(0, 6).forEach((eq, idx) => {
  const orderId = idx + 1;
  seedOrdenes.push({
    id: orderId,
    equipoId: eq.id,
    fecha: `2026-11-${String(12 + (idx % 6)).padStart(2, '0')}`,
    comentario: [
      'Mantención preventiva 50 hrs, cambio de aceite y revisión hidráulica',
      'Revisión sistema de frenos, ajuste de pastillas y purga de líneas',
      'Cambio de filtros de aire y aceite, engrase general de articulaciones',
      'Inspección eléctrica y diagnóstico de alternador en taller',
      'Reparación de manguera hidráulica de alta presión y reposición de fluido',
      'Mantenimiento programado de motor y control de refrigerante',
    ][idx % 6],
    estado: 'En curso',
    mecanicos: [idx % 2 === 0 ? 'Carlos Muñoz' : 'Daniela Rojas'],
    consumos: idx % 2 === 0 ? [{ insumoId: 1, insumoNombre: 'Aceite Hidráulico ISO VG 68', cantidad: 10, unidad: 'litros' }] : [],
    creadoPorId: 2,
    finalizadoPorId: null,
    creado_en: '2026-11-15T09:00:00.000Z',
    finalizado_en: null,
  });
});

// Create some historical finalized orders & maintenance history records
const disponiblesParaHistorial = seedEquipos.filter((e) => e.estado === 'Disponible').slice(0, 12);
disponiblesParaHistorial.forEach((eq, idx) => {
  const mantId = idx + 1;
  const orderId = seedOrdenes.length + 1;
  const desc = [
    'Mantención preventiva general completada',
    'Cambio de aceite y filtros de motor',
    'Revisión de frenos y sistema hidráulico',
    'Inspección de seguridad y lubricación completa',
  ][idx % 4];
  const insumosTxt = [
    'Aceite Hidráulico ISO VG 68: 15 litros, Filtro de Aceite Motor Diesel: 1 unidades',
    'Grasa Multipropósito EP2: 2 kg, Filtro de Aire Primario: 1 unidades',
    'Pastillas de Freno Servicio Pesado: 1 juegos',
    'Sin insumos utilizados',
  ][idx % 4];

  seedMantenciones.push({
    id: mantId,
    equipo: eq.id,
    mecanico_responsable: 3,
    fecha_intervencion: `2026-10-${String(10 + idx).padStart(2, '0')}T15:30:00.000Z`,
    horometro_al_momento: Math.max(0, eq.horometro_actual - 40),
    descripcion_falla_o_trabajo: desc,
    insumos_utilizados: insumosTxt,
  });

  if (idx < 4) {
    seedOrdenes.push({
      id: orderId,
      equipoId: eq.id,
      fecha: `2026-10-${String(10 + idx).padStart(2, '0')}`,
      comentario: desc,
      estado: 'Finalizada',
      mecanicos: ['Carlos Muñoz'],
      consumos: [],
      creadoPorId: 2,
      finalizadoPorId: 3,
      creado_en: `2026-10-${String(10 + idx).padStart(2, '0')}T09:00:00.000Z`,
      finalizado_en: `2026-10-${String(10 + idx).padStart(2, '0')}T15:30:00.000Z`,
    });
  }
});

const seedTelemetria: LogTelemetriaGPSRecord[] = seedEquipos.slice(0, 20).map((eq, idx) => ({
  id: idx + 1,
  equipo: eq.id,
  timestamp_evento: new Date(Date.now() - idx * 3600_000).toISOString(),
  motor_encendido: eq.encendido_gps,
  horometro_reportado: eq.horometro_actual,
  sincronizado_offline: !eq.senal_movil,
}));

function buildSeedBundle(): SeedBundle {
  return {
    permisos: PERMISOS_BASE.map((p) => ({ ...p })),
    roles: ROLES_BASE.map((r) => ({ ...r, permissions: [...r.permissions] })),
    users: USERS_BASE.map((u) => ({ ...u, groups: [...u.groups] })),
    clientes: seedClientes.map((c) => ({ ...c })),
    equipos: seedEquipos.map((e) => ({ ...e })),
    insumos: seedInsumos.map((i) => ({ ...i })),
    movimientosInsumos: seedMovimientos.map((m) => ({ ...m })),
    ordenes: seedOrdenes.map((o) => ({
      ...o,
      mecanicos: [...o.mecanicos],
      consumos: o.consumos.map((c) => ({ ...c })),
    })),
    mantenciones: seedMantenciones.map((m) => ({ ...m })),
    telemetria: seedTelemetria.map((t) => ({ ...t })),
  };
}

function maxId(list: Array<{ id: number }>): number {
  return list.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;
}

export const store = {
  permisos: [] as Permiso[],
  roles: [] as RolRecord[],
  users: [] as UserRecord[],
  equipos: [] as EquipoRecord[],
  mantenciones: [] as HistorialMantencionRecord[],
  telemetria: [] as LogTelemetriaGPSRecord[],
  clientes: [] as ClienteRecord[],
  insumos: [] as InsumoRecord[],
  movimientosInsumos: [] as MovimientoInsumoRecord[],
  ordenes: [] as OrdenMantenimientoRecord[],
  resetTokens: new Map<string, { userId: number; uid: string; expiresAt: number }>(),
  nextIds: {
    rol: 1,
    user: 1,
    equipo: 1,
    mantencion: 1,
    telemetria: 1,
    cliente: 1,
    insumo: 1,
    movimiento: 1,
    orden: 1,
  },
};

export function initStore(customDbPath?: string) {
  const hydrated = bootstrapDatabase(buildSeedBundle(), customDbPath);
  store.permisos.splice(0, store.permisos.length, ...hydrated.permisos);
  store.roles.splice(0, store.roles.length, ...hydrated.roles);
  store.users.splice(0, store.users.length, ...hydrated.users);
  store.clientes.splice(0, store.clientes.length, ...hydrated.clientes);
  store.equipos.splice(0, store.equipos.length, ...hydrated.equipos);
  store.insumos.splice(0, store.insumos.length, ...hydrated.insumos);
  store.ordenes.splice(0, store.ordenes.length, ...hydrated.ordenes);
  store.movimientosInsumos.splice(0, store.movimientosInsumos.length, ...hydrated.movimientosInsumos);
  store.mantenciones.splice(0, store.mantenciones.length, ...hydrated.mantenciones);
  store.telemetria.splice(0, store.telemetria.length, ...hydrated.telemetria);
  store.resetTokens.clear();
  for (const [k, v] of hydrated.resetTokens.entries()) {
    store.resetTokens.set(k, v);
  }
  store.nextIds.rol = maxId(store.roles);
  store.nextIds.user = maxId(store.users);
  store.nextIds.equipo = maxId(store.equipos);
  store.nextIds.mantencion = maxId(store.mantenciones);
  store.nextIds.telemetria = maxId(store.telemetria);
  store.nextIds.cliente = maxId(store.clientes);
  store.nextIds.insumo = maxId(store.insumos);
  store.nextIds.movimiento = maxId(store.movimientosInsumos);
  store.nextIds.orden = maxId(store.ordenes);
}

initStore();

export function getUserRoles(user: UserRecord): string[] {
  const roleNames = user.groups
    .map((gid) => store.roles.find((r) => r.id === gid)?.name.toUpperCase())
    .filter((n): n is string => Boolean(n));
  if (user.is_superuser && !roleNames.includes('ADMIN')) {
    roleNames.unshift('ADMIN');
  }
  return Array.from(new Set(roleNames));
}

export function getUserPermissions(user: UserRecord): string[] {
  if (!user.is_active) return [];
  if (user.is_superuser) {
    return store.permisos.map((p) => `${p.app_label}.${p.codename}`).sort();
  }
  const permIds = new Set<number>();
  for (const gid of user.groups) {
    const role = store.roles.find((r) => r.id === gid);
    if (role) {
      for (const pid of role.permissions) permIds.add(pid);
    }
  }
  return store.permisos
    .filter((p) => permIds.has(p.id))
    .map((p) => `${p.app_label}.${p.codename}`)
    .sort();
}

export function getUserDisplayName(userId: number | null): string {
  if (!userId) return 'Sistema';
  const u = store.users.find((x) => x.id === userId);
  if (!u) return 'Sistema';
  const full = `${u.first_name} ${u.last_name}`.trim();
  return full || u.username;
}

export function serializeUserAdmin(user: UserRecord) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    is_active: user.is_active,
    is_superuser: user.is_superuser,
    roles: getUserRoles(user),
  };
}

export function computeEquipoAlertas(
  eq: Pick<
    EquipoRecord,
    'estado' | 'is_deleted' | 'meta_proxima_mant' | 'horometro_actual' | 'unidad_medida' | 'limite_contrato_mes' | 'horas_uso_mes'
  >
) {
  const horas_restantes = Number((eq.meta_proxima_mant - eq.horometro_actual).toFixed(2));
  const umbralPreventivo = eq.unidad_medida === 'KM' ? 100.0 : 50.0;

  let estado_alerta = 'OPERATIVO: Disponible';
  if (eq.estado === 'Deshabilitada' || eq.is_deleted) {
    estado_alerta = 'INHABILITADO: Fuera de Servicio';
  } else if (horas_restantes <= 0) {
    estado_alerta = 'URGENTE: Mantenimiento Vencido';
  } else if (horas_restantes <= umbralPreventivo) {
    estado_alerta = 'PRÓXIMO: Agendar mantenimiento';
  }

  let color_semaforo: 'ROJO' | 'AMARILLO' | 'VERDE' | 'GRIS' = 'VERDE';
  if (eq.estado === 'Deshabilitada' || eq.is_deleted) {
    color_semaforo = 'GRIS';
  } else if (eq.estado === 'Mantenimiento' || estado_alerta.includes('URGENTE')) {
    color_semaforo = 'ROJO';
  } else if (estado_alerta.includes('PRÓXIMO')) {
    color_semaforo = 'AMARILLO';
  }

  const horas_contrato_disponibles = Number(Math.max(0, eq.limite_contrato_mes - eq.horas_uso_mes).toFixed(2));
  const exceso_horas_contrato =
    eq.horas_uso_mes > eq.limite_contrato_mes
      ? Number((eq.horas_uso_mes - eq.limite_contrato_mes).toFixed(2))
      : 0.0;

  return {
    horas_restantes,
    estado_alerta,
    color_semaforo,
    horas_contrato_disponibles,
    exceso_horas_contrato,
  };
}

export function serializeEquipo(eq: EquipoRecord) {
  return {
    ...eq,
    ...computeEquipoAlertas(eq),
  };
}

export function serializeMantencion(m: HistorialMantencionRecord) {
  const eq = store.equipos.find((e) => e.id === m.equipo);
  const mecanico = m.mecanico_responsable ? store.users.find((u) => u.id === m.mecanico_responsable) : null;
  return {
    ...m,
    equipo_codigo: eq?.codigo || '',
    mecanico_nombre: mecanico ? `${mecanico.first_name} ${mecanico.last_name}`.trim() || mecanico.username : 'Sin asignar',
  };
}

export function serializeCliente(c: ClienteRecord) {
  const equipos = store.equipos.filter((e) => !e.is_deleted && e.cliente_empresa === c.id).length;
  return {
    id: c.id,
    nombre: c.nombre,
    rut: c.rut,
    telefono: c.telefono,
    correo: c.correo,
    direccion: c.direccion,
    fechaCliente: c.fechaCliente,
    categoria: c.categoria,
    subcategoria: c.subcategoria,
    estado: c.estado,
    equipos,
  };
}

export function serializeInsumo(i: InsumoRecord) {
  return {
    id: i.id,
    nombre: i.nombre,
    categoria: i.categoria,
    stock: Number(i.stock),
    minimo: Number(i.minimo),
    unidad: i.unidad,
    ultimoCambioPor: i.modificado_por ? getUserDisplayName(i.modificado_por) : '',
  };
}

export function serializeMovimiento(m: MovimientoInsumoRecord) {
  const insumo = store.insumos.find((i) => i.id === m.insumo);
  return {
    id: m.id,
    insumo: m.insumo,
    insumo_nombre: insumo?.nombre || '',
    cantidad: Number(m.cantidad).toFixed(2),
    motivo: m.motivo,
    fecha: m.fecha,
    usuario_nombre: m.usuario ? getUserDisplayName(m.usuario) : 'Sistema',
  };
}

export function serializeOrden(o: OrdenMantenimientoRecord) {
  const eq = store.equipos.find((e) => e.id === o.equipoId);
  const insumosTexto =
    o.consumos.length > 0
      ? o.consumos.map((c) => `${c.insumoNombre}: ${c.cantidad} ${c.unidad}`).join(', ')
      : 'Sin insumos utilizados';
  return {
    id: o.id,
    equipoId: o.equipoId,
    equipo: eq ? `${eq.codigo} · ${eq.nombre}` : `Equipo #${o.equipoId}`,
    mecanicos: o.mecanicos,
    fecha: o.fecha,
    estado: o.estado,
    comentario: o.comentario,
    insumos: insumosTexto,
    creadoPor: getUserDisplayName(o.creadoPorId),
    finalizadoPor: o.finalizadoPorId ? getUserDisplayName(o.finalizadoPorId) : null,
  };
}
