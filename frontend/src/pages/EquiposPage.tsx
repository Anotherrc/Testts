import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EquipoCard } from '../features/equipos/components/EquipoCard';
import { ModalHorometro } from '../features/equipos/components/ModalHorometro';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { CustomSelect } from '../components/ui/CustomSelect';
import { equiposService } from '../features/equipos/api/equiposService';
import type { Equipo } from '../features/equipos/types';
import { useAuth } from '../features/auth/hooks/useAuth';
import { coincideBusqueda } from '../utils/textSearch';

const normalizarSubcategoria = (valor?: string) => {
    const nombre = (valor || 'Sin subcategoría').trim();
    const clave = nombre
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

    if (clave.startsWith('alza hombre')) return 'Alza Hombre';
    if (['retro excavadora', 'retroexcavadora', 'retroexcabadora'].includes(clave)) return 'Retroexcavadora';
    if (clave.startsWith('plataforma tijera')) return 'Plataforma Tijera';
    if (clave.startsWith('camioneta')) return 'Camionetas';
    if (clave.startsWith('camion tolva')) return 'Camión Tolva';
    if (clave.startsWith('camion pluma')) return 'Camión Pluma';
    if (clave.startsWith('camion aljibe')) return 'Camión Aljibe';
    if (clave.startsWith('camion combustible')) return 'Camión Combustible';
    if (clave.startsWith('camion lubricador')) return 'Camión Lubricador';
    if (clave.startsWith('camion pantalla')) return 'Camión Pantalla';
    if (clave.startsWith('camion plano')) return 'Camión Plano';
    if (clave.startsWith('camion plataforma')) return 'Camión Plataforma';
    if (clave.startsWith('camion rescate')) return 'Camión Rescate';
    if (clave.startsWith('tracto camion')) return 'Tracto Camión';
    if (clave === 'camion' || clave === 'camiones') return 'Camiones';
    return nombre;
};

