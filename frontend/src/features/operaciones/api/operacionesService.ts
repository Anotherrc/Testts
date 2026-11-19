import { apiClient } from '../../../api/axios';
import type { Cliente, Insumo, Orden, Movimiento } from '../types';

export const operacionesService = {
  clientes: {
    listar: async () => (await apiClient.get<Cliente[]>('/clientes/')).data,
    crear: async (data: Omit<Cliente, 'id' | 'estado' | 'equipos'>) =>
      (await apiClient.post<Cliente>('/clientes/', data)).data,
    actualizar: async (id: number, data: Partial<Cliente>) =>
      (await apiClient.patch<Cliente>(`/clientes/${id}/`, data)).data,
  },
  insumos: {
    listar: async () => (await apiClient.get<Insumo[]>('/insumos/')).data,
    crear: async (data: Omit<Insumo, 'id' | 'ultimoCambioPor'>) =>
      (await apiClient.post<Insumo>('/insumos/', data)).data,
    actualizar: async (id: number, data: Partial<Insumo>) =>
      (await apiClient.patch<Insumo>(`/insumos/${id}/`, data)).data,
    ajustar: async (id: number, cantidad: number) =>
      (await apiClient.post<Insumo>(`/insumos/${id}/ajustar/`, { cantidad })).data,
    archivar: async (id: number) => apiClient.delete(`/insumos/${id}/`),
    movimientos: async () => (await apiClient.get<Movimiento[]>('/movimientos-insumos/')).data,
  },
  ordenes: {
    listar: async () => (await apiClient.get<Orden[]>('/ordenes/')).data,
    crear: async (data: {equipoId: number; fecha: string; comentario: string; mecanicos: string[]; consumos: { insumo: number; cantidad: number }[]; estado?: 'En curso' | 'Programada'}) =>
      (await apiClient.post<Orden>('/ordenes/', data)).data,
    iniciar: async (id: number) =>
      (await apiClient.post<Orden>(`/ordenes/${id}/iniciar/`)).data,
    finalizar: async (id: number) =>
      (await apiClient.post<Orden>(`/ordenes/${id}/finalizar/`)).data,
  },
};
