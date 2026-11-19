import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { equiposService } from '../../features/equipos/api/equiposService';
import type { Equipo } from '../../features/equipos/types';
import { useAccessibility } from '../../context/useAccessibility';

export const Navbar: React.FC = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { isDark, toggleTheme } = useAccessibility();
    const [alertas, setAlertas] = useState<Equipo[]>([]);
    const [mostrarAlertas, setMostrarAlertas] = useState(false);
    const [mostrarAccesibilidad, setMostrarAccesibilidad] = useState(false);
    const accesibilidadRef = useRef<HTMLDivElement>(null);
    const [filtroPrioridad, setFiltroPrioridad] = useState<'TODAS' | 'URGENTE' | 'PROXIMO' | 'TALLER'>('TODAS');

    useEffect(() => {
        equiposService.getAll()
            .then((equipos) => setAlertas(
                equipos
                    .filter((equipo) => equipo.estado === 'Mantenimiento'
                        || equipo.color_semaforo === 'ROJO'
                        || equipo.color_semaforo === 'AMARILLO')
                    .sort((a, b) => {
                        const prioridad = (equipo: Equipo) => {
                            if (equipo.color_semaforo === 'ROJO') return 0;
                            if (equipo.estado === 'Mantenimiento') return 1;
                            return 2;
                        };
                        return prioridad(a) - prioridad(b);
                    })
            ))
            .catch(() => setAlertas([]));
    }, []);

    // Cierra el menú cuando se hace clic fuera o se pulsa Escape.
    useEffect(() => {
        if (!mostrarAccesibilidad) return;

        const cerrarSiClicFuera = (event: PointerEvent) => {
            if (!accesibilidadRef.current?.contains(event.target as Node)) {
                setMostrarAccesibilidad(false);
            }
        };
        const cerrarConEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setMostrarAccesibilidad(false);
        };

        document.addEventListener('pointerdown', cerrarSiClicFuera);
        document.addEventListener('keydown', cerrarConEscape);
        return () => {
            document.removeEventListener('pointerdown', cerrarSiClicFuera);
            document.removeEventListener('keydown', cerrarConEscape);
        };
    }, [mostrarAccesibilidad]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const alertasFiltradas = alertas.filter((equipo) => {
        if (filtroPrioridad === 'URGENTE') return equipo.color_semaforo === 'ROJO';
        if (filtroPrioridad === 'PROXIMO') return equipo.color_semaforo === 'AMARILLO';
        if (filtroPrioridad === 'TALLER') return equipo.estado === 'Mantenimiento';
        return true;
    });

    return (
        <header className="h-20 bg-white border-b border-slate-200 px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 shadow-sm select-none">
            {/* Lado izquierdo: Logo de Vilas Motor + Título del Sistema */}
            <div className="flex items-center gap-6">
                <Link to="/dashboard" aria-label="Volver al inicio">
                    <img
                        src={isDark
                            ? 'https://vilasmotor.cl/wp-content/uploads/2026/05/vilasmotor-logo-1.png'
                            : 'https://vilasmotor.cl/wp-content/uploads/2026/05/vilasmotor-red-logo-1.png'}
                        alt="Vilas Motor Logo"
                        className="h-12 w-auto object-contain"
                    />
                </Link>
                <div className="hidden md:block h-6 w-px bg-slate-200"></div>
                <span className="hidden md:block text-sm font-semibold text-slate-500 tracking-wide uppercase">
          Sistema de Gestión de Flota y Mantenimiento
        </span>
            </div>

            {/* Lado derecho: Notificaciones, Perfil con Múltiples Roles y Cerrar Sesión */}
            <div className="flex items-center gap-4">
                <div ref={accesibilidadRef} className="relative">
                    <button
                        type="button"
                        onClick={() => setMostrarAccesibilidad((visible) => !visible)}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-[#e3000f]"
                        aria-expanded={mostrarAccesibilidad}
                        aria-controls="panel-accesibilidad"
                        title="Opciones de accesibilidad"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v18M3 12h18M5.64 5.64l12.72 12.72M18.36 5.64L5.64 18.36" />
                        </svg>
                        <span className="hidden sm:inline">Accesibilidad</span>
                    </button>
                    {mostrarAccesibilidad && (
                        <div id="panel-accesibilidad" className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-slate-200 bg-white p-4 text-slate-800 shadow-2xl">
                            <p className="text-sm font-black">Accesibilidad</p>
                            <p className="mt-1 text-xs text-slate-500">Ajusta el contraste visual de la página.</p>
                            <button
                                type="button"
                                onClick={toggleTheme}
                                className="mt-4 flex w-full items-center rounded-xl border border-slate-200 px-3 py-3 text-left text-xs font-bold transition-colors hover:border-red-200 hover:bg-red-50"
                                aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                            >
                                <span className="flex items-center gap-2">
                                    <span className="text-base" aria-hidden="true">{isDark ? '☀' : '☾'}</span>
                                    {isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                                </span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Botón de alertas/notificaciones */}
                <button
                    onClick={() => setMostrarAlertas(!mostrarAlertas)}
                    className="p-2.5 text-slate-600 hover:text-[#e3000f] hover:bg-red-50 rounded-xl transition-colors relative cursor-pointer"
                    title="Mantenimientos pendientes"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {/* Punto rojo indicador de alerta activa */}
                    {alertas.length > 0 && <span className="absolute top-2 right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e3000f] px-1 text-[9px] font-black text-white">{alertas.length}</span>}
                </button>
                {mostrarAlertas && (
                    <div className="absolute right-24 top-16 z-50 w-80 rounded-2xl border border-slate-200 bg-white p-4 text-slate-800 shadow-2xl">
                        <p className="text-sm font-black">Mantenimientos pendientes</p>
                        <p className="mt-1 text-xs text-slate-500">{alertasFiltradas.length} equipos visibles · Prioridad ordenada.</p>
                        <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1">
                            {([
                                ['TODAS', 'Todas'],
                                ['URGENTE', 'Urgente'],
                                ['PROXIMO', 'Próximo'],
                                ['TALLER', 'Taller'],
                            ] as const).map(([valor, etiqueta]) => (
                                <button
                                    key={valor}
                                    type="button"
                                    onClick={() => setFiltroPrioridad(valor)}
                                    className={`rounded-lg px-1 py-2 text-[10px] font-black transition ${filtroPrioridad === valor ? 'bg-white text-[#e3000f] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                >
                                    {etiqueta}
                                </button>
                            ))}
                        </div>
                        <div className="mt-3 max-h-96 space-y-2 overflow-y-auto overscroll-contain pr-1">
                            {alertasFiltradas.length === 0 ? (
                                <p className="rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-700">No hay alertas para esta prioridad.</p>
                            ) : alertasFiltradas.map((equipo) => (
                                <button
                                    key={equipo.id}
                                    type="button"
                                    onClick={() => {
                                        setMostrarAlertas(false);
                                        navigate(`/flotas/${equipo.id}`);
                                    }}
                                    className="flex w-full items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-left hover:bg-red-50"
                                >
                                    <span className="min-w-0 truncate text-xs font-bold">{equipo.codigo} · {equipo.nombre}</span>
                                    <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black ${equipo.color_semaforo === 'ROJO' ? 'bg-red-100 text-red-700' : equipo.estado === 'Mantenimiento' ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {equipo.color_semaforo === 'ROJO' ? 'Urgente' : equipo.estado === 'Mantenimiento' ? 'Taller' : 'Próximo'}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Información del usuario activo obtenida desde useAuth */}
                <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                    <div className="w-9 h-9 rounded-xl bg-red-100 text-[#e3000f] font-bold flex items-center justify-center text-sm uppercase">
                        {/* Mejora: Extrae iniciales del nombre/apellido, o del email como respaldo */}
                        {user?.first_name && user?.last_name
                            ? `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`
                            : user?.email ? user.email.substring(0, 2) : 'VM'}
                    </div>
                    <div className="hidden sm:flex flex-col text-left">
                        <span className="text-sm font-bold text-slate-800 leading-tight">
                            {/* Corrección: Usa first_name + last_name, o username en su defecto */}
                            {user?.first_name && user?.last_name
                                ? `${user.first_name} ${user.last_name}`
                                : user?.username || 'Usuario'}
                        </span>
                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                            {user?.roles && user.roles.length > 0 ? (
                                user.roles.map((role) => (
                                    <span
                                        key={role}
                                        className="text-[10px] font-bold px-1.5 py-0.5 bg-red-50 text-[#e3000f] rounded-md tracking-wide"
                                    >
                                        {role}
                                    </span>
                                ))
                            ) : (
                                <span className="text-xs text-slate-500">Sin rol</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Botón Salir */}
                <button
                    onClick={handleLogout}
                    className="ml-2 px-3.5 py-2 text-xs font-bold text-slate-800 hover:text-[#e3000f] bg-white hover:bg-red-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span className="hidden sm:inline">Salir</span>
                </button>
            </div>
        </header>
    );
};