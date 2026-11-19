import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline';
    fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
                                                  children,
                                                  variant = 'primary',
                                                  fullWidth = false,
                                                  ...props
                                              }) => {
    const baseStyle = "px-6 py-3 text-base font-bold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 flex justify-center items-center cursor-pointer";

    const variants = {
        primary: "bg-[#e3000f] text-white hover:bg-[#c2000d] focus:ring-[#e3000f] shadow-lg shadow-[#e3000f]/20 hover:shadow-xl hover:shadow-[#e3000f]/30 transform hover:-translate-y-0.5",
        secondary: "bg-gray-800 text-white hover:bg-gray-900 focus:ring-gray-800",
        outline: "border-2 border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 focus:ring-gray-200"
    };

    return (
        <button
            className={`${baseStyle} ${variants[variant]} ${fullWidth ? 'w-full' : ''}`}
            {...props}
        >
            {children}
        </button>
    );
};