import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = "https://isqitoojzjbsddedyfxs.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_3iw5wMvKlA5_BgqDxwwf8Q_op-MnUs9";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Función global para verificar acceso mediante el ID guardado en Sesión
 */
export async function verificarAccesoPorRol(rolesPermitidos = []) {
    // Obtenemos el ID numérico que guardaste cuando el usuario inició sesión
    const idUsuarioLocal = localStorage.getItem('id_usuario_labur');

    if (!idUsuarioLocal) {
        window.location.href = "/login.html";
        return null;
    }

    // Buscamos directamente en tu tabla personalizada
    const { data: usuario, errorUser } = await supabase
        .from('usuarios_labur')
        .select('rol, estado')
        .eq('id_usuario', parseInt(idUsuarioLocal))
        .single();

    if (errorUser || !usuario) {
        alert("Error al validar el perfil de usuario.");
        localStorage.removeItem('id_usuario_labur'); // Limpiamos basura
        window.location.href = "/login.html";
        return null;
    }

    if (usuario.estado === 'Suspendido') {
        alert("Tu cuenta se encuentra suspendida. Contacta al administrador.");
        localStorage.removeItem('id_usuario_labur');
        window.location.href = "/login.html";
        return null;
    }

    // Verificar permisos de Rol
    if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(usuario.rol)) {
        alert("No tienes permisos para acceder a esta sección.");
        redirigirPorRol(usuario.rol);
        return null;
    }

    return usuario;
}

export function cerrarSesion() {
    localStorage.removeItem('id_usuario_labur');
    window.location.href = "/login.html";
}

export function redirigirPorRol(rol) {
    switch (rol) {
        case 'Trabajador':
            window.location.href = "/trabajador/dashboard_trabajador.html";
            break;
        case 'Empleador':
            window.location.href = "/empleador/dashboard_empleador.html";
            break;
        case 'Administrador':
            window.location.href = "/administrador/dashboard_admin.html";
            break;
        default:
            window.location.href = "/index.html";
    }
}