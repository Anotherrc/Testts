import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { apiClient } from '../api/axios';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

export const RegisterPage: React.FC = () => {
    const [nombreCompleto, setNombreCompleto] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    const navigate = useNavigate();

    // Validación de contraseña en tiempo real para feedback visual
    const tieneMinimo12 = password.length >= 12;
    const tieneMayuscula = /[A-Z]/.test(password);
    const tieneMinuscula = /[a-z]/.test(password);
    const tieneNumero = /\d/.test(password);
    const tieneEspecial = /[-!@#$%^&*()_+=[\]{};':"\\|,.<>/?]/.test(password);

    const esContrasenaValida =
        tieneMinimo12 && tieneMayuscula && tieneMinuscula && tieneNumero && tieneEspecial;

    const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);

        if (!esContrasenaValida) {
            setError('La contraseña no cumple con todos los requisitos de seguridad obligatorios.');
            return;
        }

        setIsSubmitting(true);

        try {
            await apiClient.post('/registro/', {
                nombre_completo: nombreCompleto,
                email: email,
                password: password,
            });

            setSuccess(true);
            setTimeout(() => {
                navigate('/admin/usuarios');
            }, 2500);

        } catch (err: unknown) {
            if (isAxiosError(err)) {
                const errorData = err.response?.data;
                if (errorData && typeof errorData === 'object') {
                    const primerMensaje = Object.values(errorData)[0];
                    if (Array.isArray(primerMensaje)) {
                        setError(primerMensaje[0]);
                    } else if (typeof primerMensaje === 'string') {
                        setError(primerMensaje);
                    } else {
                        setError('Error al validar los datos de registro.');
                    }
                } else {
                    setError('Ocurrió un error al intentar registrar la cuenta.');
                }
            } else {
                setError('Error de conexión con el servidor. Intente más tarde.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 select-none">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100">

                {/* Cabecera */}
                <div className="text-center mb-6">
                    <img
                        src="https://vilasmotor.cl/wp-content/uploads/2026/05/vilasmotor-red-logo-1.png"
                        alt="Vilas Motor Logo"
                        className="h-12 mx-auto mb-4 object-contain"
                    />
                    <h1 className="text-2xl font-extrabold text-slate-900">Crear Cuenta</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Sistema de Gestión de Flota y Mantenimiento
                    </p>
                </div>

                {/* Mensaje de Éxito */}
                {success ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
                        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                            ✓
                        </div>
                        <h3 className="text-emerald-800 font-bold mb-1">¡Registro Exitoso!</h3>
                        <p className="text-sm text-emerald-700">
                            El usuario ha sido creado correctamente. Serás redirigido al panel de administración de usuarios.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

                        {/* 1. Nombre Completo */}
                        <Input
                            id="nombreCompleto"
                            type="text"
                            label="Nombre Completo"
                            placeholder="Ej: Juan Carlos Pérez Cruz"
                            value={nombreCompleto}
                            onChange={(e) => setNombreCompleto(e.target.value)}
                            required
                        />

                        {/* 2. Correo Electrónico Personal */}
                        <Input
                            id="email"
                            type="email"
                            label="Correo Electrónico Personal"
                            placeholder="juan.perez@ejemplo.cl"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />

                        {/* 3. Contraseña */}
                        <div>
                            <Input
                                id="password"
                                type="password"
                                label="Contraseña de Seguridad"
                                placeholder="••••••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />

                            {/* Indicador visual de complejidad de contraseña */}
                            {password.length > 0 && (
                                <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                                    <p className="font-bold text-slate-700 mb-1">Requisitos obligatorios de contraseña:</p>

                                    <div className={`flex items-center gap-2 ${tieneMinimo12 ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                                        <span>{tieneMinimo12 ? '✓' : '○'}</span>
                                        <span>Mínimo 12 caracteres ({password.length}/12)</span>
                                    </div>

                                    <div className={`flex items-center gap-2 ${tieneMayuscula ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                                        <span>{tieneMayuscula ? '✓' : '○'}</span>
                                        <span>Al menos una letra mayúscula (A-Z)</span>
                                    </div>

                                    <div className={`flex items-center gap-2 ${tieneMinuscula ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                                        <span>{tieneMinuscula ? '✓' : '○'}</span>
                                        <span>Al menos una letra minúscula (a-z)</span>
                                    </div>

                                    <div className={`flex items-center gap-2 ${tieneNumero ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                                        <span>{tieneNumero ? '✓' : '○'}</span>
                                        <span>Al menos un número (0-9)</span>
                                    </div>

                                    <div className={`flex items-center gap-2 ${tieneEspecial ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                                        <span>{tieneEspecial ? '✓' : '○'}</span>
                                        <span>Al menos un carácter especial (!@#$%^&*...)</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Error General / Backend */}
                        {error && (
                            <div className="p-3 bg-red-50 text-red-700 text-xs font-semibold rounded-lg border border-red-200">
                                ⚠️ {error}
                            </div>
                        )}

                        <div className="pt-2">
                            <Button
                                type="submit"
                                fullWidth
                                disabled={isSubmitting || (password.length > 0 && !esContrasenaValida)}
                            >
                                {isSubmitting ? 'Procesando Registro...' : 'Registrar Cuenta'}
                            </Button>
                        </div>
                    </form>
                )}

                {/* Retorno al Login */}
                {!success && (
                    <p className="mt-6 text-center text-sm font-medium text-slate-600">
                        ¿Deseas regresar al panel?{' '}
                        <Link to="/admin/usuarios" className="text-[#e3000f] hover:text-[#b3000b] hover:underline font-bold transition-colors">
                            Volver a administración
                        </Link>
                    </p>
                )}
            </div>
        </div>
    );
};