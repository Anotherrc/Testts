import React from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';

// Proveedor de Autenticación (Ajustado a src/context)
import { AuthProvider } from '../context/AuthProvider';

// Layouts y Páginas
import { MainLayout } from '../components/layout/MainLayout';
import { LoginPage } from '../pages/LoginPage';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage';
import { ResetPasswordPage } from '../pages/ResetPasswordPage';
import { RegisterPage } from '../pages/RegisterPage';
import { EquiposPage } from '../pages/EquiposPage';
import { AdminUsuariosPage } from '../pages/AdminUsuariosPage';
import { DashboardPage } from '../pages/DashboardPage';
import { GeolocalizacionPage } from '../pages/GeolocalizacionPage';
import { ClientesPage } from '../pages/ClientesPage';
import { MantencionesPage } from '../pages/MantencionesPage';
import { InsumosPage } from '../pages/InsumosPage';
import { GpsEncendidosPage } from '../pages/GpsEncendidosPage';
import { MaquinariasEstadoPage } from '../pages/MaquinariasEstadoPage';
import { EquipoDetallePage } from '../pages/EquipoDetallePage';
import { ReporteMaquinariasPage } from '../pages/ReporteMaquinariasPage';

// Control de Autenticación y Roles (RBAC)
import { useAuth } from '../features/auth/hooks/useAuth';
// Importamos los tipos desde donde definiste UserRole (ajustado a src/context)
import type { UserRole } from '../context/AuthContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

interface RoleRouteProps {
    children: React.ReactNode;
    allowedRoles: UserRole[];
}

// 1. Componente para proteger rutas privadas (requiere iniciar sesión)
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return <div className="flex h-screen items-center justify-center font-bold">Cargando sesión...</div>;
    }

    return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

// 2. Componente para restringir rutas por rol específico (RBAC)
const RoleRoute: React.FC<RoleRouteProps> = ({ children, allowedRoles }) => {
    const { isAuthenticated, hasRole, isLoading } = useAuth();

    if (isLoading) {
        return <div className="flex h-screen items-center justify-center font-bold">Verificando permisos...</div>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return hasRole(allowedRoles) ? <>{children}</> : <Navigate to="/dashboard" replace />;
};

// La UI consulta los mismos permisos que Django valida en la API.
const PermissionRoute: React.FC<{children: React.ReactNode; required: string}> = ({ children, required }) => {
    const { isAuthenticated, hasPermission, isLoading } = useAuth();
    if (isLoading) return <div className="flex h-screen items-center justify-center font-bold">Verificando permisos...</div>;
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    return hasPermission(required) ? <>{children}</> : <Navigate to="/dashboard" replace />;
};

// Configuración de las Rutas de la Aplicación
const router = createBrowserRouter([
    {
        path: '/login',
        element: <LoginPage />,
    },
    {
        path: '/recuperar-contrasena',
        element: <ForgotPasswordPage />,
    },
    {
        path: '/restablecer-contrasena/:uid/:token',
        element: <ResetPasswordPage />,
    },
    {
        path: '/registro',
        element: (
            <RoleRoute allowedRoles={['ADMIN']}>
                <RegisterPage />
            </RoleRoute>
        ),
    },
    {
        path: '/',
        element: (
            <ProtectedRoute>
                <MainLayout />
            </ProtectedRoute>
        ),
        children: [
            {
                path: '',
                element: <Navigate to="/dashboard" replace />,
            },
            {
                path: 'dashboard',
                element: <DashboardPage />,
            },
            {
                path: 'clientes',
                element: (
                    <RoleRoute allowedRoles={['ADMIN', 'PLANIFICACION']}>
                        <ClientesPage />
                    </RoleRoute>
                ),
            },
            {
                path: 'flotas',
                element: (
                    <PermissionRoute required="equipos.view_equipo"><EquiposPage /></PermissionRoute>
                ),
            },
            { path: 'flotas/:id', element: <EquipoDetallePage /> },
            { path: 'gps-encendidos', element: <GpsEncendidosPage /> },
            { path: 'estado-maquinaria/:tipo', element: <MaquinariasEstadoPage /> },
            { path: 'reportes/maquinarias', element: <ReporteMaquinariasPage /> },
            { path: 'geolocalizacion', element: <PermissionRoute required="equipos.view_logtelemetriagps"><GeolocalizacionPage /></PermissionRoute> },
            { path: 'mantenciones', element: <PermissionRoute required="equipos.view_historialmantencion"><MantencionesPage /></PermissionRoute> },
            { path: 'insumos', element: <RoleRoute allowedRoles={['ADMIN', 'PLANIFICACION', 'TECNICO']}><InsumosPage /></RoleRoute> },
            // Ruta de Admin
            {
                path: 'admin/usuarios',
                element: (
                    <RoleRoute allowedRoles={['ADMIN']}>
                        <AdminUsuariosPage />
                    </RoleRoute>
                ),
            },
        ],
    },
    {
        path: '*',
        element: <Navigate to="/login" replace />,
    },
]);

// Esto se encarga de que react reciba bien los archivos
export const AppRouter: React.FC = () => {
    return (
        <AuthProvider>
            <RouterProvider router={router} />
        </AuthProvider>
    );
};
