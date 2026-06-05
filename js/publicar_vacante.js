// C:\Users\arnol\OneDrive\Documents\laburoboli\js\publicar_vacante.js
import { supabase, verificarAccesoPorRol, cerrarSesion } from './supabase-config.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Validar el acceso con el rol de Empleador
    const usuarioLogueado = await verificarAccesoPorRol(['Empleador']);
    if (!usuarioLogueado) return;

    // Obtenemos el ID del empleador logueado
    const idEmpleadorReal = localStorage.getItem('id_usuario_labur');

    configurarComponentesFijos(usuarioLogueado);
    
    // CARGA DINÁMICA: Traer especialidades reales de la base de datos
    await cargarEspecialidadesDinamicas();
    
    configurarLivePreview();
    configurarFormularioEnvio(idEmpleadorReal);
});

function configurarComponentesFijos(usuarioLogueado) {
    const botonLogout = document.getElementById('btn-logout');
    if (botonLogout) {
        botonLogout.addEventListener('click', (e) => {
            e.preventDefault();
            cerrarSesion();
        });
    }

    const nombreUsuarioFooter = document.getElementById('empresa-usuario-nombre');
    if (nombreUsuarioFooter && usuarioLogueado) {
        nombreUsuarioFooter.textContent = usuarioLogueado.nombre_completo || usuarioLogueado.nombre || "Empleador Activo";
    }

    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.style.backgroundColor = '#000000';
}

/**
 * Trae las especialidades reales desde la Base de Datos y llena el Select HTML
 */
async function cargarEspecialidadesDinamicas() {
    const selectCategoria = document.getElementById('input-categoria');
    if (!selectCategoria) return;

    try {
        const { data: especialidades, error } = await supabase
            .from('especialidades_labur')
            .select('id_especialidad, nombre_especialidad, categoria')
            .order('categoria', { ascending: true });

        if (error) throw error;

        // Limpiar mensaje de carga
        selectCategoria.innerHTML = '<option value="">-- Selecciona una Especialidad Real --</option>';

        if (especialidades && especialidades.length > 0) {
            especialidades.forEach(esp => {
                const option = document.createElement('option');
                option.value = esp.id_especialidad; // Guardamos el ID entero real de tu tabla SQL
                option.textContent = `${esp.nombre_especialidad} (${esp.categoria})`;
                selectCategoria.appendChild(option);
            });
        } else {
            selectCategoria.innerHTML = '<option value="">No hay especialidades configuradas en la BD</option>';
        }

    } catch (err) {
        console.error("Error al cargar especialidades de la BD:", err);
        selectCategoria.innerHTML = '<option value="">Error al cargar especialidades</option>';
    }
}

/**
 * Sincroniza en tiempo real los datos del formulario con la tarjeta de previsualización
 */
function configurarLivePreview() {
    const inputTitulo = document.getElementById('input-titulo');
    const inputCategoria = document.getElementById('input-categoria');
    const inputExperiencia = document.getElementById('input-experiencia');
    const inputCiudad = document.getElementById('input-ciudad');
    const inputZona = document.getElementById('input-zona');
    const inputPresupuesto = document.getElementById('input-presupuesto');
    const inputModalidad = document.getElementById('input-modalidad');
    const inputDescripcion = document.getElementById('input-descripcion');
    const inputVacantes = document.getElementById('input-vacantes'); // NUEVO
    const checkboxesBeneficios = document.querySelectorAll('.check-beneficio');

    const txtTitulo = document.getElementById('preview-titulo');
    const txtCategoria = document.getElementById('preview-categoria');
    const txtExperiencia = document.getElementById('preview-experiencia');
    const txtUbicacion = document.getElementById('preview-ubicacion');
    const txtSalario = document.getElementById('preview-salario');
    const txtDescripcion = document.getElementById('preview-descripcion');
    const boxBeneficios = document.getElementById('preview-beneficios-box');
    const tagsBeneficios = document.getElementById('preview-beneficios-tags');

    function actualizarTarjeta() {
        if (txtTitulo) txtTitulo.textContent = inputTitulo.value.trim() || "Título de la Oferta";
        
        if (txtCategoria && inputCategoria) {
            const opcionSeleccionada = inputCategoria.options[inputCategoria.selectedIndex];
            txtCategoria.textContent = opcionSeleccionada && opcionSeleccionada.value !== "" ? opcionSeleccionada.text : "Especialidad no seleccionada";
        }
        
        // Sincroniza años requeridos y opcionalmente añade info visual de puestos vacantes si lo deseas
        const cantVacantes = inputVacantes ? inputVacantes.value || 1 : 1;
        if (txtExperiencia) {
            txtExperiencia.textContent = `${inputExperiencia.value || 0} años requeridos (${cantVacantes} vacantes)`;
        }
        
        const depto = inputCiudad.value.trim() || "Cochabamba";
        const zona = inputZona.value.trim() || "Zona no especificada";
        if (txtUbicacion) txtUbicacion.textContent = `${depto} (${zona})`;

        const salario = inputPresupuesto.value.trim();
        const mod = inputModalidad.value === 'Presential' ? 'Presencial' : inputModalidad.value;
        if (txtSalario) txtSalario.textContent = salario ? `Bs. ${salario} / ${mod}` : `A convenir / ${mod}`;

        if (txtDescripcion) txtDescripcion.textContent = inputDescripcion.value.trim() || "Escribe los detalles a la izquierda para ver la sincronización automatizada...";

        let seleccionados = [];
        checkboxesBeneficios.forEach(box => {
            if (box.checked) seleccionados.push(box.value);
        });

        if (seleccionados.length > 0 && tagsBeneficios && boxBeneficios) {
            boxBeneficios.classList.remove('hidden');
            tagsBeneficios.innerHTML = '';
            seleccionados.forEach(b => {
                tagsBeneficios.insertAdjacentHTML('beforeend', `<span class="bg-sky-50 text-sky-700 text-[10px] px-2 py-0.5 rounded border border-sky-100 font-semibold">${b}</span>`);
            });
        } else if (boxBeneficios) {
            boxBeneficios.classList.add('hidden');
        }
    }

    // Se agrega inputVacantes a los elementos que escuchan eventos en tiempo real
    [inputTitulo, inputExperiencia, inputCiudad, inputZona, inputPresupuesto, inputDescripcion, inputVacantes].forEach(el => {
        if (el) el.addEventListener('input', actualizarTarjeta);
    });
    [inputCategoria, inputModalidad].forEach(el => {
        if (el) el.addEventListener('change', actualizarTarjeta);
    });
    checkboxesBeneficios.forEach(box => {
        box.addEventListener('change', actualizarTarjeta);
    });
}

