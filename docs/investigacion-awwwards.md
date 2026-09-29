# Investigación: portfolios premiados en Awwwards

Notas de referencia sobre cómo se programan, diseñan y optimizan los portfolios que ganan Site of the Day, Developer Award y similares en Awwwards.

> Los pesos son aproximados (minificado + gzip) y sirven solo para comparar.

---

## 1. Librerías

### Stack base (lo que usan casi todos)

| Librería | Para qué sirve | Peso aprox. | Cuándo usarla |
|---|---|---|---|
| **GSAP** (core) | Motor de animación: timelines, easings, control preciso | ~25 KB | Siempre. Es el estándar del sector. |
| **ScrollTrigger** (GSAP) | Animaciones ligadas al scroll: pin, scrub, reveals | ~12 KB | Siempre que haya animación con scroll. |
| **SplitText** (GSAP) | Divide texto en líneas, palabras o letras para animarlo | ~6 KB | Titulares con reveal. |
| **Flip** (GSAP) | Anima cambios de layout, por ejemplo miniatura → cabecera | ~8 KB | Filtros de grid, transiciones entre páginas. |
| **Lenis** | Scroll suave sobre el scroll nativo | ~4 KB | Casi siempre. Sustituye a Locomotive Scroll. |

- **GSAP es 100% gratis desde 2025**, plugins premium incluidos (SplitText, ScrollSmoother, Flip, MorphSVG, DrawSVG, Inertia…), también para uso comercial.
- **Locomotive Scroll está en desuso.** Su v5 está construida sobre Lenis, así que lo lógico es usar Lenis directamente.
- **ScrollSmoother** (GSAP) es la alternativa a Lenis. Lenis es más ligero y más popular, y no obliga a envolver todo el contenido en un wrapper.

### WebGL / 3D

| Librería | Para qué sirve | Peso aprox. | Cuándo usarla |
|---|---|---|---|
| **Three.js** | Motor 3D completo | ~150 KB | Escenas 3D, modelos, efectos complejos. |
| **OGL** | WebGL minimalista, API parecida a Three | ~10–30 KB | Shaders sobre imágenes: distorsión al pasar el ratón, galerías. |
| **Curtains.js** | Planos WebGL sincronizados con elementos del DOM | ~30 KB | Efectos de imagen ligados al layout HTML. Menos mantenida. |
| **Spline** | 3D sin código, exporta un visor | Pesado | Escenas 3D decorativas, si no quieres programar 3D. |

### Transiciones entre páginas (sitio multipágina)

| Librería | Para qué sirve | Peso aprox. |
|---|---|---|
| **Barba.js** | Navegación sin recarga con hooks de transición. La más usada en Awwwards. | ~7 KB |
| **Swup** | Igual que Barba, con plugins (precarga, scripts, head) | ~5 KB |
| **Taxi.js** | Alternativa minimalista, sucesora de Highway | ~4 KB |
| **View Transitions API** | Nativa del navegador, sin librería. Soporte entre documentos creciente. | 0 KB |

### Complementarias (uso puntual)

- **Lottie**: animaciones de After Effects exportadas a JSON. Pesa ~60 KB y es útil para iconos o logos animados.
- **Rive**: animaciones vectoriales interactivas con máquinas de estado. Más ligero y potente que Lottie.
- **Theatre.js**: editor visual de secuencias para animaciones cinematográficas complejas.
- **Matter.js**: físicas 2D (elementos que caen, rebotan o se arrastran).
- **Splitting.js / SplitType**: alternativas gratuitas a SplitText. Ya no son necesarias.

---

## 2. Patrones de diseño e interacción

