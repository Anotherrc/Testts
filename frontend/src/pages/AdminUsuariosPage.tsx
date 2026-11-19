import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminService } from '../features/admin/api/adminService';
import type { Permiso, Rol, UsuarioAdmin } from '../features/admin/api/adminService';
import { Button } from '../components/ui/Button';
import { coincideBusqueda } from '../utils/textSearch';
import { useAuth } from '../features/auth/hooks/useAuth';

export const AdminUsuariosPage: React.FC = () => {
    const { hasPermission, user: usuarioActual } = useAuth();
    const permisoAccion = (permiso: Permiso) => permiso.codename.startsWith('add_') ? 'Crear' : permiso.codename.startsWith('change_') ? 'Editar' : permiso.codename.startsWith('delete_') ? 'Eliminar' : 'Consultar';
    const moduloPermiso = (permiso: Permiso) => ({ equipo: 'Maquinarias', historialmantencion: 'Mantenciones', user: 'Usuarios', group: 'Roles', logtelemetriagps: 'GPS' }[permiso.modelo] || '');
    const [roles, setRoles] = useState<Rol[]>([]);
    const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
    const [nuevoRol, setNuevoRol] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [usuarioEditando, setUsuarioEditando] = useState<UsuarioAdmin | null>(null);
    const [datosEdicion, setDatosEdicion] = useState({ first_name: '', last_name: '', email: '' });
    const [permisos, setPermisos] = useState<Permiso[]>([]);
    const [rolEditando, setRolEditando] = useState<Rol | null>(null);
    const [permisosSeleccionados, setPermisosSeleccionados] = useState<number[]>([]);
    const [nombreRol, setNombreRol] = useState('');
    const [filtroUsuario, setFiltroUsuario] = useState('');
    const [filtroRol, setFiltroRol] = useState('TODOS');

    useEffect(() => {
        let activo = true;
        Promise.all([
            adminService.getRoles(),
            adminService.getUsuarios(),
            adminService.getPermisos(),
        ])
            .then(([rolesData, usuariosData, permisosData]) => {
                if (!activo) return;
                setError(null);
                setRoles(rolesData);
                setUsuarios(usuariosData);
                setPermisos(permisosData);
            })
            .catch(() => {
                if (activo) {
                    setError('Error al cargar datos. Verifica que tengas permisos de administrador.');
                }
            })
            .finally(() => {
                if (activo) setLoading(false);
            });
        return () => {
            activo = false;
        };
    }, []);

    const handleCrearRol = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nuevoRol.trim()) return;
        try {
            const rolCreado = await adminService.crearRolConPermisos(nuevoRol, []);
            setRoles([...roles, rolCreado]);
            setNuevoRol('');
        } catch {
            alert('Error al crear el rol.');
        }
    };

    const abrirPermisos = (rol: Rol) => {
        setRolEditando(rol);
        setNombreRol(rol.name);
        setPermisosSeleccionados(rol.permissions?.map((permission) => typeof permission === 'number' ? permission : permission.id) || []);
    };

    const guardarPermisos = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!rolEditando) return;
        try {
            const actualizado = await adminService.actualizarPermisosRol(rolEditando.id, permisosSeleccionados);
            setRoles(roles.map((rol) => (rol.id === actualizado.id ? actualizado : rol)));
            setRolEditando(null);
        } catch {
            alert('Error al actualizar los permisos del rol.');
        }
    };

    const handleEliminarRol = async (id: number) => {
        if (!window.confirm('¿Seguro que deseas eliminar este rol?')) return;
        try {
            await adminService.eliminarRol(id);
            setRoles(roles.filter((r) => r.id !== id));
            const usuariosData = await adminService.getUsuarios();
            setUsuarios(usuariosData);
        } catch {
            alert('Error al eliminar el rol.');
        }
    };

    const handleAsignarRol = async (usuario: UsuarioAdmin, rolId: number) => {
        const nombreRol = roles.find((r) => r.id === rolId)?.name.toUpperCase();
        if (!nombreRol) return;

        const tieneElRol = usuario.roles.includes(nombreRol);

        const idsActuales = roles
            .filter((r) => usuario.roles.includes(r.name.toUpperCase()))
            .map((r) => r.id);

        const nuevosIds = tieneElRol
            ? idsActuales.filter((id) => id !== rolId)
            : [...idsActuales, rolId];

        try {
            const userActualizado = await adminService.actualizarRolesUsuario(usuario.id, nuevosIds);
            setUsuarios(usuarios.map((u) => (u.id === usuario.id ? userActualizado : u)));
        } catch {
            alert('Error al actualizar los roles del usuario.');
        }
    };

    const handleCambiarEstado = async (usuario: UsuarioAdmin) => {
        try {
            const userActualizado = await adminService.cambiarEstadoUsuario(usuario.id, !usuario.is_active);
            setUsuarios(usuarios.map((u) => (u.id === usuario.id ? userActualizado : u)));
        } catch {
            alert('Error al cambiar el estado del usuario.');
        }
    };

    const handleEliminarUsuario = async (usuario: UsuarioAdmin) => {
        if (usuario.is_superuser || usuarioActual?.id === usuario.id) return;
        if (!window.confirm(`¿Eliminar la cuenta de ${usuario.email}? Esta acción no se puede deshacer.`)) return;
        try {
            await adminService.eliminarUsuario(usuario.id);
            setUsuarios((anteriores) => anteriores.filter((item) => item.id !== usuario.id));
        } catch {
            alert('No se pudo eliminar la cuenta. Comprueba los permisos y que no sea superusuario.');
        }
    };

    const abrirEdicion = (usuario: UsuarioAdmin) => {
        setUsuarioEditando(usuario);
        setDatosEdicion({ first_name: usuario.first_name, last_name: usuario.last_name, email: usuario.email });
    };

    const guardarEdicion = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!usuarioEditando) return;
        try {
            const actualizado = await adminService.actualizarUsuario(usuarioEditando.id, datosEdicion);
            setUsuarios(usuarios.map((u) => (u.id === actualizado.id ? actualizado : u)));
            setUsuarioEditando(null);
        } catch {
            alert('Error al editar el usuario.');
        }
    };

    const usuariosFiltrados = usuarios.filter((usuario) => {
        const texto = `${usuario.first_name} ${usuario.last_name} ${usuario.username} ${usuario.email}`;
        return coincideBusqueda(texto, filtroUsuario) && (filtroRol === 'TODOS' || usuario.roles.includes(filtroRol));
    });

    if (loading) return <div className="p-10 text-center font-bold">Cargando panel de control...</div>;
    if (error) return <div className="p-10 text-center text-red-600 font-bold">{error}</div>;

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900">Configuración de Seguridad y RBAC</h1>
                    <p className="text-sm text-slate-500">Gestión de roles y estado de cuentas del sistema.</p>
                </div>
                {hasPermission('auth.add_user') && <Link to="/registro" className="inline-flex items-center justify-center rounded-xl bg-[#e3000f] px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700">
                    + Crear usuario
                </Link>}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* PANEL 1: CRUD DE ROLES */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs lg:col-span-1">
                    <h2 className="text-sm font-extrabold text-slate-800 uppercase mb-4">Roles y permisos</h2>

                    {hasPermission('auth.add_group') && <form onSubmit={handleCrearRol} className="flex gap-2 mb-4">
                        <input
                            type="text"
                            placeholder="Nuevo rol (ej: TECNICO)"
                            value={nuevoRol}
                            onChange={(e) => setNuevoRol(e.target.value)}
                            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm uppercase focus:outline-none focus:border-[#e3000f]"
                        />
                        <Button type="submit" disabled={!nuevoRol.trim()}>Crear</Button>
                    </form>}

                    <ul className="space-y-2">
                        {roles.map((rol) => (
                            <li key={rol.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <div><p className="font-bold text-slate-700">{rol.name.toUpperCase()}</p><p className="text-[11px] text-slate-500">{rol.permissions?.length || 0} permisos otorgados</p></div>
                                    <div className="flex gap-2">{hasPermission('auth.change_group') && (rol.name !== 'ADMIN' || hasPermission('auth.change_group')) && <button onClick={() => abrirPermisos(rol)} className="text-xs font-bold text-slate-700 hover:text-[#e3000f]">Permisos</button>}{hasPermission('auth.delete_group') && rol.name !== 'ADMIN' && <button onClick={() => handleEliminarRol(rol.id)} className="text-xs font-bold text-red-600 hover:underline">Eliminar</button>}</div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* PANEL 2: ASIGNACIÓN A USUARIOS */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs lg:col-span-2 overflow-x-auto">
                    <h2 className="text-sm font-extrabold text-slate-800 uppercase mb-4">Control de Usuarios</h2>
                    <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_180px]"><input value={filtroUsuario} onChange={(event) => setFiltroUsuario(event.target.value)} placeholder="Buscar por nombre, usuario o correo..." className="rounded-xl border border-slate-200 px-3 py-2 text-sm" /><select value={filtroRol} onChange={(event) => setFiltroRol(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="TODOS">Todos los roles</option>{roles.map((rol) => <option key={rol.id} value={rol.name.toUpperCase()}>{rol.name.toUpperCase()}</option>)}</select></div>

                    <table className="w-full text-left border-collapse text-sm min-w-[600px]">
                        <thead>
                        <tr className="border-b border-slate-200 text-slate-500 uppercase">
                            <th className="pb-3 px-2 font-bold">Usuario</th>
                            <th className="pb-3 px-2 font-bold">Estado</th>
                            <th className="pb-3 px-2 font-bold">Roles asignados</th>
                            <th className="pb-3 px-2 font-bold">Acciones</th>
                        </tr>
                        </thead>
                        <tbody>
                        {usuariosFiltrados.map((user) => (
                            <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="py-3 px-2">
                                    <p className="font-bold text-slate-800">{user.first_name} {user.last_name}</p>
                                    <p className="text-xs text-slate-500">{user.email}</p>
                                </td>
                                <td className="py-3 px-2">
                                    <button
                                        onClick={() => handleCambiarEstado(user)}
                                        disabled={!hasPermission('auth.change_user')}
                                        className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                                            user.is_active
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                                : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                                        }`}
                                    >
                                        {user.is_active ? 'ACTIVO' : 'BLOQUEADO'}
                                    </button>
                                </td>
                                <td className="py-3 px-2 flex flex-wrap gap-2">
                                    {roles.map((rol) => {
                                        const nombreRol = rol.name.toUpperCase();
                                        const tieneRol = user.roles.includes(nombreRol);
                                        return (
                                            <button
                                                key={rol.id}
                                                onClick={() => handleAsignarRol(user, rol.id)}
                                                disabled={!hasPermission('auth.change_user') || !hasPermission('auth.change_group')}
                                                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                                    tieneRol
                                                        ? 'bg-slate-800 text-white border-slate-900 hover:bg-red-600 hover:border-red-600'
                                                        : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400 hover:text-slate-600'
                                                }`}
                                                title={tieneRol ? 'Click para remover' : 'Click para asignar'}
                                            >
                                                {nombreRol}
                                            </button>
                                        );
                                    })}
                                </td>
                                <td className="py-3 px-2">
                                    {hasPermission('auth.change_user') && <button onClick={() => abrirEdicion(user)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:border-[#e3000f] hover:text-[#e3000f]">Editar</button>}{hasPermission('auth.delete_user') && !user.is_superuser && usuarioActual?.id !== user.id && <button onClick={() => handleEliminarUsuario(user)} className="ml-2 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:border-red-400">Eliminar</button>}
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
                {usuarioEditando && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
                        <form onSubmit={guardarEdicion} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
                            <div><h2 className="text-xl font-black">Editar usuario</h2><p className="text-sm text-slate-500">Los roles se gestionan directamente desde la tabla.</p></div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <input value={datosEdicion.first_name} onChange={(e) => setDatosEdicion({ ...datosEdicion, first_name: e.target.value })} placeholder="Nombre" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                                <input value={datosEdicion.last_name} onChange={(e) => setDatosEdicion({ ...datosEdicion, last_name: e.target.value })} placeholder="Apellido" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                            </div>
                            <input type="email" value={datosEdicion.email} onChange={(e) => setDatosEdicion({ ...datosEdicion, email: e.target.value })} placeholder="Correo" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                            <div className="flex justify-end gap-2"><button type="button" onClick={() => setUsuarioEditando(null)} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-500">Cancelar</button><button className="rounded-xl bg-[#e3000f] px-4 py-2 text-sm font-bold text-white">Guardar cambios</button></div>
                        </form>
                    </div>
                )}
                {rolEditando && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
                        <form onSubmit={guardarPermisos} className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
                            <div className="mb-5"><h2 className="text-xl font-black">Permisos del rol {nombreRol}</h2><p className="text-sm text-slate-500">Define si puede crear, editar, eliminar o consultar cada módulo.</p></div>
                            <div className="space-y-4">
                                {['Usuarios', 'Maquinarias', 'Mantenciones', 'Clientes', 'Arriendos', 'Insumos', 'GPS', 'Roles'].map((modulo) => {
                                    const opciones = permisos.filter((permiso) => moduloPermiso(permiso) === modulo && (modulo !== 'GPS' || permiso.codename.startsWith('view_')));
                                    if (!opciones.length) return null;
                                    return <div key={modulo} className="rounded-2xl border border-slate-200 p-4"><p className="mb-3 text-sm font-black text-slate-800">{modulo}</p>{modulo === 'GPS' && <p className="mb-2 text-xs text-slate-500">La API de telemetría solo permite consultar.</p>}<div className="grid gap-2 sm:grid-cols-4">{opciones.filter((permiso) => ['Crear', 'Editar', 'Eliminar', 'Consultar'].includes(permisoAccion(permiso))).map((permiso) => <label key={permiso.id} className="flex cursor-pointer items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 hover:bg-red-50"><input type="checkbox" checked={permisosSeleccionados.includes(permiso.id)} onChange={(event) => setPermisosSeleccionados((actuales) => event.target.checked ? [...actuales, permiso.id] : actuales.filter((id) => id !== permiso.id))} className="accent-[#e3000f]" /><span className="text-xs font-bold text-slate-700">{permisoAccion(permiso)}</span></label>)}</div></div>;
                                })}
                            </div>
                            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setRolEditando(null)} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-500">Cancelar</button><button className="rounded-xl bg-[#e3000f] px-4 py-2 text-sm font-bold text-white">Guardar permisos</button></div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};