import { verificarAccesoPorRol, cerrarSesion, supabase } from './supabase-config.js';

// Guardamos en variables globales los datos de control
let idAdminActual = null;
let usuariosLocales = []; // Almacén en memoria para el buscador dinámico

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Validar accesos reales mapeando la sesión
    const adminLogueado = await verificarAccesoPorRol(['Administrador']);
    
    if (!adminLogueado) return;

    // Guardar ID y datos del administrador en sesión
    idAdminActual = adminLogueado.id_usuario; 
    const nombreAdmin = adminLogueado.nombre || "Usuario";
    const apellidoAdmin = adminLogueado.apellido || "Administrador";
    const nombreCompleto = `${nombreAdmin} ${apellidoAdmin}`;
    const rolAdmin = adminLogueado.rol || "Administrador";

    // Insertar datos dinámicos en el HTML
    document.querySelectorAll('.admin-nombre-texto').forEach(el => el.innerText = nombreCompleto);
    document.querySelectorAll('.top-admin-nombre').forEach(el => el.innerText = nombreCompleto);
    document.querySelectorAll('.admin-rol-texto').forEach(el => el.innerText = rolAdmin);
    
    const avatar = document.getElementById('avatar-iniciales');
    if (avatar) {
        avatar.innerText = nombreAdmin.substring(0, 2).toUpperCase();
    }

    // 2. Ejecutar la lectura de Supabase y configurar los componentes
    await cargarDatosDashboard();
    inicializarComponentesInteractivos();
});

/**
 * Trae los registros reales analizando y excluyendo la cuenta del admin en sesión
 */
async function cargarDatosDashboard() {
    try {
        const filtroEstadoEl = document.getElementById('filtro-estado-usuarios');
        const filtroEstado = filtroEstadoEl ? filtroEstadoEl.value : 'Todos';

        // Traer de manera explícita el teléfono de WhatsApp requerido
        let query = supabase
            .from('usuarios_labur')
            .select('id_usuario, nombre, apellido, correo_electronico, telefono_whatsapp, rol, estado');

        if (filtroEstado !== 'Todos') {
            query = query.eq('estado', filtroEstado);
        }

        const { data: usuarios, error } = await query;
        if (error) throw error;

        // Filtrar para EXCLUIR de la lista al administrador logueado actualmente
        usuariosLocales = usuarios.filter(u => u.id_usuario !== idAdminActual);

        // Calcular e inyectar contadores globales en la interfaz
        renderizarContadores(usuariosLocales);

        // Pintar las filas en la tabla basándonos en los datos descargados
        renderizarTablaUsuarios(usuariosLocales);

        // Cargar logs de auditoría en la barra lateral
        await cargarLogsAccesos();

    } catch (err) {
        console.error("Error cargando panel:", err.message);
    }
}

/**
 * Procesa la renderización de la tabla HTML basada en un Array de usuarios
 */
