import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../hooks/useAuth';

export const LoginForm: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            // Pasamos credenciales reales al AuthProvider
            // Usamos 'username' porque es el campo por defecto que espera Django REST Framework
            await login({ username: email, password: password });
            navigate('/dashboard');
        } catch (err: unknown) {
            if (isAxiosError(err) && err.response?.status === 401) {
                setError('Correo o contraseña incorrectos.');
            } else {
                setError('Error al conectar con el servidor. Intente más tarde.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
            <Input
                id="email"
                type="email"
                label="Correo Electrónico"
                placeholder="ejemplo@vilasmotor.cl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
            />

            <Input
                id="password"
                type="password"
                label="Contraseña"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
            />

            {/* Alerta de error real del backend */}
            {error && (
                <div className="p-3 bg-red-50 text-red-700 text-sm font-semibold rounded-lg border border-red-200">
                    {error}
                </div>
            )}

            <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-600 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 text-[#e3000f] focus:ring-[#e3000f] cursor-pointer accent-[#e3000f]"
                    />
                    Recordarme
                </label>
                <Link to="/recuperar-contrasena" className="text-sm font-semibold text-[#e3000f] hover:text-[#b3000b] hover:underline transition-colors">
                    ¿Olvidaste tu contraseña?
                </Link>
            </div>

            <div className="pt-1">
                <Button type="submit" fullWidth disabled={isSubmitting}>
                    {isSubmitting ? 'Verificando...' : 'Iniciar Sesión'}
                </Button>
            </div>
        </form>
    );
};