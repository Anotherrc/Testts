import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
}

export const Input: React.FC<InputProps> = ({ label, id, ...props }) => {
    return (
        <div className="flex flex-col gap-1.5 w-full">
            <label htmlFor={id} className="text-sm font-semibold text-gray-700 tracking-wide">
                {label}
            </label>
            <input
                id={id}
                className="w-full px-4 py-2.5 bg-gray-50/80 border border-gray-300 rounded-xl text-gray-900 text-sm sm:text-base placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#e3000f]/30 focus:border-[#e3000f] focus:bg-white transition-all duration-200 shadow-sm"
                {...props}
            />
        </div>
    );
};