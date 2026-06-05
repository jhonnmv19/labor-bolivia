import { supabase, verificarAccesoPorRol } from './supabase-config.js';

// Variable global para almacenar el estado actual del perfil cargado y las especialidades
let datosUsuarioGlobal = null;
let listaEspecialidades = [];

document.addEventListener('DOMContentLoaded', async () => {
    const user = await verificarAccesoPorRol(['Trabajador']);
    if (!user) return; 

    const idUsuarioLocal = localStorage.getItem('id_usuario_labur');
    if (!idUsuarioLocal) {
        window.location.href = "/login.html";
        return;
    }
    
    const userId = parseInt(idUsuarioLocal);

    // 1. Cargar el catálogo de especialidades desde la base de datos para el Formulario
    await cargarCatalogoEspecialidades();

    // 2. Cargar toda la información del Dashboard
    await cargarDatosDashboard(userId);

    // Configurar botón de Cierre de Sesión
    document.getElementById('btn-logout').addEventListener('click', async () => {
        const confirmacion = confirm("¿Estás seguro de que deseas cerrar sesión?");
        if (confirmacion) {
            await supabase.auth.signOut();
            localStorage.clear(); 
            window.location.href = "/login.html";
        }
    });

    // LÓGICA DE CONTROL DEL MODAL
    const modal = document.getElementById('modal-editar-perfil');
    const btnCerrar = document.getElementById('btn-cerrar-modal');
    const btnCancelar = document.getElementById('btn-cancelar-modal');
    const formEditar = document.getElementById('form-editar-perfil');

    const cerrarModal = () => modal.classList.add('hidden');
    btnCerrar.addEventListener('click', cerrarModal);
    btnCancelar.addEventListener('click', cerrarModal);

    // Evento Submit del Formulario Robustecido
    formEditar.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Deshabilitar botón de envío para evitar doble submit
        const btnSubmit = formEditar.querySelector('button[type="submit"]');
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<i class="fa-solid fa-spinner animate-spin mr-1"></i> Guardando...`;

        // Capturar los nuevos valores robustos del formulario
        const nombre = document.getElementById('edit-nombre').value.trim();
        const apellido = document.getElementById('edit-apellido').value.trim();
        const departamento = document.getElementById('edit-departamento').value.trim();
        const ciudad_municipio = document.getElementById('edit-ciudad').value.trim();
        
        const id_especialidad = document.getElementById('edit-especialidad').value ? parseInt(document.getElementById('edit-especialidad').value) : null;
        const anios_experiencia = parseInt(document.getElementById('edit-experiencia').value);
        const pretension_salarial = parseFloat(document.getElementById('edit-salario').value) || 0;
        const modalidad_preferida = document.getElementById('edit-modalidad').value;
        const disponibilidad_incorporacion = document.getElementById('edit-disponibilidad').value.trim();
        const portafolio_url = document.getElementById('edit-portafolio').value.trim();
        const linkedin_url = document.getElementById('edit-linkedin').value.trim();
        const descripcion_personal = document.getElementById('edit-descripcion').value.trim();

        try {
            // Actualización 1: Tabla usuarios_labur (Datos básicos)
            const { error: errorUser } = await supabase
                .from('usuarios_labur')
                .update({ nombre, apellido, departamento, ciudad_municipio })
                .eq('id_usuario', userId);

            if (errorUser) throw errorUser;

            // Actualización 2: Tabla perfiles_trabajadores_labur (Datos profesionales e hipervínculos de evidencias)
            const { error: errorPerfil } = await supabase
                .from('perfiles_trabajadores_labur')
                .update({ 
                    id_especialidad,
                    anios_experiencia, 
                    pretension_salarial,
                    modalidad_preferida,
                    disponibilidad_incorporacion,
                    portafolio_url,
                    linkedin_url,
                    descripcion_personal 
                })
                .eq('id_trabajador', userId);

            if (errorPerfil) throw errorPerfil;

            alert("¡Tu perfil profesional ha sido actualizado con éxito!");
            cerrarModal();
            
            // Recargar Dashboard reflejando los cambios inmediatamente
            await cargarDatosDashboard(userId);

        } catch (error) {
            console.error("Error al actualizar el perfil extendido:", error);
            alert("Ocurrió un problema guardando los cambios.");
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `<i class="fa-solid fa-floppy-disk mr-1"></i> Guardar Cambios`;
        }
    });
});

// Función para descargar las especialidades técnicas desde la base de datos
async function cargarCatalogoEspecialidades() {
    try {
        const { data, error } = await supabase
            .from('especialidades_labur')
            .select('id_especialidad, nombre_especialidad, categoria')
            .order('nombre_especialidad', { ascending: true });

        if (error) throw error;
        
        listaEspecialidades = data || [];
        const selectEspecialidad = document.getElementById('edit-especialidad');
        
        if (selectEspecialidad) {
            selectEspecialidad.innerHTML = `<option value="">Selecciona tu oficio...</option>`;
            listaEspecialidades.forEach(esp => {
                const opt = document.createElement('option');
                opt.value = esp.id_especialidad;
                opt.innerText = `${esp.nombre_especialidad} (${esp.categoria})`;
                selectEspecialidad.appendChild(opt);
            });
        }
    } catch (err) {
        console.error("Error al cargar las especialidades:", err);
    }
}

async function cargarDatosDashboard(userId) {
    try {
        // Hacemos el fetch incluyendo los nuevos campos agregados y la relación a especialidades_labur
        const { data: perfilCompleto, error } = await supabase
            .from('usuarios_labur')
            .select(`
                nombre,
                apellido,
                correo_electronico,
                ciudad_municipio,
                departamento,
                perfiles_trabajadores_labur (
                    id_especialidad,
                    anios_experiencia,
                    disponibilidad_incorporacion,
                    modalidad_preferida,
                    pretension_salarial,
                    portafolio_url,
                    linkedin_url,
                    estado_verificacion_global,
                    porcentaje_perfil,
                    descripcion_personal,
                    especialidades_labur (
                        nombre_especialidad
                    )
                )
            `)
            .eq('id_usuario', userId)
            .single();

        if (error || !perfilCompleto) {
            console.error("Error al recuperar los detalles de perfil:", error);
            return;
        }

        datosUsuarioGlobal = perfilCompleto;
        const datosLaborales = perfilCompleto.perfiles_trabajadores_labur;

        renderizarPerfil(perfilCompleto, datosLaborales);
        renderizarVerificacion(datosLaborales);
        await cargarPostulaciones(userId);

    } catch (err) {
        console.error("Error crítico en el render del dashboard:", err);
    }
}

function renderizarPerfil(usuario, laboral) {
    const nombreCompleto = `${usuario.nombre} ${usuario.apellido}`;
    const ubicacion = `${usuario.ciudad_municipio}, ${usuario.departamento}`;
    const desc = laboral?.descripcion_personal || "Sin descripción profesional registrada.";
    const porcentaje = laboral?.porcentaje_perfil || 0;
    
    // Obtener dinámicamente el nombre de la especialidad seleccionada
    const especialidadNombre = laboral?.especialidades_labur?.nombre_especialidad || "Técnico no especificado";

    // Modificado dinámicamente según la especialidad real del SQL
    document.getElementById('welcome-title').innerText = `¡Bienvenido de vuelta, ${usuario.nombre}!`;
    document.getElementById('welcome-subtitle').innerText = `Perfil de tipo: ${especialidadNombre}`;

    document.getElementById('sidebar-user-summary').innerHTML = `
        <div class="w-9 h-9 rounded-full bg-tierra-600 flex items-center justify-center text-white font-bold flex-shrink-0 border border-tierra-400">
            ${usuario.nombre.charAt(0)}${usuario.apellido.charAt(0)}
        </div>
        <div class="flex-1 min-w-0">
            <p class="text-white text-sm font-semibold truncate">${nombreCompleto}</p>
            <p class="text-carbon-500 text-xs truncate">${ubicacion}</p>
        </div>
    `;

    // Renderizado de tarjeta de perfil con soporte visual para ver portafolio/evidencias
    let linksHtml = "";
    if (laboral?.portafolio_url) {
        linksHtml += `
            <a href="${laboral.portafolio_url}" target="_blank" class="inline-flex items-center gap-1 text-xs text-tierra-600 hover:underline font-semibold bg-tierra-50 px-2 py-1 rounded border border-tierra-100">
                <i class="fa-solid fa-folder-open text-[10px]"></i> Ver Evidencias / Certificados
            </a>
        `;
    }

    document.getElementById('profile-card').innerHTML = `
        <div>
            <div class="flex items-start justify-between mb-3">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-xl bg-tierra-600 flex items-center justify-center text-white text-xl font-bold">
                        ${usuario.nombre.charAt(0)}
                    </div>
                    <div>
                        <h2 class="text-carbon-900 text-base font-bold">${nombreCompleto}</h2>
                        <p class="text-carbon-500 text-xs">${ubicacion}</p>
                        <p class="text-tierra-600 text-[11px] font-semibold mt-0.5"><i class="fa-solid fa-user-gear"></i> ${especialidadNombre}</p>
                    </div>
                </div>
                <button id="btn-abrir-editar" class="text-carbon-400 hover:text-tierra-600 bg-carbon-50 hover:bg-tierra-50 border border-carbon-200 hover:border-tierra-200 rounded-xl p-2 transition-all" title="Editar Perfil">
                    <i class="fa-solid fa-user-pen text-xs"></i>
                </button>
            </div>
            <p class="text-carbon-600 text-xs line-clamp-3 mb-3">${desc}</p>
            <div class="mb-4">${linksHtml}</div>
        </div>
        
        <div class="space-y-2">
            <div class="flex items-center justify-between text-xs">
                <span class="text-carbon-500 font-medium">Progreso del Perfil</span>
                <span class="text-tierra-600 font-bold">${porcentaje}%</span>
            </div>
            <div class="w-full h-2 bg-carbon-100 rounded-full overflow-hidden">
                <div class="h-full bg-gradient-to-r from-tierra-500 to-tierra-600 rounded-full" style="width: ${porcentaje}%"></div>
            </div>
        </div>
    `;

    // Escuchador dinámico mapeando absolutamente todos los nuevos campos al Modal al hacer click
    document.getElementById('btn-abrir-editar').addEventListener('click', () => {
        if (!datosUsuarioGlobal) return;

        const lab = datosUsuarioGlobal.perfiles_trabajadores_labur;

        document.getElementById('edit-nombre').value = datosUsuarioGlobal.nombre;
        document.getElementById('edit-apellido').value = datosUsuarioGlobal.apellido;
        document.getElementById('edit-departamento').value = datosUsuarioGlobal.departamento;
        document.getElementById('edit-ciudad').value = datosUsuarioGlobal.ciudad_municipio;
        
        document.getElementById('edit-especialidad').value = lab?.id_especialidad || "";
        document.getElementById('edit-experiencia').value = lab?.anios_experiencia || 0;
        document.getElementById('edit-salario').value = lab?.pretension_salarial || "";
        document.getElementById('edit-modalidad').value = lab?.modalidad_preferida || "Presential";
        document.getElementById('edit-disponibilidad').value = lab?.disponibilidad_incorporacion || "Inmediata";
        document.getElementById('edit-portafolio').value = lab?.portafolio_url || "";
        document.getElementById('edit-linkedin').value = lab?.linkedin_url || "";
        document.getElementById('edit-descripcion').value = lab?.descripcion_personal || "";

        document.getElementById('modal-editar-perfil').classList.remove('hidden');
    });
}

function renderizarVerificacion(laboral) {
    const estado = laboral?.estado_verificacion_global || 'Sin Enviar';
    let badgeColor = 'bg-gray-100 text-gray-800 border-gray-300';
    let icono = 'fa-circle-question';

    if (estado === 'Completado') {
        badgeColor = 'bg-green-50 text-green-700 border-green-200';
        icono = 'fa-circle-check';
    } else if (estado === 'En Curso') {
        badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
        icono = 'fa-spinner animate-spin';
    } else if (estado === 'Rechazado' || estado === 'Fraude') {
        badgeColor = 'bg-red-50 text-red-700 border-red-200';
        icono = 'fa-circle-exclamation';
    }

    document.getElementById('verification-card').innerHTML = `
        <div class="flex items-center gap-2 mb-3">
            <div class="w-8 h-8 rounded-lg bg-carbon-100 flex items-center justify-center text-carbon-700">
                <i class="fa-solid fa-shield-halved text-sm"></i>
            </div>
            <span class="text-carbon-800 text-sm font-semibold">Validación e Identidad</span>
        </div>
        <div class="border rounded-xl p-3 flex items-center gap-3 ${badgeColor}">
            <i class="fa-solid ${icono} text-lg"></i>
            <div>
                <p class="text-xs font-bold uppercase tracking-wider">Estado: ${estado}</p>
                <p class="text-[11px] opacity-90">Análisis y cruce de datos por Inteligencia Artificial.</p>
            </div>
        </div>
    `;
}

async function cargarPostulaciones(userId) {
    const { data: postulaciones, error } = await supabase
        .from('postulaciones_labur')
        .select(`
            score_compatibilidad_ia,
            estado_actual,
            fecha_postulacion,
            vacantes_labur (
                titulo_puesto,
                modalidad
            )
        `)
        .eq('id_trabajador', userId);

    const tbody = document.getElementById('tabla-postulaciones');
    if (!tbody) return;
    
    if (error || !postulaciones || postulaciones.length === 0) {
        document.getElementById('postulaciones-count').innerText = "0";
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-6 text-carbon-400 text-xs">No te has postulado a ninguna oferta laboral todavía.</td>
            </tr>
        `;
        return;
    }

    document.getElementById('postulaciones-count').innerText = postulaciones.length;
    tbody.innerHTML = "";

    postulaciones.forEach(item => {
        const vacante = item.vacantes_labur || { titulo_puesto: "N/A", modalidad: "Presencial" };
        const fecha = new Date(item.fecha_postulacion).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
        
        const score = item.score_compatibilidad_ia || 0;
        const scoreColor = score >= 75 ? 'text-green-600 font-bold' : score >= 50 ? 'text-yellow-600' : 'text-red-500';

        const tr = document.createElement('tr');
        tr.className = "hover:bg-carbon-50 transition-colors";
        tr.innerHTML = `
            <td class="py-3 px-4 font-semibold text-carbon-900">${vacante.titulo_puesto}</td>
            <td class="py-3 px-4"><span class="bg-carbon-100 text-carbon-700 px-2 py-0.5 rounded text-xs">${vacante.modalidad}</span></td>
            <td class="py-3 px-4 ${scoreColor}">${score}% Match</td>
            <td class="py-3 px-4"><span class="font-medium text-xs text-tierra-700 bg-tierra-50 border border-tierra-100 px-2 py-1 rounded-full">${item.estado_actual}</span></td>
            <td class="py-3 px-4 text-carbon-500 text-xs">${fecha}</td>
        `;
        tbody.appendChild(tr);
    });
}