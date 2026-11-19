import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { equiposService } from '../features/equipos/api/equiposService';
import type { Equipo } from '../features/equipos/types';
import { useAccessibility } from '../context/useAccessibility';
import { useAuth } from '../features/auth/hooks/useAuth';

const numero = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 });

export const DashboardPage: React.FC = () => {
    const { isDark } = useAccessibility();
    const { user, hasRole } = useAuth();
    const [equipos, setEquipos] = useState<Equipo[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(false);
    const [consulta, setConsulta] = useState<Date | null>(null);

    const cargarEquipos = useCallback(async () => {
        setCargando(true);
        setError(false);
        try {
            const datos = await equiposService.getAll();
            setEquipos(datos);
            setConsulta(new Date());
        } catch {
            setError(true);
            setConsulta(null);
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        let activo = true;
        equiposService.getAll()
            .then((datos) => {
                if (!activo) return;
                setError(false);
                setEquipos(datos);
                setConsulta(new Date());
            })
            .catch(() => {
                if (!activo) return;
                setError(true);
                setConsulta(null);
            })
            .finally(() => {
                if (activo) setCargando(false);
            });
        return () => {
            activo = false;
        };
    }, []);

    const resumen = useMemo(() => {
        const alertas = equipos.filter((e) => e.color_semaforo === 'ROJO');
        const proximos = equipos.filter((e) => e.color_semaforo === 'AMARILLO');
        const encendidos = equipos.filter((e) => e.encendido_gps);
        const taller = equipos.filter((e) => e.estado === 'Mantenimiento');
        const operativos = equipos.filter((e) =>
            e.estado !== 'Mantenimiento' && e.estado !== 'Deshabilitada'
        );
        return { alertas, proximos, encendidos, taller, operativos };
    }, [equipos]);

    const indicadores = [
        { titulo: 'Total de equipos', valor: equipos.length, detalle: 'Inventario registrado', enlace: '/flotas', color: 'text-slate-900' },
        { titulo: 'Operativos', valor: resumen.operativos.length, detalle: 'Disponibles o arrendados', enlace: '/flotas', color: 'text-emerald-600' },
        { titulo: 'GPS encendidos', valor: resumen.encendidos.length, detalle: 'Último estado guardado', enlace: '/gps-encendidos', color: 'text-blue-600' },
        { titulo: 'Próximos', valor: resumen.proximos.length, detalle: 'Alertas preventivas', enlace: '/estado-maquinaria/proximos', color: 'text-amber-600' },
        { titulo: 'Urgentes', valor: resumen.alertas.length, detalle: 'Semáforo rojo', enlace: '/estado-maquinaria/urgentes', color: 'text-red-600' },
        { titulo: 'En taller', valor: resumen.taller.length, detalle: 'En mantenimiento', enlace: '/estado-maquinaria/taller', color: 'text-slate-700' },
    ];

    const nombre = user?.first_name?.trim() || 'equipo';
    const puedeGestionar = hasRole(['ADMIN', 'PLANIFICACION']);

    return (
        <div className="space-y-5">
            {/* Encabezado compacto que conserva la identidad visual */}
            <section className={`relative overflow-hidden rounded-2xl px-5 py-6 shadow-sm sm:px-7 ${
                isDark
                    ? 'bg-[#151b28] text-white'
                    : 'border border-slate-200 bg-white text-slate-900'
            }`}>
                <div className="relative z-10 flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
                    <div>
                        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#e3000f]">
                            Vilas Motor · Centro de operaciones
                        </p>
                        <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Panel de control</h1>
                        <p className={`mt-2 max-w-2xl text-sm leading-6 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                            Hola, {nombre}. Consulta la flota, los equipos que requieren atención y los accesos principales en un solo lugar.
                        </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                        <Link to="/geolocalizacion" className="rounded-xl bg-[#e3000f] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700">Ver mapa GPS</Link>
                        <Link to="/flotas" className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition ${
                            isDark ? 'border-slate-500 text-white hover:bg-white/10' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}>Ver maquinarias</Link>
                    </div>
                </div>
            </section>

            {error ? (
                <section role="alert" className="flex flex-col justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 sm:flex-row sm:items-center">
                    <div>
                        <h2 className="font-extrabold text-red-800">No se pudo consultar la flota</h2>
                        <p className="mt-1 text-sm text-red-700">Revisa la conexión con Django y los permisos del usuario. No se muestran cifras hasta recuperar los datos.</p>
                    </div>
                    <button type="button" onClick={() => void cargarEquipos()} className="shrink-0 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-800">Reintentar</button>
                </section>
            ) : (
                <>
                    <section aria-label="Resumen de la operación" className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
                        {indicadores.map((item) => (
                            <Link key={item.titulo} to={item.enlace} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-red-300 hover:shadow-md">
                                <p className="text-xs font-bold text-slate-500">{item.titulo}</p>
                                <p className={`mt-2 text-3xl font-black tabular-nums ${item.color}`}>{cargando ? '—' : numero.format(item.valor)}</p>
                                <p className="mt-1 text-[11px] text-slate-500">{item.detalle}</p>
                            </Link>
                        ))}
                    </section>

                    <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="mb-4 flex items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-base font-black text-slate-900">Alertas prioritarias</h2>
                                    <p className="mt-1 text-xs text-slate-500">Equipos marcados en rojo por el sistema.</p>
                                </div>
                                <Link to="/mantenciones" className="shrink-0 text-xs font-bold text-[#e3000f] hover:underline">Ver mantenciones</Link>
                            </div>
                            {cargando ? (
                                <p role="status" className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Cargando alertas...</p>
                            ) : resumen.alertas.length === 0 ? (
                                <p className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
                                    {equipos.length === 0 ? 'Todavía no hay maquinarias registradas.' : 'No hay alertas rojas registradas.'}
                                </p>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {resumen.alertas.slice(0, 5).map((equipo) => (
                                        <Link key={equipo.id} to={`/flotas/${equipo.id}`} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 hover:bg-slate-50">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-extrabold text-slate-900">{equipo.codigo} · {equipo.nombre}</p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    {equipo.estado === 'Mantenimiento'
                                                        ? 'Equipo en mantenimiento'
                                                        : equipo.horas_restantes <= 0
                                                            ? `Mantención vencida por ${numero.format(Math.abs(equipo.horas_restantes))} ${equipo.unidad_medida}`
                                                            : equipo.estado_alerta || 'Requiere revisión'}
                                                </p>
                                            </div>
                                            <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-black text-red-700">Urgente</span>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </section>
                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="mb-4 flex items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-base font-black text-slate-900">Estado GPS</h2>
                                    <p className="mt-1 text-xs text-slate-500">Estado registrado, no transmisión en vivo.</p>
                                </div>
                                <Link to="/geolocalizacion" className="shrink-0 text-xs font-bold text-[#e3000f] hover:underline">Abrir mapa</Link>
                            </div>
                            {cargando ? (
                                <p role="status" className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Cargando equipos...</p>
                            ) : resumen.encendidos.length === 0 ? (
                                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No hay equipos marcados con GPS encendido.</p>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {resumen.encendidos.slice(0, 5).map((equipo) => (
                                        <Link key={equipo.id} to={`/flotas/${equipo.id}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 hover:bg-slate-50">
                                            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-bold text-slate-900">{equipo.codigo} · {equipo.nombre}</p>
                                                <p className="truncate text-xs text-slate-500">{equipo.zona_operacion || 'Zona no registrada'}</p>
                                            </div>
                                            <span className="text-xs font-bold text-emerald-700">Encendido</span>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>
                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                            <div>
                                <h2 className="text-base font-black text-slate-900">Accesos rápidos</h2>
                                <p className="mt-1 text-xs text-slate-500">Continúa trabajando sin recorrer todo el menú.</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Link to="/flotas" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:border-red-300">Inventario</Link>
                                <Link to="/mantenciones" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:border-red-300">Mantenciones</Link>
                                {puedeGestionar && (
                                    <Link to="/clientes" className="rounded-xl bg-[#e3000f] px-3 py-2 text-xs font-bold text-white hover:bg-red-700">Clientes y arriendos</Link>
                                )}
                            </div>
                        </div>
                    </section>
                </>
            )}
            <p className="text-right text-xs text-slate-500">
                {consulta && !error ? `Última consulta al servidor: ${consulta.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}. ` : ''}
                Los indicadores reflejan la información almacenada en el sistema.
            </p>
        </div>
    );
};
