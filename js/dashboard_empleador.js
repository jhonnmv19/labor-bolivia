// C:\Users\arnol\OneDrive\Documents\laburoboli\js\dashboard_empleador.js
import { supabase, verificarAccesoPorRol, cerrarSesion } from './supabase-config.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Validar el acceso
    const usuarioLogueado = await verificarAccesoPorRol(['Empleador']);
    if (!usuarioLogueado) return;

    // Obtenemos el ID numérico real guardado en el localStorage
    const idEmpleador = localStorage.getItem('id_usuario_labur');
    
    if (!idEmpleador || isNaN(parseInt(idEmpleador))) {
        alert("Sesión inválida o expirada. Por favor, vuelva a iniciar sesión.");
        cerrarSesion();
        return;
    }

    configurarComponentesFijos();
    configurarFormularioDesplegable(idEmpleador);
    crearEstructuraModal(); // Crea dinámicamente el modal de perfil si no existe
    crearEstructuraModalEntrevistaIA(); // Módulo SBC de IA
    crearEstructuraModalEditarVacante(); // ¡NUEVO! Inicializa el modal para editar ofertas
    
    // 2. Cargar toda la información mapeando las tablas reales
    await cargarPerfilEmpleador(idEmpleador);
    await cargarVacantesYPostulaciones(idEmpleador);
});

function configurarComponentesFijos() {
    const botonLogout = document.getElementById('btn-logout');
    if (botonLogout) {
        botonLogout.addEventListener('click', (e) => {
            e.preventDefault();
            cerrarSesion();
        });
    }

    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.style.backgroundColor = '#000000';
    }
}

/**
 * Controla la actualización dinámica del perfil apuntando a usuarios_labur y perfiles_empleadores_labur
 */
function configurarFormularioDesplegable(idEmpleador) {
    const wrapper = document.getElementById('wrapper-formulario-perfil');
    const btnToggle = document.getElementById('btn-toggle-perfil');
    const btnCancelar = document.getElementById('btn-cancelar-edicion');
    const formPerfil = document.getElementById('form-editar-perfil-directo');

    if (btnToggle && wrapper) {
        btnToggle.addEventListener('click', () => {
            wrapper.classList.toggle('hidden');
        });
    }

    if (btnCancelar && wrapper) {
        btnCancelar.addEventListener('click', () => {
            wrapper.classList.add('hidden');
        });
    }

    if (formPerfil) {
        formPerfil.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nuevoNombre = document.getElementById('input-perfil-nombre').value;
            const nuevoApellido = document.getElementById('input-perfil-apellido').value;
            const nuevoTelefono = document.getElementById('input-perfil-telefono').value;
            const nuevaEmpresa = document.getElementById('input-perfil-empresa').value;

            try {
                // Actualizar datos base en usuarios_labur
                const { error: errUser } = await supabase
                    .from('usuarios_labur')
                    .update({
                        nombre: nuevoNombre,
                        apellido: nuevoApellido,
                        telefono_whatsapp: nuevoTelefono
                    })
                    .eq('id_usuario', parseInt(idEmpleador));

                if (errUser) throw errUser;

                // Actualizar o insertar el nombre comercial en perfiles_empleadores_labur
                const { error: errEmpresa } = await supabase
                    .from('perfiles_empleadores_labur')
                    .upsert({
                        id_empleador: parseInt(idEmpleador),
                        nombre_empresa: nuevaEmpresa,
                        sector_industrial: 'General' // Valor por defecto requerido
                    }, { onConflict: 'id_empleador' });

                if (errEmpresa) throw errEmpresa;

                alert("Información del perfil actualizada exitosamente.");
                if (wrapper) wrapper.classList.add('hidden');
                await cargarPerfilEmpleador(idEmpleador);
            } catch (err) {
                console.error("Error al guardar perfil:", err);
                alert("Hubo un error al actualizar los datos en Supabase: " + err.message);
            }
        });
    }
}

/**
 * Carga los datos uniendo usuarios_labur y perfiles_empleadores_labur
 */
