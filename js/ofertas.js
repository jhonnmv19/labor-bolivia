import { supabase, verificarAccesoPorRol, cerrarSesion } from './supabase-config.js';

// Variable global para almacenar las vacantes recomendadas disponibles
let todasLasRecomendaciones = [];
let datosTrabajadorGlobal = null; // Guardará especialidad y departamento del usuario activo

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Validar seguridad del usuario activo y su rol
    const usuarioValido = await verificarAccesoPorRol(['Trabajador']);
    if (!usuarioValido) return; 

    // Asignar evento al botón de cerrar sesión
    document.getElementById('btn-cerrar-sesion')?.addEventListener('click', cerrarSesion);

    // 2. Cargar la información del perfil en la UI (Sidebar/Header)
    await cargarPerfilUsuario();

    // 3. Ejecutar carga inicial de recomendaciones reales desde Supabase
    await cargarRecomendacionesIA();

    // 4. Inicializar los oyentes de eventos para los filtros del buscador
    inicializarFiltros();
});

/**
 * REQUISITO 1: Carga dinámicamente los datos del usuario en la interfaz
 */
async function cargarPerfilUsuario() {
    try {
        const idUsuarioLocal = localStorage.getItem('id_usuario_labur');
        if (!idUsuarioLocal) return;

        const { data: perfil, error } = await supabase
            .from('usuarios_labur')
            .select('nombre, apellido, departamento, ciudad_municipio')
            .eq('id_usuario', parseInt(idUsuarioLocal))
            .single();

        if (error) throw error;

        // Reemplazar textos planos en la interfaz (asegúrate de tener estos IDs en tu HTML)
        const elNombre = document.getElementById('perfil-nombre');
        const elUbicacion = document.getElementById('perfil-ubicacion');

        if (elNombre) elNombre.textContent = `${perfil.nombre} ${perfil.apellido}`;
        if (elUbicacion) elUbicacion.textContent = `${perfil.ciudad_municipio}, ${perfil.departamento}`;

    } catch (error) {
        console.error("Error al cargar el perfil del usuario:", error.message);
    }
}

/**
 * REQUISITO 2: Cruza datos del trabajador con vacantes_labur disponibles
 */
async function cargarRecomendacionesIA() {
    const contenedor = document.getElementById("contenedor-matches");
    if (!contenedor) return;

    try {
        const idUsuarioLocal = localStorage.getItem('id_usuario_labur');
        if (!idUsuarioLocal) {
            contenedor.innerHTML = `<p class="text-center py-4 text-xs text-red-500">Sesión no encontrada.</p>`;
            return;
        }

        // 1. Obtener la especialidad y el departamento del trabajador actual
        const { data: datosTrabajador, error: errorTrabajador } = await supabase
            .from('perfiles_trabajadores_labur')
            .select(`
                id_especialidad, 
                id_trabajador, 
                usuarios_labur (departamento)
            `)
            .eq('id_trabajador', parseInt(idUsuarioLocal))
            .single();

        if (errorTrabajador || !datosTrabajador) {
            throw new Error("No se pudo obtener el perfil laboral del trabajador.");
        }

        datosTrabajadorGlobal = datosTrabajador; 
        const departamentoTrabajador = datosTrabajador.usuarios_labur?.departamento;

        // 2. Traer las vacantes que hagan MATCH con su especialidad y estén activas
        const { data: vacantes, error: errorVacantes } = await supabase
            .from('vacantes_labur')
            .select(`
                id_vacante,
                id_empleador,
                titulo_puesto,
                descripcion_puesto,
                tipo_contrato,
                nivel_experiencia_requerido,
                modalidad,
                departamento,
                ciudad_municipio,
                salario_minimo,
                salario_maximo,
                estado_vacante,
                perfiles_empleadores_labur (
                    nombre_empresa,
                    sector_industrial,
                    logo_url
                )
            `)
            .eq('id_especialidad', datosTrabajador.id_especialidad)
            .eq('estado_vacante', 'Activa'); // Solo puestos vigentes

        if (errorVacantes) throw errorVacantes;

        // 3. Mapear y calcular el score de compatibilidad dinámicamente en el Frontend
        todasLasRecomendaciones = (vacantes || []).map(vacante => {
            let score = 70; // Base inicial de coincidencia por Especialidad

            // Si coincide exactamente el departamento (ubicación), sumamos compatibilidad
            if (vacante.departamento?.toLowerCase() === departamentoTrabajador?.toLowerCase()) {
                score += 20;
            }
            // Si es remoto o híbrido, añadimos un pequeño empuje de comodidad laboral
            if (vacante.modalidad === 'Remoto' || vacante.modalidad === 'Hibrido') {
                score += 10;
            }

            // Validar que el score no supere el 100%
            if (score > 100) score = 100;

            // Retornamos el objeto estructurado igual a como lo leía tu renderizador antiguo
            return {
                score_compatibilidad_ia: score,
                estado_actual: 'Vigente',
                vacantes_labur: vacante
            };
        });

        // Ordenar de mayor a menor compatibilidad
        todasLasRecomendaciones.sort((a, b) => b.score_compatibilidad_ia - a.score_compatibilidad_ia);

        // Renderizamos las tarjetas dinámicas
        renderizarTarjetas(todasLasRecomendaciones);

    } catch (error) {
        console.error("Error cargando recomendaciones de Match:", error.message);
        contenedor.innerHTML = `<p class="text-center py-4 text-xs text-red-500">Error al procesar las vacantes: ${error.message}</p>`;
    }
}

