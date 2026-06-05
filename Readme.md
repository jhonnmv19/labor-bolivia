# LaborBolivia

## Plataforma Inteligente de Intermediación Laboral para Oficios Técnicos

### Descripción General

LaborBolivia es una plataforma web desarrollada para facilitar la conexión entre trabajadores técnicos y empleadores mediante un sistema de emparejamiento inteligente basado en competencias, evidencias verificadas y nivel de completitud del perfil profesional.

La plataforma busca modernizar los procesos tradicionales de contratación en Bolivia, reemplazando mecanismos informales como anuncios físicos, referencias personales o clasificados impresos por una solución digital centralizada que permita validar habilidades reales y generar oportunidades laborales más eficientes.

Inicialmente el sistema está orientado a trabajadores de los sectores de:

* Electricidad
* Carpintería

Sin embargo, la arquitectura fue diseñada para permitir la incorporación de nuevas especialidades técnicas en futuras versiones.

---

# 🎯 Objetivo del Proyecto

Diseñar e implementar una plataforma web capaz de:

* Reducir las barreras de acceso al empleo técnico.
* Facilitar la validación de competencias laborales.
* Incrementar la visibilidad de trabajadores sin experiencia formal.
* Automatizar procesos de reclutamiento.
* Generar coincidencias inteligentes entre vacantes y candidatos.

---

# 🏗 Arquitectura General

La solución adopta una arquitectura desacoplada basada en servicios administrados (Backend as a Service).

┌─────────────────────┐
│ Frontend Web │
│ HTML + JS + Tailwind│
└──────────┬──────────┘
│
▼
┌─────────────────────┐
│ Supabase │
│ Auth │
│ PostgreSQL │
│ Storage │
└──────────┬──────────┘
│
▼
┌─────────────────────┐
│ Gestión de Usuarios │
│ Match Laboral │
│ Validaciones │
│ Postulaciones │
└─────────────────────┘

Esta arquitectura permite reducir costos de infraestructura, acelerar el desarrollo y mantener una alta escalabilidad para futuras ampliaciones del sistema.

---

# 👥 Roles del Sistema

## Administrador

Responsable de la supervisión integral de la plataforma.

Funciones principales:

* Verificación documental.
* Auditoría de perfiles.
* Validación de certificados.
* Aprobación de evidencias fotográficas.
* Gestión de usuarios.
* Control de incidencias.

---

## Trabajador

Representa al profesional técnico que busca oportunidades laborales.

Funciones principales:

* Registro guiado.
* Gestión del perfil profesional.
* Carga de certificados.
* Carga de fotografías de trabajos realizados.
* Visualización de ofertas compatibles.
* Recepción de alertas laborales.

---

## Empleador

Representa a empresas, contratistas o personas que requieren personal técnico.

Funciones principales:

* Publicación de vacantes.
* Gestión de procesos de selección.
* Revisión de candidatos.
* Convocatoria a entrevistas.
* Seguimiento de postulaciones.

---

# 🎨 Sistema de Diseño

La identidad visual de Laburo Bolivia fue diseñada para diferenciar claramente los contextos de navegación de cada tipo de usuario.

## Módulo Trabajador

Color principal:

* Amarillo construcción (#E29A14)

Colores complementarios:

* Fondo crema cálido (#EADCC3)
* Marrón oscuro (#3A2717)
* Marrón intermedio (#724E26)

Objetivo visual:

Transmitir cercanía, confianza, crecimiento profesional y accesibilidad.

---

## Módulo Empleador

Color principal:

* Negro profundo (#09080A)

Colores complementarios:

* Amarillo laboral (#E29A14)
* Marrón corporativo (#724E26)

Objetivo visual:

Transmitir formalidad, autoridad, profesionalismo y toma de decisiones.

---

## Pantallas Compartidas

Las vistas públicas utilizan un diseño Split Gradient.

Desktop:

Crema 50% | Negro 50%

Mobile:

Crema 50%
Negro 50%

Este enfoque visual simboliza el punto de encuentro entre la oferta laboral y la demanda de talento técnico.

---

# 📁 Estructura del Proyecto

La aplicación sigue una organización modular basada en responsabilidades funcionales.

## Directorio raíz

Contiene las páginas públicas del sistema.

* index.html → Landing Page
* login.html → Portal de autenticación

---

## /administrador

Módulo destinado a la gestión y control de calidad de la plataforma.

dashboard_admin.html

Panel principal con métricas operativas.

verificaciones.html

Gestión de perfiles pendientes de aprobación.

---

## /empleador

Módulo orientado al reclutamiento.

dashboard_empleador.html

Panel principal del empleador.

publicar.html

Creación y administración de vacantes.

---

## /trabajador

Módulo operativo del trabajador técnico.

dashboard_trabajador.html

Perfil profesional y coincidencias laborales.

oferta_match.html

Visualización de oportunidades compatibles.

alertas.html

Notificaciones y seguimiento.

---

## /registro

Implementación del flujo Wizard de registro.

Paso 1

Datos personales.

Paso 2

Especialidad técnica.

Paso 3

Carga de evidencias.

---

## /js

Capa de lógica de negocio.

Se centralizan:

* Autenticación.
* Comunicación con Supabase.
* Gestión de vacantes.
* Match laboral.
* Gestión administrativa.
* Alertas.
* Postulaciones.
* Validaciones.

La separación modular permite mantener el sistema escalable y facilitar futuras tareas de mantenimiento.

---

# 🧠 Motor de Match Inteligente

El sistema incorpora un mecanismo de ponderación diseñado para priorizar perfiles con información completa y validada.

Factores considerados:

* Especialidad requerida.
* Completitud del perfil.
* Certificaciones verificadas.
* Evidencias fotográficas aprobadas.
* Estado de validación administrativa.

La lógica busca valorar las capacidades demostrables del trabajador y no únicamente la experiencia laboral formal.

El porcentaje de coincidencia aumenta conforme el perfil registra más información validada por la administración.

Esto permite que trabajadores recién formados puedan competir en igualdad de condiciones mediante evidencia objetiva de sus habilidades.

---

# 🔒 Seguridad y Validación

La plataforma implementa procesos de verificación para garantizar la confiabilidad de la información.

Incluye:

* Validación documental.
* Verificación de certificados.
* Revisión manual de evidencias.
* Control administrativo de perfiles.
* Gestión de estados de aprobación.

Este mecanismo reduce la presencia de información falsa y mejora la calidad de las contrataciones realizadas dentro del ecosistema.

---

# 🚀 Tecnologías Utilizadas

Frontend

* HTML5
* JavaScript ES6+
* Tailwind CSS

Backend

* Supabase

Base de Datos

* PostgreSQL

Servicios

* Supabase Authentication
* Supabase Storage
* Supabase Database

---

# 🔮 Mejoras Futuras

* Sistema de reputación laboral.
* Geolocalización de trabajadores.
* Aplicación móvil.
* Notificaciones en tiempo real.
* Analítica avanzada de empleabilidad.

---

# 📚 Contexto Académico

Proyecto desarrollado como propuesta tecnológica orientada a mejorar los procesos de inserción laboral de trabajadores técnicos en Bolivia mediante herramientas digitales, validación de competencias y algoritmos de emparejamiento inteligente.
