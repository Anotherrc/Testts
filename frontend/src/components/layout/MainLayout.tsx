import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

export const MainLayout: React.FC = () => {
    const [menuAbierto, setMenuAbierto] = useState(false);

    return (
        <div className="flex min-h-screen w-full flex-col bg-slate-50">
            <Navbar />

            <div className="flex min-h-0 flex-1">
                {/* Barra lateral fija en pantallas grandes */}
                <div className="sticky top-20 hidden h-[calc(100vh-5rem)] shrink-0 lg:flex">
                    <Sidebar />
                </div>

                <div className="min-w-0 flex-1">
                    <div className="border-b border-slate-200 bg-white px-4 py-2 lg:hidden">
                        <button
                            type="button"
                            onClick={() => setMenuAbierto(true)}
                            aria-label="Abrir menú de navegación"
                            aria-expanded={menuAbierto}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700"
                        >
                            ☰ Menú
                        </button>
                    </div>

                    <main className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 xl:p-7">
                        <Outlet />
                    </main>
                </div>
            </div>

            {menuAbierto && (
                <div role="dialog" aria-modal="true" aria-label="Menú de navegación" className="fixed inset-0 z-50 lg:hidden">
                    <button
                        type="button"
                        aria-label="Cerrar menú de navegación"
                        onClick={() => setMenuAbierto(false)}
                        className="absolute inset-0 w-full bg-slate-950/60"
                    />
                    <div className="relative z-10 flex h-full w-56 max-w-[85vw] flex-col bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-200 p-4">
                            <span className="text-sm font-extrabold text-slate-800">Navegación</span>
                            <button
                                type="button"
                                aria-label="Cerrar menú"
                                onClick={() => setMenuAbierto(false)}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-bold"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto">
                            <Sidebar onNavigate={() => setMenuAbierto(false)} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