function renderizarTarjetas(listaMatches) {
    const contenedor = document.getElementById("contenedor-matches");
    if (!contenedor) return;

    contenedor.innerHTML = "";

    if (!listaMatches || listaMatches.length === 0) {
        contenedor.innerHTML = `
            <div class="bg-white rounded-2xl border border-carbon-200 p-8 text-center text-carbon-500 text-xs">
                <i class="fa-solid fa-filter-circle-xmark text-xl mb-2 text-carbon-300 block"></i>
                No se encontraron vacantes activas que coincidan con tu especialidad técnica.
            </div>`;
        return;
    }

    listaMatches.forEach((item, index) => {
        const vacante = item.vacantes_labur;
        if (!vacante) return; 

        const empresa = vacante.perfiles_empleadores_labur?.nombre_empresa || "Empresa Confidencial";
        const score = item.score_compatibilidad_ia || 0;
        
        const strokeOffset = 125.6 - (125.6 * score) / 100;

        // Tonos limpios acordes a tu diseño (cyan / aqua / amber)
        let colorClase = "green"; 
        if (score < 85 && score >= 75) colorClase = "cyan"; // Ajustado a tu paleta aqua/cian
        if (score < 75) colorClase = "amber";

        const tarjetaHTML = `
            <div class="bg-white rounded-2xl border ${score >= 85 ? 'border-tierra-500' : 'border-carbon-200'} shadow-sm p-5 relative cursor-pointer hover:shadow-md transition-shadow tarjeta-match" data-index="${index}">
                <div class="absolute top-4 right-4 flex items-center gap-1.5">
                    <button class="w-7 h-7 rounded-lg bg-carbon-50 border border-carbon-200 flex items-center justify-center hover:bg-tierra-50 hover:border-tierra-200 group transition-colors">
                        <i class="fa-regular fa-bookmark text-carbon-400 group-hover:text-tierra-600 text-xs"></i>
                    </button>
                </div>
                
                <div class="flex items-start gap-3 mb-4">
                    <div class="w-12 h-12 rounded-xl bg-tierra-50 border border-tierra-100 flex items-center justify-center flex-shrink-0">
                        <i class="fa-solid fa-briefcase text-tierra-600 text-lg"></i>
                    </div>
                    <div class="flex-1 min-w-0 pr-8">
                        <h3 class="text-carbon-900 text-sm font-bold truncate mb-0.5">${vacante.titulo_puesto}</h3>
                        <p class="text-carbon-400 text-xs mb-1">${empresa} · ${vacante.departamento || 'Bolivia'}</p>
                        <div class="flex items-center gap-1.5">
                            <i class="fa-solid fa-circle-check text-green-500 text-xs"></i>
                            <span class="text-green-600 text-[11px] font-medium">Verificada por IA</span>
                            <span class="text-carbon-200 text-xs">·</span>
                            <span class="text-carbon-400 text-[11px]">${item.estado_actual}</span>
                        </div>
                    </div>
                </div>

                <div class="flex items-center gap-3 mb-4 bg-carbon-50 border border-carbon-100 rounded-xl px-4 py-3">
                    <div class="relative w-12 h-12 flex-shrink-0">
                        <svg viewBox="0 0 48 48" class="w-full h-full -rotate-90">
                            <circle cx="24" cy="24" r="20" fill="none" stroke="#e5e7eb" stroke-width="5"/>
                            <circle cx="24" cy="24" r="20" fill="none" 
                                stroke="${score >= 85 ? '#16a34a' : '#0eb6c2'}" 
                                stroke-width="5" 
                                stroke-dasharray="125.6" 
                                stroke-dashoffset="${strokeOffset}" 
                                stroke-linecap="round"/>
                        </svg>
                        <div class="absolute inset-0 flex items-center justify-center">
                            <span class="text-carbon-800 text-xs font-black">${score}%</span>
                        </div>
                    </div>
                    <div class="flex-1">
                        <p class="text-carbon-800 text-xs font-bold mb-1">Compatibilidad ${score >= 85 ? 'Alta' : 'Media'}</p>
                        <div class="grid grid-cols-3 gap-1">
                            <div>
                                <p class="text-[10px] text-carbon-500 font-semibold leading-none">Técnico</p>
                                <div class="h-1 bg-carbon-200 rounded-full mt-0.5 overflow-hidden"><div class="h-full bg-green-500 rounded-full" style="width: 100%"></div></div>
                            </div>
                            <div>
                                <p class="text-[10px] text-carbon-500 font-semibold leading-none">Ubicación</p>
                                <div class="h-1 bg-carbon-200 rounded-full mt-0.5 overflow-hidden"><div class="h-full bg-[#0eb6c2]" style="width: ${vacante.departamento === datosTrabajadorGlobal?.usuarios_labur?.departamento ? '100%' : '30%'}"></div></div>
                            </div>
                            <div>
                                <p class="text-[10px] text-carbon-500 font-semibold leading-none">Modalidad</p>
                                <div class="h-1 bg-carbon-200 rounded-full mt-0.5 overflow-hidden"><div class="h-full bg-amber-400 rounded-full" style="width: 85%"></div></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="flex flex-wrap gap-1.5 mb-4">
                    <span class="bg-carbon-50 border border-carbon-200 text-carbon-600 text-xs rounded-full px-2.5 py-0.5 font-medium">${vacante.tipo_contrato || 'Contrato N/A'}</span>
                    <span class="bg-carbon-50 border border-carbon-200 text-carbon-600 text-xs rounded-full px-2.5 py-0.5 font-medium">${vacante.modalidad || 'No especificada'}</span>
                    <span class="bg-carbon-50 border border-carbon-200 text-carbon-600 text-xs rounded-full px-2.5 py-0.5 font-medium">${vacante.departamento}</span>
                </div>

                <div class="flex items-center justify-between border-t border-carbon-100 pt-3">
                    <div>
                        <p class="text-carbon-900 text-base font-black">Bs. ${parseInt(vacante.salario_minimo) || '0'}<span class="text-carbon-400 text-xs font-normal">/mes</span></p>
                    </div>
                    <span class="text-xs text-tierra-600 font-bold flex items-center gap-1">Ver detalles <i class="fa-solid fa-arrow-right text-[10px]"></i></span>
                </div>
            </div>
        `;
        contenedor.insertAdjacentHTML('beforeend', tarjetaHTML);
    });

    // Añadir el detector de clics dinámico a cada tarjeta generada
    document.querySelectorAll('.tarjeta-match').forEach(tarjeta => {
        tarjeta.addEventListener('click', (e) => {
            // Evitar que haga trigger si da clic en el botón de guardar/marcador
            if (e.target.closest('button')) return;
            
            const index = tarjeta.getAttribute('data-index');
            verDetalleCompleto(listaMatches[index]);
        });
    });
}

