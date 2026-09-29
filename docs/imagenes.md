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
- **Las fotos van a sangre y pegadas entre sí**, sin margen ni separación. Los 20 px de margen y los 10 px de gutter solo valen para el texto.
- Cada foto va en un `<figure class="photo photo--landscape|photo--portrait">`:
  - `photo--landscape`: todo el ancho de la pantalla.
  - `photo--portrait`: la mitad derecha, empezando en la columna 3 de la grid (que es el 50 % más medio gutter), hasta el borde derecho: `width: calc(50% - var(--gutter) / 2)`.
- El alto sale de la proporción de la foto, nunca se recorta.
- `width` y `height` en el `<img>` reservan el hueco antes de cargar, así que no hay saltos de layout.
- `sizes`: `100vw` en horizontales y `calc(50vw - 5px)` en verticales.
- La primera foto lleva `fetchpriority="high"`; el resto `loading="lazy"`.
- Separación vertical entre fotos: `--image-gap` (0 px) en `css/styles.css`.
- Navbar y footer se superponen a las fotos con `mix-blend-mode: difference`.