function renderizarTablaUsuarios(lista) {
    const tbody = document.getElementById('tabla-usuarios-body');
    if (!tbody) return; // Protección si la tabla no existe en la vista actual

    tbody.innerHTML = '';

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-4 text-center text-slate-400 text-sm">No se encontraron registros coincidentes.</td></tr>`;
        return;
    }

    lista.forEach(user => {
        const tr = document.createElement('tr');
        tr.className = 'user-row font-medium border-b border-slate-100';

        let badgeStyle = 'bg-slate-100 text-slate-700';
        if (user.estado === 'Activo') badgeStyle = 'bg-green-100 text-green-700';
        if (user.estado === 'Pendiente') badgeStyle = 'bg-amber-100 text-amber-700';
        if (user.estado === 'Suspendido') badgeStyle = 'bg-red-100 text-red-700';

        const uNombre = user.nombre || "Sin";
        const uApellido = user.apellido || "Nombre";
        const uTelefono = user.telefono_whatsapp || "";

        // Estructura de columnas corregida: Teléfono en contacto y Email independiente
        tr.innerHTML = `
            <td class="py-3.5 font-mono text-xs text-slate-400">#${user.id_usuario}</td>
            <td class="py-3.5 text-slate-900 font-semibold text-sm">${uNombre} ${uApellido}</td>
            <td class="py-3.5 text-slate-600 font-medium text-xs">
                <a href="https://wa.me/${uTelefono.replace(/[^0-9]/g, '')}" target="_blank" class="hover:underline text-emerald-600">
                    <i class="fa-brands fa-whatsapp mr-1"></i>${uTelefono || 'Sin número'}
                </a>
            </td>
            <td class="py-3.5 text-slate-500 text-xs">${user.correo_electronico}</td>
            <td class="py-3.5 text-slate-600 text-xs">${user.rol}</td>
            <td class="py-3.5">
                <span class="px-2.5 py-1 rounded-full text-xs font-bold ${badgeStyle}">${user.estado}</span>
            </td>
            <td class="py-3.5 text-right">
                <select data-id="${user.id_usuario}" class="select-cambiar-estado border border-slate-200 rounded-lg p-1 text-xs bg-white outline-none cursor-pointer">
                    <option value="" disabled selected>Cambiar...</option>
                    <option value="Activo">Activo</option>
                    <option value="Pendiente">Pendiente</option>
                    <option value="Suspendido">Suspendido</option>
                </select>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Vincular selectores dinámicos para el cambio de estado inmediato
    vincularEventosEstado();
}

/**
 * Listener dinámico para los eventos de cambio de estado en la tabla
 */
function vincularEventosEstado() {
    document.querySelectorAll('.select-cambiar-estado').forEach(select => {
        select.addEventListener('change', async (e) => {
            const idTarget = e.target.getAttribute('data-id');
            const nuevoEstado = e.target.value;
            if (confirm(`¿Confirmas cambiar el estado del usuario #${idTarget} a ${nuevoEstado}?`)) {
                const { error: errUpdate } = await supabase
                    .from('usuarios_labur')
                    .update({ estado: nuevoEstado })
                    .eq('id_usuario', idTarget);
                
                if (!errUpdate) {
                    alert('Estado actualizado con éxito.');
                    await cargarDatosDashboard();
                } else {
                    alert('Error al actualizar: ' + errUpdate.message);
                }
            }
        });
    });
}

/**
 * Carga e inyecta los logs en el panel lateral de auditoría
 */
async function cargarLogsAccesos() {
    const containerLogs = document.getElementById('lista-logs-ip');
    if (!containerLogs) return; // Si no hay panel lateral de logs, salimos limpiamente

    const { data: logs, error: errLogs } = await supabase
        .from('registros_accesos_labur')
        .select('direccion_ip, fecha_acceso, dispositivo_info')
        .order('fecha_acceso', { ascending: false })
        .limit(4);

    if (!errLogs && logs) {
        containerLogs.innerHTML = '';
        logs.forEach(log => {
            const div = document.createElement('div');
            div.className = 'p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5';
            div.innerHTML = `
                <div class="flex justify-between font-semibold text-slate-700">
                    <span class="text-xs">IP: ${log.direccion_ip}</span>
                    <span class="text-xxs text-slate-400">${new Date(log.fecha_acceso).toLocaleTimeString()}</span>
                </div>
                <p class="text-slate-400 text-xxs truncate">${log.dispositivo_info || 'Dispositivo Desconocido'}</p>
            `;
            containerLogs.appendChild(div);
        });
    }
}

/**
 * Actualiza los elementos numéricos del KPI usando verificaciones seguras
 */
function renderizarContadores(lista) {
    if (document.getElementById('kpi-total')) {
        document.getElementById('kpi-total').innerText = lista.length;
        document.getElementById('kpi-trabajadores').innerText = lista.filter(u => u.rol === 'Trabajador').length;
        document.getElementById('kpi-empleadores').innerText = lista.filter(u => u.rol === 'Empleador').length;
        document.getElementById('kpi-verificaciones').innerText = lista.filter(u => u.estado === 'Pendiente').length;
    }
    
    const badgeLateral = document.getElementById('badge-verificaciones-lateral');
    if (badgeLateral) {
        badgeLateral.innerText = lista.filter(u => u.estado === 'Pendiente').length;
    }
}

/**
 * Controladores visuales de modales y busquedas (Versión Ultra-Segura)
 */
