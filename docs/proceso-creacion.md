# Proceso de creación del portfolio

## Estructura del proyecto

```
portfolio-web/
├── index.html            # Home / hero
├── sobre-mi.html         # (propuesta)
├── proyectos/
│   └── <slug>.html       # Una página por proyecto, a partir de una plantilla común
├── css/
│   └── styles.css        # Única hoja de estilos
├── js/
│   └── script.js         # Único archivo JS
├── assets/
│   ├── img/
│   ├── video/
│   └── fonts/
└── docs/                 # Notas de referencia (no forman parte de la web)
```

Reglas: la estructura va en los `.html`, todo el diseño en `css/styles.css` y todo el comportamiento en `js/script.js`. El código debe quedar ordenado y limpio, con un commit por cada cambio.

---

## Fases

### Fase 0. Setup ✅
Repositorio creado en GitHub.

### Fase 1. Estrategia y contenido (tú). Aquí se empieza.
- **Objetivo:** ¿a quién quieres atraer? Productoras, agencias, marcas, clientes directos. De eso dependen el tono y qué proyectos destacar.
- **Selección:** entre 6 y 12 proyectos, los mejores. Vale más la calidad que la cantidad.
- **Inventario por proyecto:** título, año, cliente, tu rol, disciplinas y medios disponibles (fotos, vídeos, bocetos).
- **Textos:** titular de posicionamiento, bio y datos de contacto y redes.

### Fase 2. Arquitectura de la información
- Mapa del sitio:
  - `index.html`: hero con showreel, trabajos destacados, filtros por disciplina.
  - `proyectos/<slug>.html`: una página por proyecto.
  - `sobre-mi.html`: bio y trayectoria.
  - Contacto: sección o página.
- Una **plantilla de proyecto** común, construida con bloques modulares (ver más abajo).

### Fase 3. Diseño (tú)
1. Moodboard y referencias.
2. Sistema de diseño: tipografías, paleta, retícula, espaciados, tamaños.
3. Wireframes → diseño en desktop y móvil.
4. Definir las interacciones y animaciones de cada elemento.
5. Pasarme los tokens (colores, tamaños, fuentes) para convertirlos en variables CSS.

### Fase 4. Preparación de assets
- Imágenes: AVIF/WebP, en 2 o 3 tamaños (p. ej. 800, 1600 y 2400 px de ancho).
- Loops de vídeo cortos: comprimidos (MP4 H.264 + WebM), cada uno con su imagen `poster`.
- Showreel y piezas largas: en Vimeo o YouTube, incrustados.
- Límites de GitHub Pages: 100 MB por archivo y repo por debajo de ~1 GB.

### Fase 5. Desarrollo (yo, un commit por paso)
1. **Esqueleto:** carpetas, `index.html` y plantilla de proyecto con HTML semántico, sin estilos.
2. **CSS:** reset, variables del sistema de diseño, tipografía, layout, responsive.
3. **JS base:** Lenis + GSAP, reveals y ScrollTrigger.
4. **Interacciones:** cursor, hover, filtros, transiciones entre páginas.
5. **WebGL:** opcional y al final, como mejora progresiva.

### Fase 6. Pulido
- Lighthouse (rendimiento, accesibilidad, SEO).
- Accesibilidad: teclado, `alt`, `prefers-reduced-motion`.
- SEO: `<title>`, meta description, Open Graph (vista previa al compartir), favicon, `sitemap.xml`.
- Pruebas en móviles reales.

### Fase 7. Despliegue
- Activar GitHub Pages desde la rama `main`.
- Dominio propio si quieres.

### Fase 8. Mantenimiento
- Para añadir un proyecto: duplicar la plantilla, cambiar el contenido y los assets, añadirlo a la home, y commit.

---

## Planteamiento para un perfil multidisciplinar

**Una sola identidad, no cuatro portfolios pegados.**
Diseño multimedia, diseño gráfico, fotografía y cine se presentan bajo una misma voz: la de un creador visual o narrador de imágenes. El titular debe conectar las disciplinas. Esa mezcla es el diferencial.

**Home**
- Abre con el **showreel de cine**, que es lo que más impacta en los primeros segundos.
- Debajo, una **selección mezclada** de trabajos destacados.
- **Filtros por disciplina:** Todo / Gráfico / Multimedia / Fotografía / Cine.

**Etiquetas**
Cada proyecto lleva una o varias etiquetas de disciplina. Un proyecto puede ser a la vez "Cine + Gráfico", y así se ve cómo se cruzan tus disciplinas.

**Una plantilla de proyecto, bloques distintos**
La página de proyecto es siempre la misma plantilla y se combinan bloques según el caso:
- **Galería de fotos:** gran formato, interfaz al mínimo, la imagen manda.
- **Vídeo:** incrustado, con ficha técnica y créditos (rol, equipo, año).
- **Caso de estudio:** brief → proceso → resultado, para gráfico y multimedia.
- **Texto:** contexto breve del proyecto.

**Cine sin título**
Que hable el trabajo: rol, créditos, equipo, dónde se proyectó o publicó y resultados. En "Sobre mí" se cuenta la trayectoria y la experiencia, no la formación.

**Coherencia visual**
Los mismos tokens, las mismas animaciones y el mismo ritmo en todas las páginas. Cada disciplina cambia el contenido, no el lenguaje visual.
