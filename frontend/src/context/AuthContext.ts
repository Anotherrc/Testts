import { createContext } from 'react';

// ==========================================
// 1. DEFINICIÓN DE TIPOS
// ==========================================
export type UserRole = 'ADMIN' | 'PLANIFICACION' | 'TECNICO';

export interface User {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    roles: UserRole[];
    is_active: boolean;
    is_superuser: boolean;
    permisos: string[];
}

export interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (credentials: { username: string; password: string }) => Promise<void>;
    logout: () => void;
    hasRole: (allowedRoles: UserRole[]) => boolean;
    hasPermission: (permission: string) => boolean;
}

// ==========================================
// 2. CREACIÓN DEL CONTEXTO
// ==========================================
export const AuthContext = createContext<AuthContextType | undefined>(undefined);