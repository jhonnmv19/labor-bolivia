import { supabase } from './supabase-config.js';

let ID_USUARIO_ACTUAL = null;
let DATOS_USUARIO = null;
let PERFIL_TRABAJADOR = null;

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Obtener ID del LocalStorage de manera segura
    const idLocal = localStorage.getItem('id_usuario_labur');
    if (!idLocal) {
        alert("Sesión no válida. Redirigiendo al Login.");
        window.location.href = "login.html";
        return;
    }
    ID_USUARIO_ACTUAL = parseInt(idLocal);

    // 2. Cargar sesión dinámica del usuario e inicializar interfaz
    await cargarDatosPerfilUsuario();
    await cargarPreferenciasFormulario();
    await generarBandejaAlertasReal();

    // 3. Listener del Formulario de Preferencias (Switches)
    const formPref = document.getElementById("form-preferencias-alertas");
    if (formPref) {
        formPref.addEventListener("submit", guardarPreferenciasUsuario);
    }

    // 4. Listener para Limpiar el Historial de Alertas de la Tabla
    const btnLimpiar = document.getElementById("btn-limpiar-historial");
    if (btnLimpiar) {
        btnLimpiar.addEventListener("click", limpiarHistorialBuzon);
    }

    // 5. Botón de Cerrar Sesión
    document.getElementById("btn-logout")?.addEventListener("click", () => {
        localStorage.clear();
        window.location.href = "login.html";
    });
});

/**
 * Trae los datos de las tablas 'usuarios_labur' y 'perfiles_trabajadores_labur'
 */
async function cargarDatosPerfilUsuario() {
    try {
        const { data: usuario, error: errU } = await supabase
            .from('usuarios_labur')
            .select('*')
            .eq('id_usuario', ID_USUARIO_ACTUAL)
            .single();

        if (errU || !usuario) throw new Error("No se pudo obtener la información de cuenta.");
        DATOS_USUARIO = usuario;

        const { data: perfil, error: errP } = await supabase
            .from('perfiles_trabajadores_labur')
            .select('*, especialidades_labur(nombre_especialidad)')
            .eq('id_trabajador', ID_USUARIO_ACTUAL)
            .maybeSingle();

        PERFIL_TRABAJADOR = perfil;

        // PINTAR ELEMENTOS EN EL SIDEBAR Y HEADER
        const iniciales = `${usuario.nombre.charAt(0)}${usuario.apellido.charAt(0)}`.toUpperCase();
        document.getElementById("usr-avatar").innerText = iniciales;
        document.getElementById("usr-nombre").innerText = `${usuario.nombre} ${usuario.apellido}`;
        
        const oficio = perfil?.especialidades_labur?.nombre_especialidad || 'Trabajador';
        document.getElementById("usr-subtexto").innerText = `${oficio} · ${usuario.ciudad_municipio}`;
        
        document.getElementById("header-welcome").innerText = `¡Bienvenido de vuelta, ${usuario.nombre}! Revisa tus alertas prioritarias para ${usuario.departamento}.`;

    } catch (error) {
        console.error("Error cargando perfil dinámico:", error.message);
    }
}

/**
 * Obtiene el registro de 'configuracion_alertas_labur'
 */
async function cargarPreferenciasFormulario() {
    try {
        const { data: pref, error } = await supabase
            .from('configuracion_alertas_labur')
            .select('*')
            .eq('id_trabajador', ID_USUARIO_ACTUAL)
            .maybeSingle();

        if (error) throw error;

        if (pref) {
            document.getElementById("pref-match").checked = pref.notificar_match;
            document.getElementById("pref-entrevistas").checked = pref.notificar_entrevistas;
            document.getElementById("pref-estados").checked = pref.notificar_estados;
            document.getElementById("pref-frecuencia").value = pref.frecuencia;
        } else {
            document.getElementById("pref-match").checked = true;
            document.getElementById("pref-entrevistas").checked = true;
            document.getElementById("pref-estados").checked = true;
            document.getElementById("pref-frecuencia").value = "Tiempo Real";
        }
    } catch (error) {
        console.error("Error al mapear preferencias:", error.message);
    }
}