export const EquiposPage: React.FC = () => {
    const navigate = useNavigate();
    const { hasPermission } = useAuth();
    const puedeCrear = hasPermission('equipos.add_equipo');
    const puedeEditar = hasPermission('equipos.change_equipo');
    const puedeEliminar = hasPermission('equipos.delete_equipo');
    const [equipos, setEquipos] = useState<Equipo[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [errorApi, setErrorApi] = useState<string | null>(null);

    const [equipoSeleccionado, setEquipoSeleccionado] = useState<Equipo | null>(null);
    const [modalAbierto, setModalAbierto] = useState<boolean>(false);

    // Estados de Filtros
    const [filtroCategoria, setFiltroCategoria] = useState<string>('');
    const [filtroSubcategoria, setFiltroSubcategoria] = useState<string>('');
    const [filtroMarca, setFiltroMarca] = useState<string>('');
    const [filtroModelo, setFiltroModelo] = useState<string>('');
    const [filtroEstado, setFiltroEstado] = useState<string>('');
    const [filtroAlerta, setFiltroAlerta] = useState<string>('');
    const [filtroGps, setFiltroGps] = useState(false);
    const [panelAlerta, setPanelAlerta] = useState<'GPS' | 'URGENTE' | 'PROXIMO' | 'TALLER' | null>(null);
    const [busqueda, setBusqueda] = useState('');
    const [modalNuevo, setModalNuevo] = useState(false);
    const [nuevoEquipo, setNuevoEquipo] = useState({ codigo: '', nombre: '', categoria: '', subcategoria: '', marca: '', modelo: '', meta_proxima_mant: '', unidad_medida: 'HORAS', limite_contrato_mes: '162', foto_url: '', foto_archivo: null as File | null });

    // Carga inicial de datos desde el servidor (incluyendo deshabilitadas para el filtro)
    const cargarEquipos = async () => {
        try {
            setLoading(true);
            setErrorApi(null);
            const data = await equiposService.getAll(true);
            setEquipos(data);
        } catch (err: unknown) {
            console.error('Error al cargar maquinarias:', err);
            setErrorApi('No se pudo conectar con el servidor de Vilas Motor. Verifica tu conexión o sesión.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let activo = true;
        equiposService.getAll(true)
            .then((data) => {
                if (!activo) return;
                setErrorApi(null);
                setEquipos(data);
            })
            .catch((err: unknown) => {
                console.error('Error al cargar maquinarias:', err);
                if (activo) {
                    setErrorApi('No se pudo conectar con el servidor de Vilas Motor. Verifica tu conexión o sesión.');
                }
            })
            .finally(() => {
                if (activo) setLoading(false);
            });
        return () => {
            activo = false;
        };
    }, []);

    const categorias = useMemo(
        () => Array.from(new Set(equipos.map((e) => e.categoria || 'Sin categoría'))).filter(Boolean).sort(),
        [equipos]
    );
    const subcategorias = useMemo(() => Array.from(new Set(
        equipos
            .filter((e) => filtroCategoria && e.categoria === filtroCategoria)
            .map((e) => normalizarSubcategoria(e.subcategoria))
    )).filter(Boolean).sort(), [equipos, filtroCategoria]);
    const marcas = useMemo(() => Array.from(new Set(equipos
        .filter((e) => {
            if (filtroCategoria && e.categoria !== filtroCategoria) return false;
            if (filtroSubcategoria && normalizarSubcategoria(e.subcategoria) !== filtroSubcategoria) return false;
            return true;
        })
        .map((e) => e.marca || 'Sin marca'))).filter(Boolean).sort(), [equipos, filtroCategoria, filtroSubcategoria]);
    const modelos = useMemo(() => Array.from(new Set(equipos
        .filter((e) => {
            if (!filtroCategoria || e.categoria !== filtroCategoria) return false;
            if (!filtroSubcategoria || normalizarSubcategoria(e.subcategoria) !== filtroSubcategoria) return false;
            if (filtroMarca && e.marca !== filtroMarca) return false;
            return true;
        })
        .map((e) => e.modelo || 'Sin modelo'))).filter(Boolean).sort(), [equipos, filtroCategoria, filtroSubcategoria, filtroMarca]);

    const handleAbrirModal = (equipo: Equipo) => {
        setEquipoSeleccionado(equipo);
        setModalAbierto(true);
    };

    const handleCerrarModal = () => {
        setModalAbierto(false);
        setEquipoSeleccionado(null);
    };

    // Guardar lectura enviando PATCH a Django
    const handleGuardarLectura = async (
        equipoId: number,
        nuevaLecturaTotal: number,
        nuevoConsumoMes: number
    ) => {
        const equipoActualizado = await equiposService.actualizarHorometro(
            equipoId,
            nuevaLecturaTotal,
            nuevoConsumoMes
        );

        // Actualizamos el estado local con la respuesta oficial del backend
        setEquipos((prev) =>
            prev.map((eq) => (eq.id === equipoId ? equipoActualizado : eq))
        );
    };

    const handleDarDeBaja = async (equipo: Equipo) => {
        const primeraConfirmacion = window.confirm(`¿Dar de baja ${equipo.codigo}? Esta acción conserva el historial, pero lo deja fuera de servicio.`);
        if (!primeraConfirmacion) return;
        const segundaConfirmacion = window.prompt(`Escribe ${equipo.codigo} para confirmar la baja segura.`);
        if (segundaConfirmacion?.trim().toUpperCase() !== equipo.codigo.toUpperCase()) return;
        await equiposService.darDeBaja(equipo.id);
        setEquipos((prev) =>
            prev.map((item) =>
                item.id === equipo.id
                    ? {
                        ...item,
                        estado: 'Deshabilitada',
                        is_deleted: true,
                        color_semaforo: 'GRIS',
                        estado_alerta: 'INHABILITADO: Fuera de Servicio',
                    }
                    : item
            )
        );
    };

    const handleRestaurar = async (equipo: Equipo) => {
        if (!window.confirm(`¿Restaurar ${equipo.codigo} a estado Disponible?`)) return;
        const restaurado = await equiposService.restaurar(equipo.id);
        setEquipos((prev) => prev.map((item) => (item.id === equipo.id ? restaurado : item)));
    };

    const handleCrearEquipo = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!nuevoEquipo.codigo || !nuevoEquipo.nombre || !nuevoEquipo.meta_proxima_mant) return;
        const equipo = await equiposService.crear({
            codigo: nuevoEquipo.codigo,
            nombre: nuevoEquipo.nombre,
            categoria: nuevoEquipo.categoria,
            subcategoria: nuevoEquipo.subcategoria,
            marca: nuevoEquipo.marca,
            modelo: nuevoEquipo.modelo,
            meta_proxima_mant: Number(nuevoEquipo.meta_proxima_mant),
            unidad_medida: nuevoEquipo.unidad_medida as 'HORAS' | 'KM',
            limite_contrato_mes: Number(nuevoEquipo.limite_contrato_mes),
            estado: 'Disponible',
            horometro_actual: 0,
            horas_uso_mes: 0,
            encendido_gps: false,
            foto_url: nuevoEquipo.foto_url,
            foto_archivo: nuevoEquipo.foto_archivo || undefined,
        });
        setEquipos((prev) => [...prev, equipo]);
        setNuevoEquipo({ codigo: '', nombre: '', categoria: '', subcategoria: '', marca: '', modelo: '', meta_proxima_mant: '', unidad_medida: 'HORAS', limite_contrato_mes: '162', foto_url: '', foto_archivo: null });
        setModalNuevo(false);
    };

    const limpiarFiltros = () => {
        setFiltroCategoria('');
        setFiltroSubcategoria('');
        setFiltroMarca('');
        setFiltroModelo('');
        setFiltroEstado('');
        setFiltroAlerta('');
        setFiltroGps(false);
        setPanelAlerta(null);
        setBusqueda('');
    };

    const mostrarTodasAlerta = (tipo: 'GPS' | 'URGENTE' | 'PROXIMO' | 'TALLER') => {
        setFiltroCategoria('');
        setFiltroSubcategoria('');
        setFiltroMarca('');
        setFiltroModelo('');
        setBusqueda('');
        setFiltroEstado(tipo === 'TALLER' ? 'Mantenimiento' : '');
        setFiltroAlerta(tipo === 'TALLER' || tipo === 'GPS' ? '' : tipo);
        setFiltroGps(tipo === 'GPS');
        setPanelAlerta(null);
    };

    const equiposActivos = useMemo(
        () => equipos.filter((e) => !e.is_deleted && e.estado !== 'Deshabilitada'),
        [equipos]
    );

    // Filtrado completo por datos visibles de la maquinaria.
    const equiposProcesados = useMemo(() => {
        return equipos
            .filter((eq) => {
                const esDeshabilitada = eq.estado === 'Deshabilitada' || Boolean(eq.is_deleted);
                if (filtroEstado === 'Deshabilitada') {
                    if (!esDeshabilitada) return false;
                } else {
                    if (esDeshabilitada) return false;
                }

                const texto = [
                    eq.nombre,
                    eq.codigo,
                    eq.nro_interno,
                    eq.marca,
                    eq.modelo,
                    eq.patente,
                    eq.categoria,
                    eq.subcategoria,
                    eq.zona_operacion,
                    eq.estado,
                ].filter(Boolean).join(' ');
                const coincideTexto = coincideBusqueda(texto, busqueda);
                const coincideCategoria = !filtroCategoria || eq.categoria === filtroCategoria;
                const coincideSubcategoria = !filtroSubcategoria || normalizarSubcategoria(eq.subcategoria) === filtroSubcategoria;
                const coincideMarca = !filtroMarca || eq.marca === filtroMarca;
                const coincideModelo = !filtroModelo || eq.modelo === filtroModelo;
                const coincideEstado = !filtroEstado || (filtroEstado === 'Deshabilitada' ? esDeshabilitada : eq.estado === filtroEstado);
                const coincideGps = !filtroGps || eq.encendido_gps;
                const coincideAlerta =
                    !filtroAlerta
                    || (filtroAlerta === 'URGENTE' && eq.color_semaforo === 'ROJO')
                    || (filtroAlerta === 'PROXIMO' && eq.color_semaforo === 'AMARILLO');

                return coincideTexto && coincideCategoria && coincideSubcategoria && coincideMarca && coincideModelo && coincideEstado && coincideGps && coincideAlerta;
            });
    }, [
        equipos,
        filtroCategoria,
        filtroSubcategoria,
        filtroMarca,
        filtroModelo,
        filtroEstado,
        filtroAlerta,
        filtroGps,
        busqueda,
    ]);

    const gpsEncendidos = equiposActivos.filter((e) => e.encendido_gps);
    const totalOperando = gpsEncendidos.length;
    const urgentes = equiposActivos.filter((e) => e.color_semaforo === 'ROJO');
    const proximos = equiposActivos.filter((e) => e.color_semaforo === 'AMARILLO');
    const enTaller = equiposActivos.filter((e) => e.estado === 'Mantenimiento');

    return (
        <div className="space-y-6">
            {/* Cabecera y Métricas */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900">
                        Control de Flota y Horómetros
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Gestión en tiempo real vinculada a la base de datos de Vilas Motor.
                    </p>
                </div>


                <div className="relative flex flex-wrap items-center gap-3">
                    {puedeCrear && <button onClick={() => setModalNuevo(true)} className="rounded-xl bg-[#e3000f] px-4 py-2.5 text-xs font-black text-white shadow-sm hover:bg-red-600">+ Agregar maquinaria</button>}
                    <Link to="/reportes/maquinarias" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700">Informe PDF</Link>
                    <button type="button" onClick={() => setPanelAlerta((actual) => actual === 'GPS' ? null : 'GPS')} className="px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-center transition hover:bg-emerald-100">
                        <span className="block text-xs font-bold text-emerald-700 uppercase">GPS Encendido</span>
                        <span className="text-lg font-black text-emerald-900">{totalOperando} / {equiposActivos.length}</span>
                    </button>
                    <button type="button" onClick={() => setPanelAlerta((actual) => actual === 'URGENTE' ? null : 'URGENTE')} className="px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-center transition hover:bg-red-100">
                        <span className="block text-xs font-bold text-red-700 uppercase">Urgentes</span>
                        <span className="text-lg font-black text-red-900">{urgentes.length}</span>
                    </button>
                    <button type="button" onClick={() => setPanelAlerta((actual) => actual === 'PROXIMO' ? null : 'PROXIMO')} className="px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl text-center transition hover:bg-amber-100">
                        <span className="block text-xs font-bold text-amber-700 uppercase">Próximos</span>
                        <span className="text-lg font-black text-amber-900">{proximos.length}</span>
                    </button>
                    <button type="button" onClick={() => setPanelAlerta((actual) => actual === 'TALLER' ? null : 'TALLER')} className="px-4 py-2 bg-slate-100 border border-slate-300 rounded-xl text-center transition hover:bg-slate-200">
                        <span className="block text-xs font-bold text-slate-700 uppercase">En taller</span>
                        <span className="text-lg font-black text-slate-900">{enTaller.length}</span>
                    </button>
                    {panelAlerta && (() => {
                        const lista = panelAlerta === 'GPS'
                            ? gpsEncendidos
                            : panelAlerta === 'URGENTE'
                                ? urgentes
                                : panelAlerta === 'PROXIMO'
                                    ? proximos
                                    : enTaller;
                        const titulo = panelAlerta === 'GPS'
                            ? 'Maquinarias con GPS encendido'
                            : panelAlerta === 'URGENTE'
                                ? 'Maquinarias urgentes'
                                : panelAlerta === 'PROXIMO'
                                    ? 'Próximas a mantenimiento'
                                    : 'Maquinarias en taller';
                        return (
                            <div
                                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
                                onMouseDown={(event) => {
                                    if (event.target === event.currentTarget) setPanelAlerta(null);
                                }}
                            >
                                <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-2xl">
                                    <div className="mb-4 flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-lg font-black text-slate-900">{titulo}</p>
                                            <p className="text-xs text-slate-500">{lista.length} maquinarias coinciden con el filtro</p>
                                        </div>
                                        <button type="button" onClick={() => setPanelAlerta(null)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Cerrar</button>
                                    </div>
                                    <div className="max-h-[420px] space-y-2 overflow-y-auto">
                                        {lista.length === 0 ? (
                                            <p className="rounded-xl bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">No hay maquinarias en este filtro.</p>
                                        ) : lista.map((equipo) => (
                                            <Link
                                                key={equipo.id}
                                                to={`/flotas/${equipo.id}`}
                                                onClick={() => setPanelAlerta(null)}
                                                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 hover:border-red-200 hover:bg-red-50"
                                            >
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-black text-slate-900">{equipo.codigo} · {equipo.nombre}</p>
                                                    <p className="mt-0.5 text-xs text-slate-500">{equipo.estado} · {equipo.categoria || 'Sin categoría'}</p>
                                                </div>
                                                <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black ${panelAlerta === 'GPS' ? 'bg-emerald-100 text-emerald-700' : panelAlerta === 'URGENTE' ? 'bg-red-100 text-red-700' : panelAlerta === 'PROXIMO' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-700'}`}>
                                                    {panelAlerta === 'GPS' ? 'GPS encendido' : panelAlerta === 'URGENTE' ? 'Abrir urgente' : panelAlerta === 'PROXIMO' ? 'Abrir próximo' : 'Abrir taller'}
                                                </span>
                                            </Link>
                                        ))}
                                    </div>
                                    <button type="button" onClick={() => mostrarTodasAlerta(panelAlerta)} className="mt-3 w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-[#e3000f]">
                                        Ver las {lista.length} maquinarias
                                    </button>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* PANEL DE FILTROS Y BUSQUEDA */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide">
                        Filtros del Catálogo
                    </h2>
                    <button
                        type="button"
                        onClick={limpiarFiltros}
                        className="text-xs font-bold text-[#e3000f] hover:underline cursor-pointer"
                    >
                        Limpiar filtros
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <SearchableSelect label="Tipo de maquinaria" options={categorias} value={filtroCategoria} onChange={(value) => { setFiltroCategoria(value); setFiltroSubcategoria(''); setFiltroMarca(''); setFiltroModelo(''); }} placeholder="Ej: Construcción..." />
                        {filtroCategoria && (
                            <CustomSelect label="Subcategoría del tipo" value={filtroSubcategoria} onChange={(value) => { setFiltroSubcategoria(value); setFiltroMarca(''); setFiltroModelo(''); }} options={[{ value: '', label: 'Todas' }, ...subcategorias.map((value) => ({ value, label: value }))]} />
                        )}
                        <CustomSelect label="Marca" value={filtroMarca} onChange={(value) => { setFiltroMarca(value); setFiltroModelo(''); }} options={[{ value: '', label: 'Todas' }, ...marcas.map((value) => ({ value, label: value }))]} />
                        {filtroCategoria && filtroSubcategoria && (
                            <CustomSelect label="Modelo" value={filtroModelo} onChange={setFiltroModelo} options={[{ value: '', label: 'Todos' }, ...modelos.map((value) => ({ value, label: value }))]} />
                        )}
                        <CustomSelect
                            label="Estado"
                            value={filtroEstado}
                            onChange={setFiltroEstado}
                            options={[
                                { value: '', label: 'Todos' },
                                { value: 'Disponible', label: 'Disponible' },
                                { value: 'Mantenimiento', label: 'Mantenimiento' },
                                { value: 'Arrendada', label: 'Arrendada' },
                                { value: 'Deshabilitada', label: 'Deshabilitada' },
                            ]}
                        />
                    </div>
                    <div className="rounded-2xl border border-red-100 bg-red-50/40 p-4">
                        <label className="block text-xs font-black uppercase tracking-wide text-slate-600">Buscar maquinaria</label>
                        <p className="mt-1 text-xs text-slate-500">Nombre, N° interno, marca, modelo, patente o categoría</p>
                        <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Ej: grúa, XLS-0001, Caterpillar..." className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none focus:border-[#e3000f] focus:ring-2 focus:ring-red-100" />
                    </div>
                </div>
            </div>

            {/* Estados de Carga y Error de API */}
            {loading && (
                <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-600 font-semibold">
                    Cargando catálogo desde el backend...
                </div>
            )}

            {errorApi && (
                <div className="bg-red-50 p-6 rounded-2xl border border-red-200 text-center">
                    <p className="text-sm font-bold text-red-800">{errorApi}</p>
                    <button
                        onClick={cargarEquipos}
                        className="mt-3 px-4 py-2 bg-[#e3000f] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                    >
                        Reintentar Conexión
                    </button>
                </div>
            )}

            {/* Grilla de Resultados */}
            {!loading && !errorApi && (
                <>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500 px-1">
                        <span>
                            Mostrando {equiposProcesados.length} de {filtroEstado === 'Deshabilitada' ? equipos.filter((e) => e.estado === 'Deshabilitada' || e.is_deleted).length : equiposActivos.length} equipos
                        </span>
                    </div>

                    {equiposProcesados.length === 0 ? (
                        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
                            <p className="text-base font-bold text-slate-700">No hay maquinarias registradas o coincidentes</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {equiposProcesados.map((equipo) => (
                                <EquipoCard
                                    key={equipo.id}
                                    equipo={equipo}
                                    onActualizarHorometro={puedeEditar ? handleAbrirModal : undefined}
                                    onDarDeBaja={puedeEliminar ? handleDarDeBaja : undefined}
                                    onRestaurar={puedeEditar ? handleRestaurar : undefined}
                                    onVerDetalle={(equipo) => navigate(`/flotas/${equipo.id}`)}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Modal Horómetro */}
            <ModalHorometro
                key={equipoSeleccionado?.id || 'modal-closed'}
                isOpen={modalAbierto}
                onClose={handleCerrarModal}
                equipo={equipoSeleccionado}
                onGuardarLectura={handleGuardarLectura}
            />
            {modalNuevo && puedeCrear && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
                    <form onSubmit={handleCrearEquipo} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
                        <div><h2 className="text-xl font-black">Agregar maquinaria</h2><p className="text-sm text-slate-500">La maquinaria quedará disponible para arriendo y mantenimiento.</p></div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <input required value={nuevoEquipo.codigo} onChange={(e) => setNuevoEquipo({ ...nuevoEquipo, codigo: e.target.value })} placeholder="Nro. interno" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                            <input required value={nuevoEquipo.nombre} onChange={(e) => setNuevoEquipo({ ...nuevoEquipo, nombre: e.target.value })} placeholder="Nombre visible" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                            <input value={nuevoEquipo.categoria} onChange={(e) => setNuevoEquipo({ ...nuevoEquipo, categoria: e.target.value })} placeholder="Tipo de maquinaria" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                            <input value={nuevoEquipo.subcategoria} onChange={(e) => setNuevoEquipo({ ...nuevoEquipo, subcategoria: e.target.value })} placeholder="Subcategoría general del tipo" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                            <input value={nuevoEquipo.marca} onChange={(e) => setNuevoEquipo({ ...nuevoEquipo, marca: e.target.value })} placeholder="Marca" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                            <input value={nuevoEquipo.modelo} onChange={(e) => setNuevoEquipo({ ...nuevoEquipo, modelo: e.target.value })} placeholder="Modelo" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                            <input required type="number" min="0" value={nuevoEquipo.meta_proxima_mant} onChange={(e) => setNuevoEquipo({ ...nuevoEquipo, meta_proxima_mant: e.target.value })} placeholder="Próxima mantención" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                            <select value={nuevoEquipo.unidad_medida} onChange={(e) => setNuevoEquipo({ ...nuevoEquipo, unidad_medida: e.target.value })} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="HORAS">Horómetro</option><option value="KM">Kilometraje</option></select>
                            <select value={nuevoEquipo.limite_contrato_mes} onChange={(e) => setNuevoEquipo({ ...nuevoEquipo, limite_contrato_mes: e.target.value })} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="162">Contrato 162 hrs</option><option value="176">Contrato 176 hrs</option></select>
                            <input type="url" value={nuevoEquipo.foto_url} onChange={(e) => setNuevoEquipo({ ...nuevoEquipo, foto_url: e.target.value })} placeholder="URL de foto (opcional)" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm sm:col-span-2" />
                            <input type="file" accept="image/*" onChange={(e) => setNuevoEquipo({ ...nuevoEquipo, foto_archivo: e.target.files?.[0] || null })} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm sm:col-span-2" />
                        </div>
                        <div className="flex justify-end gap-2"><button type="button" onClick={() => setModalNuevo(false)} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-500">Cancelar</button><button className="rounded-xl bg-[#e3000f] px-4 py-2 text-sm font-bold text-white">Guardar maquinaria</button></div>
                    </form>
                </div>
            )}
        </div>
    );
};