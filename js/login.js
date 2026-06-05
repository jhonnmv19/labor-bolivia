import { supabase, redirigirPorRol } from './supabase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const btnSubmit = loginForm.querySelector('button[type="submit"]');

            btnSubmit.disabled = true;
            btnSubmit.innerText = "Verificando credenciales...";

            try {
                // Realizamos la consulta a tu tabla intacta
                const { data: usuario, error: errorUser } = await supabase
                    .from('usuarios_labur')
                    .select('id_usuario, rol, estado')
                    .eq('correo_electronico', email)
                    .eq('contrasenia_hash', password)
                    .maybeSingle(); // maybeSingle evita errores si no encuentra nada

                if (errorUser) {
                    // Si el RLS sigue bloqueando, aquí nos dirá exactamente el por qué
                    throw new Error(`Error de base de datos: ${errorUser.message} (Código: ${errorUser.code})`);
                }

                if (!usuario) {
                    throw new Error("El correo electrónico o la contraseña son incorrectos.");
                }

                if (usuario.estado === 'Suspendido') {
                    alert("Esta cuenta está suspendida por infringir normas de moderación.");
                    btnSubmit.disabled = false;
                    btnSubmit.innerText = "Ingresar";
                    return;
                }

                // Actualizar último login (Auditoría)
                await supabase
                    .from('usuarios_labur')
                    .update({ ultimo_login: new Date().toISOString() })
                    .eq('id_usuario', usuario.id_usuario);

                // Guardar sesión en el navegador
                localStorage.setItem('id_usuario_labur', usuario.id_usuario);

                // Redirección automática según su rol
                redirigirPorRol(usuario.rol);

            } catch (error) {
                alert(`${error.message}`);
                btnSubmit.disabled = false;
                btnSubmit.innerText = "Ingresar";
            }
        });
    }
});