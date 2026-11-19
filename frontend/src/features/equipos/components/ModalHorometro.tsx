import React, { useState } from 'react';
import { isAxiosError } from 'axios';
import type { Equipo } from '../types';

interface ModalHorometroProps {
  isOpen: boolean;
  onClose: () => void;
  equipo: Equipo | null;
  onGuardarLectura: (equipoId: number, nuevaLecturaTotal: number, nuevoConsumoMes: number) => Promise<void>;
}

export const ModalHorometro: React.FC<ModalHorometroProps> = ({
                                                                isOpen,
                                                                onClose,
                                                                equipo,
                                                                onGuardarLectura,
                                                              }) => {
  const [nuevaLectura, setNuevaLectura] = useState<string>(
      equipo ? equipo.horometro_actual.toString() : ''
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen || !equipo) return null;

  const lecturaNumerica = Number(nuevaLectura) || 0;
  const diferenciaHoras = lecturaNumerica - equipo.horometro_actual;
  const nuevoConsumoMes = equipo.horas_uso_mes + (diferenciaHoras > 0 ? diferenciaHoras : 0);

  const limite = equipo.limite_contrato_mes;
  const horasRestantes = limite - nuevoConsumoMes;
  const horasExceso = nuevoConsumoMes - limite;
  const hayExceso = nuevoConsumoMes > limite;

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Validación local de inconsistencia (HU03)
    if (lecturaNumerica < equipo.horometro_actual) {
      setError(`Error de inconsistencia: La nueva lectura (${lecturaNumerica}) no puede ser menor a la lectura previa (${equipo.horometro_actual} ${equipo.unidad_medida}).`);
      return;
    }

    if (lecturaNumerica === equipo.horometro_actual) {
      setError('Debes ingresar una lectura mayor a la actual para actualizar el registro.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onGuardarLectura(equipo.id, lecturaNumerica, nuevoConsumoMes);
      onClose();
    } catch (err: unknown) {
      // Validamos de forma segura si el error proviene de nuestra petición Axios
      if (isAxiosError(err)) {
        if (err.response?.data?.horometro_actual) {
          setError(err.response.data.horometro_actual[0]);
        } else {
          setError('Error al conectar con el servidor para actualizar la lectura.');
        }
      } else {
        // Si es un error de código o de red inesperado
        setError('Ocurrió un error inesperado al procesar la solicitud.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl transition-all">
          {/* Cabecera del Modal */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
            <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-bold text-[#e3000f]">
              {equipo.nro_interno}
            </span>
              <h3 className="mt-1 text-lg font-bold text-slate-800">
                Registrar {equipo.unidad_medida === 'HORAS' ? 'Horómetro' : 'Kilometraje'}
              </h3>
              <p className="text-xs text-slate-500">Tipo: {equipo.tipo_equipo}</p>
            </div>
            <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase">
                Lectura Anterior Registrada
              </label>
              <div className="mt-1 rounded-lg bg-slate-100 p-2.5 text-sm font-semibold text-slate-700">
                {equipo.horometro_actual} {equipo.unidad_medida}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase">
                Nueva Lectura Actualizada
              </label>
              <input
                  type="number"
                  step="0.5"
                  value={nuevaLectura}
                  onChange={(e) => {
                    setNuevaLectura(e.target.value);
                    setError(null);
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-base font-bold text-slate-800 focus:border-[#e3000f] focus:outline-none focus:ring-2 focus:ring-[#e3000f]/20"
                  placeholder="Ej: 2150.5"
                  required
              />
            </div>

            {/* Error de Inconsistencia */}
            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 font-medium">
                  ⚠️ {error}
                </div>
            )}

            {/* Cálculo en Vivo */}
            {!error && diferenciaHoras > 0 && (
                <div className={`rounded-xl border p-3.5 transition-all ${
                    hayExceso
                        ? 'border-red-300 bg-red-50 text-red-900'
                        : 'border-emerald-300 bg-emerald-50 text-emerald-900'
                }`}>
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>Consumo proyectado este mes:</span>
                    <span className="text-sm font-bold">{nuevoConsumoMes} / {limite} hrs</span>
                  </div>

                  {hayExceso ? (
                      <div className="mt-2 text-xs font-semibold">
                        🚨 <span className="font-bold">{horasExceso.toFixed(1)} hrs de exceso</span> detectadas. Se generará un cobro adicional en factura.
                      </div>
                  ) : (
                      <div className="mt-2 text-xs font-medium text-emerald-800">
                        ✅ Registro en norma. Quedan <span className="font-bold">{horasRestantes.toFixed(1)} hrs</span> disponibles este mes.
                      </div>
                  )}
                </div>
            )}

            {/* Botones de acción */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-[#e3000f] px-5 py-2 text-sm font-bold text-white shadow-md hover:bg-[#b3000b] transition cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Guardando...' : 'Guardar y Calcular'}
              </button>
            </div>
          </form>
        </div>
      </div>
  );
};