async function cargarPerfilEmpleador(idEmpleador) {
    try {
        // Obtenemos los datos del usuario base
        const { data: usuario, error: errUser } = await supabase
            .from('usuarios_labur')
            .select('*')
            .eq('id_usuario', parseInt(idEmpleador))
            .single();

        if (errUser || !usuario) {
            console.error("Error al recuperar el usuario de usuarios_labur:", errUser);
            return;
        }

        // Obtenemos los datos de la empresa
        const { data: empresa } = await supabase
            .from('perfiles_empleadores_labur')
            .select('*')
            .eq('id_empleador', parseInt(idEmpleador))
            .single();

        // Referencias del DOM
        const heroEmpresaNombre = document.getElementById('hero-empresa-nombre');
        const empresaUsuarioNombre = document.getElementById('empresa-usuario-nombre');
        const headerSaludo = document.getElementById('header-saludo');
        const heroEmpresaDetalles = document.getElementById('hero-empresa-detalles');
        
        const inputNombre = document.getElementById('input-perfil-nombre');
        const inputApellido = document.getElementById('input-perfil-apellido');
        const inputTelefono = document.getElementById('input-perfil-telefono');
        const inputEmpresa = document.getElementById('input-perfil-empresa');
        const txtUbicacionHero = document.getElementById('txt-ubicacion-hero');

        // Valores lógicos basados en tu SQL real
        const nombreCompleto = `${usuario.nombre} ${usuario.apellido}`;
        const empresaNombre = empresa ? empresa.nombre_empresa : "Empresa no registrada";
        const telefonoMostrar = usuario.telefono_whatsapp || "Sin teléfono";
        const correoMostrar = usuario.correo_electronico || "Sin correo";
        const ubicacion = `${usuario.ciudad_municipio || 'Cercado'}, ${usuario.departamento || 'Cochabamba'}`;

        if (heroEmpresaNombre) heroEmpresaNombre.textContent = empresaNombre;
        if (empresaUsuarioNombre) empresaUsuarioNombre.textContent = nombreCompleto;
        if (headerSaludo) headerSaludo.textContent = `¡Bienvenido de vuelta, ${usuario.nombre}!`;
        if (heroEmpresaDetalles) heroEmpresaDetalles.textContent = `Contacto: ${correoMostrar} · WhatsApp: ${telefonoMostrar}`;
        if (txtUbicacionHero) txtUbicacionHero.textContent = ubicacion;
        
        // Rellenar formulario de edición
        if (inputNombre) inputNombre.value = usuario.nombre;
        if (inputApellido) inputApellido.value = usuario.apellido;
        if (inputTelefono) inputTelefono.value = usuario.telefono_whatsapp;
        if (inputEmpresa) inputEmpresa.value = empresaNombre;

    } catch (err) {
        console.error("Excepción al renderizar el perfil de usuario:", err);
    }
}

/**
 * Carga las vacantes y vincula dinámicamente los postulantes con modales interactivos
 */
