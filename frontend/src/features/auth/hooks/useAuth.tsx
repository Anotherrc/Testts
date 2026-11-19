import { useContext } from 'react';
// IMPORTANTE: Asegúrate de que esta ruta apunte al archivo AuthContext.ts que creamos arriba
import { AuthContext } from '../../../context/AuthContext';

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
    }
    return context;
};