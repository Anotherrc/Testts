import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../features/auth/hooks/useAuth';
import type { UserRole } from '../../context/AuthContext';

// Estructura de cada botón del menú
interface NavItem {
    name: string;
    path: string;
    allowedRoles: UserRole[]; // Reglas heredadas de módulos sin permisos configurables
    requiredPermission?: string; // Casilla de permiso guardada en Django
    icon: React.ReactNode;
}

// 1. CONFIGURACIÓN DE RUTAS Y SUS PERMISOS (RBAC)
const navItems: NavItem[] = [
    {
        name: 'Dashboard',
        path: '/dashboard',
        // Visible para todos los roles operativos y administrativos
        allowedRoles: ['ADMIN', 'PLANIFICACION', 'TECNICO'],
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
        ),
    },
    {
        name: 'Geolocalización GPS',
        path: '/geolocalizacion',
        requiredPermission: 'equipos.view_logtelemetriagps',
        allowedRoles: ['ADMIN', 'PLANIFICACION', 'TECNICO'],
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21s7-4.35 7-10a7 7 0 10-14 0c0 5.65 7 10 7 10z" /><circle cx="12" cy="11" r="2.3" /></svg>
        ),
    },
    {
        name: 'Maquinarias',
        path: '/flotas',
        requiredPermission: 'equipos.view_equipo',
        allowedRoles: ['ADMIN', 'PLANIFICACION', 'TECNICO'],
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 17h18M5 17V9h8l3 4h3v4M8 17a2 2 0 104 0m5 0a2 2 0 104 0" /></svg>
        ),
    },
    {
        name: 'Mantenciones',
        path: '/mantenciones',
        requiredPermission: 'equipos.view_historialmantencion',
        allowedRoles: ['ADMIN', 'PLANIFICACION', 'TECNICO'],
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.7 6.3a4 4 0 01-5 5L4 17l3 3 5.7-5.7a4 4 0 005-5l-3 3-3-3 3-3z" /></svg>
        ),
    },
    {
        name: 'Clientes y arriendos',
        path: '/clientes',
        // Visible para Administración y Planificación
        allowedRoles: ['ADMIN', 'PLANIFICACION'],
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
        ),
    },
    {
        name: 'Insumos y stock',
        path: '/insumos',
        allowedRoles: ['ADMIN', 'PLANIFICACION', 'TECNICO'],
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16v13H4zM7 7V5a2 2 0 012-2h6a2 2 0 012 2v2M8 12h8M8 16h5" /></svg>
        ),
    },
    {
        name: 'Módulo Administrador',
        path: '/admin/usuarios',
        requiredPermission: 'auth.view_user',
        // EXCLUSIVO: Solo los usuarios en el grupo ADMIN pueden ver este botón
        allowedRoles: ['ADMIN'],
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
        ),
    },
];

interface SidebarProps { onNavigate?: () => void; }

export const Sidebar: React.FC<SidebarProps> = ({ onNavigate }) => {
    const { hasRole, hasPermission } = useAuth();

    // Filtra los ítems según los roles del usuario logueado
    const visibleNavItems = navItems.filter((item) =>
        item.requiredPermission
            ? hasPermission(item.requiredPermission) && (item.path !== '/admin/usuarios' || hasRole(['ADMIN']))
            : hasRole(item.allowedRoles)
    );

    return (
        <aside className="h-full w-56 shrink-0 select-none border-r border-slate-200 bg-white">
            {/* Navegación Principal */}
            <div className="p-3">
                <p className="px-3 text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                    Menú Principal
                </p>
                <nav className="flex flex-col gap-1.5">
                    {visibleNavItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={onNavigate}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                                    isActive
                                        ? 'bg-[#e3000f] text-white shadow-md shadow-[#e3000f]/20'
                                        : 'text-slate-600 hover:bg-red-50 hover:text-[#e3000f]'
                                }`
                            }
                        >
                            {item.icon}
                            <span>{item.name}</span>
                        </NavLink>
                    ))}
                </nav>
            </div>

        </aside>
    );
};
