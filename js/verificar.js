// verificar.js

// 1. Importamos la conexión de Supabase y el verificador de acceso
import { supabase, verificarAccesoPorRol } from './supabase-config.js';

// Variables globales para la gráfica
let miGrafico = null;

document.addEventListener("DOMContentLoaded", async () => {
    // Proteger la ruta: solo administradores deberían moderar verificaciones
    const usuarioValido = await verificarAccesoPorRol(['Administrador']);
    if (!usuarioValido) return;

    // Inicializaciones
    inicializarGrafico();
    await cargarDatosVerificacion();
});

/**
 * Inicializa la estructura base del gráfico de barras horizontales
 */
function inicializarGrafico() {
    const ctx = document.getElementById('graficoVerificaciones').getContext('2d');
    
    miGrafico = new Chart(ctx, {
        type: 'bar', 
        data: {
            labels: ['Sin Enviar', 'En Curso', 'Completado', 'Rechazado', 'Fraude'],
            datasets: [{
                label: 'Cantidad de Usuarios',
                data: [0, 0, 0, 0, 0], // Se actualizará en tiempo real
                backgroundColor: [
                    '#94a3b8', // Sin Enviar (Slate)
                    '#f59e0b', // En Curso (Amber)
                    '#10b981', // Completado (Emerald)
                    '#ef4444', // Rechazado (Red)
                    '#7f1d1d'  // Fraude (Dark Red)
                ],
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            indexAxis: 'y', // Hace que la barra sea horizontal
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { beginAtZero: true, grid: { display: false } },
                y: { grid: { display: false } }
            }
        }
    });
}

/**
 * Carga de datos real desde Supabase (Eficiente y optimizada)
 */
async function cargarDatosVerificacion() {
    try {
        // --- EFICIENCIA PARA EL GRÁFICO (Conteos rápidos mediante HEAD en Supabase) ---
        // Obtenemos los totales directamente desde la tabla 'perfiles_trabajadores_labur' sin descargar filas completas
        const [cntSinEnviar, cntEnCurso, cntCompletado, cntRechazado, cntFraude] = await Promise.all([
            supabase.from('perfiles_trabajadores_labur').select('*', { count: 'exact', head: true }).eq('estado_verificacion_global', 'Sin Enviar'),
            supabase.from('perfiles_trabajadores_labur').select('*', { count: 'exact', head: true }).eq('estado_verificacion_global', 'En Curso'),
            supabase.from('perfiles_trabajadores_labur').select('*', { count: 'exact', head: true }).eq('estado_verificacion_global', 'Completado'),
            supabase.from('perfiles_trabajadores_labur').select('*', { count: 'exact', head: true }).eq('estado_verificacion_global', 'Rechazado'),
            supabase.from('perfiles_trabajadores_labur').select('*', { count: 'exact', head: true }).eq('estado_verificacion_global', 'Fraude')
        ]);

        const totalSinEnviar = cntSinEnviar.count || 0;
        const totalEnCurso = cntEnCurso.count || 0;
        const totalCompletado = cntCompletado.count || 0;
        const totalRechazado = cntRechazado.count || 0;
        const totalFraude = cntFraude.count || 0;

        // Actualizar Gráfico Dinámico con datos reales de manera inmediata
        miGrafico.data.datasets[0].data = [totalSinEnviar, totalEnCurso, totalCompletado, totalRechazado, totalFraude];
        miGrafico.update();

        // --- CARGAR TRABAJADORES PENDIENTES (En Curso) CON DETALLES DE CERTIFICADOS ---
        // Relacionamos perfiles_trabajadores con usuarios_labur (para nombre/ci) y certificados_trabajador_labur (para el archivo subido)
        const { data: trabajadoresPendientes, error: errTrabajadores } = await supabase
            .from('perfiles_trabajadores_labur')
            .select(`
                id_trabajador,
                estado_verificacion_global,
                usuarios_labur (nombre, apellido, ci_documento),
                certificados_trabajador_labur (id_certificado, tipo_certificado, archivo_url, estado_validacion)
            `)
            .eq('estado_verificacion_global', 'En Curso'); // Cola de revisión

        if (errTrabajadores) throw errTrabajadores;

        // --- CARGAR INCIDENTES DE FRAUDE / ANOMALÍAS ALTAS PARA EL KPI ---
        const { count: totalAnomaliasAltas, error: errIncidentes } = await supabase
            .from('incidentes_moderacion_labur')
            .select('*', { count: 'exact', head: true })
            .eq('prioridad', 'Alta')
            .eq('estado_resolucion', 'En Revision');

        if (errIncidentes) throw errIncidentes;

        // --- CARGAR RESEÑAS CON CALIFICACIÓN BAJA REPORTADAS PARA MODERACIÓN ---
        const { data: reseniasBajas, error: errResenias } = await supabase
            .from('resenias_labur')
            .select(`
                id_resenia,
                id_emisor,
                id_receptor,
                calificacion,
                comentario,
                fecha_resenia,
                emisor_user:usuarios_labur!id_emisor(nombre, apellido),
                receptor_user:usuarios_labur!id_receptor(nombre, apellido)
            `)
            .lte('calificacion', 2.0) // Cargamos reseñas conflictivas (ej. de 1 o 2 estrellas)
            .order('fecha_resenia', { ascending: false });

        if (errResenias) throw errResenias;

        // --- ACTUALIZAR LOS KPIS EN EL PANEL ---
        document.getElementById('kpi-pendientes-verif').innerText = totalEnCurso;
        document.getElementById('badge-verificaciones-lateral').innerText = totalEnCurso;
        document.getElementById('kpi-fraudes-verif').innerText = totalAnomaliasAltas || 0;

        // --- RENDERIZAR EN EL HTML ---
        renderizarTablaVerificaciones(trabajadoresPendientes);
        renderizarModuloResenias(reseniasBajas);

    } catch (error) {
        console.error("Error al sincronizar con Supabase:", error.message);
        alert("Hubo un problema al obtener datos reales de la base de datos.");
    }
}

/**
 * Inyecta filas dinámicas en la cola de validación desde la BD Real
 */
function renderizarTablaVerificaciones(lista) {
    const tbody = document.getElementById('tabla-verificaciones-body');
    tbody.innerHTML = "";

    if (!lista || lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-400 text-sm">No hay perfiles pendientes de verificación en este momento.</td></tr>`;
        return;
    }

    lista.forEach(perfil => {
        const usuario = perfil.usuarios_labur;
        // Obtenemos el último certificado subido si es que existe
        const certificado = perfil.certificados_trabajador_labur?.[0] || { tipo_certificado: "No adjuntado", ci_documento: "N/A" };

        const fila = document.createElement('tr');
        fila.className = "hover:bg-slate-50/80 transition-colors";
        fila.innerHTML = `
            <td class="py-4 px-4">
                <div class="font-semibold text-slate-900 text-sm">${usuario?.nombre || 'Desconocido'} ${usuario?.apellido || ''}</div>
                <div class="text-xs text-slate-400">UID: ${perfil.id_trabajador}</div>
            </td>
            <td class="py-4 text-xs text-slate-600">
                <div class="font-medium text-slate-800">${certificado.tipo_certificado}</div>
                <div>CI: <span class="font-mono bg-slate-100 px-1 rounded">${usuario?.ci_documento || 'S/D'}</span></div>
            </td>
            <td class="py-4">
                ${certificado.archivo_url ? `
                    <a href="${certificado.archivo_url}" target="_blank" class="text-xs text-cyan-600 hover:underline font-semibold flex items-center gap-1">
                        <i class="fa-solid fa-file-pdf"></i> Ver Documento
                    </a>
                ` : '<span class="text-xs text-slate-400">Sin archivo</span>'}
            </td>
            <td class="py-4">
                <span class="text-xxs px-2 py-0.5 rounded-full font-bold border bg-amber-50 text-amber-700 border-amber-200">
                    ${perfil.estado_verificacion_global}
                </span>
            </td>
            <td class="py-4 text-right px-4 space-x-1">
                <button onclick="cambiarEstadoTrabajador(${perfil.id_trabajador}, 'Completado')" class="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold px-2.5 py-1 rounded-xl transition-colors" title="Aprobar Verificación">
                    <i class="fa-solid fa-check"></i>
                </button>
                <button onclick="cambiarEstadoTrabajador(${perfil.id_trabajador}, 'Fraude')" class="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold px-2.5 py-1 rounded-xl transition-colors" title="Marcar como Fraude">
                    <i class="fa-solid fa-ban"></i>
                </button>
            </td>
        `;
        tbody.appendChild(fila);
    });
}

/**
 * Inyecta el control de testimonios y reputación denunciada reales
 */
function renderizarModuloResenias(lista) {
    const contenedor = document.getElementById('contenedor-reseñas');
    contenedor.innerHTML = "";

    if (!lista || lista.length === 0) {
        contenedor.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">No hay reseñas con bajas calificaciones bajo sospecha.</p>`;
        return;
    }

    lista.forEach(res => {
        let estrellasHTML = "";
        for (let i = 1; i <= 5; i++) {
            estrellasHTML += i <= res.calificacion 
                ? `<i class="fa-solid fa-star text-amber-400 text-xxs"></i>`
                : `<i class="fa-regular fa-star text-slate-200 text-xxs"></i>`;
        }

        // Calcular formato de fecha legible rápido
        const fecha = new Date(res.fecha_resenia).toLocaleDateString('es-BO', { day: 'numeric', month: 'short' });

        const tarjeta = document.createElement('div');
        tarjeta.className = "p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5 text-xs relative";
        tarjeta.innerHTML = `
            <div class="flex items-center justify-between">
                <span class="font-bold text-slate-800 truncate max-w-[140px]">${res.emisor_user?.nombre || 'Usuario'}</span>
                <span class="text-xxs text-slate-400">${fecha}</span>
            </div>
            <div class="flex items-center gap-1">
                ${estrellasHTML}
                <span class="text-slate-400 text-xxs pl-1">para ${res.receptor_user?.nombre || 'Trabajador'}</span>
            </div>
            <p class="text-slate-600 italic text-justify bg-white p-2 rounded-lg border border-slate-100 shadow-2xs">
                "${res.comentario}"
            </p>
            <div class="flex items-center justify-end gap-2 pt-1">
                <button onclick="eliminarResenia(${res.id_resenia})" class="text-rose-600 hover:text-rose-800 font-medium text-xxs transition-colors">
                    <i class="fa-solid fa-trash-can mr-1"></i>Eliminar
                </button>
                <button onclick="aprobarResenia(${res.id_resenia})" class="text-emerald-600 hover:text-emerald-800 font-medium text-xxs transition-colors">
                    <i class="fa-solid fa-circle-check mr-1"></i>Mantener
                </button>
            </div>
        `;
        contenedor.appendChild(tarjeta);
    });
}

// =============================================================================
// ACCIONES EN TIEMPO REAL CON SUPABASE (Hacemos las funciones globales usando window)
// =============================================================================

window.cambiarEstadoTrabajador = async function(idTrabajador, nuevoEstado) {
    try {
        const { error } = await supabase
            .from('perfiles_trabajadores_labur')
            .update({ estado_verificacion_global: nuevoEstado, fecha_verificacion: new Date().toISOString() })
            .eq('id_trabajador', idTrabajador);

        if (error) throw error;

        alert(`El estado del trabajador se actualizó con éxito a: ${nuevoEstado}`);
        // Volvemos a refrescar el gráfico y las tablas automáticamente
        await cargarDatosVerificacion();

    } catch (error) {
        console.error("Error al actualizar estado:", error.message);
        alert("No se pudo actualizar el estado de verificación.");
    }
};

window.eliminarResenia = async function(idResenia) {
    if (confirm("¿Estás seguro de que deseas eliminar permanentemente esta reseña de la base de datos?")) {
        try {
            const { error } = await supabase
                .from('resenias_labur')
                .delete()
                .eq('id_resenia', idResenia);

            if (error) throw error;

            alert("Reseña eliminada con éxito.");
            await cargarDatosVerificacion();
        } catch (error) {
            console.error("Error al eliminar reseña:", error.message);
            alert("No se pudo remover la reseña.");
        }
    }
};

window.aprobarResenia = function(idResenia) {
    // Aquí podrías agregar un campo en tu tabla como 'revisado_por_admin: true' si fuera necesario.
    alert(`Reseña #${idResenia} validada por el administrador.`);
};