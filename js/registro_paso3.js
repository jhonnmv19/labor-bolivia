import { supabase, redirigirPorRol } from './supabase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-paso3');
    const btnIniciarEntrevista = document.getElementById('btn-iniciar-entrevista');
    const boxEntrevistaIa = document.getElementById('box-entrevista-ia');
    const preguntaIaTexto = document.getElementById('pregunta-ia-texto');
    const respuestaIaUsuario = document.getElementById('respuesta-ia-usuario');
    const statusBox = document.getElementById('status-box');
    const btnFinalizar = document.getElementById('btn-finalizar');

    const paso1 = JSON.parse(localStorage.getItem('registro_temp_paso1'));
    const paso2 = JSON.parse(localStorage.getItem('registro_temp_paso2'));

    // Si es Empleador, ocultamos visualmente la sección de entrevista de inmediato
    if (paso1 && paso1.role === 'Empleador') {
        if(boxEntrevistaIa) boxEntrevistaIa.classList.add('hidden');
        if(btnIniciarEntrevista) btnIniciarEntrevista.classList.add('hidden');
    }

    // 1. Activar Simulador Dinámico consultando metadatos reales
    if (btnIniciarEntrevista) {
        btnIniciarEntrevista.addEventListener('click', async () => {
            if (!paso2 || !paso2.id_especialidad) {
                alert("No se detectó ninguna profesión del paso anterior.");
                return;
            }

            btnIniciarEntrevista.disabled = true;
            btnIniciarEntrevista.textContent = "Consultando especialidad...";

            // Buscamos el nombre de la especialidad real guardada para armar la pregunta
            const { data: especialidad, error } = await supabase
                .from('especialidades_labur')
                .select('nombre_especialidad')
                .eq('id_especialidad', paso2.id_especialidad)
                .single();

            if (error || !especialidad) {
                alert("Error al mapear la especialidad con la base de datos.");
                btnIniciarEntrevista.disabled = false;
                btnIniciarEntrevista.textContent = "🔒 Reintentar Activación";
                return;
            }

            boxEntrevistaIa.classList.remove('hidden');
            btnIniciarEntrevista.className = "bg-carbon-900 text-carbon-400 border border-emerald-500 p-3 rounded w-full cursor-not-allowed";
            btnIniciarEntrevista.textContent = "⚙️ Simulador Evaluador Activado con Éxito";

            // Creamos una pregunta altamente técnica y contextualizada dinámicamente
            preguntaIaTexto.textContent = `Como especialista en el área de "${especialidad.nombre_especialidad}", describa detalladamente un procedimiento técnico avanzado que usted domine, los estándares de seguridad que implementa críticamente y las herramientas específicas que utiliza para certificar la excelencia en el desarrollo del trabajo.`;
        });
    }

    // 2. Transacción e Inserción Unificada a PostgreSQL
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!paso1) {
            alert("Estructura base de datos corrupta. Reinicia el registro.");
            window.location.href = 'registropaso1.html';
            return;
        }

        // Si es trabajador, exigir por código la validación del simulador de entrevista
        if (paso1.rol === 'Trabajador') {
            if (boxEntrevistaIa.classList.contains('hidden') || respuestaIaUsuario.value.trim().length < 15) {
                alert("Es un requisito obligatorio completar la entrevista técnica para validar tus habilidades profesionales.");
                return;
            }
        }

        btnFinalizar.disabled = true;
        btnFinalizar.textContent = "Procesando credenciales de acceso...";

        try {
            // Paso A: Crear el registro maestro en usuarios_labur
            const { data: userRecord, error: dbError } = await supabase
                .from('usuarios_labur')
                .insert([{
                    nombre: paso1.nombre,
                    apellido: paso1.apellido,
                    correo_electronico: paso1.correo_electronico,
                    contrasenia_hash: paso1.contrasenia, 
                    telefono_whatsapp: paso1.telefono_whatsapp,
                    ci_documento: paso1.ci_documento,
                    departamento: paso1.departamento,
                    ciudad_municipio: paso1.ciudad_municipio,
                    rol: paso1.rol,
                    estado: 'Pendiente'
                }])
                .select('id_usuario')
                .single();

            if (dbError) throw dbError;

            // Paso B: Dependiendo del rol, inyectamos en las tablas relacionales correspondientes
            if (paso1.rol === 'Trabajador') {
                const { error: profileError } = await supabase
                    .from('perfiles_trabajadores_labur')
                    .insert([{
                        id_trabajador: userRecord.id_usuario, 
                        id_especialidad: paso2.id_especialidad,
                        anios_experiencia: paso2.anios_experiencia,
                        pretension_salarial: paso2.pretension_salarial,
                        modalidad_preferida: paso2.modalidad_preferida,
                        disponibilidad_incorporacion: paso2.disponibilidad_incorporacion,
                        metodo_contacto_preferido: paso2.metodo_contacto_preferido
                    }]);

                if (profileError) throw profileError;

                // Guardar la entrevista del trabajador de manera automática
                await supabase.from('entrevistas_ia_labur').insert([{
                    id_trabajador: userRecord.id_usuario,
                    cantidad_preguntas: 1,
                    analisis_ia_resumen: respuestaIaUsuario.value.trim(),
                    score_desempenio_tecnico: Math.floor(Math.random() * (100 - 70 + 1)) + 70 // Puntuación inicial temporal simulación
                }]);

            } else if (paso1.rol === 'Empleador') {
                // Registrar datos base obligatorios en la tabla relacional de Empleadores
                const { error: empError } = await supabase
                    .from('perfiles_empleadores_labur')
                    .insert([{
                        id_empleador: userRecord.id_usuario,
                        nombre_empresa: `Empresa de ${paso1.nombre}`,
                        sector_industrial: 'Pendiente de Configuración'
                    }]);

                if (empError) throw empError;
            }

            // Guardar credenciales de sesión local
            localStorage.setItem('id_usuario_labur', userRecord.id_usuario);

            statusBox.className = "p-3 rounded-lg text-xs bg-emerald-950/60 text-emerald-400 border border-emerald-800 block";
            statusBox.textContent = "✓ ¡Registro exitoso! Tus credenciales se han validado. Redirigiendo a tu panel de control...";

            localStorage.removeItem('registro_temp_paso1');
            localStorage.removeItem('registro_temp_paso2');

            setTimeout(() => {
                redirigirPorRol(paso1.rol);
            }, 2000);

        } catch (err) {
            console.error("Error detallado en la transacción:", err);
            statusBox.className = "p-3 rounded-lg text-xs bg-red-950/60 text-red-400 border border-red-800 block";
            statusBox.textContent = `Error crítico de consistencia: ${err.message || err.details}`;
            btnFinalizar.disabled = false;
            btnFinalizar.textContent = "Finalizar Registro Completo";
        }
    });
});