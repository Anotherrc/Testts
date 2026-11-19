export type Cliente = {
  id: number; nombre: string; rut: string; telefono: string; correo: string;
  direccion: string; fechaCliente: string | null; categoria: string;
  subcategoria: string; estado: 'Activo' | 'Inactivo'; equipos: number;
};

export type Insumo = {
  id: number; nombre: string; categoria: string; stock: number; minimo: number;
  unidad: string; ultimoCambioPor?: string;
};

export type Orden = {
  id: number; equipoId: number; equipo: string; mecanicos: string[];
  fecha: string; estado: 'En curso' | 'Programada' | 'Finalizada';
  comentario: string; insumos: string; creadoPor?: string; finalizadoPor?: string;
};

export type Movimiento = {
  id: number; insumo: number; insumo_nombre: string; cantidad: string;
  motivo: string; fecha: string; usuario_nombre: string;
};