| Patrón | Descripción | Cómo se hace |
|---|---|---|
| **Preloader** | Contador de 0 a 100 o animación de marca mientras cargan los assets | GSAP timeline + precarga de imágenes y fuentes |
| **Tipografía XXL con reveal** | Títulos enormes que suben línea a línea | SplitText + máscara `overflow: hidden` + `yPercent` |
| **Cursor personalizado** | Círculo que sigue al ratón y cambia de texto o tamaño ("Ver", "Play") | `mousemove` + `gsap.quickTo` |
| **Botones magnéticos** | El botón se desplaza hacia el cursor al acercarse | Distancia al centro + `gsap.to` |
| **Reveal de imágenes** | La imagen se descubre con una máscara | `clip-path: inset()` animado con ScrollTrigger |
| **Parallax interno** | La imagen se mueve dentro de su marco al hacer scroll | Imagen escalada ~1.2 + `yPercent` con scrub |
| **Distorsión WebGL al pasar el ratón** | Ondas, RGB split o ruido sobre la imagen | Shader en OGL/Three sobre un plano sincronizado con el DOM |
| **Scroll horizontal** | Una sección se fija y avanza en horizontal | ScrollTrigger `pin` + `x` con scrub |
| **Showreel** | Vídeo a pantalla completa o que se expande con el scroll | `<video>` + ScrollTrigger con `scale`/`clip-path` |
| **Lista con vista previa** | Lista de proyectos; una imagen sigue al cursor al pasar por cada fila | `mouseenter` + `quickTo` |
| **Grid con filtros** | Filtrar por disciplina con reordenación animada | GSAP Flip |
| **Marquee** | Texto en bucle horizontal infinito | CSS `@keyframes` o GSAP, con velocidad ligada al scroll |
| **Grano / ruido** | Textura analógica sobre la página | PNG o SVG de ruido animado con `steps()` |
| **Miniatura → cabecera** | La miniatura del proyecto se convierte en el hero de la página del proyecto | Barba/Swup + Flip, o View Transitions |
| **Estética editorial** | Retícula visible, textos pequeños en mayúsculas, números de índice | Diseño, más CSS grid |

---

## 3. Optimización

### Rendimiento de la animación
- Animar solo `transform` y `opacity`, que van en la GPU. Nunca `top`, `left`, `width`, `height` ni `margin`.
- Usar `will-change` solo en lo que se anima en ese momento, no en todo.
- **Un único bucle rAF**: Lenis dentro del `gsap.ticker`, con `lagSmoothing(0)`.
- `gsap.quickTo` para lo que se actualiza en cada frame (cursor, magnéticos).
- `gsap.matchMedia()` para dar animaciones distintas a desktop y móvil, y para respetar `prefers-reduced-motion`.
- Reiniciar o destruir las instancias de ScrollTrigger al cambiar de página cuando hay Barba/Swup.

### Imágenes
- Formatos AVIF con fallback WebP mediante `<picture>`.
- `srcset` + `sizes` con 2 o 3 tamaños por imagen.
- `loading="lazy"` en todo lo que queda fuera de la primera pantalla.
- `fetchpriority="high"` en la imagen del hero, que es la que marca el LCP.
- `width`/`height` o `aspect-ratio` siempre, para evitar saltos de layout (CLS).

### Vídeo
- Loops de fondo: `muted autoplay loop playsinline`, comprimidos en H.264 MP4 más WebM/AV1.
- `poster` siempre, con `preload="none"` o `metadata`.
- Cargar o reproducir al entrar en pantalla y pausar al salir, con IntersectionObserver.
- Piezas largas (showreel, cortos) en **Vimeo o YouTube incrustados**, no en el repo.

### Fuentes
- woff2, recortadas a los caracteres que se usan (latín + español).
- `<link rel="preload">` de las 1 o 2 fuentes críticas.
- `font-display: swap`.

### Scripts
- `defer` en todos los `<script>`.
- Cargar desde CDN solo los plugins necesarios.
- WebGL como **mejora progresiva**: la web tiene que funcionar sin él.

### WebGL
- Limitar la densidad de píxeles: `Math.min(devicePixelRatio, 2)`.
- `dispose()` de geometrías y texturas que ya no se usan.
- Pausar el render cuando el canvas no se ve.

### Core Web Vitals (lo que mide Google)
- **LCP** (carga del elemento principal): menos de 2,5 s.
- **CLS** (estabilidad del layout): menos de 0,1.
- **INP** (respuesta a interacciones): menos de 200 ms.

### Accesibilidad (el jurado también la puntúa)
- HTML semántico: `header`, `nav`, `main`, `section`, `article`, `footer`.
- Foco visible y navegación completa con teclado.
- `alt` descriptivo en todas las imágenes.
- `prefers-reduced-motion` respetado.
- El contenido tiene que ser legible aunque el JS falle.

---

## 4. Recomendación para este proyecto

Restricciones: HTML/CSS/JS vanilla, multipágina, GitHub Pages, un solo `css/styles.css` y un solo `js/script.js`.

- **Base:** GSAP + ScrollTrigger + SplitText + Lenis por CDN. No hace falta build, así que funciona directamente en GitHub Pages.
- **Si el diseño pide transiciones entre páginas:** Barba.js o Swup, combinados con GSAP Flip.
- **WebGL (OGL o Three.js):** solo si el diseño lo pide, como mejora progresiva y al final del desarrollo.
- **Assets:** es el punto crítico en un portfolio de foto y cine. GitHub Pages limita cada archivo a 100 MB y el repo debería quedarse por debajo de ~1 GB. Los vídeos largos van en Vimeo o YouTube.
