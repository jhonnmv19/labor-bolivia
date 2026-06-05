import { supabase } from './supabase-config.js';

document.addEventListener('DOMContentLoaded', async () => {
    const contenedorOficios = document.getElementById('contenedor-oficios');
    const form = document.getElementById('form-paso2');
    const inputFiltro = document.getElementById('input-filtro');
    const contadorSeleccion = document.getElementById('contador-seleccion');
    
    let oficiosSeleccionados = [];

    // 1. Descargar especialidades reales directamente desde Supabase
    const { data: especialidades, error } = await supabase
        .from('especialidades_labur')
        .select('id_especialidad, nombre_especialidad, categoria')
        .order('categoria', { ascending: true });

    if (error) {
        console.error("Error cargando especialidades:", error);
        alert("No se pudo conectar con el catálogo de oficios.");
        return;
    }

    // 2. Renderizar dinámicamente las especialidades en el contenedor del HTML
    contenedorOficios.innerHTML = ''; 
    especialidades.forEach(esp => {
        const div = document.createElement('div');
        
        // SOLUCCIÓN AL COLOR NEGRO: Se añade "bg-carbon-900" como fondo base de la tarjeta
        div.className = "item-oficio flex justify-between items-center p-3 bg-carbon-900 border border-carbon-800 rounded-lg cursor-pointer hover:bg-carbon-800 hover:border-carbon-700 transition duration-200 shadow-sm";
        
        div.setAttribute('data-id', esp.id_especialidad);
        div.setAttribute('data-nombre', esp.nombre_especialidad.toLowerCase());
        
        div.innerHTML = `
            <div class="pr-2">
                <p class="text-xs font-semibold text-white leading-tight mb-0.5">${esp.nombre_especialidad}</p>
                <span class="text-[10px] text-tierra-300 font-medium tracking-wide uppercase px-1.5 py-0.5 bg-carbon-950/60 rounded border border-carbon-800">${esp.categoria}</span>
            </div>
            <span class="ticket hidden text-emerald-400 text-sm font-bold bg-emerald-500/10 w-5 h-5 rounded-full flex items-center justify-center border border-emerald-500/20 flex-shrink-0">✓</span>
        `;

        // Lógica de interacción y límite de selección máxima (Mantenida intacta para que todo funcione)
        div.addEventListener('click', () => {
            const id = esp.id_especialidad;
            const ticket = div.querySelector('.ticket');

            if (oficiosSeleccionados.includes(id)) {
                oficiosSeleccionados = oficiosSeleccionados.filter(oficioId => oficioId !== id);
                // Volvemos al estado normal con bg-carbon-900
                div.classList.remove('border-emerald-500', 'bg-carbon-850');
                div.classList.add('border-carbon-800', 'bg-carbon-900');
                ticket.classList.add('hidden');
                // Forzamos el reset de flex porque tu nuevo ticket usa flex-shrink-0
                ticket.classList.remove('flex'); 
            } else {
                if (oficiosSeleccionados.length >= 2) {
                    alert("Solo puedes seleccionar un máximo de 2 especialidades.");
                    return;
                }
                oficiosSeleccionados.push(id);
                div.classList.remove('border-carbon-800', 'bg-carbon-900');
                div.classList.add('border-emerald-500', 'bg-carbon-850');
                ticket.classList.remove('hidden');
                ticket.classList.add('flex'); // Asegura que el check '✓' se centre perfectamente al activarse
            }
            contadorSeleccion.textContent = `Seleccionados: ${oficiosSeleccionados.length} / 2`;
        });

        contenedorOficios.appendChild(div);
    });

    // 3. Filtrado interactivo en tiempo real adaptado a elementos dinámicos
    inputFiltro.addEventListener('input', (e) => {
        const busqueda = e.target.value.toLowerCase().trim();
        const items = contenedorOficios.querySelectorAll('.item-oficio');
        items.forEach(item => {
            const nombre = item.getAttribute('data-nombre');
            item.style.display = nombre.includes(busqueda) ? 'flex' : 'none';
        });
    });

    // 4. Guardado transaccional en LocalStorage
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        if (oficiosSeleccionados.length === 0) {
            alert("Por favor selecciona al menos 1 oficio para continuar.");
            return;
        }

        const datosPaso2 = {
            id_especialidad: parseInt(oficiosSeleccionados[0]),
            id_especialidad_secundaria: oficiosSeleccionados[1] ? parseInt(oficiosSeleccionados[1]) : null,
            anios_experiencia: parseInt(document.getElementById('anios_experiencia').value) || 0,
            pretension_salarial: parseFloat(document.getElementById('pretension_salarial').value) || 0,
            modalidad_preferida: document.getElementById('modalidad_preferida').value,
            disponibilidad_incorporacion: 'Inmediata',
            metodo_contacto_preferido: 'WhatsApp'
        };

        localStorage.setItem('registro_temp_paso2', JSON.stringify(datosPaso2));
        window.location.href = 'registropaso3.html';
    });
});