function inicializarComponentesInteractivos() {
    // 1. Filtro de estado
    const filtroEstado = document.getElementById('filtro-estado-usuarios');
    if (filtroEstado) {
        filtroEstado.addEventListener('change', cargarDatosDashboard);
    }

    // 2. Buscador dinámico
    const inputBuscar = document.getElementById('input-buscador-usuarios');
    if (inputBuscar) {
        inputBuscar.addEventListener('input', (e) => {
            const termino = e.target.value.toLowerCase().trim();
            
            if (termino === "") {
                renderizarTablaUsuarios(usuariosLocales);
                return;
            }

            const resultadosFiltrados = usuariosLocales.filter(user => {
                const idMatch = user.id_usuario.toString().includes(termino);
                const nombreMatch = (user.nombre || "").toLowerCase().includes(termino);
                const apellidoMatch = (user.apellido || "").toLowerCase().includes(termino);
                const telefonoMatch = (user.telefono_whatsapp || "").toLowerCase().includes(termino);
                
                return idMatch || nombreMatch || apellidoMatch || telefonoMatch;
            });

            renderizarTablaUsuarios(resultadosFiltrados);
        });
    }

    // 3. Formulario de Nuevo Administrador (Mostrar / Ocultar)
    const paneAdmin = document.getElementById('pane-nuevo-admin');
    const btnAbrirAdmin = document.getElementById('btn-abrir-nuevo-admin');
    const btnCerrarAdmin = document.getElementById('btn-cerrar-form-admin');

    if (btnAbrirAdmin && paneAdmin) {
        btnAbrirAdmin.addEventListener('click', () => paneAdmin.style.display = 'block');
    }
    if (btnCerrarAdmin && paneAdmin) {
        btnCerrarAdmin.addEventListener('click', () => paneAdmin.style.display = 'none');
    }

    // 4. Evento de Envío del Formulario Admin
    const formNuevoAdmin = document.getElementById('form-nuevo-admin');
    if (formNuevoAdmin && paneAdmin) {
        formNuevoAdmin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nuevoAdmin = {
                nombre: document.getElementById('adm-nombre').value,
                apellido: document.getElementById('adm-apellido').value,
                correo_electronico: document.getElementById('adm-correo').value,
                contrasenia_hash: document.getElementById('adm-pass').value,
                telefono_whatsapp: document.getElementById('adm-phone').value,
                ci_documento: document.getElementById('adm-ci').value,
                departamento: 'Santa Cruz',
                ciudad_municipio: 'Santa Cruz de la Sierra',
                rol: 'Administrador',
                estado: 'Activo'
            };

            const { error } = await supabase.from('usuarios_labur').insert([nuevoAdmin]);
            if (!error) {
                alert('¡Nuevo Administrador registrado exitosamente!');
                formNuevoAdmin.reset();
                paneAdmin.style.display = 'none';
                await cargarDatosDashboard();
            } else {
                alert('Error al registrar administrador: ' + error.message);
            }
        });
    }

    // 5. Control del Modal de Suspensión por IP
    const modalIp = document.getElementById('modal-suspender-ip');
    const btnModalIp = document.getElementById('btn-modal-ip');
    const btnCancelarIp = document.getElementById('btn-cancelar-ip');
    const btnGuardarIp = document.getElementById('btn-guardar-ip');

    if (btnModalIp && modalIp) {
        btnModalIp.addEventListener('click', () => modalIp.style.display = 'flex');
    }
    if (btnCancelarIp && modalIp) {
        btnCancelarIp.addEventListener('click', () => modalIp.style.display = 'none');
    }

    if (btnGuardarIp && modalIp) {
        btnGuardarIp.addEventListener('click', async () => {
            const ip = document.getElementById('ip-sospechosa').value;
            const motivo = document.getElementById('ip-motivo').value;

            if (!ip || !motivo) {
                alert('Por favor rellene todos los campos.');
                return;
            }

            const { error } = await supabase.from('incidentes_moderacion_labur').insert([{
                tipo_anomalia: 'Bloqueo Manual de IP',
                prioridad: 'Alta',
                descripcion: motivo,
                direccion_ip_sospechosa: ip,
                estado_resolucion: 'Bloqueado'
            }]);

            if (!error) {
                alert(`La dirección IP [${ip}] ha sido registrada e inyectada en la lista de restricciones de manera correcta.`);
                modalIp.style.display = 'none';
                document.getElementById('ip-sospechosa').value = '';
                document.getElementById('ip-motivo').value = '';
            } else {
                alert('Error al registrar bloqueo: ' + error.message);
            }
        });
    }

    // 6. Logout
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            if (confirm('¿Cerrar sesión de la cuenta administrativa actual?')) cerrarSesion();
        });
    }
}