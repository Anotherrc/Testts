import React, { useState } from 'react';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';

export const RegisterForm: React.FC = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.id]: e.target.value });
    };

    const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            alert("Las contraseñas no coinciden");
            return;
        }
        console.log('Register request:', formData);
    };

    return (
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
            {/* 2 columnas para Nombre y Correo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Input
                    id="name"
                    type="text"
                    label="Nombre Completo"
                    placeholder="Ej: Juan Pérez"
                    value={formData.name}
                    onChange={handleChange}
                    required
                />

                <Input
                    id="email"
                    type="email"
                    label="Correo Electrónico"
                    placeholder="ejemplo@vilasmotor.cl"
                    value={formData.email}
                    onChange={handleChange}
                    required
                />
            </div>

            {/* 2 columnas para Contraseñas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Input
                    id="password"
                    type="password"
                    label="Contraseña"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    required
                />

                <Input
                    id="confirmPassword"
                    type="password"
                    label="Confirmar Contraseña"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                />
            </div>

            <div className="pt-2">
                <Button type="submit" fullWidth>
                    Crear Cuenta
                </Button>
            </div>
        </form>
    );
};