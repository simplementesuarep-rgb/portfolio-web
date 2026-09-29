# Tipografía: Mona Sans

Decisión tomada el 2026-09-29 tras comparar en Figma Inter y Mona Sans (finalistas de una selección de ocho familias sans-serif libres). Primero se eligió Inter; después de probar ambas con más textos se cambió a **Mona Sans**: dentro de ser de palo seco, tiene más personalidad y un tono más editorial. Inter queda descartada.

Las pruebas de la primera ronda están en la página "Tipografías" del Figma del proyecto.

---

## Sobre Mona Sans

- **Origen:** creada por GitHub. Versión revisada: 2.0.27.
- **Licencia:** OFL-1.1 (`Copyright 2022 The Mona Sans Project Authors`, con Reserved Font Name "Mona"). Se puede usar y subir al repo público incluyendo el archivo de licencia. Por el nombre reservado, si algún día se modifica la fuente hay que cambiarle el nombre.
- **Variable con tres ejes** (verificado en el archivo):

| Eje | Rango | Para qué sirve |
|---|---|---|
| `wght` | 200-900 | Peso, de ExtraLight a Black |
| `wdth` | 75-125 | Ancho: de condensada a expandida |
| `opsz` | 0-100 | Tamaño óptico |

- **Cursiva real** en archivo aparte.

## Funciones OpenType (verificadas en el archivo)

`case`, `tnum` / `pnum`, `frac`, `sups`, `subs`, `sinf`, `numr`, `dnom`, `ordn`, `ss01`-`ss10`, `liga`, `kern`.

Diferencias con Inter: **no tiene** `cpsp` (espaciado extra automático en mayúsculas), `zero` (cero tachado) ni `cv01`-`cv13`. En mayúsculas hay que ajustar `letter-spacing` a mano. Qué hace cada `ssXX` no está revisado todavía.

## Qué archivos usar

Fuente oficial: release **v2.0.27** de `github/mona-sans`, archivo `mona-sans-webfonts-v2.0.27.zip`, carpeta `fonts/webfonts/variable/`. Ya vienen en WOFF2.

| Archivo | Ejes | Peso |
|---|---|---|
| `MonaSansVF[opsz,wght].woff2` | peso + tamaño óptico | 134 KB |
| `MonaSansVF-Italic[opsz,wght].woff2` | peso (la cursiva no tiene `opsz`) | 122 KB |
| `MonaSansVF[wdth,opsz,wght].woff2` | añade el eje de ancho | 301 KB |
| `MonaSansVF-Italic[wdth,opsz,wght].woff2` | ídem, cursiva | 275 KB |

- **Recomendado para empezar:** `MonaSansVF[opsz,wght].woff2` (134 KB). Sirve para toda la maqueta salvo que el diseño juegue con el ancho.
- **Si se usa `wdth`** (titulares condensados o expandidos, algo muy en línea con lo experimental) hay que cargar la versión de 301 KB: más del doble.
- Los archivos **no están recortados** a un subconjunto latino (797 glifos, incluyen otros alfabetos y símbolos). Que cubren el español (`á é í ó ú ñ ü ¿ ¡ €`) está por comprobar con la primera prueba en navegador. Si el peso molesta, se puede subsetear con `pyftsubset`/`glyphhanger` conservando `case` y las funciones que se usen.

## Cómo declararla (`css/styles.css`)

```css
@font-face {
  font-family: "Mona Sans";
  src: url("../assets/fonts/MonaSansVF[opsz,wght].woff2") format("woff2");
  font-weight: 200 900;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "Mona Sans";
  src: url("../assets/fonts/MonaSansVF-Italic[opsz,wght].woff2") format("woff2");
  font-weight: 200 900;
  font-style: italic;
  font-display: swap;
}
```

- Los corchetes y comas del nombre original dan problemas en URLs: al copiar los archivos a `assets/fonts/` conviene renombrarlos (por ejemplo `MonaSans-Variable.woff2` y `MonaSans-Italic-Variable.woff2`).
- Con el archivo `wdth` añadir `font-stretch: 75% 125%;` en el `@font-face` para poder usar `font-stretch` desde CSS.
- Precargar solo el archivo normal: `<link rel="preload" as="font" type="font/woff2" href="assets/fonts/MonaSans-Variable.woff2" crossorigin>` (el `crossorigin` es obligatorio aunque sea del mismo dominio).
- Activar `font-feature-settings: "case"` en los textos en mayúsculas.
- Los archivos irán a `assets/fonts/` junto con `OFL.txt`, porque el repo es público.

## Puntos a vigilar

- **Figma y el navegador pueden diferir en titulares grandes**, sobre todo por `opsz`. No está confirmado qué versión de la fuente usa Figma; comprobarlo con el primer texto real.
- **Rango de `opsz` 0-100** según el archivo: revisar el efecto real en el navegador antes de fijar `font-optical-sizing`.
- **Peso mínimo 200:** no existe el peso 100 (Thin); el mínimo es ExtraLight.
- **Mayúsculas con tildes:** con interlineado del 95 % quedan justas. No bajar de ese valor y verificarlo en el navegador.
- **Presupuesto de fuentes:** 134 KB (solo normal), ~256 KB con cursiva, o el doble si se usa `wdth`. Cargar la cursiva y el ancho solo si el diseño los usa.
