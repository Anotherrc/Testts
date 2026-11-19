
import React from 'react';
import type { Equipo } from '../types';
import { getEquipmentSilhouette } from '../../../utils/equipmentSilhouettes';

interface EquipoCardProps {
    equipo: Equipo;
    onActualizarHorometro?: (equipo: Equipo) => void;
    onDarDeBaja?: (equipo: Equipo) => void;
    onVerDetalle?: (equipo: Equipo) => void;
}

export const EquipoCard: React.FC<EquipoCardProps> = ({
    equipo,
    onActualizarHorometro,
    onDarDeBaja,
    onVerDetalle,
}) => {
    const estadoVisual = equipo.estado === 'Mantenimiento' || equipo.color_semaforo === 'ROJO'
        ? { label: 'Urgente', className: 'bg-red-100 text-red-700 border-red-200' }
        : equipo.color_semaforo === 'AMARILLO'
            ? { label: 'Próximo', className: 'bg-amber-100 text-amber-700 border-amber-200' }
            : { label: 'Operativo', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' };

    const silueta = getEquipmentSilhouette(equipo);
    const fotoGuardada = equipo.foto_url?.trim() || '';

    return (
        <div
            onClick={() => onVerDetalle?.(equipo)}
            className="cursor-pointer space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
        >
            {/* Recuadro blanco con silueta negra centrada */}
            <div className="flex h-32 items-center justify-center overflow-hidden rounded-xl bg-white">
                <img
                    src={fotoGuardada || silueta}
                    alt={fotoGuardada
                        ? `Fotografía de ${equipo.nombre}`
                        : `Silueta referencial de ${equipo.nombre}`}
                    className={fotoGuardada
                        ? 'h-full w-full object-cover'
                        : 'h-full w-full object-contain'}
                    style={fotoGuardada
                        ? undefined
                        : { filter: 'grayscale(1) contrast(3)' }}
                    loading="lazy"
                    onError={(event) => {
                        // Si una foto falla, mostrar la silueta.
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = silueta;
                        event.currentTarget.className = 'h-full w-full object-contain';
                        event.currentTarget.style.filter = 'grayscale(1) contrast(3)';
                    }}
                />
            </div>

            {/* Nombre y código */}
            <div className="flex items-start justify-between gap-3">
                <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        {equipo.codigo}
                    </span>
                    <h3 className="mt-0.5 text-base font-extrabold text-slate-900">
                        {equipo.nombre}
                    </h3>
                </div>

                {/* Estado de mantenimiento */}
                <span className={`rounded-full border px-2.5 py-1 text-xs font-extrabold uppercase ${estadoVisual.className}`}>
                    {estadoVisual.label}
                </span>
            </div>

            {/* Información del horómetro */}
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
                <div>
                    <span className="block font-medium text-slate-500">
                        Horómetro Actual
                    </span>
                    <span className="text-sm font-black text-slate-800">
                        {equipo.horometro_actual} {equipo.unidad_medida || 'hrs'}
                    </span>
                </div>
                <div>
                    <span className="block font-medium text-slate-500">
                        Uso Mes Actual
                    </span>
                    <span className="text-sm font-black text-slate-800">
                        {equipo.horas_uso_mes} / {equipo.limite_contrato_mes} hrs
                    </span>
                </div>
            </div>

            {/* Botones de acciones */}
            <div className="grid grid-cols-2 gap-2">
                {onActualizarHorometro && (
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            onActualizarHorometro(equipo);
                        }}
                        className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-800"
                    >
                        Actualizar lectura
                    </button>
                )}

                {onDarDeBaja && equipo.estado !== 'Deshabilitada' && (
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            onDarDeBaja(equipo);
                        }}
                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition-colors hover:bg-red-100"
                    >
                        Dar de baja
                    </button>
                )}
            </div>
        </div>
    );
};
