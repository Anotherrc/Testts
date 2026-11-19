import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { equiposService } from '../features/equipos/api/equiposService';
import type { Equipo } from '../features/equipos/types';
import { useAuth } from '../features/auth/hooks/useAuth';
import { operacionesService } from '../features/operaciones/api/operacionesService';
import type { Insumo, Orden } from '../features/operaciones/types';
import { coincideBusqueda } from '../utils/textSearch';

export const MantencionesPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const puedeCrearMantencion = hasPermission('equipos.add_historialmantencion');
  const puedeFinalizarMantencion = hasPermission('equipos.change_historialmantencion');
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [form, setForm] = useState({ equipo: '', fecha: '', comentario: '' });
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [mecanicosSeleccionados, setMecanicosSeleccionados] = useState<string[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [nuevoMecanico, setNuevoMecanico] = useState('');
  const [uso, setUso] = useState<Record<number, string>>({});
  const [ordenamiento, setOrdenamiento] = useState<'cercanas' | 'asc' | 'desc'>('cercanas');
  const [vista, setVista] = useState<'taller' | 'pendientes' | 'historial'>('taller');
  const [modalAgregar, setModalAgregar] = useState(false);

  const cargarDatos = async () => {
    setError('');
    try {
      const [maquinas, lista, inventario] = await Promise.all([
        equiposService.getAll(), operacionesService.ordenes.listar(), operacionesService.insumos.listar(),
      ]);
      setEquipos(maquinas);
      setOrdenes(lista);
      setInsumos(inventario);
    } catch { setError('No se pudieron cargar órdenes, equipos o insumos desde Django.'); }
    finally { setCargando(false); }
  };
  useEffect(() => { void cargarDatos(); }, []);
  const equiposEnMantenimiento = useMemo(
    () => equipos.filter((equipo) => equipo.estado === 'Mantenimiento' || ordenes.some((orden) => orden.equipoId === equipo.id && orden.estado !== 'Finalizada')),
    [equipos, ordenes],
  );
  const idsEnMantenimiento = useMemo(() => new Set(equiposEnMantenimiento.map((equipo) => equipo.id)), [equiposEnMantenimiento]);
  const disponibles = useMemo(() => equipos.filter((equipo) => equipo.estado !== 'Mantenimiento' && equipo.estado !== 'Deshabilitada' && !idsEnMantenimiento.has(equipo.id)), [equipos, idsEnMantenimiento]);
  const insumosAgotados = insumos.filter((item) => item.stock <= 0);

  const categorias = useMemo(() => Array.from(new Set(disponibles.map((item) => item.categoria).filter(Boolean))).sort(), [disponibles]);
  const marcas = useMemo(() => Array.from(new Set(disponibles.filter((item) => !categoria || item.categoria === categoria).map((item) => item.marca).filter(Boolean))).sort(), [disponibles, categoria]);
  const modelos = useMemo(() => Array.from(new Set(disponibles.filter((item) => (!categoria || item.categoria === categoria) && (!marca || item.marca === marca)).map((item) => item.modelo).filter(Boolean))).sort(), [disponibles, categoria, marca]);
  const equiposFiltrados = useMemo(() => disponibles.filter((equipo) => {
    const texto = `${equipo.codigo} ${equipo.nombre} ${equipo.categoria || ''}`;
    return coincideBusqueda(texto, busqueda) && (!categoria || equipo.categoria === categoria) && (!marca || equipo.marca === marca) && (!modelo || equipo.modelo === modelo);
  }), [disponibles, busqueda, categoria, marca, modelo]);
  const pendientes = useMemo(() => ordenes
    .filter((orden) => orden.estado !== 'Finalizada')
    .sort((a, b) => {
      const fechaA = new Date(`${a.fecha}T12:00:00`).getTime();
      const fechaB = new Date(`${b.fecha}T12:00:00`).getTime();
      if (ordenamiento === 'asc') return fechaA - fechaB;
      if (ordenamiento === 'desc') return fechaB - fechaA;
      return Math.abs(fechaA - Date.now()) - Math.abs(fechaB - Date.now());
    }), [ordenes, ordenamiento]);
  const historial = useMemo(() => ordenes.filter((orden) => orden.estado === 'Finalizada'), [ordenes]);

  const cambiarMecanico = (nombre: string) => setMecanicosSeleccionados((actuales) => actuales.includes(nombre) ? actuales.filter((item) => item !== nombre) : [...actuales, nombre]);

  const finalizarOrden = async (orden: Orden) => {
    setError('');
    try {
      await operacionesService.ordenes.finalizar(orden.id);
      await cargarDatos();
    } catch { setError('No se pudo finalizar la orden. Verifica tu autorización y la conexión con Django.'); }
  };

  const crear = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.equipo || !form.fecha || !form.comentario.trim() || !mecanicosSeleccionados.length) return;
    setError('');
    const consumos = insumos.filter((item) => Number(uso[item.id]) > 0).map((item) => ({
      insumo: item.id, cantidad: Number(uso[item.id]),
    }));
    if (consumos.some((c) => !Number.isFinite(c.cantidad) || c.cantidad <= 0 || c.cantidad > (insumos.find((i) => i.id === c.insumo)?.stock || 0))) {
      setError('Revisa las cantidades de insumos: no pueden superar el stock disponible.');
      return;
    }
    try {
      await operacionesService.ordenes.crear({
        equipoId: Number(form.equipo), fecha: form.fecha, comentario: form.comentario.trim(),
        mecanicos: mecanicosSeleccionados, consumos,
      });
      await cargarDatos();
      setForm({ equipo: '', fecha: '', comentario: '' });
      setMecanicosSeleccionados([]);
      setUso({});
      setModalAgregar(false);
    } catch { setError('No se pudo crear la orden. Revisa que el equipo esté disponible y exista stock suficiente.'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#e3000f]">Taller y alertas</p>
          <h1 className="mt-1 text-3xl font-black">Mantenciones</h1>
          <p className="mt-1 text-sm text-slate-500">Maquinaria actualmente fuera de operación y trabajos pendientes.</p>
        </div>
        {puedeCrearMantencion && (
          <button type="button" onClick={() => setModalAgregar(true)} className="rounded-xl bg-[#e3000f] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-red-700">
            + Agregar mantención
          </button>
        )}
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {cargando && <p role="status" className="text-sm text-slate-500">Cargando órdenes y stock...</p>}

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <button type="button" onClick={() => setVista('taller')} className={`rounded-xl px-4 py-2 text-xs font-black ${vista === 'taller' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>En taller ({equiposEnMantenimiento.length})</button>
        <button type="button" onClick={() => setVista('pendientes')} className={`rounded-xl px-4 py-2 text-xs font-black ${vista === 'pendientes' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>Órdenes pendientes ({pendientes.length})</button>
        <button type="button" onClick={() => setVista('historial')} className={`rounded-xl px-4 py-2 text-xs font-black ${vista === 'historial' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>Historial ({historial.length})</button>
      </div>

      {vista === 'taller' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-black">Maquinaria en taller</h2>
            <p className="mt-1 text-sm text-slate-500">Resumen de equipos que no están disponibles actualmente.</p>
          </div>
          {equiposEnMantenimiento.length === 0 ? (
            <p className="rounded-xl bg-emerald-50 p-8 text-center text-sm font-bold text-emerald-700">No hay maquinaria en mantenimiento.</p>
          ) : (
            <div className="grid max-h-[620px] gap-3 overflow-y-auto md:grid-cols-2 xl:grid-cols-3">
              {equiposEnMantenimiento.map((equipo) => {
                const orden = pendientes.find((item) => item.equipoId === equipo.id);
                return (
                  <article key={equipo.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-400">{equipo.codigo}</p>
                        <h3 className="truncate text-base font-black text-slate-900">{equipo.nombre}</h3>
                      </div>
                      <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-black text-red-700">En taller</span>
                    </div>
                    <p className="mt-3 min-h-10 text-sm leading-5 text-slate-600">{orden?.comentario || 'Maquinaria marcada en mantenimiento sin una descripción registrada.'}</p>
                    <div className="mt-3 grid gap-1 text-xs text-slate-500">
                      <span>Responsable: {orden?.mecanicos.join(', ') || 'Sin asignar'}</span>
                      <span>Fecha: {orden?.fecha || 'No registrada'}</span>
                    </div>
                    <Link to={`/flotas/${equipo.id}`} className="mt-4 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-xs font-black text-slate-700 hover:border-[#e3000f] hover:text-[#e3000f]">Ver ficha</Link>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {(vista === 'pendientes' || vista === 'historial') && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">{vista === 'historial' ? 'Historial de mantenimientos' : 'Órdenes de trabajo pendientes'}</h2>
              <p className="text-sm text-slate-500">{vista === 'historial' ? 'Órdenes finalizadas y trabajos realizados.' : 'Ordenadas por cercanía a la fecha actual.'}</p>
            </div>
            {vista === 'pendientes' && (
              <select value={ordenamiento} onChange={(event) => setOrdenamiento(event.target.value as typeof ordenamiento)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold">
                <option value="cercanas">Más cerca a hoy</option>
                <option value="asc">Fecha ascendente</option>
                <option value="desc">Fecha descendente</option>
              </select>
            )}
          </div>
          <div className="grid max-h-[620px] gap-3 overflow-y-auto md:grid-cols-2">
            {(vista === 'historial' ? historial : pendientes).map((orden) => (
              <div key={orden.id} className={`rounded-xl border p-4 ${orden.estado === 'Finalizada' ? 'border-emerald-100 bg-emerald-50/40' : 'border-slate-100 bg-slate-50'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-black">{orden.equipo}</p><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-700">{orden.estado}</span></div>
                <p className="mt-2 text-sm text-slate-700">{orden.comentario}</p>
                <div className="mt-2 grid gap-1 text-xs text-slate-500">
                  <span>Responsables: {orden.mecanicos.join(', ')}</span>
                  <span>Fecha: {orden.fecha}</span>
                  <span>Insumos: {orden.insumos}</span>
                  <span className="text-[10px] text-slate-400">Creada por: {orden.creadoPor || 'Usuario no registrado'}{orden.finalizadoPor ? ` · Finalizada por: ${orden.finalizadoPor}` : ''}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to={`/flotas/${orden.equipoId}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-700">Ver ficha</Link>
                  {orden.estado !== 'Finalizada' && puedeFinalizarMantencion && <button type="button" onClick={() => finalizarOrden(orden)} className="rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-black text-white">Finalizar y devolver</button>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {modalAgregar && puedeCrearMantencion && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalAgregar(false); }}>
          <form id="agregar-mantenimiento" onSubmit={crear} className="h-full w-full max-w-md space-y-4 overflow-y-auto bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div><p className="text-xs font-bold uppercase text-[#e3000f]">Nueva mantención</p><h2 className="text-lg font-black">Enviar máquina a taller</h2></div>
              <button type="button" onClick={() => setModalAgregar(false)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">Cerrar</button>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
              <label className="block text-xs font-black uppercase text-slate-500">Buscar maquinaria disponible</label>
              <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Nombre, código o categoría" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm" />
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <select value={categoria} onChange={(event) => { setCategoria(event.target.value); setMarca(''); setModelo(''); }} className="rounded-lg border border-slate-200 px-2 py-2 text-xs"><option value="">Categoría</option>{categorias.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                <select value={marca} onChange={(event) => { setMarca(event.target.value); setModelo(''); }} className="rounded-lg border border-slate-200 px-2 py-2 text-xs"><option value="">Marca</option>{marcas.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                <select value={modelo} onChange={(event) => setModelo(event.target.value)} className="rounded-lg border border-slate-200 px-2 py-2 text-xs"><option value="">Modelo</option>{modelos.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              </div>
            </div>
            <select required value={form.equipo} onChange={(event) => setForm({ ...form, equipo: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="">Seleccionar maquinaria ({equiposFiltrados.length} disponibles)</option>{equiposFiltrados.map((equipo) => <option key={equipo.id} value={equipo.id}>{equipo.codigo} · {equipo.nombre}</option>)}</select>
            <textarea required minLength={8} value={form.comentario} onChange={(event) => setForm({ ...form, comentario: event.target.value })} placeholder="Comentario: ¿qué se le realizará a la máquina?" className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            <div>
              <p className="mb-2 text-xs font-black uppercase text-slate-500">Responsables de mantenimiento</p>
              <div className="flex gap-2"><input value={nuevoMecanico} onChange={(e) => setNuevoMecanico(e.target.value)} placeholder="Nombre de responsable" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs" /><button type="button" onClick={() => { const nombre = nuevoMecanico.trim(); if (nombre && !mecanicosSeleccionados.includes(nombre)) setMecanicosSeleccionados((a) => [...a, nombre]); setNuevoMecanico(''); }} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">Agregar</button></div>
              <div className="mt-2 flex flex-wrap gap-2">{mecanicosSeleccionados.map((nombre) => <button type="button" key={nombre} onClick={() => cambiarMecanico(nombre)} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold">{nombre} ×</button>)}</div>
            </div>
            <input required type="date" value={form.fecha} onChange={(event) => setForm({ ...form, fecha: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            <div>
              <p className="mb-2 text-xs font-black uppercase text-slate-500">Insumos utilizados</p>
              {insumosAgotados.length > 0 && <div role="alert" className="mb-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">Alerta de inventario: no hay stock disponible para {insumosAgotados.map((item) => item.nombre).join(', ')}.</div>}
              <div className="space-y-2">{insumos.map((item) => <div key={item.id} className="grid grid-cols-[1fr_100px] items-center gap-2"><span className="truncate text-xs font-bold">{item.nombre}{item.stock > 0 ? <small className="ml-1 text-slate-400">({item.stock} {item.unidad})</small> : <small className="ml-1 font-black text-red-600">Sin stock</small>}</span>{item.stock > 0 ? <input type="number" min="0" max={item.stock} step="0.01" value={uso[item.id] || ''} onChange={(event) => setUso({ ...uso, [item.id]: event.target.value })} placeholder="Cantidad" className="rounded-lg border border-slate-200 px-2 py-2 text-xs" /> : <span className="rounded-lg bg-red-50 px-2 py-2 text-center text-[10px] font-black text-red-600">Sin stock</span>}</div>)}</div>
            </div>
            <button type="submit" className="w-full rounded-xl bg-[#e3000f] py-3 text-sm font-bold text-white">Enviar máquina a mantenimiento</button>
          </form>
        </div>
      )}
    </div>
  );
};
