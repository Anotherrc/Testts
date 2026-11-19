import { apiClient } from '../../../api/axios';

export interface Rol {
    id: number;
    name: string;
    permissions: Array<Permiso | number>;
}

export interface Permiso {
    id: number;
    name: string;
    codename: string;
    app_label: string;
    modelo: string;
}

export interface UsuarioAdmin {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    is_active: boolean;
    is_superuser: boolean;
    roles: string[];
}

export const adminService = {
    eliminarUsuario: async (id: number): Promise<void> => {
        await apiClient.delete(`/admin/usuarios/${id}/`);
    },
    // --- CRUD DE ROLES ---
    getRoles: async (): Promise<Rol[]> => {
        const res = await apiClient.get('/admin/roles/');
        return res.data;
    },
    crearRol: async (name: string): Promise<Rol> => {
        const res = await apiClient.post('/admin/roles/', { name, permissions: [] });
        return res.data;
    },
    crearRolConPermisos: async (name: string, permissions: number[]): Promise<Rol> => {
        const res = await apiClient.post('/admin/roles/', { name, permissions });
        return res.data;
    },
    actualizarPermisosRol: async (roleId: number, permissions: number[]): Promise<Rol> => {
        const res = await apiClient.patch(`/admin/roles/${roleId}/`, { permissions });
        return res.data;
    },
    eliminarRol: async (id: number): Promise<void> => {
        await apiClient.delete(`/admin/roles/${id}/`);
    },

    // --- GESTIÓN DE USUARIOS ---
    getUsuarios: async (): Promise<UsuarioAdmin[]> => {
        const res = await apiClient.get('/admin/usuarios/');
        return res.data;
    },
    actualizarRolesUsuario: async (userId: number, grupos_ids: number[]): Promise<UsuarioAdmin> => {
        const res = await apiClient.patch(`/admin/usuarios/${userId}/`, { grupos_ids });
        return res.data;
    },
    cambiarEstadoUsuario: async (userId: number, is_active: boolean): Promise<UsuarioAdmin> => {
        const res = await apiClient.patch(`/admin/usuarios/${userId}/`, { is_active });
        return res.data;
    },
    getPermisos: async (): Promise<Permiso[]> => {
        const res = await apiClient.get('/admin/permisos/');
        return res.data;
    },
    actualizarUsuario: async (userId: number, data: Partial<UsuarioAdmin>): Promise<UsuarioAdmin> => {
        const res = await apiClient.patch(`/admin/usuarios/${userId}/`, data);
        return res.data;
    }
};