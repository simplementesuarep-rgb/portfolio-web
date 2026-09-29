# Referencia 01: Grids S03 (Obys)

- URL: https://grids03.obys.agency/
- Qué le gusta al usuario: grid editorial que admite archivos de cualquier medida y proporción sin romperse, con interacciones modernas. Encaja con un perfil experimental y conceptual.
- Solo se analiza; no se copia código ni identidad visual (la fuente y el concepto son de Obys).

---

## 1. La clave: el grid define el marco, no el archivo

Cada pieza tiene dos capas:

1. **Marco** (`grid-entry__frame`). Posición y tamaño salen de la retícula (una columna, dos, la mitad del ancho...). Su proporción la decide el diseño, nunca la foto.
2. **Imagen** dentro del marco, más grande que él; lo que sobra queda oculto. Es un `object-fit: cover` con un encuadre elegido a mano para cada imagen.

Cada entrada del layout es un dato:

```js
{ image: [x, y, ancho, alto],   // el marco, en coordenadas de la retícula
  crop:  [w, h, offX, offY],    // cómo se coloca el archivo dentro (el encuadre)
  src:   '/pictures/image-106.webp' }
```

Da igual subir una foto vertical, un panorámico o un frame de vídeo: el hueco no cambia, solo cambia qué parte de la imagen se ve. Si la imagen es demasiado pequeña para su marco, el código la escala para que siempre lo cubra.

**Retícula**
- 12 columnas, margen 20 px, gutter 20 px, como variables en `:root`.
- Todo se diseña sobre un lienzo de 1440 px y se escala con `--s` (ancho de ventana / 1440): la composición es un "póster" que crece o encoge proporcionalmente.
- No usa CSS Grid: cada marco se coloca con posición absoluta calculada en JS, con coordenadas escritas a mano bloque a bloque.

## 2. Interacciones

| Efecto | Técnica |
|---|---|
| Preloader | Barras blanco y negro que construyen la retícula: módulos `<i>` posicionados y animados con GSAP. |
| Reveal de imágenes | `clip-path: inset(22%)` a `inset(0%)` al entrar en pantalla, `expo.out`, ScrollTrigger (`top 97%`, una sola vez). |
| Parallax interno | La imagen se desplaza dentro del marco con scrub. Solo se mueve lo que sobra del encuadre, así nunca aparece un hueco. |
| Hover WebGL | Shader en OGL: gotas u ondas deforman la foto y dejan ver la retícula dibujada debajo (foto sobre papel cuadriculado). |
| Sección educativa fijada | Grid de 4 columnas que se construye con el scroll (columnas, gutters y márgenes animados). |
| Tipografía | Letras enmascaradas una a una, títulos fijos, índice numerado con duraciones, estilo editorial. |
| Separadores | Barras negras gruesas entre bloques, animadas. |

## 3. Stack técnico

- Vite, GSAP + ScrollTrigger, Lenis, OGL. Sin frameworks ni Three.js.
- JS ~250 KB sin comprimir, CSS ~10 KB: el layout vive en el JS.
- Imágenes WebP y una sola fuente woff2.
- Shader optimizado: si la imagen no está bajo el ratón solo lee la textura; lo que está fuera de pantalla no se dibuja.

## 4. Qué tomar y qué evitar

**Tomar**
- El sistema marco + encuadre (resuelve el problema de medidas variables).
- Reveal con `clip-path`, parallax limitado al encuadre, índice numerado, barras y tipografía como estructura.
- El efecto WebGL como mejora opcional (la web debe funcionar igual sin él).

**Evitar**
- Solo funciona en escritorio (en móvil muestra un aviso). Para un portfolio no es aceptable.
- Layouts escritos en el JS con coordenadas a mano: añadir un proyecto obliga a tocar código, y el contenido no está en el HTML (SEO y accesibilidad).
- Copiar su identidad: fuente propia de Obys y concepto de la retícula suyo.

## 5. Adaptación a este proyecto

- **CSS Grid de 12 columnas** en `css/styles.css`. Cada pieza ocupa columnas o filas mediante clases de layout; en móvil se reorganizan en menos columnas.
- **Marco con `aspect-ratio`** fijado por el diseño; imagen o vídeo con `object-fit: cover` + `object-position` para el encuadre (lo único que se ajusta por pieza, con una variable o atributo).
- **Contenido en el HTML** (`<img>` / `<video>` reales). El JS solo anima: reveal, parallax y WebGL opcional.