async function cargarVacantesYPostulaciones(idEmpleador) {
    try {
        const { data: vacantes, error: errorVacantes } = await supabase
            .from('vacantes_labur')
            .select('*')
            .eq('id_empleador', parseInt(idEmpleador))
            .order('fecha_publicacion', { ascending: false });

        if (errorVacantes) throw errorVacantes;

        const listaVacantesContenedor = document.getElementById('lista-vacantes');
        const contadorVacantes = document.getElementById('contador-vacantes');
        const contadorPostulaciones = document.getElementById('contador-postulaciones');

        if (contadorVacantes) contadorVacantes.textContent = vacantes ? vacantes.length : 0;
        if (listaVacantesContenedor) listaVacantesContenedor.innerHTML = '';

        if (!vacantes || vacantes.length === 0) {
            if (listaVacantesContenedor) {
                listaVacantesContenedor.innerHTML = `<p class="text-xs text-slate-400 py-4 text-center">No posees ofertas de trabajo activas.</p>`;
            }
            if (contadorPostulaciones) contadorPostulaciones.textContent = 0;
            const contenedorSolicitudes = document.getElementById('contenedor-solicitudes');
            if (contenedorSolicitudes) {
                contenedorSolicitudes.innerHTML = `<p class="text-xs text-slate-400 py-4 text-center">Sin solicitudes pendientes.</p>`;
            }
            return;
        }

        // Renderizar ofertas encontradas
        vacantes.forEach(vacante => {
            const vacanteHTML = `
                <div class="border border-slate-200 rounded-xl p-3.5 space-y-2 bg-white shadow-xs">
                    <div class="flex justify-between items-start gap-2">
                        <h3 class="font-bold text-slate-800 text-sm font-display truncate">${vacante.titulo_puesto}</h3>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            vacante.estado_vacante === 'Activa'
                            ? 'bg-green-50 text-green-700 border-green-100' 
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }">${vacante.estado_vacante.toUpperCase()}</span>
                    </div>
                    <p class="text-xs text-slate-500"><i class="fa-solid fa-location-dot text-sky-500"></i> ${vacante.departamento}, ${vacante.ciudad_municipio}</p>
                    <p class="text-[11px] text-slate-400">Puestos disponibles: <span class="font-semibold text-slate-600">${vacante.numero_vacantes_disponibles}</span></p>
                    <div class="flex justify-end pt-1.5 border-t border-slate-100">
                        <button class="btn-editar-vacante px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 text-[11px] font-bold rounded-md border border-slate-200 transition-colors cursor-pointer"
                            data-vacante-info='${JSON.stringify(vacante).replace(/'/g, "&apos;")}'>
                            <i class="fa-solid fa-pen-to-square"></i> Editar Oferta
                        </button>
                    </div>
                </div>
            `;
            if (listaVacantesContenedor) listaVacantesContenedor.insertAdjacentHTML('beforeend', vacanteHTML);
        });

        // Asignar eventos dinámicos para editar vacantes
        document.querySelectorAll('.btn-editar-vacante').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const data = JSON.parse(e.currentTarget.getAttribute('data-vacante-info'));
                abrirModalEditarVacante(data);
            });
        });

        // Recuperar postulaciones usando la lista de IDs directamente
        const listaIdsVacantes = vacantes.map(v => v.id_vacante);

        // CORRECCIÓN RELACIONAL EN CADENA
        const { data: postulaciones, error: errorPostulaciones } = await supabase
            .from('postulaciones_labur')
            .select(`
                id_postulacion,
                id_vacante,
                score_compatibilidad_ia,
                estado_actual,
                id_trabajador,
                vacantes_labur ( titulo_puesto ),
                perfiles_trabajadores_labur (
                    usuarios_labur (
                        nombre,
                        apellido,
                        correo_electronico,
                        telefono_whatsapp,
                        departamento,
                        ciudad_municipio
                    )
                )
            `)
            .in('id_vacante', listaIdsVacantes)
            .order('score_compatibilidad_ia', { ascending: false });

        if (errorPostulaciones) throw errorPostulaciones;

        if (contadorPostulaciones) contadorPostulaciones.textContent = postulaciones ? postulaciones.length : 0;
        const contenedorSolicitudes = document.getElementById('contenedor-solicitudes');
        
        if (contenedorSolicitudes) {
            if (postulaciones && postulaciones.length > 0) {
                contenedorSolicitudes.innerHTML = '';
                postulaciones.forEach(post => {
                    const datosUsuario = post.perfiles_trabajadores_labur?.usuarios_labur;
                    const nombrePostulante = datosUsuario 
                        ? `${datosUsuario.nombre} ${datosUsuario.apellido}` 
                        : "Postulante Anónimo";
                    
                    const postHTML = `
                        <div class="p-4 border border-slate-200 rounded-xl space-y-3 bg-white shadow-xs hover:border-sky-300 transition-all">
                            <div class="flex justify-between items-center">
                                <h4 class="font-bold text-sm text-slate-800">${nombrePostulante}</h4>
                                <span class="bg-sky-50 text-sky-700 text-xs font-bold px-2 py-0.5 rounded border border-sky-200">${post.score_compatibilidad_ia || 0}% Match IA</span>
                            </div>
                            <div class="flex justify-between items-center text-xs text-slate-500">
                                <p>Puesto: <span class="font-semibold text-slate-700">${post.vacantes_labur?.titulo_puesto || 'No especificado'}</span></p>
                                <span class="bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-100">Fase: ${post.estado_actual}</span>
                            </div>
                            <div class="flex justify-end gap-2 pt-1 border-t border-slate-100">
                                <button class="btn-ver-perfil px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer" 
                                    data-info='${JSON.stringify({ ...post, nombreCompleto: nombrePostulante }).replace(/'/g, "&apos;")}'>
                                    <i class="fa-solid fa-eye text-slate-500"></i> Ver Perfil
                                </button>
                                <button class="btn-configurar-ia px-3 py-1 btn-empleador-accent text-white text-xs font-bold rounded-lg transition-all cursor-pointer"
                                    data-trabajador="${post.id_trabajador}"
                                    data-vacante="${post.id_vacante}"
                                    data-postulacion="${post.id_postulacion}">
                                    <i class="fa-solid fa-robot"></i> Configurar Entrevista IA
                                </button>
                            </div>
                        </div>
                    `;
                    contenedorSolicitudes.insertAdjacentHTML('beforeend', postHTML);
                });

                // Asignar eventos dinámicos
                document.querySelectorAll('.btn-ver-perfil').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const data = JSON.parse(e.currentTarget.getAttribute('data-info'));
                        abrirModalPerfil(data);
                    });
                });

                document.querySelectorAll('.btn-configurar-ia').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const idTrabajador = e.currentTarget.getAttribute('data-trabajador');
                        const idVacante = e.currentTarget.getAttribute('data-vacante');
                        const idPostulacion = e.currentTarget.getAttribute('data-postulacion');
                        abrirConfiguracionEntrevista(idTrabajador, idVacante, idPostulacion);
                    });
                });

            } else {
                contenedorSolicitudes.innerHTML = `<p class="text-xs text-slate-400 py-6 text-center">No se han recibido postulaciones para tus ofertas aún.</p>`;
            }
        }
    } catch (err) {
        console.error("Error crítico al procesar listas del dashboard:", err);
    }
}