function configurarFormularioEnvio(idEmpleadorReal) {
    const form = document.getElementById('form-publicar-vacante');
    const btnBorrador = document.getElementById('btn-borrador');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await enviarVacanteReal(idEmpleadorReal, 'Activa');
        });
    }

    if (btnBorrador) {
        btnBorrador.addEventListener('click', async (e) => {
            e.preventDefault();
            await enviarVacanteReal(idEmpleadorReal, 'Borrador'); 
        });
    }
}

/**
 * Envía la información sanitizada y de forma dinámica directamente a Postgres
 */
async function enviarVacanteReal(idEmpleadorReal, estadoInicial) {
    try {
        const idEmpleadorNum = parseInt(idEmpleadorReal);
        if (isNaN(idEmpleadorNum)) {
            alert("Error: ID de empleador no válido en sesión. Por favor, reingresa al sistema.");
            return;
        }

        const tituloPuesto = document.getElementById('input-titulo').value.trim();
        const idEspecialidadString = document.getElementById('input-categoria').value; 
        const inputExpValue = document.getElementById('input-experiencia').value;
        const aniosExperiencia = inputExpValue ? parseInt(inputExpValue) : 0;
        
        const departamento = document.getElementById('input-ciudad').value.trim() || 'Cochabamba';
        const zonaDireccion = document.getElementById('input-zona').value.trim();
        
        const salarioOfrecidoRaw = document.getElementById('input-presupuesto').value.trim();
        const salarioOfrecido = (salarioOfrecidoRaw && !isNaN(parseFloat(salarioOfrecidoRaw))) ? parseFloat(salarioOfrecidoRaw) : null;
        
        const modalidadSeleccionada = document.getElementById('input-modalidad').value; // 'Presential', 'Hibrido', 'Remoto'
        const tipoContratoSeleccionado = document.getElementById('input-contrato').value; // ENUM directo de la BD
        const descripcionCuerpo = document.getElementById('input-descripcion').value.trim();

        // NUEVO: Capturar cantidad de vacantes dinámicas desde el HTML
        const inputVacantesElement = document.getElementById('input-vacantes');
        const numeroVacantes = inputVacantesElement ? parseInt(inputVacantesElement.value) : 1;

        if (!idEspecialidadString) {
            alert("Por favor, selecciona una especialidad válida de la lista.");
            return;
        }

        let listaBeneficios = [];
        document.querySelectorAll('.check-beneficio:checked').forEach(box => {
            listaBeneficios.push(box.value);
        });

        // Determinar el nivel de experiencia de acuerdo al ENUM ('Junior', 'Intermedio', 'Senior', 'Experto')
        let nivelExperiencia = 'Intermedio';
        if (aniosExperiencia <= 1) {
            nivelExperiencia = 'Junior';
        } else if (aniosExperiencia > 1 && aniosExperiencia <= 4) {
            nivelExperiencia = 'Intermedio';
        } else if (aniosExperiencia > 4 && aniosExperiencia <= 8) {
            nivelExperiencia = 'Senior';
        } else if (aniosExperiencia > 8) {
            nivelExperiencia = 'Experto';
        }

        // Inserción directa vinculando IDs reales e inyectando ENUMs exactos
        const { data, error } = await supabase
            .from('vacantes_labur')
            .insert([{
                id_empleador: idEmpleadorNum, 
                titulo_puesto: tituloPuesto,
                id_especialidad: parseInt(idEspecialidadString), 
                tipo_contrato: tipoContratoSeleccionado, 
                descripcion_puesto: descripcionCuerpo,
                
                // DINÁMICO: Guarda el número real insertado por el usuario
                numero_vacantes_disponibles: numeroVacantes, 
                
                nivel_experiencia_requerido: nivelExperiencia, 
                modalidad: modalidadSeleccionada, 
                departamento: departamento,
                ciudad_municipio: 'Cercado', 
                direccion_zona: zonaDireccion || null,
                tipo_compensacion: 'Mensual Fijo', 
                salario_minimo: salarioOfrecido,
                salario_maximo: salarioOfrecido,
                beneficios_adicionales: listaBeneficios.length > 0 ? listaBeneficios.join(', ') : null,
                estado_vacante: estadoInicial, 
                fecha_limite: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            }])
            .select();

        if (error) throw error;

        alert(estadoInicial === 'Activa' ? "¡Éxito! Tu oferta de trabajo ha sido publicada en LaborBolivia." : "Guardado como borrador correctamente.");
        window.location.href = "dashboard_empleador.html";

    } catch (err) {
        console.error("Error completo retornado por Supabase:", err);
        alert(`Ocurrió un error al procesar el registro:\n${err.message || 'Verifica la integridad de los datos.'}`);
    }
}