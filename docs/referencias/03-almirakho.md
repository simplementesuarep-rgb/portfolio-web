# Referencia 03: Almira Kho

- URL: https://almirakho.com/works/mabel
- Qué le gusta al usuario: la forma de mostrar las fotografías (recortadas en el índice, a su tamaño original al abrir el proyecto) y el efecto de la etiqueta "View" que sigue al ratón. **No le gusta** el hover sobre las imágenes.
- Solo se analiza; no se copia código ni identidad visual.

---

## 1. De recortado a tamaño original: dos niveles

**Índice (`/works`): el marco manda, no la foto**
- 3 columnas verticales en bucle infinito, 5 tarjetas por columna.
- Cada tarjeta mide `33vw x 70vh` (533x630 en 1600x900); lo decide el layout.
- Imagen con `object-fit: cover`, `scale(1.2)` y un `translateY` ligado al scroll (parallax interno). Archivos reales de 1024x1536, 1024x713, 1024x1024... todos recortados al mismo marco.
- Mismo principio que Grids: el hueco es fijo y solo cambia qué parte de la foto se ve.

**Proyecto: cada foto recupera su proporción nativa**
- Cada imagen guarda su `aspectRatio` en el CMS y se pinta con `style="aspect-ratio: 0.66"` antes de cargar: reserva el hueco y no hay saltos de layout.
- Proporción > 1 (apaisada): clase `wide`, 100 % del ancho.
- Vertical: ~50 % del ancho (5 columnas + gutters), alineada a la derecha (`flex-direction: column; align-items: flex-end`). El lado izquierdo queda libre para el texto.
- Alto `auto`: una foto de 1024x1545 mide 800x1207, exacta.
- Tras cada `load` se llama a `lenis.resize()` porque cambia la altura total.
- En móvil sí se recorta: ancho completo con `height: 100vh` y `cover`.

## 2. Efecto del ratón: etiqueta "View" (el que le gusta)

Componente `CursorTag`:
- Píldora negra (`#0a0a0a`), texto blanco 13 px Archivo 500, `position: fixed`, `pointer-events: none`, `z-index: 30`.
- **Movimiento:** `mousemove` en `window` guarda el objetivo; en cada frame del `gsap.ticker`: `pos = pos + (objetivo - pos) * 0.1`, aplicado como `translate3d(x, y, 0) translate(-50%, -50%)`. El 10 % da la sensación de inercia.
- **Aparece y desaparece con `clip-path`:** entra de izquierda a derecha (`inset(0 100% 0 0)` a `inset(0)`) en 0,4 s `power3.inOut`; sale por la derecha (`inset(0 0 0 100%)`).
- El texto es un estado global (`isVisible`, `text`): cualquier elemento puede cambiar la palabra ("View", "Close"...).
- No se pinta en táctil ni en tablet vertical.
- Coste: ~20 líneas de JS y una regla de CSS.

## 3. Hover de las imágenes (descartado por el usuario)

9 tiras verticales por tarjeta que se cierran de derecha a izquierda (`scaleX`, `transform-origin: 100%`, `transition .2s`) con 20 ms de retardo escalonado. Cada tira muestra la misma foto al 200 % de ancho y desplazada: efecto persiana/glitch. CSS puro.

Coste: 171 `<img>` en el DOM para 17 fotos (cada tarjeta duplica su imagen 9 veces solo para este efecto). Al descartarlo desaparece.

## 4. Footer: el mismo patrón "siempre ahí, se abre al llegar abajo", sin JS

```
section
├─ .wrapper       position: relative; z-index: 10; fondo #fafafa   (contenido)
├─ .next-project  position: relative; z-index: 10; fondo #0a0a0a; 100vh
└─ .footer        position: sticky; bottom: 0; z-index: 0; height: 100dvh
```

El footer está pegado al fondo del viewport desde el principio, oculto tras el contenido opaco. Al acabar el contenido, `next-project` sale de pantalla y el footer queda descubierto. 3 reglas de CSS.

Contenido: email enorme (`clamp(60px, 6vw, 85px)`), "Based in Paris, available worldwide" y un **cuadrado de 128 px (90 en móvil) que rebota solo, como el logo del DVD** (no sigue al ratón): 180 px/s en x e y con `requestAnimationFrame`; en cada rebote cambia a la siguiente foto del proyecto. Solo anima `transform`.

## 5. Otros detalles (vistos en el código)

- **Transición de página:** 10 franjas verticales (`page-overlay-item`): al salir `scaleY` 0 a 1 desde arriba (0,4 s, `power4.out`, stagger 0,03); al entrar 1 a 0 desde abajo. Lenis se pausa durante la transición y se llama a `resize()` al terminar.
- **"Next project":** bloque a pantalla completa con la foto del siguiente proyecto, velo blanco al 50 % y `backdrop-filter: blur(5px)`.
- **Lluvia de fotos cuadradas (`ImageRain`):** 8 fotos de 80-180 px que caen en línea recta (4-9 s) con barrido de `clip-path` al entrar y salir, usando fotos de la galería de About. Solo en el código; no visto en pantalla.
- **Índice con scroll virtual:** GSAP Observer captura rueda y gesto táctil; la página mide 900 px y no tiene scroll nativo.

## 6. Stack

Nuxt 3 (Vue) + Sanity (CDN de imágenes con `auto=format&w=1024`), GSAP 3.15 (Observer, SplitText), Lenis. Sin Three.js. Fuente Archivo; colores `#0a0a0a` y `#fafafa`; unidad `--rem: 1px` escalable.

## 7. Qué tomar y qué evitar

**Tomar**
1. Modelo de dos niveles: marco fijo con `cover` en el índice, proporción nativa con hueco reservado en el proyecto.
2. Etiqueta de cursor con inercia 0,1 y barrido de `clip-path`.
3. Footer con `sticky` (CSS puro) y el cuadrado rebotante como toque experimental.
4. Transición de persianas.

**Evitar**
- El hover en tiras.
- Índice sin scroll nativo: mala usabilidad con teclado y SEO, y tarjetas que no son enlaces reales.

## 8. Adaptación a este proyecto

- **Sin CMS:** `<img width="1024" height="1545">` ya da la proporción al navegador y reserva el hueco; con `img { width: 100%; height: auto }` no hay saltos. La clase de foto apaisada (`--wide`) se pone a mano en el HTML o se calcula con unas líneas de JS a partir de `naturalWidth/naturalHeight`.
- **Índice:** tarjeta con `aspect-ratio` y `object-fit: cover`, con `object-position` propio por foto para elegir el encuadre.
- **Cursor:** atributo `data-cursor="View"` en cada elemento que cambie el texto de la píldora.
