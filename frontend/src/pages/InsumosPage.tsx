import React, { useEffect, useState } from 'react';
import { operacionesService } from '../features/operaciones/api/operacionesService';
import type { Insumo, Movimiento } from '../features/operaciones/types';
import { useAuth } from '../features/auth/hooks/useAuth';
import { coincideBusqueda } from '../utils/textSearch';

export const InsumosPage: React.FC = () => {
  const { hasRole } = useAuth();
  const puedeEditar = hasRole(['ADMIN', 'PLANIFICACION']);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState(false);
  const [insumoEditando, setInsumoEditando] = useState<Insumo | null>(null);
  const [form, setForm] = useState({ nombre: '', cantidad: '1', unidad: 'unidades', minimo: '1', categoria: 'General' });
  const [auditoria, setAuditoria] = useState<string[]>([]);
  const cargarDatos = async () => {
    setError('');
    try {
      const [lista, movimientos] = await Promise.all([
        operacionesService.insumos.listar(), operacionesService.insumos.movimientos(),
      ]);
      setInsumos(lista);
      setAuditoria(movimientos.slice(0, 8).map((m: Movimiento) =>
        `${new Date(m.fecha).toLocaleString('es-CL')} · ${m.usuario_nombre} · ${m.motivo} (${m.insumo_nombre})`
      ));
    } catch { setError('No se pudo consultar el inventario de Django.'); }
    finally { setCargando(false); }
  };
  useEffect(() => { void cargarDatos(); }, []);
  const abrirAgregar = () => {
    setInsumoEditando(null);
    setForm({ nombre: '', cantidad: '1', unidad: 'unidades', minimo: '1', categoria: 'General' });
    setModal(true);
  };
  const abrirEditar = (insumo: Insumo) => {
    setInsumoEditando(insumo);
    setForm({ nombre: insumo.nombre, cantidad: String(insumo.stock), unidad: insumo.unidad, minimo: String(insumo.minimo), categoria: insumo.categoria });
    setModal(true);
  };
  const guardar = async (event: React.FormEvent) => {
    event.preventDefault();
    const stock = Number(form.cantidad);
    const minimo = Number(form.minimo);
    if (!form.nombre.trim() || !Number.isFinite(stock) || stock < 0 || !Number.isFinite(minimo) || minimo < 0) return;
    setError('');
    try {
      const datos = { nombre: form.nombre.trim(), categoria: form.categoria.trim() || 'General', stock, minimo, unidad: form.unidad };
      if (insumoEditando) await operacionesService.insumos.actualizar(insumoEditando.id, datos);
      else await operacionesService.insumos.crear(datos);
      await cargarDatos();
      setForm({ nombre: '', cantidad: '1', unidad: 'unidades', minimo: '1', categoria: 'General' });
      setInsumoEditando(null);
      setModal(false);
    } catch { setError('No se pudo guardar el insumo. Revisa los datos y la conexión.'); }
  };
  const ajustarStock = async (insumo: Insumo, cambio: number) => {
    setError('');
    try {
      await operacionesService.insumos.ajustar(insumo.id, cambio);
      await cargarDatos();
    } catch { setError('No se pudo ajustar el stock. No se permite stock negativo.'); }
  };
  const quitar = async (insumo: Insumo) => {
    if (!window.confirm(`¿Quitar ${insumo.nombre} del inventario?`)) return;
    setError('');
    try {
      await operacionesService.insumos.archivar(insumo.id);
      await cargarDatos();
    } catch { setError('No se pudo archivar el insumo.'); }
  };

  const filtrados = insumos.filter((insumo) => {
    const texto = `${insumo.nombre} ${insumo.categoria} ${insumo.unidad}`;
    return coincideBusqueda(texto, busqueda);
  });


  return <div className="space-y-6">
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {cargando && <p role="status" className="text-sm text-slate-500">Cargando inventario...</p>}
<div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-xs font-bold uppercase tracking-widest text-[#e3000f]">Bodega de mantenimiento</p><h1 className="mt-1 text-3xl font-black">Insumos y stock</h1><p className="mt-1 text-sm text-slate-500">Agrega, edita, ajusta o quita insumos del inventario.</p></div>{puedeEditar && <button onClick={abrirAgregar} className="rounded-xl bg-[#e3000f] px-4 py-2 text-sm font-bold text-white">+ Agregar insumo</button>}</div>{auditoria.length > 0 && <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-[11px] text-slate-500"><span className="font-black text-slate-700">Últimos cambios: </span>{auditoria.slice(0, 3).join(' · ')}</div>}<input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar insumo..." className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#e3000f]" /><div className="grid gap-4 md:grid-cols-3">{filtrados.map((item) => <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex justify-between"><span className="text-xs font-bold uppercase text-slate-400">{item.categoria}</span><span className={`rounded-full px-2 py-1 text-[10px] font-black ${item.stock < item.minimo ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{item.stock < item.minimo ? 'Reponer' : 'OK'}</span></div><h2 className="mt-4 font-black">{item.nombre}</h2><p className="mt-3 text-3xl font-black">{item.stock} <span className="text-sm font-bold text-slate-400">{item.unidad}</span></p><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${item.stock < item.minimo ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, item.stock / Math.max(item.minimo * 2, 1) * 100)}%` }} /></div><p className="mt-2 text-xs text-slate-500">Stock mínimo: {item.minimo} {item.unidad}</p><p className="mt-1 text-[10px] text-slate-400">Último cambio por: {item.ultimoCambioPor || 'Sin registro'}</p>{puedeEditar && <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => void ajustarStock(item, -1)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-black" title="Quitar una unidad">−</button><button onClick={() => void ajustarStock(item, 1)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-black" title="Agregar una unidad">+</button><button onClick={() => abrirEditar(item)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">Editar</button><button onClick={() => void quitar(item)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700">Quitar</button></div>}</div>)}</div>{puedeEditar && modal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><form onSubmit={guardar} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-xl font-black">{insumoEditando ? 'Editar insumo' : 'Agregar insumo'}</h2><input required value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} placeholder="Nombre del insumo" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /><div className="grid gap-3 sm:grid-cols-2"><input required type="number" min="0" step="0.01" value={form.cantidad} onChange={(event) => setForm({ ...form, cantidad: event.target.value })} placeholder="Cantidad / stock actual" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /><select value={form.unidad} onChange={(event) => setForm({ ...form, unidad: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option>unidades</option><option>litros</option><option>kilogramos</option><option>metros</option><option>juegos</option><option>cajas</option></select><input type="number" min="0" step="0.01" value={form.minimo} onChange={(event) => setForm({ ...form, minimo: event.target.value })} placeholder="Stock mínimo" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /><input value={form.categoria} onChange={(event) => setForm({ ...form, categoria: event.target.value })} placeholder="Categoría" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></div><div className="flex justify-end gap-2"><button type="button" onClick={() => { setModal(false); setInsumoEditando(null); }} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-500">Cancelar</button><button className="rounded-xl bg-[#e3000f] px-4 py-2 text-sm font-bold text-white">{insumoEditando ? 'Guardar cambios' : 'Guardar ingreso'}</button></div></form></div>}</div>;
};
