import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { equiposService } from '../features/equipos/api/equiposService';
import type { Equipo } from '../features/equipos/types';
import { getEquipmentSilhouette } from '../utils/equipmentSilhouettes';

type TipoEstado = 'proximos' | 'urgentes' | 'taller';

const configuracion: Record<TipoEstado, { titulo: string; descripcion: string; etiqueta: string }> = {
    proximos: {
        titulo: 'Maquinarias próximas a mantenimiento',
        descripcion: 'Equipos con alerta preventiva en semáforo amarillo.',
        etiqueta: 'Próximo',
    },
    urgentes: {
        titulo: 'Maquinarias urgentes',
        descripcion: 'Equipos con mantención vencida o semáforo rojo.',
        etiqueta: 'Urgente',
    },
    taller: {
        titulo: 'Maquinarias en taller',
        descripcion: 'Equipos registrados actualmente en mantenimiento.',
        etiqueta: 'En taller',
    },
};

export const MaquinariasEstadoPage: React.FC = () => {
    const { tipo = 'proximos' } = useParams<{ tipo: TipoEstado }>();
    const tipoValido: TipoEstado =
        tipo === 'urgentes' || tipo === 'taller' ? tipo : 'proximos';
    const config = configuracion[tipoValido];
    const [equipos, setEquipos] = useState<Equipo[]>([]);
    const [seleccionado, setSeleccionado] = useState<Equipo | null>(null);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        let activo = true;
        Promise.resolve()
            .then(() => {
                if (activo) setCargando(true);
                return equiposService.getAll();
            })
            .then((datos) => {
                if (!activo) return;
                const filtrados = datos.filter((equipo) => {
                    if (tipoValido === 'urgentes') return equipo.color_semaforo === 'ROJO';
                    if (tipoValido === 'taller') return equipo.estado === 'Mantenimiento';
                    return equipo.color_semaforo === 'AMARILLO';
                });
                setEquipos(filtrados);
                setSeleccionado(filtrados[0] || null);
            })
            .finally(() => {
                if (activo) setCargando(false);
            });
        return () => {
            activo = false;
        };
    }, [tipoValido]);

    const descripcionLectura = useMemo(() => {
        if (!seleccionado) return '';
        return `${seleccionado.horometro_actual} ${seleccionado.unidad_medida}`;
    }, [seleccionado]);

    const imageFor = (equipo: Equipo) => {
        if (equipo.foto_url?.trim()) return equipo.foto_url;
        return getEquipmentSilhouette(equipo);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#e3000f]">Flota · Filtro operativo</p>
                    <h1 className="mt-1 text-3xl font-black">{config.titulo}</h1>
                    <p className="mt-1 text-sm text-slate-500">{config.descripcion}</p>
                </div>
                <Link to="/flotas" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">Ver catálogo completo</Link>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-black">Maquinarias coincidentes</h2>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{equipos.length} equipos</span>
                    </div>
                    {cargando ? (
                        <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">Cargando maquinarias...</p>
                    ) : equipos.length === 0 ? (
                        <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">No hay maquinarias en este filtro.</p>
                    ) : (
                        <div className="grid max-h-[520px] gap-3 overflow-y-auto md:grid-cols-2">
                            {equipos.map((equipo) => (
                                <button
                                    key={equipo.id}
                                    type="button"
                                    onClick={() => setSeleccionado(equipo)}
                                    className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition hover:border-red-300 hover:shadow-sm ${seleccionado?.id === equipo.id ? 'border-[#e3000f] bg-red-50/50' : 'border-slate-200 bg-slate-50'}`}
                                >
                                    <img src={imageFor(equipo)} alt="" className="h-16 w-20 rounded-xl object-contain" />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-xs font-black text-slate-400">{equipo.codigo}</span>
                                        <span className="block truncate text-sm font-black text-slate-900">{equipo.nombre}</span>
                                        <span className={`mt-1 block text-xs font-bold ${tipoValido === 'urgentes' ? 'text-red-700' : tipoValido === 'proximos' ? 'text-amber-700' : 'text-slate-700'}`}>{config.etiqueta}</span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </section>

                <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    {seleccionado ? (
                        <div className="space-y-4">
                            <img src={imageFor(seleccionado)} alt={seleccionado.nombre} className="h-44 w-full rounded-2xl object-contain" />
                            <div>
                                <p className="text-xs font-bold text-slate-400">{seleccionado.codigo}</p>
                                <h2 className="text-xl font-black">{seleccionado.nombre}</h2>
                                <p className="text-sm text-slate-500">{seleccionado.marca || 'Marca no registrada'} · {seleccionado.modelo || 'Modelo no registrado'}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="rounded-xl bg-slate-50 p-3"><span className="block text-slate-500">Estado operativo</span><b>{seleccionado.estado}</b></div>
                                <div className="rounded-xl bg-slate-50 p-3"><span className="block text-slate-500">Zona</span><b>{seleccionado.zona_operacion || 'No registrada'}</b></div>
                                <div className="rounded-xl bg-slate-50 p-3"><span className="block text-slate-500">Lectura</span><b>{descripcionLectura}</b></div>
                                <div className="rounded-xl bg-slate-50 p-3"><span className="block text-slate-500">Próxima mantención</span><b>{seleccionado.meta_proxima_mant} {seleccionado.unidad_medida}</b></div>
                            </div>
                            <Link to={`/flotas/${seleccionado.id}`} className="block w-full rounded-xl bg-[#e3000f] py-2.5 text-center text-sm font-bold text-white">Ver ficha completa</Link>
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500">Selecciona una maquinaria para ver su detalle.</p>
                    )}
                </aside>
            </div>
        </div>
    );
};
