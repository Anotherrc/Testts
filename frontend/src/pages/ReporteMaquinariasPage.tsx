import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { equiposService } from '../features/equipos/api/equiposService';
import type { Equipo } from '../features/equipos/types';

const color = (equipo: Equipo) => equipo.color_semaforo === 'ROJO' ? 'bg-red-100 text-red-700' : equipo.color_semaforo === 'AMARILLO' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';

export const ReporteMaquinariasPage: React.FC = () => {
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [seleccionados, setSeleccionados] = useState<number[]>([]);
  const [filtro, setFiltro] = useState('TODOS');

  useEffect(() => { equiposService.getAll().then(setEquipos).catch(() => setEquipos([])); }, []);

  const filtrados = useMemo(() => equipos.filter((equipo) => {
    if (filtro === 'GPS') return equipo.encendido_gps;
    if (filtro === 'URGENTES') return equipo.color_semaforo === 'ROJO';
    if (filtro === 'MANTENCION') return equipo.estado === 'Mantenimiento';
    return true;
  }), [equipos, filtro]);

  const todosMarcados = filtrados.length > 0 && filtrados.every((equipo) => seleccionados.includes(equipo.id));
  const alternarTodos = () => setSeleccionados(todosMarcados ? seleccionados.filter((id) => !filtrados.some((equipo) => equipo.id === id)) : Array.from(new Set([...seleccionados, ...filtrados.map((equipo) => equipo.id)])));
  const reporte = equipos.filter((equipo) => seleccionados.includes(equipo.id));

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end print:hidden"><div><p className="text-xs font-bold uppercase tracking-widest text-[#e3000f]">Documentos de flota</p><h1 className="mt-1 text-3xl font-black">Informe de maquinarias</h1><p className="mt-1 text-sm text-slate-500">Selecciona todas o solo algunas máquinas y genera un informe limpio para guardar como PDF.</p></div><div className="flex gap-2"><Link to="/flotas" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold">Volver a flota</Link><button disabled={!reporte.length} onClick={() => window.print()} className="rounded-xl bg-[#e3000f] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">Generar PDF</button></div></div>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><select value={filtro} onChange={(event) => setFiltro(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"><option value="TODOS">Todas las maquinarias</option><option value="GPS">GPS encendido</option><option value="URGENTES">Urgentes</option><option value="MANTENCION">En mantenimiento</option></select><button onClick={alternarTodos} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">{todosMarcados ? 'Quitar selección' : 'Seleccionar visibles'}</button></div><span className="text-sm font-bold text-slate-500">{seleccionados.length} seleccionadas</span></div><div className="mt-4 grid max-h-[460px] gap-2 overflow-y-auto md:grid-cols-2">{filtrados.map((equipo) => <label key={equipo.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 hover:border-red-200"><input type="checkbox" checked={seleccionados.includes(equipo.id)} onChange={(event) => setSeleccionados(event.target.checked ? [...seleccionados, equipo.id] : seleccionados.filter((id) => id !== equipo.id))} className="accent-[#e3000f]" /><span className="min-w-0 flex-1"><b className="block truncate text-sm">{equipo.codigo} · {equipo.nombre}</b><small className="text-xs text-slate-500">{equipo.marca || 'Sin marca'} {equipo.modelo || ''}</small></span><span className={`rounded-full px-2 py-1 text-[10px] font-black ${color(equipo)}`}>{equipo.color_semaforo}</span></label>)}</div></section>
    <article className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:p-0 print:shadow-none"><div className="border-b border-slate-200 pb-5"><p className="text-xs font-bold uppercase tracking-widest text-slate-400">Vilas Motor</p><h2 className="mt-1 text-2xl font-black">Informe de estado de maquinarias</h2><p className="mt-1 text-sm text-slate-500">Emitido el {new Date().toLocaleDateString('es-CL')} · {reporte.length} equipos</p></div>{reporte.length === 0 ? <p className="py-12 text-center text-sm text-slate-500 print:hidden">Selecciona al menos una maquinaria para preparar el informe.</p> : <div className="mt-6 grid gap-4 md:grid-cols-2">{reporte.map((equipo) => <div key={equipo.id} className="break-inside-avoid rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-slate-400">{equipo.codigo}</p><h3 className="text-base font-black">{equipo.nombre}</h3></div><span className={`rounded-full px-2 py-1 text-[10px] font-black ${color(equipo)}`}>{equipo.color_semaforo}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><p><span className="text-slate-500">Marca/modelo:</span><br /><b>{equipo.marca || '—'} {equipo.modelo || ''}</b></p><p><span className="text-slate-500">Estado:</span><br /><b>{equipo.estado}</b></p><p><span className="text-slate-500">GPS:</span><br /><b>{equipo.encendido_gps ? 'Encendido' : 'Apagado'}</b></p><p><span className="text-slate-500">Lectura:</span><br /><b>{equipo.horometro_actual} {equipo.unidad_medida}</b></p><p><span className="text-slate-500">Zona:</span><br /><b>{equipo.zona_operacion || '—'}</b></p><p><span className="text-slate-500">Próxima mantención:</span><br /><b>{equipo.meta_proxima_mant} {equipo.unidad_medida}</b></p></div></div>)}</div>}</article>
  </div>;
};
