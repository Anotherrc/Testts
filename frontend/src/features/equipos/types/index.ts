export type TipoMedicion = 'HORAS' | 'KM';

export type EstadoOperativo = 'Disponible' | 'En Taller';

export interface HistorialIntervencion {
  id: number;
  equipo: number;
  equipo_codigo?: string;
  mecanico_responsable?: number | null;
  mecanico_nombre: string;
  fecha_intervencion: string;
  horometro_al_momento: number;
  descripcion_falla_o_trabajo: string;
  insumos_utilizados: string;
}

export interface Equipo {
    id: number;
    codigo: string;
    nombre: string;
    nro_interno?: string;
    tipo_equipo?: string;
    marca?: string;
    modelo?: string;
    patente?: string;
    kilometraje?: number;
    foto_url?: string;
    foto_archivo?: string | File;
    latitud?: number;
    longitud?: number;
    zona_operacion?: string;
    senal_movil?: boolean;
    ubicacion_registrada?: boolean;
    categoria?: string;
    subcategoria?: string;
    estado: string;
    is_deleted?: boolean;
    fecha_baja?: string | null;
    horometro_actual: number;
    meta_proxima_mant: number;
    unidad_medida: 'HORAS' | 'KM';
    horas_uso_mes: number;
    limite_contrato_mes: number;
    encendido_gps: boolean;
    color_semaforo: 'ROJO' | 'AMARILLO' | 'VERDE' | 'GRIS';
    exceso_horas_contrato: number;
    horas_restantes: number;
    estado_alerta?: string;
    cliente_asignado?: number | null;
    cliente_empresa?: number | null;
    cliente_nombre?: string;
}