/**
 * Crea dinámicamente la estructura del modal interactivo de visualización en el DOM
 */
function crearEstructuraModal() {
    if (document.getElementById('modal-perfil-candidato')) return;
    
    const modalHTML = `
        <div id="modal-perfil-candidato" class="hidden fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all">
            <div class="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-100">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 id="modal-candidate-name" class="font-display font-black text-slate-900 text-base">Nombre Candidato</h3>
                        <p id="modal-candidate-job" class="text-xs text-sky-600 font-semibold">Postulante a: Puesto</p>
                    </div>
                    <button id="close-modal-candidate" class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer">
                        <i class="fa-solid fa-xmark text-sm"></i>
                    </button>
                </div>
                <div class="space-y-2 text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p><strong><i class="fa-solid fa-envelope text-slate-400 w-4"></i> Correo:</strong> <span id="modal-candidate-email"></span></p>
                    <p><strong><i class="fa-solid fa-phone text-slate-400 w-4"></i> Teléfono:</strong> <span id="modal-candidate-phone"></span></p>
                    <p><strong><i class="fa-solid fa-location-dot text-slate-400 w-4"></i> Ubicación:</strong> <span id="modal-candidate-location"></span></p>
                    <p><strong><i class="fa-solid fa-star text-slate-400 w-4"></i> Compatibilidad:</strong> <span id="modal-candidate-match"></span></p>
                </div>
                <div class="flex gap-2 justify-end pt-2">
                    <button id="btn-modal-rechazar" class="px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold rounded-lg transition-colors cursor-pointer">Descartar</button>
                    <button id="btn-modal-aprobar" class="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer">Aprobar Candidato</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('close-modal-candidate').addEventListener('click', () => {
        document.getElementById('modal-perfil-candidato').classList.add('hidden');
    });
}

/**
 * Crea dinámicamente el modal interactivo de la Guía de Entrevista IA (Módulo SBC)
 */
function crearEstructuraModalEntrevistaIA() {
    if (document.getElementById('modal-entrevista-ia')) return;

    const modalIAHTML = `
        <div id="modal-entrevista-ia" class="hidden fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all">
            <div class="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-100">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="font-display font-black text-slate-900 text-base">🎯 Configurar Entrevista IA</h3>
                        <p class="text-xs text-sky-600 font-semibold">Módulo Basado en Conocimiento (SBC)</p>
                    </div>
                    <button id="close-modal-ia" class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer">
                        <i class="fa-solid fa-xmark text-sm"></i>
                    </button>
                </div>
                
                <div class="space-y-3 text-xs">
                    <p class="text-slate-500">La IA analizará el perfil del postulante frente a los requisitos técnicos cargados en la vacante.</p>
                    
                    <div class="space-y-1">
                        <label class="block font-bold text-slate-700">Cantidad de preguntas deseadas:</label>
                        <select id="cantidad-preguntas" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-sky-500">
                            <option value="5">5 Preguntas (Rápido)</option>
                            <option value="10" selected>10 Preguntas (Recomendado)</option>
                            <option value="20">20 Preguntas (Exhaustivo)</option>
                        </select>
                    </div>

                    <div class="space-y-1">
                        <label class="block font-bold text-slate-700">Enfoque personalizado de la encuesta:</label>
                        <textarea id="enfoque-particular" rows="3" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-sky-500 placeholder:text-slate-400" 
                            placeholder="Ej. Centrarse en su experiencia con bases de datos relacionales, manejo de lógica MVC y resolución de problemas..."></textarea>
                    </div>
                </div>

                <div class="flex gap-2 justify-end pt-2">
                    <button id="btn-cancelar-ia" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer">Cancelar</button>
                    <button id="btn-lanzar-ia" class="px-4 py-1.5 btn-empleador-accent text-white text-xs font-bold rounded-lg shadow-xs transition-all cursor-pointer">🚀 Enviar Encuesta</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalIAHTML);

    document.getElementById('close-modal-ia').addEventListener('click', () => {
        document.getElementById('modal-entrevista-ia').classList.add('hidden');
    });
    document.getElementById('btn-cancelar-ia').addEventListener('click', () => {
        document.getElementById('modal-entrevista-ia').classList.add('hidden');
    });
}

