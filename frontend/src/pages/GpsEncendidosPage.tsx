import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { equiposService } from '../features/equipos/api/equiposService';
import type { Equipo } from '../features/equipos/types';
import { EquipoImagen } from '../features/equipos/components/EquipoImagen';


export const GpsEncendidosPage: React.FC = () => {
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [seleccionado, setSeleccionado] = useState<Equipo | null>(null);

  useEffect(() => {
    equiposService.getAll().then((data) => {
      const activos = data.filter((equipo) => equipo.encendido_gps);
      setEquipos(activos);
      setSeleccionado(activos[0] || null);
    }).catch(() => setEquipos([]));
  }, []);

  const ubicacion = useMemo(() => {
    if (!seleccionado) return 'Sin ubicación GPS registrada';
    if (seleccionado.ubicacion_registrada && seleccionado.latitud && seleccionado.longitud) return `${seleccionado.latitud.toFixed(5)}, ${seleccionado.longitud.toFixed(5)}`;
    return seleccionado.zona_operacion || 'Sin ubicación GPS registrada';
  }, [seleccionado]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Último estado registrado</p>
          <h1 className="mt-1 text-3xl font-black">Maquinarias con GPS encendido</h1>
          <p className="mt-1 text-sm text-slate-500">Estado almacenado por el sistema; no representa transmisión GPS en vivo.</p>
        </div>
        <Link to="/geolocalizacion?filtro=ENCENDIDOS" className="rounded-xl bg-[#122033] px-4 py-2.5 text-sm font-bold text-white">Abrir mapa GPS</Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black">Equipos en marcha</h2>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{equipos.length} activos</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {equipos.map((equipo) => (
              <button key={equipo.id} onClick={() => setSeleccionado(equipo)} className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition hover:border-emerald-300 hover:shadow-sm ${seleccionado?.id === equipo.id ? 'border-emerald-400 bg-emerald-50/60' : 'border-slate-200 bg-slate-50'}`}>
                <EquipoImagen equipo={equipo} alt="" className="h-16 w-20 rounded-xl" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-black text-slate-400">{equipo.codigo}</span>
                  <span className="block truncate text-sm font-black text-slate-900">{equipo.nombre}</span>
                  <span className="mt-1 block text-xs font-bold text-emerald-600">GPS encendido</span>
                </span>
              </button>
            ))}
          </div>
          {equipos.length === 0 && <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">No hay equipos con GPS encendido.</p>}
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {seleccionado ? (
            <div className="space-y-4">
              <EquipoImagen equipo={seleccionado} className="h-44 w-full rounded-2xl" />
              <div><p className="text-xs font-bold text-slate-400">{seleccionado.codigo}</p><h2 className="text-xl font-black">{seleccionado.nombre}</h2><p className="text-sm text-slate-500">{seleccionado.marca || 'Marca no registrada'} · {seleccionado.modelo || 'Modelo no registrado'}</p></div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-emerald-50 p-3"><span className="block text-slate-500">Estado GPS</span><b className="text-emerald-700">Encendido</b></div>
                <div className="rounded-xl bg-slate-50 p-3"><span className="block text-slate-500">Ubicación</span><b>{seleccionado.zona_operacion || 'En ruta'}</b></div>
                <div className="rounded-xl bg-slate-50 p-3"><span className="block text-slate-500">Coordenadas</span><b>{ubicacion}</b></div>
                <div className="rounded-xl bg-slate-50 p-3"><span className="block text-slate-500">Lectura</span><b>{seleccionado.horometro_actual} {seleccionado.unidad_medida}</b></div>
              </div>
              <Link to={`/flotas/${seleccionado.id}`} className="block w-full rounded-xl bg-[#e3000f] py-2.5 text-center text-sm font-bold text-white">Ver ficha completa</Link>
            </div>
          ) : <p className="text-sm text-slate-500">Selecciona un equipo para ver su detalle.</p>}
        </aside>
      </div>
    </div>
  );
};
