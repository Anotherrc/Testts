import React, { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { apiClient } from '../api/axios'; // Ajusta la ruta a axios.ts según tu proyecto

// Importamos el contexto y los tipos del archivo separado
import { AuthContext } from './AuthContext';
import type { User, UserRole } from './AuthContext';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const checkAuth = useCallback(async () => {
        const token = localStorage.getItem('access_token');

        if (!token) {
            await Promise.resolve();
            setIsLoading(false);
            return;
        }

        try {
            const res = await apiClient.get<User>('/perfil/');
            setUser(res.data);
        } catch {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    const login = async (credentials: { username: string; password: string }) => {
        const { data: tokenData } = await apiClient.post('/login/', credentials);

        localStorage.setItem('access_token', tokenData.access);
        localStorage.setItem('refresh_token', tokenData.refresh);

        const res = await apiClient.get<User>('/perfil/');
        setUser(res.data);
    };

    const logout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setUser(null);
        window.location.href = '/login';
    };

    const hasRole = (allowedRoles: UserRole[]) => {
        if (!user || !user.roles) return false;
        return allowedRoles.some((role) => user.roles.includes(role));
    };

    const hasPermission = (permission: string) => {
        return !!user && (user.is_superuser || (user.permisos || []).includes(permission));
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: !!user,
                isLoading,
                login,
                logout,
                hasRole,
                hasPermission,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};