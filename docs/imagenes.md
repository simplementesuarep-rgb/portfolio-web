# Imágenes

Cómo se preparan y se colocan las fotos en la web.

## Flujo

1. Los **originales** van en `assets/originals/`. Esa carpeta está en `.gitignore`: los originales pesan entre 5 y 33 MB y no deben entrar en el repo público.
2. Las **versiones web** van en `assets/img/`, en AVIF y WebP y a tres tamaños. Esas sí se suben.
3. En el HTML cada foto usa `<picture>` con AVIF y WebP de respaldo, `srcset`, `sizes` y las dimensiones reales (`width` y `height`).

## Versiones web

| Tipo | Anchos | Formatos |
|---|---|---|
| Horizontal | 800, 1600, 2400 | AVIF (calidad 52) y WebP (calidad 80) |
| Vertical | 640, 1280, 2000 | AVIF (calidad 52) y WebP (calidad 80) |

- Nombre: `<slug>-<ancho>.avif|webp`, en minúsculas y sin caracteres raros (el nombre `3&.jpg` pasó a `3`).
- Conversión a sRGB de 8 bits. Los PNG de 16 bits de 33 MB acaban en unos 25 KB (AVIF, 800 px) y 150 KB (AVIF, 1600 px).
- Con las 11 fotos de prueba: 21 MB en total entre todos los tamaños.
- La herramienta usada es `sharp` (Node), con `resize` sin ampliar y `toColourspace("srgb")`. El script no está en el repo; si se quiere versionar, iría en una carpeta aparte de `js/` para respetar la regla de un solo `script.js`.

## Maquetación

- La galería está en `index.html` dentro de `<section class="gallery">`.
- **Las fotos van pegadas entre sí**, sin separación vertical (`--image-gap`, 0 px). Los 20 px de margen y los 10 px de gutter solo valen para el texto.
- Cada foto va en un `<figure class="photo photo--landscape|photo--portrait">`. En las páginas de proyecto:
  - `photo--landscape`: todo el ancho de la pantalla, a sangre.
  - `photo--portrait`: las 2 columnas de la derecha (`width: calc(50% - var(--gutter) / 2)`), hasta el borde derecho.
- **Home 60/40:** la horizontal 12 va fija arriba a la izquierda (`.home__feature`, 60 % del ancho, 864×576 a 1440, `sizes="60vw"`) y no se mueve. A la derecha, `gallery--side` ocupa el 40 % con las dos verticales (3 y 4) pegadas y en scroll infinito (`sizes="40vw"`). El reparto se cambia con `--home-split` en `.home`. Ninguna foto se recorta; bajo la horizontal queda blanco.
- El marco sale de la proporción de la foto, nunca se deforma. Por el parallax, la foto va ampliada al 120 % dentro del marco y se ve en torno al 83 % de ella (ver abajo).
- `width` y `height` en el `<img>` reservan el hueco antes de cargar, así que no hay saltos de layout.
- `sizes` en proyectos: `100vw` en horizontales y `calc(50vw - 5px)` en verticales.
- La primera foto lleva `fetchpriority="high"`; el resto `loading="lazy"`.
- En proyectos solo el footer queda fuera de las fotos: la galería termina con `padding-bottom: var(--footer-height) + var(--margin)`, así que al llegar al final el footer está a 20 px de la última foto y sobre fondo blanco. En la home no hay final (scroll infinito) y ese hueco no existe.
- Navbar y footer se superponen a las fotos con `mix-blend-mode: difference`.

## Movimiento

- **Sin animación de entrada:** las fotos ya están en su sitio al cargar la página.
- **Hover morph (a partir del de GRIDS, análisis en `docs/referencias/01-grids03-obys.md`):** al pasar el ratón se abre en la foto una mancha blanca (el color de `--color-bg`). Sigue al puntero con inercia y deja una estela de gotas que se funden (metaballs) y se cierran en 1,5 s. El borde ondula con ruido y cada gota manda una onda que dobla la foto. Es un shader de WebGL escrito a mano en `script.js`, sin librerías. El `<canvas>` solo se crea en la foto que está bajo el ratón, lee la foto ya cargada como textura (con su parallax) y se destruye al terminar. Los valores están en `MORPH`. Sin WebGL, en táctil o con `prefers-reduced-motion`, no hay efecto y la foto se queda tal cual.
- **Scroll suave:** Lenis con `duration: 1.8`, frenada exponencial y `wheelMultiplier: 0.7`. Es más suave que el de Almira Kho, que usa 1,2 s y 0,8 (valores sacados de su código).
- **Scroll infinito en la home:** `<body data-scroll="infinite">` activa `infinite` en Lenis (y `syncTouch`, que lo necesita en táctil). script.js añade copias de las fotos (`aria-hidden`, sin `alt`) hasta cubrir una pantalla y fija el alto de la galería en `alto de las originales + una pantalla`. Así el final del recorrido se ve igual que el principio y el salto a 0 no se nota. Se recalcula al cambiar el tamaño de la ventana.
- **Footer en la home:** con scroll infinito no hay final de página, así que el nombre se queda separado y a baja opacidad; LinkedIn e Instagram no aparecen. El comportamiento completo queda para las páginas de proyecto.
- **Parallax dentro del marco:** el `<figure>` tiene la proporción de la foto y `overflow: hidden`. Dentro, la foto va al 120 % y se desplaza del -8 % al 8 % de su alto mientras cruza la pantalla (ScrollTrigger con `scrub`). El 120 % deja un 10 % de margen por cada lado, así que nunca asoma el fondo.
- **Etiqueta del cursor:** sobre los elementos con `data-cursor="View"` aparece un rectángulo negro de esquinas rectas que sigue al ratón con inercia (0,1 por fotograma, como en Almira Kho). Entra y sale con morph de tinta, sin fundido de opacidad: un ruido deforma sus bordes, el desenfoque y el corte del alfa lo convierten en una mancha que encoge hasta desaparecer (y al revés al entrar). Sigue al ratón también mientras se disuelve y, si se vuelve a entrar a mitad, continúa desde donde estaba. Solo con ratón, no en táctil.
- Con `prefers-reduced-motion` no hay Lenis, ni parallax, ni scroll infinito, ni morph.
