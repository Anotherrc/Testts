import React, { useState, useRef, useEffect } from 'react';
import { coincideBusqueda, normalizarBusqueda } from '../../utils/textSearch';

interface SearchableSelectProps {
    label: string;
    options: string[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
                                                                      label,
                                                                      options,
                                                                      value,
                                                                      onChange,
                                                                      placeholder = 'Escribir o seleccionar...',
                                                                  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Cierra el menú si el usuario hace clic fuera del componente
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter((opt) =>
        coincideBusqueda(opt, value)
    );

    return (
        <div className="relative w-full" ref={containerRef}>
            <label className="block text-xs font-bold text-slate-600 mb-1">
                {label}
            </label>
            <div className="relative">
                <input
                    type="text"
                    value={value}
                    placeholder={placeholder}
                    onFocus={() => setIsOpen(true)}
                    onChange={(e) => {
                        onChange(e.target.value);
                        setIsOpen(true);
                    }}
                    className="w-full pl-3.5 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#e3000f]/20 focus:border-[#e3000f] focus:bg-white transition-all"
                />

                {/* Botón para limpiar texto rápidamente o flecha indicadora */}
                {value ? (
                    <button
                        type="button"
                        onClick={() => {
                            onChange('');
                            setIsOpen(false);
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#e3000f] text-xs font-bold p-1 cursor-pointer"
                        title="Limpiar"
                    >
                        ✕
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    >
                        <svg
                            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#e3000f]' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Menú Flotante Personalizado */}
            {isOpen && (
                <ul className="absolute z-40 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-200/70 max-h-52 overflow-y-auto py-1.5 text-sm">
                    <li
                        onClick={() => {
                            onChange('');
                            setIsOpen(false);
                        }}
                        className={`px-3.5 py-2 cursor-pointer transition-colors flex items-center justify-between ${
                            value === ''
                                ? 'bg-red-50 text-[#e3000f] font-bold'
                                : 'text-slate-500 hover:bg-slate-50 font-medium'
                        }`}
                    >
                        <span>Mostrar todos</span>
                        {value === '' && <span className="text-xs">✓</span>}
                    </li>

                    {filteredOptions.length === 0 ? (
                        <li className="px-3.5 py-2.5 text-xs text-slate-400 italic text-center">
                            Sin coincidencias para "{value}"
                        </li>
                    ) : (
                        filteredOptions.map((option) => {
                            const isSelected = normalizarBusqueda(value) === normalizarBusqueda(option);
                            return (
                                <li
                                    key={option}
                                    onClick={() => {
                                        onChange(option);
                                        setIsOpen(false);
                                    }}
                                    className={`px-3.5 py-2 cursor-pointer transition-colors flex items-center justify-between ${
                                        isSelected
                                            ? 'bg-red-50 text-[#e3000f] font-bold'
                                            : 'text-slate-700 hover:bg-red-50/50 hover:text-[#e3000f]'
                                    }`}
                                >
                                    <span>{option}</span>
                                    {isSelected && <span className="text-xs font-bold">✓</span>}
                                </li>
                            );
                        })
                    )}
                </ul>
            )}
        </div>
    );
};