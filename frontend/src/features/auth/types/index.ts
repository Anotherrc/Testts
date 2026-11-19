export type UserRole = 'ADMIN' | 'PLANIFICACION' | 'TECNICO';

export interface User {
    id?: number;
    email: string;
    name: string;
    roles: UserRole[]; // <-- Ahora soporta múltiples roles desde SQL (Ej: ['PLANIFICACION', 'TECNICO'])
}

export interface AuthResponse {
    access_token: string;
    refresh_token?: string;
    user: User;
}