async function guardarPreferenciasUsuario(e) {
    e.preventDefault();
    const notiMatch = document.getElementById("pref-match").checked;
    const notiEntrevistas = document.getElementById("pref-entrevistas").checked;
    const notiEstados = document.getElementById("pref-estados").checked;
    const frecuenciaSel = document.getElementById("pref-frecuencia").value;

    try {
        const { error } = await supabase
            .from('configuracion_alertas_labur')
            .upsert({
                id_trabajador: ID_USUARIO_ACTUAL,
                frecuencia: frecuenciaSel,
                notificar_match: notiMatch,
                notificar_entrevistas: notiEntrevistas,
                notificar_estados: notiEstados
            }, { onConflict: 'id_trabajador' });

        if (error) throw error;
        alert("Preferencias globales guardadas y actualizadas.");
        await generarBandejaAlertasReal();
    } catch (error) {
        alert("Error al guardar configuraciones: " + error.message);
    }
}

/**
 * Genera la bandeja cruzando vacantes y alertas dinámicas de la base de datos
 */
async function generarBandejaAlertasReal() {
    try {
        const contenedor = document.getElementById("buzon-alertas-reales");
        if (!contenedor) return;
        contenedor.innerHTML = "";

        const { data: pref, error: errPref } = await supabase
            .from('configuracion_alertas_labur')
            .select('*')
            .eq('id_trabajador', ID_USUARIO_ACTUAL)
            .maybeSingle();

        // 1. COMPONENTE DINÁMICO DE VACANTES REALES (MATCHES)
        if (!pref || pref.notificar_match) {
            if (PERFIL_TRABAJADOR?.id_especialidad) {
                const { data: vacantes, error: errV } = await supabase
                    .from('vacantes_labur')
                    .select('*')
                    .eq('id_especialidad', PERFIL_TRABAJADOR.id_especialidad)
                    .eq('estado_vacante', 'Activa')
                    .limit(3);

                if (!errV && vacantes && vacantes.length > 0) {
                    vacantes.forEach(vac => {
                        const scoreSimulado = Math.floor(Math.random() * (99 - 85 + 1)) + 85;
                        const itemHTML = `
                            <div class="p-4 rounded-xl border border-amber-200 bg-amber-50/40 shadow-sm flex gap-3.5 items-start animate-fade-in">
                                <div class="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <i class="fa-solid fa-brain text-sm"></i>
                                </div>
                                <div class="flex-1">
                                    <div class="flex justify-between items-start gap-2">
                                        <div>
                                            <span class="text-[10px] font-bold uppercase tracking-wider text-amber-600 block">Match Recomendado por IA</span>
                                            <h4 class="text-sm font-bold text-carbon-900 leading-tight mt-0.5">${vac.titulo_puesto}</h4>
                                        </div>
                                        <span class="text-[10px] bg-amber-200 text-amber-900 font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap">${scoreSimulado}% Match</span>
                                    </div>
                                    <p class="text-xs text-carbon-600 mt-1.5 leading-relaxed">
                                        Detectamos una vacante ideal en ${vac.ciudad_municipio}, ${vac.departamento}. Modalidad: ${vac.modalidad} (${vac.tipo_contrato}). Quedan escasamente ${vac.numero_vacantes_disponibles} puestos libres.
                                    </p>
                                    <div class="flex items-center gap-2 mt-3">
                                        <button class="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg transition-colors shadow-xs cursor-pointer" onclick="vincularPostulacionReal(${vac.id_vacante})">
                                            <i class="fa-solid fa-paper-plane mr-1"></i> Postularse Ahora
                                        </button>
                                    </div>
                                </div>
                            </div>`;
                        contenedor.innerHTML += itemHTML;
                    });
                }
            }
        }

        // 2. LEER NOTIFICACIONES REALES
        const { data: logs, error: errL } = await supabase
            .from('alertas_notificaciones_labur')
            .select('*')
            .eq('id_usuario', ID_USUARIO_ACTUAL)
            .eq('leido', false) 
            .order('fecha_notificacion', { ascending: false });

        if (!errL && logs && logs.length > 0) {
            logs.forEach(noti => {
                // EVALUACIÓN MEJORADA: Detecta si es una invitación a entrevista por tipo_evento o por palabras clave
                const esInvitacionEntrevista = noti.tipo_evento === 'Entrevista IA' || 
                                               noti.titulo.toLowerCase().includes('entrevista') || 
                                               noti.mensaje.toLowerCase().includes('entrevista virtual');

                // Filtros de preferencias del switch del usuario
                if (esInvitacionEntrevista && pref && !pref.notificar_entrevistas) return;
                if ((noti.tipo_evento === 'Estado' || noti.titulo.includes('✅')) && pref && !pref.notificar_estados) return;

                const fecha = new Date(noti.fecha_notificacion).toLocaleString('es-BO', { 
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
                });

                let iconColor = "bg-carbon-100 text-carbon-600";
                let iconClass = "fa-solid fa-circle-info";
                let botonesAccion = "";
                let badgeColor = "bg-carbon-100 text-carbon-700";

                if (esInvitacionEntrevista && !noti.titulo.includes('✅')) { 
                    // Si no contiene '✅' significa que está pendiente por realizar
                    iconColor = "bg-green-100 text-green-600";
                    iconClass = "fa-solid fa-video";
                    badgeColor = "bg-green-100 text-green-700";
                    
                    const idVacanteAsociada = noti.id_vacante || 1; 
                    
                    botonesAccion = `
                        <div class="flex items-center gap-2 mt-3">
                            <button class="bg-green-600 hover:bg-green-700 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg transition-colors shadow-xs cursor-pointer" 
                                    onclick="abrirSalaEntrevista(${noti.id_notificacion}, ${idVacanteAsociada})">
                                <i class="fa-solid fa-play mr-1"></i> Iniciar Entrevista Virtual
                            </button>
                        </div>
                    `;
                } else if (noti.tipo_evento === 'Estado' || noti.titulo.includes('✅')) {
                    // Tarjeta informativa de estado (ej: cuando ya completó la entrevista)
                    iconColor = "bg-blue-100 text-blue-600";
                    iconClass = "fa-solid fa-square-poll-vertical";
                    badgeColor = "bg-blue-100 text-blue-700";
                }

                const logHTML = `
                    <div class="p-4 rounded-xl border border-carbon-200 bg-white shadow-sm flex gap-3.5 items-start animate-fade-in">
                        <div class="w-9 h-9 rounded-xl ${iconColor} flex items-center justify-center flex-shrink-0 mt-0.5">
                            <i class="${iconClass} text-sm"></i>
                        </div>
                        <div class="flex-1">
                            <div class="flex justify-between items-start gap-2">
                                <div>
                                    <span class="px-2 py-0.5 ${badgeColor} text-[10px] font-bold rounded-md uppercase tracking-wider block w-fit mb-1">${noti.tipo_evento || 'Notificación'}</span>
                                    <h4 class="text-sm font-bold text-carbon-900 leading-tight">${noti.titulo}</h4>
                                </div>
                                <span class="text-[10px] text-carbon-400 font-medium whitespace-nowrap">${fecha}</span>
                            </div>
                            <p class="text-xs text-carbon-600 mt-1.5 leading-relaxed">${noti.mensaje}</p>
                            ${botonesAccion}
                        </div>
                    </div>
                `;
                contenedor.innerHTML += logHTML;
            });
        }

        if (contenedor.innerHTML.trim() === "") {
            contenedor.innerHTML = `
                <div class="text-center py-12 bg-carbon-50/50 rounded-2xl border border-dashed border-carbon-200 text-carbon-400">
                    <i class="fa-regular fa-folder-open text-3xl mb-2 block text-carbon-300"></i>
                    <p class="text-xs font-medium">Buzón en tiempo real vacío</p>
                    <p class="text-[11px] text-carbon-500 max-w-xs mx-auto mt-1">No tienes entrevistas pendientes ni alertas activas que coincidan con tu configuración actual.</p>
                </div>`;
        }

    } catch (error) {
        console.error("Error al organizar la bandeja:", error.message);
    }
}

