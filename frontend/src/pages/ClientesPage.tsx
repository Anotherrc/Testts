import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { equiposService } from '../features/equipos/api/equiposService';
import type { Equipo } from '../features/equipos/types';

import type { Cliente } from '../features/operaciones/types';
import { operacionesService } from '../features/operaciones/api/operacionesService';
import { coincideBusqueda } from '../utils/textSearch';
type Asignaciones = Record<number, number>;

const dotClass = (equipo: Equipo) => equipo.color_semaforo === 'ROJO' ? 'bg-red-500' : equipo.color_semaforo === 'AMARILLO' ? 'bg-amber-400' : 'bg-emerald-500';

export const ClientesPage: React.FC = () => {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [clienteAbierto, setClienteAbierto] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('TODAS');
  const [modal, setModal] = useState(false);
  const [nuevo, setNuevo] = useState({ nombre: '', rut: '', telefono: '', correo: '', direccion: '', fechaCliente: '', categoria: 'Construcción', subcategoria: '' });
  const [asignaciones, setAsignaciones] = useState<Asignaciones>({});
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [clienteParaAsignar, setClienteParaAsignar] = useState<number | null>(null);
  const [busquedaAsignacion, setBusquedaAsignacion] = useState('');
  const [categoriaAsignacion, setCategoriaAsignacion] = useState('TODAS');
  const [marcaAsignacion, setMarcaAsignacion] = useState('TODAS');
  const [modeloAsignacion, setModeloAsignacion] = useState('TODOS');

  useEffect(() => {
    let activo = true;
    Promise.all([equiposService.getAll(), operacionesService.clientes.listar()])
      .then(([maquinas, lista]) => {
        if (!activo) return;
        setError('');
        setEquipos(maquinas);
        setClientes(lista);
        setAsignaciones(maquinas.reduce<Asignaciones>((acc, equipo) => {
          if (equipo.cliente_empresa) acc[equipo.id] = equipo.cliente_empresa;
          return acc;
        }, {}));
      })
      .catch(() => {
        if (activo) setError('No se pudieron cargar los datos del servidor. Verifica la conexión y tus permisos.');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => { activo = false; };
  }, []);
  const cambiarAsignacion = async (equipo: Equipo, clienteId: number | null) => {
    setError('');
    try {
      const actualizado = await equiposService.actualizar(equipo.id, {
        cliente_empresa: clienteId,
        estado: clienteId ? 'Arrendada' : 'Disponible',
      });
      setEquipos((prev) => prev.map((e) => e.id === actualizado.id ? actualizado : e));
      setAsignaciones((prev) => {
        const nuevos = { ...prev };
        if (clienteId) nuevos[equipo.id] = clienteId;
        else delete nuevos[equipo.id];
        return nuevos;
      });
    } catch { setError('No se pudo guardar la asignación. Revisa el estado del equipo.'); }
  };
  const alternarCliente = async (cliente: Cliente) => {
    setError('');
    try {
      const actualizado = await operacionesService.clientes.actualizar(cliente.id, {
        estado: cliente.estado === 'Activo' ? 'Inactivo' : 'Activo'
      });
      setClientes((prev) => prev.map((c) => c.id === actualizado.id ? actualizado : c));
    } catch { setError('No se pudo cambiar el estado del cliente. Comprueba si tiene equipos asignados.'); }
  };
  const filtrados = useMemo(() => clientes.filter((cliente) => (categoria === 'TODAS' || cliente.categoria === categoria) && coincideBusqueda(`${cliente.nombre} ${cliente.rut}`, busqueda)), [clientes, categoria, busqueda]);
  const categoriasAsignacion = useMemo(() => Array.from(new Set(equipos.map((equipo) => equipo.categoria || 'Sin categoría'))).sort(), [equipos]);
  const marcasAsignacion = useMemo(() => Array.from(new Set(equipos.map((equipo) => equipo.marca || 'Sin marca'))).sort(), [equipos]);
  const modelosAsignacion = useMemo(() => Array.from(new Set(equipos.map((equipo) => equipo.modelo || 'Sin modelo'))).sort(), [equipos]);
  const guardar = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!nuevo.nombre.trim()) return;
    setError('');
    try {
      const creado = await operacionesService.clientes.crear({
        ...nuevo, fechaCliente: nuevo.fechaCliente || null,
      });
      setClientes((actuales) => [...actuales, creado]);
      setNuevo({ nombre: '', rut: '', telefono: '', correo: '', direccion: '', fechaCliente: '', categoria: 'Construcción', subcategoria: '' });
      setModal(false);
    } catch { setError('No se pudo crear el cliente. Revisa el RUT, el correo y los campos ingresados.'); }
  };

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-xs font-bold uppercase tracking-widest text-[#e3000f]">Relación comercial</p><h1 className="mt-1 text-3xl font-black">Clientes y arriendos</h1><p className="mt-1 text-sm text-slate-500">Consulta los equipos asignados y su estado operativo.</p></div><button onClick={() => setModal(true)} className="rounded-xl bg-[#e3000f] px-4 py-2 text-sm font-bold text-white">+ Agregar cliente</button></div>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {cargando && <p role="status" className="text-sm text-slate-500">Cargando clientes y maquinarias...</p>}
    <div className="grid gap-3 md:grid-cols-[1fr_220px]"><input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar por nombre o RUT..." className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#e3000f]" /><select value={categoria} onChange={(event) => setCategoria(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold"><option value="TODAS">Todas las categorías</option><option>Construcción</option><option>Minería</option></select></div>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-4">Cliente</th><th className="px-5 py-4">Categoría / subcategoría</th><th className="px-5 py-4">Equipos asignados</th><th className="px-5 py-4">Estado</th><th className="px-5 py-4">Acciones</th></tr></thead><tbody>{filtrados.map((cliente) => {
      const asignados = equipos.filter((equipo) => (asignaciones[equipo.id] ?? equipo.cliente_empresa) === cliente.id);
      const disponibles = equipos.filter((equipo) => {
        if (asignaciones[equipo.id] || equipo.cliente_empresa || equipo.estado === 'Deshabilitada' || equipo.estado === 'Mantenimiento' || equipo.estado === 'Arrendada') return false;
        const texto = `${equipo.codigo} ${equipo.nombre} ${equipo.nro_interno || ''} ${equipo.patente || ''}`;
        return coincideBusqueda(texto, busquedaAsignacion)
          && (categoriaAsignacion === 'TODAS' || (equipo.categoria || 'Sin categoría') === categoriaAsignacion)
          && (marcaAsignacion === 'TODAS' || (equipo.marca || 'Sin marca') === marcaAsignacion)
          && (modeloAsignacion === 'TODOS' || (equipo.modelo || 'Sin modelo') === modeloAsignacion);
      });
      return <React.Fragment key={cliente.id}><tr className="border-t border-slate-100"><td className="px-5 py-4"><p className="font-black">{cliente.nombre}</p><p className="text-xs text-slate-500">{cliente.rut}</p></td><td className="px-5 py-4"><p className="font-bold">{cliente.categoria}</p><p className="text-xs text-slate-500">{cliente.subcategoria || 'Sin subcategoría'}</p></td><td className="px-5 py-4"><button onClick={() => setClienteAbierto(clienteAbierto === cliente.id ? null : cliente.id)} className="font-black text-[#e3000f] hover:underline">{asignados.length} equipos · Abrir maquinarias</button></td><td className="px-5 py-4"><span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-bold ${cliente.estado === 'Activo' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}><span className={`h-2 w-2 rounded-full ${cliente.estado === 'Activo' ? 'bg-emerald-500' : 'bg-slate-400'}`} />{cliente.estado}</span></td><td className="px-5 py-4"><button onClick={() => void alternarCliente(cliente)} className="text-xs font-bold text-[#e3000f] hover:underline">{cliente.estado === 'Activo' ? 'Dar de baja' : 'Reactivar'}</button></td></tr>{clienteAbierto === cliente.id && <tr><td colSpan={5} className="bg-slate-50 px-5 py-4"><p className="mb-3 text-xs font-black uppercase text-slate-500">Maquinarias del cliente</p><div className="mb-3 flex flex-wrap items-center gap-2"><button onClick={() => setClienteParaAsignar(clienteParaAsignar === cliente.id ? null : cliente.id)} className="rounded-lg bg-[#e3000f] px-3 py-2 text-xs font-bold text-white">+ Agregar maquinaria</button><span className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-500">{asignados.length} arrendadas</span><span className="text-xs text-slate-500">Pulsa “Agregar maquinaria” para buscar entre toda la flota disponible.</span></div>{clienteParaAsignar === cliente.id && <div className="mb-3 rounded-xl border border-red-100 bg-white p-3"><div className="mb-3 grid gap-2 md:grid-cols-4"><input value={busquedaAsignacion} onChange={(event) => setBusquedaAsignacion(event.target.value)} placeholder="Buscar código, nombre, patente..." className="rounded-lg border border-slate-200 px-3 py-2 text-xs md:col-span-1" /><select value={categoriaAsignacion} onChange={(event) => setCategoriaAsignacion(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs"><option value="TODAS">Todas las categorías</option>{categoriasAsignacion.map((value) => <option key={value}>{value}</option>)}</select><select value={marcaAsignacion} onChange={(event) => setMarcaAsignacion(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs"><option value="TODAS">Todas las marcas</option>{marcasAsignacion.map((value) => <option key={value}>{value}</option>)}</select><select value={modeloAsignacion} onChange={(event) => setModeloAsignacion(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs"><option value="TODOS">Todos los modelos</option>{modelosAsignacion.map((value) => <option key={value}>{value}</option>)}</select></div><p className="mb-2 text-xs font-bold text-slate-500">{disponibles.length} maquinarias disponibles</p><div className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2">{disponibles.length ? disponibles.map((equipo) => <button key={equipo.id} onClick={() => { void cambiarAsignacion(equipo, cliente.id); setClienteParaAsignar(null); }} className="rounded-lg border border-slate-200 p-2 text-left text-xs hover:border-[#e3000f]"><b>{equipo.codigo}</b> · {equipo.nombre}<span className="mt-1 block text-[11px] text-slate-500">{equipo.categoria || 'Sin categoría'} · {equipo.marca || 'Sin marca'} {equipo.modelo || ''}</span></button>) : <p className="text-xs text-slate-500">No hay maquinarias disponibles con estos filtros.</p>}</div></div>}<div className="grid gap-2 sm:grid-cols-2">{asignados.length ? asignados.map((equipo) => <div key={equipo.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2"><button onClick={() => navigate(`/flotas/${equipo.id}`)} className="flex min-w-0 flex-1 items-center gap-2 text-left"><span className={`h-3 w-3 shrink-0 rounded-full ${dotClass(equipo)}`} /><span className="min-w-0"><span className="block truncate text-xs font-black">{equipo.codigo} · {equipo.nombre}</span><span className="block truncate text-[11px] text-slate-500">{equipo.marca || 'Sin marca'} {equipo.modelo || ''}</span></span></button><button onClick={() => void cambiarAsignacion(equipo, null)} className="rounded-lg px-2 py-1 text-[10px] font-black text-red-600 hover:bg-red-50">Quitar</button></div>) : <span className="text-xs text-slate-500">Sin equipos arrendados.</span>}</div></td></tr>}</React.Fragment>;
    })}</tbody></table></div>{filtrados.length === 0 && <p className="p-10 text-center text-sm text-slate-500">No hay clientes que coincidan con los filtros.</p>}</div>
    {modal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><form onSubmit={guardar} className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div><h2 className="text-xl font-black">Agregar cliente</h2><p className="text-sm text-slate-500">Registra la información comercial completa.</p></div><div className="grid gap-3 sm:grid-cols-2">{[['nombre', 'Nombre o razón social'], ['rut', 'RUT o RUN'], ['telefono', 'Número de teléfono'], ['correo', 'Correo electrónico'], ['direccion', 'Dirección'], ['fechaCliente', 'Fecha en que se hizo cliente'], ['subcategoria', 'Tipo de maquinaria / subcategoría']].map(([key, label]) => <input key={key} required={['nombre', 'rut', 'correo'].includes(key)} type={key === 'fechaCliente' ? 'date' : key === 'correo' ? 'email' : 'text'} value={nuevo[key as keyof typeof nuevo]} onChange={(event) => setNuevo({ ...nuevo, [key]: event.target.value })} placeholder={label} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />)}<select value={nuevo.categoria} onChange={(event) => setNuevo({ ...nuevo, categoria: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option>Construcción</option><option>Minería</option><option>Transporte</option><option>Servicios</option></select></div><div className="flex justify-end gap-2"><button type="button" onClick={() => setModal(false)} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-500">Cancelar</button><button className="rounded-xl bg-[#e3000f] px-4 py-2 text-sm font-bold text-white">Guardar cliente</button></div></form></div>}
  </div>;
};
