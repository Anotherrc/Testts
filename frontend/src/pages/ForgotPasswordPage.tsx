import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/axios';

export const ForgotPasswordPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [cargando, setCargando] = useState(false);
    const [enviado, setEnviado] = useState(false);
    const [error, setError] = useState('');

    const solicitar = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setCargando(true);
        setError('');
        try {
            await apiClient.post('/contrasena/solicitar/', { email });
            setEnviado(true);
        } catch {
            setError('No fue posible procesar la solicitud. Intenta más tarde.');
        } finally {
            setCargando(false);
        }
    };

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
            <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
                <p className="text-xs font-extrabold uppercase tracking-widest text-[#e3000f]">Vilas Motor</p>
                <h1 className="mt-2 text-2xl font-extrabold text-slate-900">Recuperar contraseña</h1>
                {enviado ? (
                    <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
                        Si existe una cuenta activa con ese correo, recibirás instrucciones para recuperar tu contraseña.
                        En desarrollo, revisa la terminal donde se ejecuta Django para obtener el enlace.
                    </p>
                ) : (
                    <form onSubmit={solicitar} className="mt-5 space-y-4">
                        <p className="text-sm text-slate-600">Ingresa el correo de tu cuenta para solicitar un enlace temporal.</p>
                        <label className="block text-sm font-semibold text-slate-700" htmlFor="correo-recuperacion">Correo electrónico</label>
                        <input id="correo-recuperacion" type="email" autoComplete="email" required maxLength={254}
                            value={email} onChange={(event) => setEmail(event.target.value)}
                            className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-[#e3000f]"
                            placeholder="correo@ejemplo.cl" />
                        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                        <button disabled={cargando} className="w-full rounded-xl bg-[#e3000f] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
                            {cargando ? 'Enviando...' : 'Solicitar enlace'}
                        </button>
                    </form>
                )}
                <Link to="/login" className="mt-5 block text-center text-sm font-semibold text-[#e3000f] hover:underline">
                    Volver a iniciar sesión
                </Link>
            </section>
        </main>
    );
};