// Renderiza dinámicamente el bloque lateral derecho con el botón funcional de Postulación
window.verDetalleCompleto = function(item) {
    const panelDetalle = document.getElementById("vista-detalle-vacante");
    if (!panelDetalle) return;

    const vacante = item.vacantes_labur;
    if (!vacante) return;

    const empresa = vacante.perfiles_empleadores_labur?.nombre_empresa || "Empresa Confidencial";
    const sector = vacante.perfiles_empleadores_labur?.sector_industrial || "General";
    const score = item.score_compatibilidad_ia || 0;

    panelDetalle.innerHTML = `
        <div class="flex items-center justify-between border-b border-carbon-200 pb-4">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-tierra-100 flex items-center justify-center">
                    <i class="fa-solid fa-briefcase text-tierra-600 text-sm"></i>
                </div>
                <div>
                    <h3 class="text-carbon-900 font-bold text-sm leading-tight">${vacante.titulo_puesto}</h3>
                    <p class="text-carbon-500 text-xs">${empresa}</p>
                </div>
            </div>
            <span class="bg-tierra-100 text-tierra-800 text-xs font-black px-2.5 py-1 rounded-lg">${score}% Match</span>
        </div>

        <div class="space-y-3 pt-2">
            <h4 class="text-[11px] font-bold text-carbon-700 uppercase tracking-wider">Atributos del Cargo</h4>
            <div class="grid grid-cols-1 gap-2 text-xs">
                <div class="flex justify-between items-center bg-white p-2.5 rounded-xl border border-carbon-200">
                    <span class="text-carbon-600 font-medium"><i class="fa-solid fa-location-dot text-carbon-400 mr-1.5"></i> Ubicación</span>
                    <span class="text-carbon-900 font-bold">${vacante.ciudad_municipio || 'No especificado'}, ${vacante.departamento}</span>
                </div>
                <div class="flex justify-between items-center bg-white p-2.5 rounded-xl border border-carbon-200">
                    <span class="text-carbon-600 font-medium"><i class="fa-solid fa-clock text-carbon-400 mr-1.5"></i> Tipo de Jornada</span>
                    <span class="text-carbon-900 font-bold">${vacante.tipo_contrato || 'N/A'}</span>
                </div>
                <div class="flex justify-between items-center bg-white p-2.5 rounded-xl border border-carbon-200">
                    <span class="text-carbon-600 font-medium"><i class="fa-solid fa-laptop-house text-carbon-400 mr-1.5"></i> Modalidad</span>
                    <span class="text-carbon-900 font-bold">${vacante.modalidad || 'N/A'}</span>
                </div>
                <div class="flex justify-between items-center bg-white p-2.5 rounded-xl border border-carbon-200">
                    <span class="text-carbon-600 font-medium"><i class="fa-solid fa-layer-group text-carbon-400 mr-1.5"></i> Experiencia Mínima</span>
                    <span class="text-carbon-900 font-bold">${vacante.nivel_experiencia_requerido || 'No especificada'}</span>
                </div>
                <div class="flex justify-between items-center bg-white p-2.5 rounded-xl border border-carbon-200">
                    <span class="text-carbon-700 font-medium"><i class="fa-solid fa-circle-nodes text-tierra-500 mr-1.5"></i> Sector Industrial</span>
                    <span class="text-carbon-900 font-bold">${sector}</span>
                </div>
            </div>
        </div>

        <div class="border-t border-carbon-200 pt-4">
            <h4 class="text-[11px] font-bold text-carbon-700 uppercase tracking-wider mb-2">Descripción del Cargo</h4>
            <p class="text-carbon-600 text-xs leading-relaxed whitespace-pre-line">${vacante.descripcion_puesto || 'Sin descripción detallada disponible.'}</p>
        </div>

        <div class="bg-tierra-50 border border-tierra-200 rounded-xl p-4 flex items-center justify-between mt-4">
            <div>
                <span class="text-[10px] uppercase font-bold text-tierra-700">Remuneración Ofrecida</span>
                <p class="text-carbon-900 font-black text-base">Bs. ${parseInt(vacante.salario_minimo) || '0'} - ${parseInt(vacante.salario_maximo) || 'N/A'}</p>
            </div>
            <button id="btn-postular-accion" class="bg-gradient-to-r from-tierra-500 to-tierra-600 hover:from-tierra-600 hover:to-tierra-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-colors">
                Postularme Ahora
            </button>
        </div>
    `;

    // REQUISITO 3: Asignar evento al botón dinámico de postulación
    document.getElementById('btn-postular-accion')?.addEventListener('click', async () => {
        await manejarPostulacion(vacante.id_vacante, vacante.id_empleador, vacante.titulo_puesto, score);
    });
};

