import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiClient } from '../api/axios';

export const ResetPasswordPage: React.FC = () => {
    const { uid, token } = useParams<{ uid: string; token: string }>();
    const [password, setPassword] = useState('');
    const [confirmar, setConfirmar] = useState('');
    const [cargando, setCargando] = useState(false);
    const [completado, setCompletado] = useState(false);
    const [error, setError] = useState('');

    const guardar = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (password !== confirmar) {
            setError('Las contraseñas no coinciden.');
            return;
        }
        if (!uid || !token) {
            setError('El enlace no es válido. Solicita uno nuevo.');
            return;
        }
        setError('');
        setCargando(true);
        try {
            await apiClient.post('/contrasena/restablecer/', {
                uid,
                token,
                password,
                confirm_password: confirmar,
            });
            setCompletado(true);
        } catch (err: unknown) {
            const mensaje = 'No se pudo cambiar la contraseña. Verifica los requisitos o solicita un enlace nuevo.';
            if (err && typeof err === 'object' && 'response' in err) {
                const respuesta = (err as { response?: { data?: { detail?: string; password?: string[] } } }).response;
                setError(respuesta?.data?.password?.join(' ') || respuesta?.data?.detail || mensaje);
            } else {
                setError(mensaje);
            }
        } finally {
            setCargando(false);
        }
    };

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
            <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
                <p className="text-xs font-extrabold uppercase tracking-widest text-[#e3000f]">Vilas Motor</p>
                <h1 className="mt-2 text-2xl font-extrabold text-slate-900">Nueva contraseña</h1>
                {completado ? (
                    <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
                        Contraseña actualizada correctamente. Ya puedes iniciar sesión.
                    </p>
                ) : (
                    <form onSubmit={guardar} className="mt-5 space-y-4">
                        <p className="text-sm text-slate-600">Utiliza una contraseña segura de al menos 12 caracteres.</p>
                        <label htmlFor="nueva-clave" className="block text-sm font-semibold text-slate-700">Nueva contraseña</label>
                        <input id="nueva-clave" type="password" autoComplete="new-password" minLength={12} required
                            value={password} onChange={(event) => setPassword(event.target.value)}
                            className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm focus:border-[#e3000f]" />
                        <label htmlFor="repetir-clave" className="block text-sm font-semibold text-slate-700">Confirmar contraseña</label>
                        <input id="repetir-clave" type="password" autoComplete="new-password" minLength={12} required
                            value={confirmar} onChange={(event) => setConfirmar(event.target.value)}
                            className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm focus:border-[#e3000f]" />
                        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                        <button disabled={cargando} className="w-full rounded-xl bg-[#e3000f] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
                            {cargando ? 'Guardando...' : 'Guardar nueva contraseña'}
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
