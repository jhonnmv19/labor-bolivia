import { supabase } from './supabase-config.js';

/**
 * Función encargada de lanzar el asistente de evaluación automática de IA 
 * desde el perfil o panel del empleador.
 * * @param {number|string} idTrabajador - Identificador único del trabajador a notificar
 * @param {number} cantidad - Número de preguntas configuradas para el cuestionario
 * @param {number} idVacante - ID de la vacante asociada para asociar la alerta directamente
 */
export async function lanzarEntrevistaAutomatizada(idTrabajador, cantidad, idVacante) {
    try {
        console.log(`Iniciando lanzamiento de entrevista para el usuario ${idTrabajador} en la vacante ${idVacante}`);

        // 1. Aquí va tu lógica base (Por ejemplo: cambiar el estado de la postulación inicial o crear registro de control)
        const { data: registroEntrevista, error: errorUpdate } = await supabase
            .from('postulaciones_labur')
            .update({ 
                estado_actual: 'Entrevista Pendiente',
                fecha_actualizacion: new Date().toISOString()
            })
            .eq('id_trabajador', parseInt(idTrabajador))
            .eq('id_vacante', parseInt(idVacante))
            .select();

        if (errorUpdate) throw errorUpdate;


        // =========================================================================
        // PASO 2.5: INSERTAR ALERTA EN LA BANDEJA DE NOTIFICACIONES EN TIEMPO REAL
        // =========================================================================
        const { error: errorAlerta } = await supabase
            .from('alertas_notificaciones_labur')
            .insert([{
                id_usuario: parseInt(idTrabajador), 
                titulo: '🎯 Nueva Entrevista IA Programada',
                mensaje: `Un empleador ha solicitado una entrevista virtual de ${cantidad} preguntas para la vacante a la que postulaste. ¡Ingresa a resolverla!`,
                tipo_evento: 'Entrevista', // Ajustado a 'Entrevista' para activar los listeners del Frontend
                id_vacante: parseInt(idVacante), // Enlazamos la vacante para que el modal sepa qué responder
                leido: false
            }]);

        if (errorAlerta) {
            console.error("Error secundario al generar notificación física en la tabla:", errorAlerta);
        } else {
            console.log("Notificación insertada con éxito para la bandeja del trabajador.");
        }
        // =========================================================================


        // 3. Acciones de interfaz del Administrador/Empleador
        alert("¡Asistente de entrevista activado! El trabajador recibirá la notificación en su buzón de entrada de forma inmediata.");
        
        // Si tienes funciones para recargar tablas en tu panel administrador, las ejecutas aquí:
        // if (typeof actualizarTablaPostulantes === 'function') actualizarTablaPostulantes();

    } catch (error) {
        console.error("Error crítico al procesar el lanzamiento de entrevista:", error.message);
        alert("No se pudo programar la entrevista: " + error.message);
    }
}