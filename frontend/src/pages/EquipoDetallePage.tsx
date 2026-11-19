import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth';
import { equiposService } from '../features/equipos/api/equiposService';
import type { Equipo, HistorialIntervencion } from '../features/equipos/types';
import { EquipoImagen } from '../features/equipos/components/EquipoImagen';

const statusClass: Record<string, string> = { ROJO: 'bg-red-100 text-red-700', AMARILLO: 'bg-amber-100 text-amber-700', VERDE: 'bg-emerald-100 text-emerald-700', GRIS: 'bg-slate-100 text-slate-600' };

export const EquipoDetallePage: React.FC = () => {
  const { hasPermission } = useAuth();
  const puedeEditar = hasPermission('equipos.change_equipo');
  const puedeEliminar = hasPermission('equipos.delete_equipo');
  const { id } = useParams();
  const navigate = useNavigate();
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [equipo, setEquipo] = useState<Equipo | null>(null);
  const [fotoUrl, setFotoUrl] = useState('');
  const [fotoArchivo, setFotoArchivo] = useState<File | null>(null);
  const [editandoFoto, setEditandoFoto] = useState(false);
  const [historial, setHistorial] = useState<HistorialIntervencion[]>([]);
  const [guardandoEstado, setGuardandoEstado] = useState(false);
  const [lecturaActual, setLecturaActual] = useState('');
  const [proximaMeta, setProximaMeta] = useState('');
  const [errorMeta, setErrorMeta] = useState('');
  const [errorEstado, setErrorEstado] = useState('');

  useEffect(() => {
    equiposService.getAll().then((data) => {
      setEquipos(data);
      setEquipo(data.find((item) => item.id === Number(id)) || null);
      setFotoUrl(data.find((item) => item.id === Number(id))?.foto_url || '');
      setLecturaActual(String(data.find((item) => item.id === Number(id))?.horometro_actual ?? ''));
      setProximaMeta(String(data.find((item) => item.id === Number(id))?.meta_proxima_mant ?? ''));
    }).catch(() => setEquipos([]));
    equiposService.getMantenciones().then((data) => setHistorial(data.filter((item) => item.equipo === Number(id)))).catch(() => setHistorial([]));
  }, [id]);

  const index = useMemo(() => equipo ? equipos.findIndex((item) => item.id === equipo.id) : -1, [equipo, equipos]);
  const anterior = index > 0 ? equipos[index - 1] : null;
  const siguiente = index >= 0 && index < equipos.length - 1 ? equipos[index + 1] : null;
  const guardarFoto = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!equipo) return;
    const actualizado = await equiposService.actualizar(equipo.id, { foto_url: fotoUrl, foto_archivo: fotoArchivo || undefined });
    setEquipo(actualizado);
    setEquipos((actuales) => actuales.map((item) => item.id === actualizado.id ? actualizado : item));
    setFotoArchivo(null);
    setEditandoFoto(false);
  };
  const guardarProximaMeta = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!equipo) return;
    const lectura = Number(lecturaActual);
    const nueva = Number(proximaMeta);
    if (!Number.isFinite(lectura) || lectura < 0) {
      setErrorMeta('Ingresa una lectura actual válida.');
      return;
    }
    if (!Number.isFinite(nueva) || nueva < 0) {
      setErrorMeta('Ingresa una próxima meta válida.');
      return;
    }
    setErrorMeta('');
    try {
      const actualizado = await equiposService.actualizar(equipo.id, {
        horometro_actual: lectura,
        meta_proxima_mant: nueva,
      });
      setEquipo(actualizado);
      setEquipos((actuales) => actuales.map((item) => item.id === actualizado.id ? actualizado : item));
      setLecturaActual(String(actualizado.horometro_actual));
      setProximaMeta(String(actualizado.meta_proxima_mant));
    } catch { setErrorMeta('No se pudo actualizar la meta. Verifica tus permisos y la conexión.'); }
  };
  const cambiarEstado = async (estado: 'Mantenimiento' | 'Disponible' | 'Deshabilitada') => {
    if (!equipo) return;
    if (estado === 'Deshabilitada' && !window.confirm(`¿Dar de baja ${equipo.codigo}? Esta acción conserva su historial.`)) return;
    if (!window.confirm(`¿Cambiar ${equipo.codigo} a ${estado === 'Mantenimiento' ? 'mantenimiento' : estado === 'Disponible' ? 'disponible' : 'baja'}?`)) return;
    setGuardandoEstado(true);
    setErrorEstado('');
    try {
      const actualizado = estado === 'Deshabilitada'
        ? await equiposService.darDeBaja(equipo.id).then(() => ({ ...equipo, estado, is_deleted: true }))
        : await equiposService.actualizar(equipo.id, estado === 'Disponible'
            ? { estado, cliente_empresa: null, cliente_asignado: null }
            : { estado });
      setEquipo(actualizado);
      setEquipos((actuales) => actuales.map((item) => item.id === actualizado.id ? actualizado : item));
    } catch (error: unknown) {
      setErrorEstado('No se pudo cambiar el estado. Si existe una orden abierta, finalízala desde Mantenciones antes de marcar la máquina disponible.');
      console.error(error);
    } finally {
      setGuardandoEstado(false);
    }
  };

  if (!equipo) return <div className="equipment-detail-page rounded-2xl border border-slate-200 bg-white p-10 text-center font-bold text-slate-600">Cargando ficha de maquinaria...</div>;

  return (
    <div className="equipment-detail-page space-y-6">
      <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-[#e3000f]">Ficha de maquinaria</p><h1 className="mt-1 text-3xl font-black">{equipo.nombre}</h1><p className="mt-1 text-sm text-slate-500">{equipo.codigo} · información operativa, técnica y de ubicación</p></div><Link to="/flotas" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold">Volver a flota</Link></div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <main className="space-y-6">
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="flex h-72 w-full items-center justify-center overflow-hidden bg-slate-50 md:h-96"><EquipoImagen equipo={equipo} loading="eager" portada className="h-full w-full" /></div><div className="p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-bold text-slate-400">{equipo.categoria || 'Sin categoría'} / {equipo.subcategoria || 'Sin subcategoría'}</p><h2 className="mt-1 text-2xl font-black">{equipo.marca || 'Marca no registrada'} {equipo.modelo || ''}</h2></div><span className={`rounded-full px-3 py-1.5 text-xs font-black ${statusClass[equipo.color_semaforo] || statusClass.GRIS}`}>{equipo.color_semaforo === 'ROJO' ? 'Mantenimiento urgente' : equipo.color_semaforo === 'AMARILLO' ? 'Próximo a mantenimiento' : 'Operativo'}</span></div>{puedeEditar && <button onClick={() => setEditandoFoto(!editandoFoto)} className="mt-4 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold">{editandoFoto ? 'Cerrar cambio de foto' : 'Cambiar fotografía'}</button>}{puedeEditar && editandoFoto && <form onSubmit={guardarFoto} className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-2"><input type="url" value={fotoUrl} onChange={(event) => setFotoUrl(event.target.value)} placeholder="Nueva URL de foto" className="rounded-lg border border-slate-200 px-2 py-2 text-sm" /><input type="file" accept="image/*" onChange={(event) => setFotoArchivo(event.target.files?.[0] || null)} className="rounded-lg border border-slate-200 px-2 py-2 text-sm" /><button className="rounded-lg bg-[#e3000f] px-3 py-2 text-xs font-bold text-white sm:col-span-2">Guardar fotografía</button></form>}
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Patente', equipo.patente || 'No registrada'], ['Kilometraje', `${equipo.kilometraje ?? equipo.horometro_actual} ${equipo.kilometraje !== undefined ? 'km' : equipo.unidad_medida}`], ['N° interno', equipo.nro_interno || equipo.codigo], ['Estado GPS', equipo.encendido_gps ? 'Encendido' : 'Apagado'], ['Estado operativo', equipo.estado], ['Zona', equipo.zona_operacion || 'No registrada'], ['Próxima mantención', `${equipo.meta_proxima_mant} ${equipo.unidad_medida}`], ['Señal móvil', equipo.senal_movil === false ? 'Sin señal' : 'Disponible']].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><span className="block text-xs text-slate-500">{label}</span><b className="mt-1 block text-sm text-slate-900">{value}</b></div>)}</div>
          </div></section>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black">Acciones operativas</h2>
            <p className="mt-2 text-sm text-slate-500">Una orden de mantenimiento la deja en taller al registrarla. También puedes cambiar el estado directamente.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button disabled={!puedeEditar || guardandoEstado || equipo.estado === 'Mantenimiento'} onClick={() => cambiarEstado('Mantenimiento')} className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">Poner en mantenimiento</button>
              <button disabled={!puedeEditar || guardandoEstado || equipo.estado === 'Disponible'} onClick={() => cambiarEstado('Disponible')} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 disabled:opacity-40">Marcar disponible</button>
              <button disabled={!puedeEliminar || guardandoEstado || equipo.estado === 'Deshabilitada'} onClick={() => cambiarEstado('Deshabilitada')} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 disabled:opacity-40">Dar de baja</button>
            </div>
            {errorEstado && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{errorEstado}</p>}
            {puedeEditar && (
              <form onSubmit={guardarProximaMeta} className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <label className="text-xs font-bold text-slate-600">
                  {equipo.unidad_medida === 'KM' ? 'Kilometraje actual' : 'Lectura actual'}
                  <input type="number" min="0" step="0.01" value={lecturaActual} onChange={(e) => setLecturaActual(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" required />
                </label>
                <label className="text-xs font-bold text-slate-600">
                  Próxima mantención ({equipo.unidad_medida})
                  <input type="number" min="0" step="0.01" value={proximaMeta} onChange={(e) => setProximaMeta(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" required />
                </label>
                <button type="submit" className="rounded-lg bg-[#e3000f] px-4 py-2.5 text-xs font-bold text-white">Guardar cambios</button>
                {errorMeta && <span role="alert" className="w-full text-xs text-red-700 sm:col-span-3">{errorMeta}</span>}
              </form>
            )}
          <Link to="/geolocalizacion" className="mt-4 inline-block rounded-xl bg-[#122033] px-4 py-2.5 text-sm font-bold text-white">Abrir en mapa</Link></section>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-black">Historial de mantenciones</h2><p className="text-sm text-slate-500">Trabajos realizados y lecturas registradas.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{historial.length} registros</span></div><div className="mt-4 space-y-3">{historial.length === 0 && <p className="text-sm text-slate-500">No hay intervenciones registradas para esta máquina.</p>}{historial.map((item) => <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-black">{item.descripcion_falla_o_trabajo}</p><span className="text-xs font-bold text-slate-500">{new Date(item.fecha_intervencion).toLocaleDateString('es-CL')}</span></div><p className="mt-1 text-xs text-slate-500">Mecánico: {item.mecanico_nombre} · Lectura: {item.horometro_al_momento} {equipo.unidad_medida}</p><p className="mt-2 text-xs text-slate-600">Insumos: {item.insumos_utilizados || 'No registrados'}</p></div>)}</div></section>
        </main>
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-24"><div className="mb-4"><h2 className="text-lg font-black">Navegar por maquinaria</h2><p className="text-xs text-slate-500">Muévete por la flota sin volver al listado.</p></div><div className="space-y-2">{[anterior, equipo, siguiente].filter(Boolean).map((item) => item && <button key={item.id} onClick={() => navigate(`/flotas/${item.id}`)} className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left ${item.id === equipo.id ? 'border-[#e3000f] bg-red-50' : 'border-slate-100 hover:border-slate-300'}`}><EquipoImagen equipo={item} className="h-12 w-14 rounded-lg" alt="" /><span className="min-w-0"><span className="block truncate text-xs font-black">{item.codigo}</span><span className="block truncate text-xs text-slate-500">{item.nombre}</span></span></button>)}</div><div className="mt-4 grid grid-cols-2 gap-2"><button disabled={!anterior} onClick={() => anterior && navigate(`/flotas/${anterior.id}`)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-40">← Anterior</button><button disabled={!siguiente} onClick={() => siguiente && navigate(`/flotas/${siguiente.id}`)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-40">Siguiente →</button></div></aside>
      </div>
    </div>
  );
};