/**
 * NUEVA ESTRUCTURA CONTROLADA Y TRANSACCIONAL:
 * Manejo de inserciones controladas (Postulación + Alerta al empleador)
 */
async function manejarPostulacion(idVacante, idEmpleador, tituloPuesto, scoreCalculado) {
    const idUsuarioLocal = localStorage.getItem('id_usuario_labur');
    const btnPostular = document.getElementById('btn-postular-accion');
    
    if (!idUsuarioLocal) return;

    try {
        if (btnPostular) {
            btnPostular.disabled = true;
            btnPostular.textContent = "Procesando...";
        }

        // 1. Ejecutamos la inserción controlada en la base de datos con .select() al final
        const { data, error: errorPostulacion } = await supabase
            .from('postulaciones_labur')
            .insert([
                { 
                    id_vacante: idVacante, 
                    id_trabajador: parseInt(idUsuarioLocal), 
                    estado_actual: 'Enviado', // Coincide con tu ENUM
                    score_compatibilidad_ia: scoreCalculado
                }
            ])
            .select();

        // Si Supabase devuelve un error, detenemos el proceso y evaluamos
        if (errorPostulacion) {
            // El código '23505' es el error de restricción UNIQUE en PostgreSQL
            if (errorPostulacion.code === '23505') {
                alert("💡 Ya te has postulado a este empleo anteriormente. Puedes revisar el estado de tu postulación en tu panel.");
                console.warn("Postulación duplicada evitada para la vacante ID:", idVacante);
            } else {
                // Cualquier otro error de base de datos
                throw errorPostulacion;
            }
            return;
        }

        // 2. Solo si la postulación fue exitosa, procedemos a insertar la notificación para el empleador
        const { error: errorNotificacion } = await supabase
            .from('alertas_notificaciones_labur')
            .insert([
                {
                    id_usuario: idEmpleador, 
                    titulo: '¡Nueva postulación recibida!',
                    mensaje: `Un trabajador con ${scoreCalculado}% de compatibilidad ha postulado a tu vacante de "${tituloPuesto}". Revisa su perfil técnico.`,
                    tipo_evento: 'Postulacion',
                    leido: false
                }
            ]);

        if (errorNotificacion) throw errorNotificacion;

        // Éxito completo en el flujo transaccional
        alert("¡Postulación enviada con éxito! Tu perfil ha sido enviado y el empleador fue notificado.");
        
        if (btnPostular) {
            btnPostular.className = "bg-green-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm cursor-not-allowed";
            btnPostular.textContent = "¡Ya Postulado!";
        }

        // Opcional: Recargar las recomendaciones de la vista principal si es necesario
        if (typeof cargarRecomendacionesIA === 'function') {
            await cargarRecomendacionesIA();
        }

    } catch (error) {
        console.error("Error crítico en el flujo de postulación:", error);
        alert("Hubo un inconveniente al procesar tu postulación: " + error.message);
    } finally {
        if (btnPostular && btnPostular.textContent !== "¡Ya Postulado!") {
            btnPostular.disabled = false;
            btnPostular.textContent = "Postularme Ahora";
        }
    }
}