/**
 * ¡NUEVO! Crea dinámicamente el modal interactivo para Modificar / Gestionar Estado y Vacantes de la Oferta
 */
function crearEstructuraModalEditarVacante() {
    if (document.getElementById('modal-editar-vacante')) return;

    const modalEditarHTML = `
        <div id="modal-editar-vacante" class="hidden fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all">
            <div class="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-100">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 id="modal-vacante-titulo" class="font-display font-black text-slate-900 text-base">Editar Oferta de Trabajo</h3>
                        <p class="text-xs text-sky-600 font-semibold">Configuración de Disponibilidad</p>
                    </div>
                    <button id="close-modal-vacante" class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer">
                        <i class="fa-solid fa-xmark text-sm"></i>
                    </button>
                </div>
                
                <form id="form-editar-vacante-directo" class="space-y-3 text-xs">
                    <div class="space-y-1">
                        <label class="block font-bold text-slate-700">Estado de la Oferta:</label>
                        <select id="input-vacante-estado" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-sky-500">
                            <option value="Activa">Activa (Visible para postulantes)</option>
                            <option value="Inactiva">Inactiva (Inhabilitada / Oculta)</option>
                        </select>
                    </div>

                    <div class="space-y-1">
                        <label class="block font-bold text-slate-700">Número de Vacantes Disponibles:</label>
                        <input type="number" id="input-vacante-cantidad" min="1" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-sky-500 font-medium" required>
                    </div>

                    <div class="flex gap-2 justify-end pt-2">
                        <button type="button" id="btn-cancelar-vacante" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer">Cancelar</button>
                        <button type="submit" class="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer">Guardar Cambios</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalEditarHTML);

    document.getElementById('close-modal-vacante').addEventListener('click', () => {
        document.getElementById('modal-editar-vacante').classList.add('hidden');
    });
    document.getElementById('btn-cancelar-vacante').addEventListener('click', () => {
        document.getElementById('modal-editar-vacante').classList.add('hidden');
    });
}

function abrirModalPerfil(post) {
    const datosUsuario = post.perfiles_trabajadores_labur?.usuarios_labur;

    document.getElementById('modal-candidate-name').textContent = post.nombreCompleto;
    document.getElementById('modal-candidate-job').textContent = `Postulante a: ${post.vacantes_labur?.titulo_puesto || 'Puesto'}`;
    
    document.getElementById('modal-candidate-email').textContent = datosUsuario?.correo_electronico || 'No disponible';
    document.getElementById('modal-candidate-phone').textContent = datosUsuario?.telefono_whatsapp || 'No disponible';
    document.getElementById('modal-candidate-location').textContent = `${datosUsuario?.ciudad_municipio || 'Cercado'}, ${datosUsuario?.departamento || 'Cochabamba'}`;
    
    document.getElementById('modal-candidate-match').textContent = `${post.score_compatibilidad_ia || 0}% Match Pro IA`;

    const btnAprobar = document.getElementById('btn-modal-aprobar');
    const btnRechazar = document.getElementById('btn-modal-rechazar');

    // Implementación rápida de cambios manuales de estado
    btnAprobar.onclick = async () => {
        try {
            const { error } = await supabase.from('postulaciones_labur').update({ estado_actual: 'Aprobado' }).eq('id_postulacion', post.id_postulacion);
            if (error) throw error;
            alert("Candidato aprobado correctamente.");
            document.getElementById('modal-perfil-candidato').classList.add('hidden');
            await cargarVacantesYPostulaciones(localStorage.getItem('id_usuario_labur'));
        } catch(e) { alert(e.message); }
    };
    btnRechazar.onclick = async () => {
        try {
            const { error } = await supabase.from('postulaciones_labur').update({ estado_actual: 'Descartado' }).eq('id_postulacion', post.id_postulacion);
            if (error) throw error;
            alert("Candidato movido a descartados.");
            document.getElementById('modal-perfil-candidato').classList.add('hidden');
            await cargarVacantesYPostulaciones(localStorage.getItem('id_usuario_labur'));
        } catch(e) { alert(e.message); }
    };

    document.getElementById('modal-perfil-candidato').classList.remove('hidden');
}

/**
 * ¡NUEVO! Abre el modal rellenando los campos con la información actual de la oferta y configura el guardado
 */
function abrirModalEditarVacante(vacante) {
    const modal = document.getElementById('modal-editar-vacante');
    if (!modal) return;

    document.getElementById('modal-vacante-titulo').textContent = `Editar: ${vacante.titulo_puesto}`;
    document.getElementById('input-vacante-estado').value = vacante.estado_vacante || 'Activa';
    document.getElementById('input-vacante-cantidad').value = vacante.numero_vacantes_disponibles || 1;

    const form = document.getElementById('form-editar-vacante-directo');
    
    // Desvinculamos listeners previos clonando el formulario para evitar ejecuciones repetidas
    const nuevoForm = form.cloneNode(true);
    form.parentNode.replaceChild(nuevoForm, form);

    nuevoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const nuevoEstado = document.getElementById('input-vacante-estado').value;
        const nuevaCantidad = document.getElementById('input-vacante-cantidad').value;

        try {
            const { error } = await supabase
                .from('vacantes_labur')
                .update({
                    estado_vacante: nuevoEstado,
                    numero_vacantes_disponibles: parseInt(nuevaCantidad)
                })
                .eq('id_vacante', parseInt(vacante.id_vacante));

            if (error) throw error;

            alert("Oferta de trabajo actualizada con éxito.");
            modal.classList.add('hidden');
            
            // Recargar las listas del dashboard para ver los cambios aplicados en tiempo real
            const idEmpleador = localStorage.getItem('id_usuario_labur');
            await cargarVacantesYPostulaciones(idEmpleador);

        } catch (err) {
            console.error("Error al actualizar la vacante:", err);
            alert("No se pudo actualizar la oferta: " + err.message);
        }
    });

    modal.classList.remove('hidden');
}

/**
 * Abre y prepara el formulario guía guardando las variables en el DOM
 */
function abrirConfiguracionEntrevista(idTrabajador, idVacante, idPostulacion) {
    const modalIA = document.getElementById('modal-entrevista-ia');
    if (!modalIA) return;
    
    modalIA.setAttribute('data-trabajador', idTrabajador);
    modalIA.setAttribute('data-vacante', idVacante);
    modalIA.setAttribute('data-postulacion', idPostulacion);

    document.getElementById('cantidad-preguntas').value = "10";
    document.getElementById('enfoque-particular').value = "";

    // Clonación de botón para eliminar listeners anteriores y evitar duplicaciones
    const btnLanzar = document.getElementById('btn-lanzar-ia');
    const nuevoBtnLanzar = btnLanzar.cloneNode(true);
    btnLanzar.parentNode.replaceChild(nuevoBtnLanzar, btnLanzar);

    nuevoBtnLanzar.addEventListener('click', async () => {
        await lanzarEntrevistaAutomatizada();
    });

    modalIA.classList.remove('hidden');
}

/**
 * Lanza la entrevista automatizada adaptada al esquema SQL real de Supabase.
 */
async function lanzarEntrevistaAutomatizada() {
    const modalIA = document.getElementById('modal-entrevista-ia');
    if (!modalIA) return;

    // Recuperamos las variables guardadas temporalmente en el DOM del modal
    const idTrabajador = modalIA.getAttribute('data-trabajador');
    const idVacante = modalIA.getAttribute('data-vacante');
    // NOTA: id_postulacion se puede quedar en memoria si lo necesitas para actualizar el estado después, 
    // pero NO se debe enviar en el INSERT de entrevistas_ia_labur.
    const idPostulacion = modalIA.getAttribute('data-postulacion');

    const cantidadPreguntas = document.getElementById('cantidad-preguntas').value;
    const enfoqueParticular = document.getElementById('enfoque-particular').value;

    try {
        // 1. Insertar la entrevista en entrevistas_ia_labur usando solo columnas existentes en tu SQL
        const { data: dataEntrevista, error: errorEntrevista } = await supabase
            .from('entrevistas_ia_labur')
            .insert([
                {
                    id_trabajador: parseInt(idTrabajador),
                    id_vacante: parseInt(idVacante),
                    cantidad_preguntas: parseInt(cantidadPreguntas),
                    analisis_ia_resumen: enfoqueParticular,
                    // score_desempenio_tecnico y sello_verificado_otorgado se quedan vacíos/por defecto al iniciar
                }
            ])
            .select();

        if (errorEntrevista) throw errorEntrevista;

        // 2. OPCIONAL/RECOMENDADO: Actualizar el estado de la postulación a 'Entrevista IA'
        // Ya que tu enum 'estado_postulacion' tiene contemplado el valor 'Entrevista IA'
        if (idPostulacion) {
            const { error: errorPostulacion } = await supabase
                .from('postulaciones_labur')
                .update({ 
                    estado_actual: 'Entrevista IA',
                    fecha_actualizacion: new Date().toISOString()
                })
                .eq('id_postulacion', parseInt(idPostulacion));

            if (errorPostulacion) {
                console.warn("La entrevista se creó, pero no se pudo actualizar el estado de la postulación:", errorPostulacion);
            }
        }

        // 3. Éxito y Limpieza
        alert("🚀 ¡Encuesta de Inteligencia Artificial enviada con éxito al postulante!");
        modalIA.classList.add('hidden');

        // Recargar las listas del dashboard para ver reflejado el cambio de estado de fases inmediatamente
        const idEmpleador = localStorage.getItem('id_usuario_labur');
        await cargarVacantesYPostulaciones(idEmpleador);

    } catch (err) {
        console.error("Error al lanzar la entrevista automatizada:", err);
        alert("No se pudo iniciar la entrevista virtual: " + (err.message || err));
    }
}