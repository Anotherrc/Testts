import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { equiposService } from '../features/equipos/api/equiposService';
import type { Equipo } from '../features/equipos/types';
import type { Cliente } from '../features/operaciones/types';
import { operacionesService } from '../features/operaciones/api/operacionesService';
import { coincideBusqueda } from '../utils/textSearch';

const IQUIQUE: [number, number] = [-20.2141, -70.1524];
const zoneStorage = 'vilas-zonas-sin-cobertura';

type ZonaCobertura = {
  id: number;
  nombre: string;
  latitud: number;
  longitud: number;
  radio: number;
};

type ZonaReferencial = {
  nombre: string;
  latitud: number;
  longitud: number;
};

// Puntos ilustrativos situados en sectores terrestres de Tarapacá.
// NO indican la ubicación real de un equipo ni información GPS en vivo.
const ZONAS_REFERENCIALES: ZonaReferencial[] = [
  { nombre: 'Iquique, sector urbano', latitud: -20.2185, longitud: -70.1355 },
  { nombre: 'Iquique, sector industrial', latitud: -20.1989, longitud: -70.1365 },
  { nombre: 'Alto Hospicio', latitud: -20.2675, longitud: -70.0990 },
  { nombre: 'Pozo Almonte', latitud: -20.2583, longitud: -69.7864 },
];

const textoNormalizado = (texto: string) =>
  texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

