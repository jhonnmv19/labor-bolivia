document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-paso1');
    const passwordInput = document.getElementById('contrasenia');
    const togglePasswordBtn = document.getElementById('btn-toggle-password');
    const strengthBar = document.getElementById('password-strength-bar');
    const feedbackText = document.getElementById('password-feedback');
    const btnSiguiente = document.getElementById('btn-siguiente');

    let isPasswordValid = false;

    togglePasswordBtn.addEventListener('click', () => {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        togglePasswordBtn.textContent = isPassword ? 'Ocultar' : 'Ver';
    });

    passwordInput.addEventListener('input', () => {
        const value = passwordInput.value;
        let score = 0;
        let suggestions = [];

        if (value.length >= 8) score++;
        else suggestions.push("Mínimo 8 caracteres.");
        if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
        if (/\d/.test(value)) score++;
        if (/[@$!%*?&]/.test(value)) score++;

        if (value.length === 0) {
            strengthBar.style.width = '0%';
            feedbackText.textContent = "Ingresa tu contraseña.";
            feedbackText.className = "text-xs text-carbon-400";
            isPasswordValid = false;
        } else if (score <= 2) {
            strengthBar.style.width = '33%';
            strengthBar.className = "h-full bg-red-500 transition-all";
            feedbackText.textContent = "Contraseña débil. " + (suggestions[0] || "");
            feedbackText.className = "text-xs text-red-400";
            isPasswordValid = false;
        } else if (score === 3) {
            strengthBar.style.width = '66%';
            strengthBar.className = "h-full bg-amber-500 transition-all";
            feedbackText.textContent = "Contraseña aceptable.";
            feedbackText.className = "text-xs text-amber-400";
            isPasswordValid = true;
        } else if (score === 4) {
            strengthBar.style.width = '100%';
            strengthBar.className = "h-full bg-emerald-500 transition-all";
            feedbackText.textContent = "¡Contraseña fuerte y segura!";
            feedbackText.className = "text-xs text-emerald-400";
            isPasswordValid = true;
        }

        btnSiguiente.disabled = !isPasswordValid;
        btnSiguiente.className = isPasswordValid 
            ? "bg-tierra-500 text-white font-semibold text-sm px-6 py-2 rounded-lg shadow-lg hover:bg-tierra-600 transition"
            : "bg-carbon-700 text-carbon-400 font-semibold text-sm px-6 py-2 rounded-lg cursor-not-allowed transition";
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const datosPaso1 = {
            rol: document.querySelector('input[name="rol"]:checked').value,
            nombre: document.getElementById('nombre').value.trim(),
            apellido: document.getElementById('apellido').value.trim(),
            correo_electronico: document.getElementById('correo').value.trim(),
            telefono_whatsapp: document.getElementById('whatsapp').value.trim(),
            ci_documento: document.getElementById('ci_documento').value.trim(),
            departamento: document.getElementById('departamento').value,
            ciudad_municipio: document.getElementById('ciudad_municipio').value.trim(),
            contrasenia: passwordInput.value
        };

        localStorage.setItem('registro_temp_paso1', JSON.stringify(datosPaso1));
        
        // CORRECCIÓN SENSATA: Si es Empleador, se salta los cuestionarios de oficios de forma directa
        if (datosPaso1.rol === 'Empleador') {
            window.location.href = 'registropaso3.html';
        } else {
            window.location.href = 'registropaso2.html';
        }
    });
});