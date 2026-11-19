import React, { useEffect, useState } from 'react';
import type { Equipo } from '../types';
import { getEquipmentSilhouette } from '../../../utils/equipmentSilhouettes';
import { apiClient } from '../../../api/axios';

type EquipoImagenProps = {
  equipo: Equipo;
  className?: string;
  alt?: string;
  loading?: 'eager' | 'lazy';
  /** Amplía suavemente las siluetas en la cabecera del detalle, sin recortarlas. */
  portada?: boolean;
};

/** Convierte las rutas de archivos de Django en direcciones accesibles desde Vite. */
function fotoSubida(equipo: Equipo): string {
  const archivo = typeof equipo.foto_archivo === 'string' ? equipo.foto_archivo.trim() : '';
  if (!archivo) return '';
  if (/^https?:\/\//i.test(archivo)) return archivo;

  const origenDjango = new URL(apiClient.defaults.baseURL || '/api', window.location.origin).origin;
  const ruta = archivo.startsWith('/')
    ? archivo
    : `/media/${archivo.replace(/^media\//, '')}`;
  return new URL(ruta, origenDjango).href;
}

/**
 * Muestra la fotografía guardada y, si no existe o falla,
 * utiliza la silueta referencial de la familia de maquinaria.
 * Nunca utiliza fotografías aleatorias de otros rubros.
 */
export const EquipoImagen: React.FC<EquipoImagenProps> = ({
  equipo,
  className = '',
  alt,
  loading = 'lazy',
  portada = false,
}) => {
  const silueta = getEquipmentSilhouette(equipo);
  const foto = fotoSubida(equipo) || equipo.foto_url?.trim() || '';
  const [fotoFallida, setFotoFallida] = useState(false);

  useEffect(() => {
    setFotoFallida(false);
  }, [foto, silueta]);

  const esReferencial = !foto || fotoFallida;
  // Las siluetas WEBP tienen un fondo #FDFDFD y un tono azul/verde oscuro.
  // Convertimos ambos tonos visualmente a blanco puro y negro sin alterar
  // el archivo, para que no aparezca un rectángulo dentro del contenedor.
  // mixBlendMode permite integrar el fondo blanco con el fondo de la portada.
  const estiloReferencial: React.CSSProperties | undefined = esReferencial
    ? {
        filter: 'grayscale(1) contrast(5)',
        mixBlendMode: 'multiply',
        transform: portada ? 'scale(1.1)' : undefined,
      }
    : undefined;

  return (
    <img
      src={esReferencial ? silueta : foto}
      alt={alt ?? (esReferencial
        ? `Silueta referencial de ${equipo.nombre}`
        : `Fotografía de ${equipo.nombre}`)}
      loading={loading}
      className={`${className} block ${esReferencial ? 'object-contain' : 'object-cover'}`}
      style={estiloReferencial}
      onError={() => {
        if (!esReferencial) setFotoFallida(true);
      }}
    />
  );
};