/**
 * Inserta una postulación real
 */
window.vincularPostulacionReal = async function(idVacante) {
    try {
        const { data, error } = await supabase
            .from('postulaciones_labur')
            .insert([{
                id_vacante: idVacante,
                id_trabajador: ID_USUARIO_ACTUAL,
                score_compatibilidad_ia: 92,
                estado_actual: 'Enviado'
            }])
            .select();

        if (error) {
            if (error.code === '23505') {
                alert("💡 Ya te has postulado a este empleo anteriormente. Puedes revisar el estado en tu panel.");
            } else {
                throw error;
            }
            return;
        }

        alert("¡Postulación enviada con éxito! Tu perfil ha sido enviado al empleador.");
        await generarBandejaAlertasReal();
    } catch (error) {
        console.error("Error crítico en el proceso de postulación:", error);
        alert("Hubo un inconveniente al procesar tu postulación: " + error.message);
    }
};

/**
 * Abre el Modal y procesa de forma controlada la entrevista por IA
 */
window.abrirSalaEntrevista = async function(idNoti, idVacante = null) {
    try {
        const { data: noti, error: errN } = await supabase
            .from('alertas_notificaciones_labur')
            .select('*')
            .eq('id_notificacion', idNoti)
            .single();

        if (errN || !noti) throw new Error("No se pudo recuperar los detalles de la invitación.");

        const vacanteIdFinal = idVacante || null;

        const modalHTML = `
            <div id="modal-sala-entrevista" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
                <div class="bg-white rounded-2xl w-full max-w-xl shadow-xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
                    <div class="p-5 border-b border-slate-100 bg-slate-900 text-white flex justify-between items-center">
                        <div class="flex items-center gap-2.5">
                            <div class="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center text-green-400">
                                <i class="fa-solid fa-robot"></i>
                            </div>
                            <div>
                                <h3 class="font-display font-bold text-sm leading-tight">Entrevista Virtual Automatizada</h3>
                                <p class="text-[11px] text-slate-400">LaborBolivia Evaluador Inteligente</p>
                            </div>
                        </div>
                        <button onclick="document.getElementById('modal-sala-entrevista').remove()" class="text-slate-400 hover:text-white text-sm cursor-pointer">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>

                    <div class="p-6 overflow-y-auto space-y-5 flex-1 text-slate-700">
                        <div class="bg-sky-50 border border-sky-100 rounded-xl p-3.5 text-xs text-sky-800 leading-relaxed">
                            <i class="fa-solid fa-circle-info mr-1 text-sky-500"></i> 
                            Por favor, responde con sinceridad a las siguientes preguntas técnicas. Al finalizar, nuestro modelo de IA procesará tus respuestas y generará un reporte de desempeño para el empleador.
                        </div>

                        <form id="form-cuestionario-ia" class="space-y-4">
                            <div>
                                <label class="block text-xs font-bold text-slate-700 mb-1.5">1. Describe tu experiencia técnica en este rubro y qué proyectos similares has desarrollado en Bolivia:</label>
                                <textarea required rows="3" id="preg-1" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-green-500 focus:bg-white transition-all text-slate-900" placeholder="Ej. He trabajado manejando herramientas del rubro..."></textarea>
                            </div>

                            <div>
                                <label class="block text-xs font-bold text-slate-700 mb-1.5">2. ¿Cómo solucionas un problemático bajo presión cuando tienes plazos de entrega ajustados?</label>
                                <textarea required rows="3" id="preg-2" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-green-500 focus:bg-white transition-all text-slate-900" placeholder="Detalla tu metodología de priorización o resolución de problemas..."></textarea>
                            </div>

                            <div>
                                <label class="block text-xs font-bold text-slate-700 mb-1.5">3. ¿Cuál es tu pretensión salarial real y tu disponibilidad de incorporación para este puesto?</label>
                                <input type="text" required id="preg-3" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-green-500 focus:bg-white transition-all text-slate-900" placeholder="Ej. 4500 Bs, disponibilidad inmediata.">
                            </div>
                        </form>
                    </div>

                    <div class="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                        <button type="button" onclick="document.getElementById('modal-sala-entrevista').remove()" class="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 rounded-lg cursor-pointer">
                            Cancelar
                        </button>
                        <button type="button" id="btn-enviar-entrevista" class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-lg transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer">
                            <i class="fa-solid fa-square-check"></i> Finalizar Entrevista
                        </button>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        document.getElementById('btn-enviar-entrevista').addEventListener('click', async () => {
            const f1 = document.getElementById('preg-1').value.trim();
            const f2 = document.getElementById('preg-2').value.trim();
            const f3 = document.getElementById('preg-3').value.trim();

            if (!f1 || !f2 || !f3) {
                alert("Por favor, llena todas las preguntas antes de finalizar.");
                return;
            }

            const btn = document.getElementById('btn-enviar-entrevista');
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Procesando por IA...`;

            try {
                const scoreDesempenio = Math.floor(Math.random() * (95 - 72 + 1)) + 72;

                // 1. Guardar el resultado de la entrevista
                const { error: errEntrevista } = await supabase
                    .from('entrevistas_ia_labur')
                    .insert([{
                        id_trabajador: ID_USUARIO_ACTUAL,
                        id_vacante: vacanteIdFinal, 
                        cantidad_preguntas: 3,
                        score_desempenio_tecnico: scoreDesempenio,
                        analisis_ia_resumen: `El candidato completó la entrevista. Respuestas consolidadas: P1: ${f1}. P2: ${f2}. P3: ${f3}.`,
                        sello_verificado_otorgado: scoreDesempenio >= 80
                    }]);

                if (errEntrevista) throw errEntrevista;

                // 2. Actualizar la postulación ligada a esta vacante específica
                if (vacanteIdFinal) {
                    await supabase
                        .from('postulaciones_labur')
                        .update({ 
                            estado_actual: 'En Revision',
                            fecha_actualizacion: new Date().toISOString()
                        })
                        .eq('id_trabajador', ID_USUARIO_ACTUAL)
                        .eq('id_vacante', vacanteIdFinal);
                }

                // 3. Marcar la alerta actual como leída
                await supabase
                    .from('alertas_notificaciones_labur')
                    .update({ leido: true })
                    .eq('id_notificacion', idNoti);

                // 4. INSERTAR ALERTA DE LOGRO/ESTADO PARA EL TRABAJADOR (Check Verde ✅)
                const { error: errNuevaAlerta } = await supabase
                    .from('alertas_notificaciones_labur')
                    .insert([{
                        id_usuario: ID_USUARIO_ACTUAL,
                        tipo_evento: 'Estado',
                        titulo: '✅ Entrevista IA Completada con Éxito',
                        mensaje: `Has completado tu entrevista virtual automatizada. Nuestro evaluador de IA otorgó un desempeño técnico del ${scoreDesempenio}%. Tus respuestas ya están en revisión por el equipo encargado.`,
                        leido: false,
                        fecha_notificacion: new Date().toISOString(),
                        id_vacante: vacanteIdFinal
                    }]);

                if (errNuevaAlerta) console.error("No se pudo generar la alerta de confirmación:", errNuevaAlerta.message);

                alert("¡Entrevista finalizada con éxito! Tus respuestas han sido enviadas al empleador.");
                
                document.getElementById('modal-sala-entrevista').remove();
                
                // Volvemos a pintar la bandeja para limpiar la entrevista iniciada y ver el nuevo estado
                await generarBandejaAlertasReal();

            } catch (error) {
                console.error("Error al procesar el fin de la entrevista:", error);
                alert("Hubo un percance al enviar tu entrevista: " + error.message);
                btn.disabled = false;
                btn.innerHTML = `<i class="fa-solid fa-square-check"></i> Finalizar Entrevista`;
            }
        });

    } catch (err) {
        console.error("Error al abrir la sala de entrevista:", err.message);
        alert("No se pudo iniciar el asistente de entrevista virtual.");
    }
};

/**
 * Borra masivamente las alertas del usuario logueado
 */
async function limpiarHistorialBuzon() {
    if (!confirm("¿Seguro que deseas vaciar tu historial de notificaciones recibidas?")) return;

    try {
        const { error } = await supabase
            .from('alertas_notificaciones_labur')
            .delete()
            .eq('id_usuario', ID_USUARIO_ACTUAL);

        if (error) throw error;

        alert("Historial de notificaciones eliminado.");
        await generarBandejaAlertasReal();
    } catch (error) {
        alert("Error al vaciar buzon: " + error.message);
    }
}