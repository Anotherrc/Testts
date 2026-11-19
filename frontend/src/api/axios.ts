import axios from 'axios';

// La URL de tu backend en Django (idealmente esto va en un archivo .env como VITE_API_URL)
const API_URL = (
    import.meta.env.VITE_API_URL ?? '/api'
).replace(/\/+$/, '');

export const apiClient = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor para inyectar el Token de Acceso en cada petición
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Interceptor para manejar tokens expirados (Código 401)
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Si el error es 401 (No autorizado) y no es la ruta de login ni de refresh
        if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url.includes('/login/')) {
            originalRequest._retry = true;
            try {
                const refreshToken = localStorage.getItem('refresh_token');
                if (!refreshToken) throw new Error('No refresh token');

                // Intentar obtener un nuevo access token desde Django
                const { data } = await axios.post(`${API_URL}/login/refresh/`, {
                    refresh: refreshToken,
                });

                localStorage.setItem('access_token', data.access);
                if (data.refresh) localStorage.setItem('refresh_token', data.refresh);

                // Reintentar la petición original con el nuevo token
                originalRequest.headers.Authorization = `Bearer ${data.access}`;
                return apiClient(originalRequest);
            } catch (refreshError) {
                // Si el refresh token también expiró (después de 1 día, según settings.py), cerramos sesión
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                localStorage.removeItem('user_data');
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    }
);