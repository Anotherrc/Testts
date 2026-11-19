import React from 'react';
import { LoginForm } from '../features/auth/components/LoginForm';

export const LoginPage: React.FC = () => {
    return (
        <div className="h-screen w-screen bg-slate-50 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 relative overflow-hidden select-none">

            {/* Luces decorativas de fondo */}
            <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] bg-[#e3000f] rounded-full mix-blend-multiply filter blur-[140px] opacity-10 pointer-events-none"></div>
            <div className="absolute bottom-[-15%] right-[-10%] w-[500px] h-[500px] bg-slate-400 rounded-full mix-blend-multiply filter blur-[140px] opacity-15 pointer-events-none"></div>

            {/* Contenedor central */}
            <div className="w-full max-w-xl z-10 flex flex-col items-center">

                {/* Tarjeta con ancho y altura fijos (h-[560px] y max-h-[85vh] para no tocar bordes) */}
                <div className="w-full h-[560px] max-h-[85vh] bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8 sm:p-10 flex flex-col justify-between">

                    {/* Cabecera: Logo + Títulos */}
                    <div>
                        <a href="/" className="mb-4 flex justify-center">
                            <img
                                src="https://vilasmotor.cl/wp-content/uploads/2026/05/vilasmotor-red-logo-1.png"
                                alt="Vilas Motor Logo"
                                className="h-14 sm:h-16 w-auto object-contain"
                            />
                        </a>

                        <div className="text-center">
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                                Iniciar Sesión
                            </h1>
                            <p className="mt-1.5 text-sm text-gray-500">
                                Ingresa tus credenciales para acceder al sistema de gestión
                            </p>
                        </div>
                    </div>

                    {/* Cuerpo: Formulario centrado verticalmente en el espacio disponible */}
                    <div className="my-auto py-2">
                        <LoginForm />
                    </div>

                    {/* Pie de tarjeta */}
                    <div className="pt-5 border-t border-gray-100 text-center text-sm">
                        <p className="text-gray-500">
                            Acceso exclusivo para personal autorizado.
                            <span className="mt-1 block">Solicita tu cuenta a un administrador.</span>
                        </p>
                    </div>

                </div>
            </div>

            {/* Footer fijo en la parte inferior de la pantalla */}
            <div className="absolute bottom-3 text-center text-xs text-gray-400 z-10">
                © {new Date().getFullYear()} Vilas Motor. Todos los derechos reservados.
            </div>

        </div>
    );
};