# Referencia 02: bleibtgleich.dev

- URL: https://bleibtgleich.dev/
- Qué le gusta al usuario: la interactividad, y sobre todo el funcionamiento del footer (siempre presente y se "abre" por completo al llegar abajo).
- Solo se analiza; no se copia código ni identidad visual.

---

## 1. Cómo funciona el footer

No es un footer de "reveal" clásico (fijo debajo del contenido). Son dos piezas:

1. **Nombre siempre presente.** Sección `sticky-name` con `position: sticky; bottom: 0; z-index: 95`. Es un elemento del flujo que se pega abajo del viewport durante todo el recorrido. Se ve como "bleibt ... gleich", cada mitad en un extremo de la pantalla.
2. **Footer real.** Un `<footer>` normal (sin `sticky` ni `fixed`) de ~1800 px de alto. La sensación de "se abre" viene del nombre pegado y de lo que ocurre al llegar al final.

### Detector de fin de scroll (Lenis)

En cada evento `scroll` y `lenis:settled` se comprueba `lenis.scroll >= lenis.limit - 2`:

- **Llega al final** (`triggered = true`): se lanza una timeline pausada.
  1. El ancho del contenedor del nombre pasa de `100%` a `29.45rem`: las dos mitades convergen y forman "bleibtgleich".
  2. La opacidad sube de `0.1` a `1`.
  3. Se dispara un reveal de texto.
- **Sale del final**: `tl.reverse()`.

Patrón reutilizable: **timeline pausada controlada por un booleano "¿estoy en el fondo?"**. Sin scrub, así que la animación dura siempre lo mismo, vaya el usuario rápido o lento.

## 2. Efecto "goo" en el texto

Todos los titulares (`data-reveal="text"`) aparecen así:

- **SplitText** divide el texto en líneas.
- Cada línea recibe un filtro SVG: `feGaussianBlur` + `feColorMatrix` con matriz alfa `20 / -8`.
- Se anima `stdDeviation` de `50` a `0`; a mitad de camino la matriz pasa a `1 / 0`.
- Al terminar se **quita el filtro** (`style.filter = ""`) para no gastar GPU.

Resultado: el texto se condensa como líquido. Los valores (blur 50, amplitud 20, offset -8) definen el efecto. Reproducible en vanilla.

## 3. Contenido del footer

- Titular enorme de 4 líneas, cada una con su reveal goo.
- Reloj en vivo (hora : minutos) con `setInterval` de 1 s; solo toca el DOM si el valor cambió.
- Celda de logos entre horas y minutos: rota cada 5 s o al hacer clic (alterna `display`/`position`).
- Contacto: email en texto, redes en botones circulares, línea inferior con copyright y firma.
- Regla fina (`border-top`) que separa el footer del resto.
- Dial girable con Draggable (hasta 60°) que vuelve solo a 0° al soltarlo.

## 4. Otras interacciones (vistas en el código, no probadas una a una)

- Nav con botón que despliega la rejilla de columnas (`initDevGrid`).
- Cursor inclinable (`initTiltCursor`), canvas infinito, globo 3D (Three.js r128).
- Hover en cada proyecto, filtros por pestañas, cambio de tema claro/oscuro con overlay, vibración háptica en clic (móvil).
- Preloader con contador 0-100 % y barra que sube.
- Transiciones entre páginas con Barba.js.
- Hover de enlaces que intercambia el texto entre dos copias ("label" y "shadow").

## 5. Stack

Webflow + GSAP 3.15 (SplitText, Draggable, InertiaPlugin, MorphSVG, CustomEase), ScrollTrigger, Lenis, Barba.js, Three.js y socket.io. Misma base que Grids, con transiciones entre páginas.

## 6. Qué tomar y precauciones

**Tomar**
1. Nombre pegado abajo con `position: sticky` + timeline pausada al llegar al fondo.
2. Reveal goo de titulares (firma visual, encaja con perfil experimental).
3. Footer editorial: titular grande, reloj vivo y contacto sin ruido.
4. Hover de enlaces con cambio de texto y el patrón de quitar el filtro al terminar cada animación.

**Precauciones**
- Blur de 50 px sobre texto grande pesa en GPU: aplicarlo solo a las líneas que se animan y probar en un móvil de gama media.
- Tiene una versión móvil aparte (`m-footer`); nosotros haremos una sola versión responsive.
- El detector `lenis.limit - 2` depende de Lenis; sin Lenis habría que usar `IntersectionObserver` o `scrollY`.
- Con Barba hay que reinicializar los scripts en cada página. Al ser multipágina, planificarlo desde el inicio o usar la View Transitions API.