const hashTexto = (texto: string) => {
  let hash = 0;
  for (let i = 0; i < texto.length; i += 1) {
    hash = (hash * 31 + texto.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const zonaReferencial = (equipo: Equipo): ZonaReferencial => {
  const nombre = textoNormalizado(
    `${equipo.nombre} ${equipo.categoria || ''} ${equipo.tipo_equipo || ''}`
  );
  if (nombre.includes('GRUA') || nombre.includes('MANIPULADOR')) {
    return ZONAS_REFERENCIALES[1];
  }
  if (nombre.includes('EXCAVADORA') || nombre.includes('RETRO') || nombre.includes('MOVIMIENTO')) {
    return ZONAS_REFERENCIALES[3];
  }
  if (nombre.includes('CAMION') || nombre.includes('TRACTO')) {
    return ZONAS_REFERENCIALES[2];
  }
  if (nombre.includes('GENERADOR') || nombre.includes('LUMINARIA')) {
    return ZONAS_REFERENCIALES[0];
  }
  return ZONAS_REFERENCIALES[hashTexto(equipo.codigo) % ZONAS_REFERENCIALES.length];
};

const coordenadasValidas = (latitud?: number, longitud?: number) =>
  typeof latitud === 'number' &&
  typeof longitud === 'number' &&
  Number.isFinite(latitud) &&
  Number.isFinite(longitud) &&
  latitud >= -90 && latitud <= 90 &&
  longitud >= -180 && longitud <= 180 &&
  !(latitud === 0 && longitud === 0);

// El importador genera posiciones de prueba para los códigos XLS-0001...XLS-0394.
// Se reconocen para no mostrarlas como ubicaciones registradas, incluso si
// anteriormente se marcó ubicacion_registrada=True en la base de pruebas.
const coordenadasDelImportador = (equipo: Equipo) => {
  const coincidencia = /^XLS-(\d+)$/.exec(equipo.codigo);
  if (!coincidencia || !coordenadasValidas(equipo.latitud, equipo.longitud)) {
    return false;
  }
  const indice = Number(coincidencia[1]);
  const rutas: [number, number][] = [
    [-18.4783, -70.3126],
    [-19.5, -70.25],
    [-20.2141, -70.1524],
    [-20.95, -69.5],
  ];
  const base = rutas[indice % rutas.length];
  const latitudImportada = base[0] + Math.sin(indice) * 0.05;
  const longitudImportada = base[1] + Math.cos(indice) * 0.06;
  return Math.abs(equipo.latitud! - latitudImportada) < 0.00001 &&
         Math.abs(equipo.longitud! - longitudImportada) < 0.00001;
};

// Registrada significa ingresada manualmente, NO verificada por GPS.
const esUbicacionManual = (equipo: Equipo) =>
  equipo.ubicacion_registrada === true &&
  coordenadasValidas(equipo.latitud, equipo.longitud) &&
  !coordenadasDelImportador(equipo);

const obtenerPosicionEquipo = (equipo: Equipo): [number, number] => {
  if (esUbicacionManual(equipo)) {
    return [equipo.latitud!, equipo.longitud!];
  }
  const zona = zonaReferencial(equipo);
  const hash = hashTexto(equipo.codigo || String(equipo.id));
  // Distribución estable en una cuadrícula pequeña alrededor del punto ilustrativo.
  // No se generan desplazamientos amplios que puedan llevar puntos al océano.
  const latitud = zona.latitud + ((hash % 17) - 8) * 0.00026;
  const longitud = zona.longitud + ((Math.floor(hash / 17) % 17) - 8) * 0.00026;
  return [latitud, longitud];
};

const markerIcon = (encendido: boolean, manual: boolean) => L.divIcon({
  className: 'equipment-marker',
  html: `<span style="display:block;width:18px;height:18px;border:4px solid ${manual ? '#2563eb' : '#f59e0b'};border-radius:999px;background:${encendido ? '#16a34a' : '#64748b'};box-shadow:0 2px 8px rgba(15,23,42,.3)"></span>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const zoneIcon = L.divIcon({
  className: 'coverage-zone-marker',
  html: '<span style="display:block;width:22px;height:22px;border:3px solid white;border-radius:999px;background:#e3000f;box-shadow:0 2px 8px rgba(15,23,42,.35)"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const RecenterMap: React.FC<{ equipo: Equipo | null }> = ({ equipo }) => {
  const map = useMap();
  useEffect(() => {
    if (equipo) map.flyTo(obtenerPosicionEquipo(equipo), 13, { duration: 0.8 });
  }, [equipo, map]);
  return null;
};

const layers = {
  calles: {
    label: 'Calles',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  satelite: {
    label: 'Satélite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
  },
};

const selectorClass = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold';

export const GeolocalizacionPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [seleccionado, setSeleccionado] = useState<Equipo | null>(null);
  const [filtro, setFiltro] = useState(searchParams.get('filtro') || 'TODOS');
  const [tipoMapa, setTipoMapa] = useState<keyof typeof layers>('calles');
  const [clienteFiltro, setClienteFiltro] = useState('TODOS');
  const [categoriaFiltro, setCategoriaFiltro] = useState('TODAS');
  const [subcategoriaFiltro, setSubcategoriaFiltro] = useState('TODAS');
  const [marcaFiltro, setMarcaFiltro] = useState('TODAS');
  const [modeloFiltro, setModeloFiltro] = useState('TODOS');
  const [busquedaCodigo, setBusquedaCodigo] = useState('');
  const [busquedaAvanzada, setBusquedaAvanzada] = useState(false);
  const [editandoGps, setEditandoGps] = useState(false);
  const [gpsForm, setGpsForm] = useState({ latitud: '', longitud: '', encendido_gps: false });
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [errorGps, setErrorGps] = useState('');
  const [nuevaZona, setNuevaZona] = useState({ nombre: '', radio: '3000' });
  const [creandoZona, setCreandoZona] = useState(false);
  const [zonas, setZonas] = useState<ZonaCobertura[]>(() => {
    try {
      const guardadas: unknown = JSON.parse(localStorage.getItem(zoneStorage) || '[]');
      return Array.isArray(guardadas) ? guardadas as ZonaCobertura[] : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    Promise.all([equiposService.getAll(), operacionesService.clientes.listar()])
      .then(([lista, negocios]) => {
        setEquipos(lista);
        setClientes(negocios);
        setErrorGps('');
      })
      .catch(() => setErrorGps('No se pudo consultar la información del mapa.'));
  }, []);

  useEffect(() => {
    localStorage.setItem(zoneStorage, JSON.stringify(zonas));
  }, [zonas]);

  const seleccionarEquipo = (equipo: Equipo) => {
    setSeleccionado(equipo);
    setGpsForm({
      latitud: esUbicacionManual(equipo) ? String(equipo.latitud) : '',
      longitud: esUbicacionManual(equipo) ? String(equipo.longitud) : '',
      encendido_gps: equipo.encendido_gps,
    });
  };

  const categorias = Array.from(new Set(equipos.map((e) => e.categoria || 'Sin categoría'))).sort();
  const subcategorias = Array.from(new Set(equipos
    .filter((e) => categoriaFiltro === 'TODAS' || (e.categoria || 'Sin categoría') === categoriaFiltro)
    .map((e) => e.subcategoria || 'Sin subcategoría'))).sort();
  const marcas = Array.from(new Set(equipos
    .filter((e) => {
      if (categoriaFiltro !== 'TODAS' && (e.categoria || 'Sin categoría') !== categoriaFiltro) return false;
      if (subcategoriaFiltro !== 'TODAS' && (e.subcategoria || 'Sin subcategoría') !== subcategoriaFiltro) return false;
      return true;
    })
    .map((e) => e.marca || 'Sin marca'))).sort();
  const modelos = Array.from(new Set(equipos
    .filter((e) => {
      if (categoriaFiltro !== 'TODAS' && (e.categoria || 'Sin categoría') !== categoriaFiltro) return false;
      if (subcategoriaFiltro !== 'TODAS' && (e.subcategoria || 'Sin subcategoría') !== subcategoriaFiltro) return false;
      if (marcaFiltro !== 'TODAS' && (e.marca || 'Sin marca') !== marcaFiltro) return false;
      return true;
    })
    .map((e) => e.modelo || 'Sin modelo'))).sort();

  const visibles = useMemo(() => equipos.filter((equipo) => {
    if (filtro === 'ENCENDIDOS' && !equipo.encendido_gps) return false;
    if ((filtro === 'ROJO' || filtro === 'AMARILLO') && equipo.color_semaforo !== filtro) return false;
    if (clienteFiltro !== 'TODOS' && String(equipo.cliente_empresa ?? '') !== clienteFiltro) return false;
    if (categoriaFiltro !== 'TODAS' && (equipo.categoria || 'Sin categoría') !== categoriaFiltro) return false;
    if (subcategoriaFiltro !== 'TODAS' && (equipo.subcategoria || 'Sin subcategoría') !== subcategoriaFiltro) return false;
    if (marcaFiltro !== 'TODAS' && (equipo.marca || 'Sin marca') !== marcaFiltro) return false;
    if (modeloFiltro !== 'TODOS' && (equipo.modelo || 'Sin modelo') !== modeloFiltro) return false;
    if (busquedaCodigo.trim()) {
      if (!coincideBusqueda(`${equipo.codigo} ${equipo.nombre}`, busquedaCodigo)) return false;
    }
    return true;
  }), [equipos, filtro, clienteFiltro, categoriaFiltro, subcategoriaFiltro, marcaFiltro, modeloFiltro, busquedaCodigo]);

  const zonaDeEquipo = (equipo: Equipo) => {
    // Una posición simulada no se utiliza para afirmar que hay falta de cobertura.
    if (!esUbicacionManual(equipo)) return undefined;
    return zonas.find((zona) => {
      const latKm = (equipo.latitud! - zona.latitud) * 111;
      const lonKm = (equipo.longitud! - zona.longitud) * 111 * Math.cos((zona.latitud * Math.PI) / 180);
      return Math.sqrt(latKm * latKm + lonKm * lonKm) * 1000 <= zona.radio;
    });
  };

  const agregarZona = (event: React.FormEvent) => {
    event.preventDefault();
    const radio = Number(nuevaZona.radio);
    if (!nuevaZona.nombre.trim() || !Number.isFinite(radio) || radio < 100) return;
    const centro = seleccionado ? obtenerPosicionEquipo(seleccionado) : IQUIQUE;
    setZonas((actuales) => [
      ...actuales,
      {
        id: Date.now(),
        nombre: nuevaZona.nombre.trim(),
        latitud: centro[0],
        longitud: centro[1],
        radio,
      },
    ]);
    setNuevaZona({ nombre: '', radio: '3000' });
    setCreandoZona(false);
  };

  const moverZona = (zonaId: number, position: L.LatLng) => {
    setZonas((actuales) => actuales.map((zona) =>
      zona.id === zonaId ? { ...zona, latitud: position.lat, longitud: position.lng } : zona
    ));
  };

  const guardarUbicacionManual = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!seleccionado) return;
    const latitud = Number(gpsForm.latitud);
    const longitud = Number(gpsForm.longitud);
    if (!gpsForm.latitud.trim() || !gpsForm.longitud.trim() || !coordenadasValidas(latitud, longitud)) {
      setErrorGps('Ingresa una latitud y longitud válidas antes de guardar.');
      return;
    }
    try {
      const actualizado = await equiposService.actualizar(seleccionado.id, {
        latitud,
        longitud,
        encendido_gps: gpsForm.encendido_gps,
      });
      setEquipos((actuales) => actuales.map((e) => e.id === actualizado.id ? actualizado : e));
      seleccionarEquipo(actualizado);
      setEditandoGps(false);
      setErrorGps('');
    } catch {
      setErrorGps('No se pudo guardar la ubicación. Revisa tus permisos y el servidor.');
    }
  };

  return (
    <div className="space-y-6">
      {errorGps && (
        <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {errorGps}
        </div>
      )}

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#e3000f]">
            Modo demostración · posiciones referenciales
          </p>
          <h1 className="mt-1 text-3xl font-black">Geolocalización GPS</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Los equipos sin coordenadas manuales verificadas aparecen en posiciones
            ilustrativas sobre tierra. No se recibe GPS en tiempo real.
            Las zonas dibujadas se guardan solo en este navegador.
          </p>
        </div>
        <div className="relative flex flex-wrap gap-2">
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className={selectorClass}>
            <option value="TODOS">Todos los equipos</option>
            <option value="ENCENDIDOS">GPS marcado como encendido</option>
            <option value="ROJO">Mantenimiento urgente</option>
            <option value="AMARILLO">Próximos a mantenimiento</option>
          </select>
          <select value={clienteFiltro} onChange={(e) => setClienteFiltro(e.target.value)} className={selectorClass}>
            <option value="TODOS">Todos los clientes</option>
            {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nombre}</option>)}
          </select>
          <select value={categoriaFiltro} onChange={(e) => {
            setCategoriaFiltro(e.target.value);
            setSubcategoriaFiltro('TODAS');
            setMarcaFiltro('TODAS');
            setModeloFiltro('TODOS');
          }} className={selectorClass}>
            <option value="TODAS">Todas las categorías</option>
            {categorias.map((categoria) => <option key={categoria}>{categoria}</option>)}
          </select>
          <button
            type="button"
            onClick={() => setBusquedaAvanzada((abierta) => !abierta)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:border-[#e3000f]"
          >
            Búsqueda avanzada
          </button>
          <button
            type="button"
            onClick={() => setTipoMapa((actual) => actual === 'calles' ? 'satelite' : 'calles')}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:border-[#e3000f]"
            title={`Cambiar a ${tipoMapa === 'calles' ? 'Satélite' : 'Calles'}`}
          >
            {tipoMapa === 'calles' ? '🛰 Satélite' : '🗺 Calles'}
          </button>
          {busquedaAvanzada && (
            <div className="absolute right-0 top-full z-[1000] mt-2 w-[min(520px,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-slate-900">Búsqueda avanzada</p>
                  <p className="text-xs text-slate-500">Código, nombre, subcategoría, marca y modelo.</p>
                </div>
                <button type="button" onClick={() => setBusquedaAvanzada(false)} className="rounded-lg px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100">Cerrar</button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="sm:col-span-2 text-xs font-bold text-slate-600">
                  Código o nombre
                  <input value={busquedaCodigo} onChange={(e) => setBusquedaCodigo(e.target.value)} placeholder="Ej: XLS-0001 o excavadora" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                </label>
                {categoriaFiltro !== 'TODAS' && (
                  <label className="text-xs font-bold text-slate-600">
                    Subcategoría
                    <select value={subcategoriaFiltro} onChange={(e) => {
                      setSubcategoriaFiltro(e.target.value);
                      setMarcaFiltro('TODAS');
                      setModeloFiltro('TODOS');
                    }} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                      <option value="TODAS">Todas</option>
                      {subcategorias.map((subcategoria) => <option key={subcategoria}>{subcategoria}</option>)}
                    </select>
                  </label>
                )}
                <label className="text-xs font-bold text-slate-600">
                  Marca
                  <select value={marcaFiltro} onChange={(e) => { setMarcaFiltro(e.target.value); setModeloFiltro('TODOS'); }} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <option value="TODAS">Todas</option>
                    {marcas.map((marca) => <option key={marca}>{marca}</option>)}
                  </select>
                </label>
                {categoriaFiltro !== 'TODAS' && subcategoriaFiltro !== 'TODAS' && (
                  <label className="text-xs font-bold text-slate-600">
                    Modelo
                    <select value={modeloFiltro} onChange={(e) => setModeloFiltro(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                      <option value="TODOS">Todos</option>
                      {modelos.map((modelo) => <option key={modelo}>{modelo}</option>)}
                    </select>
                  </label>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSubcategoriaFiltro('TODAS');
                  setMarcaFiltro('TODAS');
                  setModeloFiltro('TODOS');
                  setBusquedaCodigo('');
                }}
                className="mt-4 w-full rounded-xl border border-slate-200 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"
              >
                Limpiar búsqueda avanzada
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
        <span><span className="mr-1 inline-block h-3 w-3 rounded-full border-2 border-amber-500 bg-slate-500 align-middle" /> Referencial</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded-full border-2 border-blue-600 bg-slate-500 align-middle" /> Coordenada manual (sin verificar)</span>
        <span>Mostrando {visibles.length} de {equipos.length} maquinarias</span>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative isolate h-[520px] min-h-[520px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <MapContainer center={IQUIQUE} zoom={9} scrollWheelZoom={false} className="h-full w-full">
            <TileLayer attribution={layers[tipoMapa].attribution} url={layers[tipoMapa].url} />
            <RecenterMap equipo={seleccionado} />

            {zonas.map((zona) => (
              <React.Fragment key={zona.id}>
                <Circle
                  center={[zona.latitud, zona.longitud]}
                  radius={zona.radio}
                  pathOptions={{ color: '#e3000f', fillColor: '#e3000f', fillOpacity: 0.12 }}
                />
                <Marker
                  position={[zona.latitud, zona.longitud]}
                  icon={zoneIcon}
                  draggable
                  eventHandlers={{ dragend: (event) => moverZona(zona.id, event.target.getLatLng()) }}
                >
                  <Popup>
                    <b>{zona.nombre}</b>
                    <br />Zona dibujada para demostración.
                    <br />Arrastra el marcador para moverla.
                    <br />
                    <button
                      type="button"
                      onClick={() => setZonas((actuales) => actuales.filter((item) => item.id !== zona.id))}
                      className="mt-2 text-red-600"
                    >
                      Eliminar zona
                    </button>
                  </Popup>
                </Marker>
              </React.Fragment>
            ))}

            {visibles.map((equipo) => {
              const manual = esUbicacionManual(equipo);
              const posicion = obtenerPosicionEquipo(equipo);
              const zona = zonaDeEquipo(equipo);
              return (
                <Marker
                  key={equipo.id}
                  position={posicion}
                  icon={markerIcon(equipo.encendido_gps, manual)}
                  eventHandlers={{ click: () => seleccionarEquipo(equipo) }}
                >
                  <Popup>
                    <b>{equipo.codigo}</b>
                    <br />{equipo.nombre}
                    <br />{equipo.estado_alerta || 'Sin alerta'}
                    <br />
                    <span style={{ color: manual ? '#2563eb' : '#b45309', fontWeight: 700 }}>
                      {manual ? 'Coordenadas manuales sin verificar' : 'Posición referencial simulada'}
                    </span>
                    {zona && (
                      <>
                        <br />
                        <span style={{ color: '#e3000f', fontWeight: 700 }}>
                          Dentro de zona dibujada: {zona.nombre}
                        </span>
                      </>
                    )}
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">Zonas sin cobertura</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Dibuja una zona de ejemplo y muévela arrastrando el punto rojo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreandoZona(!creandoZona)}
                className="rounded-lg bg-[#e3000f] px-3 py-2 text-xs font-bold text-white"
              >
                {creandoZona ? 'Cerrar' : '+ Zona'}
              </button>
            </div>

            {creandoZona && (
              <form onSubmit={agregarZona} className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3">
                <input
                  required
                  value={nuevaZona.nombre}
                  onChange={(e) => setNuevaZona({ ...nuevaZona, nombre: e.target.value })}
                  placeholder="Nombre de la zona"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <input
                  required
                  type="number"
                  min="100"
                  value={nuevaZona.radio}
                  onChange={(e) => setNuevaZona({ ...nuevaZona, radio: e.target.value })}
                  placeholder="Radio en metros"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <button className="w-full rounded-lg bg-[#122033] py-2 text-xs font-bold text-white">
                  Crear zona {seleccionado ? 'junto al equipo seleccionado' : 'en Iquique'}
                </button>
              </form>
            )}

            {zonas.length > 0 && (
              <div className="mt-3 space-y-2">
                {zonas.map((zona) => (
                  <div key={zona.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
                    <span className="font-bold">{zona.nombre} · {zona.radio} m</span>
                    <button
                      type="button"
                      onClick={() => setZonas((actuales) => actuales.filter((item) => item.id !== zona.id))}
                      className="font-black text-red-600"
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">Ficha operativa</h2>

            {seleccionado ? (
              <div className="mt-4 space-y-3">
                {seleccionado.foto_url ? (
                  <img
                    src={seleccionado.foto_url}
                    className="h-36 w-full rounded-2xl object-cover"
                    alt={seleccionado.nombre}
                  />
                ) : (
                  <div className="flex h-28 items-center justify-center rounded-2xl bg-slate-100 text-sm text-slate-500">
                    Fotografía del equipo no disponible
                  </div>
                )}

                <div>
                  <p className="text-xs font-bold text-slate-400">{seleccionado.codigo}</p>
                  <p className="text-lg font-black">{seleccionado.nombre}</p>
                  <p className="text-sm text-slate-500">
                    {seleccionado.marca || 'Marca no registrada'} · {seleccionado.modelo || 'Modelo no registrado'}
                  </p>
                </div>

                <div className={`rounded-xl p-3 text-xs font-bold ${
                  esUbicacionManual(seleccionado)
                    ? 'border border-blue-100 bg-blue-50 text-blue-800'
                    : 'border border-amber-100 bg-amber-50 text-amber-800'
                }`}>
                  {esUbicacionManual(seleccionado)
                    ? 'Coordenadas introducidas manualmente; no verificadas por GPS.'
                    : `Ubicación referencial de demostración: ${zonaReferencial(seleccionado).nombre}.`}
                </div>

                {zonaDeEquipo(seleccionado) && (
                  <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-700">
                    Equipo dentro de zona dibujada: {zonaDeEquipo(seleccionado)?.nombre}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <span className="block text-slate-500">Horómetro actual</span>
                    <b className="mt-1 block text-sm">{seleccionado.horometro_actual} {seleccionado.unidad_medida}</b>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-3">
                    <span className="block text-slate-500">Falta para mantención</span>
                    <b className={`mt-1 block text-sm ${
                      seleccionado.horas_restantes <= 0
                        ? 'text-red-700'
                        : seleccionado.horas_restantes <= (seleccionado.unidad_medida === 'KM' ? 1000 : 50)
                          ? 'text-amber-700' : 'text-emerald-700'
                    }`}>
                      {seleccionado.horas_restantes > 0
                        ? `${seleccionado.horas_restantes} ${seleccionado.unidad_medida}`
                        : 'Vencida'}
                    </b>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <span className="block text-slate-500">Meta próxima</span>
                    <b className="mt-1 block text-sm">{seleccionado.meta_proxima_mant} {seleccionado.unidad_medida}</b>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <span className="block text-slate-500">Estado GPS registrado</span>
                    <b className={`mt-1 block text-sm ${seleccionado.encendido_gps ? 'text-emerald-700' : 'text-slate-600'}`}>
                      {seleccionado.encendido_gps ? 'Encendido' : 'Apagado'}
                    </b>
                  </div>
                </div>

                <Link
                  to={`/flotas/${seleccionado.id}`}
                  className="block rounded-xl bg-[#122033] py-2.5 text-center text-sm font-bold text-white"
                >
                  Ver ficha completa
                </Link>
                <button
                  type="button"
                  onClick={() => setEditandoGps(!editandoGps)}
                  className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-bold"
                >
                  {editandoGps ? 'Cerrar edición GPS' : 'Editar ubicación / GPS demo'}
                </button>

                {editandoGps && (
                  <form onSubmit={guardarUbicacionManual} className="space-y-2 rounded-xl bg-slate-50 p-3">
                    <p className="text-xs font-bold text-slate-500">
                      Ingresa coordenadas manuales de prueba. No son datos GPS en vivo.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        required
                        type="number"
                        step="any"
                        min="-90"
                        max="90"
                        value={gpsForm.latitud}
                        onChange={(e) => setGpsForm({ ...gpsForm, latitud: e.target.value })}
                        placeholder="Latitud"
                        className="min-w-0 rounded-lg border border-slate-200 px-2 py-2 text-sm"
                      />
                      <input
                        required
                        type="number"
                        step="any"
                        min="-180"
                        max="180"
                        value={gpsForm.longitud}
                        onChange={(e) => setGpsForm({ ...gpsForm, longitud: e.target.value })}
                        placeholder="Longitud"
                        className="min-w-0 rounded-lg border border-slate-200 px-2 py-2 text-sm"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs font-bold">
                      <input
                        type="checkbox"
                        checked={gpsForm.encendido_gps}
                        onChange={(e) => setGpsForm({ ...gpsForm, encendido_gps: e.target.checked })}
                        className="accent-emerald-600"
                      />
                      GPS marcado como encendido (demostración)
                    </label>
                    <button className="w-full rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white">
                      Guardar ubicación demo
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-700">Selecciona un marcador</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Aquí verás el horómetro, la meta de mantenimiento, el estado GPS registrado
                  y el acceso a la ficha completa.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-white p-3">
                    <span className="block text-slate-500">Equipos visibles</span>
                    <b className="mt-1 block text-lg">{visibles.length}</b>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <span className="block text-slate-500">GPS marcados encendidos</span>
                    <b className="mt-1 block text-lg text-emerald-700">
                      {visibles.filter((equipo) => equipo.encendido_gps).length}
                    </b>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};