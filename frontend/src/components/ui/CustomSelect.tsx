import React, { useState, useRef, useEffect } from 'react';

export interface SelectOption {
    value: string;
    label: string;
}

interface CustomSelectProps {
    label: string;
    options: SelectOption[];
    value: string;
    onChange: (value: string) => void;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
                                                              label,
                                                              options,
                                                              value,
                                                              onChange,
                                                          }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find((opt) => opt.value === value) || options[0];

    return (
        <div className="relative w-full select-none" ref={containerRef}>
            <label className="block text-xs font-bold text-slate-600 mb-1">
                {label}
            </label>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full px-3.5 py-2 bg-slate-50 border rounded-xl text-sm text-left flex items-center justify-between transition-all cursor-pointer ${
                    isOpen
                        ? 'border-[#e3000f] ring-2 ring-[#e3000f]/20 bg-white'
                        : 'border-slate-200 hover:border-slate-300'
                }`}
            >
        <span className="truncate font-medium text-slate-800">
          {selectedOption?.label}
        </span>
                <svg
                    className={`w-4 h-4 text-slate-400 shrink-0 ml-2 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-[#e3000f]' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <ul className="absolute z-40 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-200/70 py-1.5 text-sm overflow-hidden">
                    {options.map((option) => {
                        const isSelected = option.value === value;
                        return (
                            <li
                                key={option.value}
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                                className={`px-3.5 py-2 cursor-pointer transition-colors flex items-center justify-between ${
                                    isSelected
                                        ? 'bg-red-50 text-[#e3000f] font-bold'
                                        : 'text-slate-700 hover:bg-slate-50 hover:text-[#e3000f]'
                                }`}
                            >
                                <span className="truncate">{option.label}</span>
                                {isSelected && <span className="text-xs font-bold ml-2">✓</span>}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};