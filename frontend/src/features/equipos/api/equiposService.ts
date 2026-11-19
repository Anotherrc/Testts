import { apiClient } from '../../../api/axios';
import type { Equipo } from '../types';
import type { HistorialIntervencion } from '../types';

export const equiposService = {
    // Obtener todas las maquinarias
    getAll: async (): Promise<Equipo[]> => {
        const response = await apiClient.get<Equipo[]>('/equipos/');
        return response.data;
    },

    // Obtener una maquinaria específica
    getById: async (id: number): Promise<Equipo> => {
        const response = await apiClient.get<Equipo>(`/equipos/${id}/`);
        return response.data;
    },
    getMantenciones: async (): Promise<HistorialIntervencion[]> => {
        const response = await apiClient.get<HistorialIntervencion[]>('/mantenciones/');
        return response.data;
    },

    // Actualizar el horómetro de una maquinaria
    actualizarHorometro: async (id: number, nuevoHorometro: number, nuevoUsoMes: number): Promise<Equipo> => {
        const response = await apiClient.patch<Equipo>(`/equipos/${id}/`, {
            horometro_actual: nuevoHorometro,
            horas_uso_mes: nuevoUsoMes
        });
        return response.data;
    },
    actualizar: async (id: number, payload: Partial<Equipo>): Promise<Equipo> => {
        const body = Object.values(payload).some((value) => value instanceof File)
            ? Object.entries(payload).reduce((formData, [key, value]) => {
                if (value !== undefined && value !== null) formData.append(key, value instanceof File ? value : String(value));
                return formData;
            }, new FormData())
            : payload;
        const response = await apiClient.patch<Equipo>(`/equipos/${id}/`, body, {
            headers: body instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
        });
        return response.data;
    },
    crear: async (payload: Partial<Equipo>): Promise<Equipo> => {
        const body = Object.values(payload).some((value) => value instanceof File)
            ? Object.entries(payload).reduce((formData, [key, value]) => {
                if (value !== undefined && value !== null) formData.append(key, value instanceof File ? value : String(value));
                return formData;
            }, new FormData())
            : payload;
        const response = await apiClient.post<Equipo>('/equipos/', body, {
            headers: body instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
        });
        return response.data;
    },
    darDeBaja: async (id: number): Promise<void> => {
        await apiClient.delete(`/equipos/${id}/`);
    },
};