// Resto de tus funciones de filtrado se quedan exactamente igual...
function inicializarFiltros() {
    const btnAplicar = document.getElementById('btn-aplicar-filtros');
    const btnLimpiar = document.getElementById('btn-limpiar-filtros');

    btnAplicar?.addEventListener('click', aplicarFiltrosLogicos);

    btnLimpiar?.addEventListener('click', () => {
        document.getElementById('filtro-buscar').value = "";
        document.getElementById('filtro-ubicacion').value = "TODOS";
        document.getElementById('filtro-compatibilidad').value = "0";
        document.getElementById('filtro-sector').value = "TODOS";
        document.getElementById('filtro-salario-min').value = "";
        document.getElementById('filtro-salario-max').value = "";
        
        document.querySelectorAll('#grupo-tipo-trabajo input[type="checkbox"]').forEach(cb => cb.checked = false);
        document.querySelectorAll('#grupo-modalidad input[type="checkbox"]').forEach(cb => cb.checked = false);

        renderizarTarjetas(todasLasRecomendaciones);
    });
}

function aplicarFiltrosLogicos() {
    const textoBuscar = document.getElementById('filtro-buscar').value.toLowerCase().trim();
    const ubicacionSel = document.getElementById('filtro-ubicacion').value;
    const compatibilidadMin = parseInt(document.getElementById('filtro-compatibilidad').value || 0);
    const sectorSel = document.getElementById('filtro-sector').value;
    const salarioMin = parseFloat(document.getElementById('filtro-salario-min').value) || 0;
    const salarioMax = parseFloat(document.getElementById('filtro-salario-max').value) || Infinity;

    const tiposSeleccionados = Array.from(document.querySelectorAll('#grupo-tipo-trabajo input[type="checkbox"]:checked'))
                                    .map(cb => cb.value);

    const modalidadesSeleccionadas = Array.from(document.querySelectorAll('#grupo-modalidad input[type="checkbox"]:checked'))
                                          .map(cb => cb.value);

    const resultadosFiltrados = todasLasRecomendaciones.filter(item => {
        const vacante = item.vacantes_labur;
        if (!vacante) return false;

        const empresa = (vacante.perfiles_empleadores_labur?.nombre_empresa || "").toLowerCase();
        const puesto = (vacante.titulo_puesto || "").toLowerCase();
        const score = item.score_compatibilidad_ia || 0;
        const sectorIndustrial = vacante.perfiles_empleadores_labur?.sector_industrial || "General";

        if (textoBuscar && !puesto.includes(textoBuscar) && !empresa.includes(textoBuscar)) return false;
        if (ubicacionSel !== "TODOS" && vacante.departamento !== ubicacionSel) return false;
        if (score < compatibilidadMin) return false;
        if (sectorSel !== "TODOS" && sectorIndustrial !== sectorSel) return false;
        if (tiposSeleccionados.length > 0 && !tiposSeleccionados.includes(vacante.tipo_contrato)) return false;
        if (modalidadesSeleccionadas.length > 0 && !modalidadesSeleccionadas.includes(vacante.modalidad)) return false;

        const vMin = parseFloat(vacante.salario_minimo) || 0;
        if (vMin < salarioMin) return false;
        if (salarioMax !== Infinity && vMin > salarioMax) return false;

        return true;
    });

    renderizarTarjetas(resultadosFiltrados);
}