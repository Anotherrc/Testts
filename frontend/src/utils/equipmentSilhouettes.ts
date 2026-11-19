import type { Equipo } from '../features/equipos/types';

// Estas ilustraciones representan la FAMILIA de maquinaria, no el modelo exacto
// ni una fotografía verificada del fabricante o de Vilas Motor.
const BASE = '/equipos/siluetas/';

const normalizar = (valor: string) =>
  valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

type EquipoVisual = Pick<Equipo, 'nombre' | 'categoria' | 'subcategoria' | 'modelo'>;

export function getEquipmentSilhouette(equipo: EquipoVisual): string {
  const nombre = normalizar(equipo.nombre ?? '');
  const texto = normalizar([
    equipo.nombre,
    equipo.categoria,
    equipo.subcategoria,
    equipo.modelo,
  ].filter(Boolean).join(' '));

  // Se usa primero el NOMBRE porque en el Excel es la clasificación más clara.
  if (/RETRO\s*EXCAVADORA/.test(texto)) return BASE + 'retroexcavadora.webp';
  if (/GRUA\s*HORQ|HORQULLA|HORQUILLA/.test(texto)) return BASE + 'grua-horquilla.webp';
  if (/MINICARGADOR/.test(texto)) return BASE + 'minicargador.webp';
  if (/CARGADOR\s*FRONTAL/.test(texto)) return BASE + 'cargador-frontal.webp';
  if (/EXCAVADORA/.test(texto)) return BASE + 'excavadora.webp';
  if (/MOTONIVELADORA/.test(texto)) return BASE + 'motoniveladora.webp';
  if (/RODILLO|COMPACTADOR/.test(texto)) return BASE + 'rodillo.webp';
  if (/MANIPULADOR|TELEHANDLER/.test(texto)) return BASE + 'manipulador.webp';
  if (/PLATAFORMA\s*TIJER/.test(texto)) return BASE + 'plataforma-tijera.webp';
  if (/ALZA\s*HOMBRE/.test(texto)) return BASE + 'alza-hombre.webp';
  if (/LUMINARIA|TORRE\s*DE\s*ILUMINACION/.test(texto)) return BASE + 'luminaria.webp';
  if (/COMPRESOR/.test(texto)) return BASE + 'compresor.webp';
  if (/GENERADOR|SOLDADORA/.test(texto)) return BASE + 'generador.webp';
  if (/CAMION\s*PLUMA|\bPLUMA\b/.test(texto)) return BASE + 'camion-pluma.webp';
  if (/CAMION\s*TOLVA/.test(texto)) return BASE + 'camion-tolva.webp';
  if (/CAMIONETA/.test(texto)) return BASE + 'camioneta.webp';

  // Para furgones, buses, tractocamiones y remolques, la silueta genérica
  // evita atribuir una apariencia incorrecta a un modelo sin ilustración.
  if (/FURGON|MINIBUS|TRACTO|CAMA\s*BAJA|REMOLQUE|RAMPLA/.test(nombre)) {
    return BASE + 'equipo-generico.svg';
  }
  if (/CAMION/.test(texto)) return BASE + 'camion-tolva.webp';
  return BASE + 'equipo-generico.svg';
}
