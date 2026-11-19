export interface Permiso {
  id: number;
  name: string;
  codename: string;
  app_label: string;
  modelo: string;
}

export interface RolRecord {
  id: number;
  name: string;
  permissions: number[];
}

export interface UserRecord {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  passwordHash: string;
  is_active: boolean;
  is_superuser: boolean;
  groups: number[];
}

export interface EquipoRecord {
  id: number;
  codigo: string;
  nombre: string;
  marca: string;
  modelo: string;
  foto_url: string;
  foto_archivo: string;
  latitud: number;
  longitud: number;
  ubicacion_registrada: boolean;
  zona_operacion: string;
  senal_movil: boolean;
  categoria: string;
  subcategoria: string;
  estado: 'Disponible' | 'Mantenimiento' | 'Arrendada' | 'Deshabilitada';
  is_deleted: boolean;
  fecha_baja: string | null;
  horometro_actual: number;
  meta_proxima_mant: number;
  unidad_medida: 'HORAS' | 'KM';
  horas_uso_mes: number;
  limite_contrato_mes: number;
  encendido_gps: boolean;
  cliente_asignado: number | null;
  cliente_empresa: number | null;
}

export interface HistorialMantencionRecord {
  id: number;
  equipo: number;
  mecanico_responsable: number | null;
  fecha_intervencion: string;
  horometro_al_momento: number;
  descripcion_falla_o_trabajo: string;
  insumos_utilizados: string;
}

export interface LogTelemetriaGPSRecord {
  id: number;
  equipo: number;
  timestamp_evento: string;
  motor_encendido: boolean;
  horometro_reportado: number;
  sincronizado_offline: boolean;
}

export interface ClienteRecord {
  id: number;
  nombre: string;
  rut: string | null;
  telefono: string;
  correo: string;
  direccion: string;
  fechaCliente: string | null;
  categoria: string;
  subcategoria: string;
  estado: 'Activo' | 'Inactivo';
  creado_en: string;
}

export interface InsumoRecord {
  id: number;
  nombre: string;
  categoria: string;
  stock: number;
  minimo: number;
  unidad: string;
  activo: boolean;
  modificado_por: number | null;
  actualizado_en: string;
}

export interface MovimientoInsumoRecord {
  id: number;
  insumo: number;
  cantidad: number;
  motivo: string;
  orden: number | null;
  usuario: number | null;
  fecha: string;
}

export interface OrdenMantenimientoRecord {
  id: number;
  equipoId: number;
  fecha: string;
  comentario: string;
  estado: 'Programada' | 'En curso' | 'Finalizada';
  mecanicos: string[];
  consumos: Array<{
    insumoId: number;
    insumoNombre: string;
    cantidad: number;
    unidad: string;
  }>;
  creadoPorId: number | null;
  finalizadoPorId: number | null;
  creado_en: string;
  finalizado_en: string | null;
}
