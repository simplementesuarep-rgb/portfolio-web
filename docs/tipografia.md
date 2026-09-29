# Tipografía: Inter

Decisión tomada el 2026-09-29 tras comparar en Figma con Mona Sans y otras siete familias sans-serif libres (Archivo, Bricolage Grotesque, Instrument Sans, Anybody, Schibsted Grotesk, Geist, Hanken Grotesk). Todas descartadas salvo Inter. **No se usa Inter Tight**, solo Inter.

Las pruebas están en la página "Tipografías" del Figma del proyecto.

---

## Sobre Inter

- **Origen:** diseñada por Rasmus Andersson pensando en pantallas. X-height alta y aperturas abiertas: se lee bien a tamaños pequeños. Es la fuente de la interfaz de Figma.
- **Licencia:** OFL-1.1. Se puede usar y subir al repo público incluyendo su archivo de licencia.
- **Variable con dos ejes:** peso 100-900 y tamaño óptico (`opsz`, 14-32), con cursiva real. El eje `opsz` hace que a tamaños grandes las letras se vean más cerradas y refinadas. El navegador lo aplica solo con `font-optical-sizing: auto`.

## Funciones OpenType (verificadas en el archivo oficial)

| Función | Para qué sirve |
|---|---|
| `case` | Corrige la puntuación en mayúsculas: `¿ ¡ ( ) -` a la altura de las versiones altas |
| `cpsp` | Espaciado extra automático entre mayúsculas |
| `tnum` / `pnum` | Cifras tabulares / proporcionales |
| `zero` | Cero tachado |
| `ss01`-`ss08`, `cv01`-`cv13` | Conjuntos estilísticos y variantes de carácter |
| `frac`, `sups`, `subs`, `ordn` | Fracciones, superíndices, subíndices, ordinales |

## Qué archivos usar

Usar el paquete oficial npm **`inter-ui@4.1.1`**, carpeta `variable-latin/`:

| Archivo | Peso |
|---|---|
| `InterVariable-subset.woff2` | 97 KB |
| `InterVariable-Italic-subset.woff2` | 107 KB |

Tienen 765 glifos, con los ejes `wght` y `opsz` y todas las funciones de la tabla anterior. El subconjunto latino cubre el español (`á é í ó ú ñ ü ¿ ¡`, comillas, guiones y `€`).

**No usar el subconjunto de Fontsource** (`@fontsource-variable/inter`): solo conserva `calt`, `tnum`, `pnum` y `frac` (518 glifos) y descarta `case`, `cpsp`, `zero` y las alternativas. Sin `case` las mayúsculas con signos de puntuación salen desalineadas.

## Cómo declararla (`css/styles.css`)

```css
@font-face {
  font-family: "Inter";
  src: url("../assets/fonts/InterVariable-subset.woff2") format("woff2");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "Inter";
  src: url("../assets/fonts/InterVariable-Italic-subset.woff2") format("woff2");
  font-weight: 100 900;
  font-style: italic;
  font-display: swap;
}
```

- Precargar solo el archivo normal en el HTML: `<link rel="preload" as="font" type="font/woff2" href="assets/fonts/InterVariable-subset.woff2" crossorigin>` (el `crossorigin` es obligatorio aunque sea del mismo dominio).
- Activar `font-feature-settings: "case"` en los textos en mayúsculas.
- Los archivos irán a `assets/fonts/` junto con la licencia OFL (`OFL.txt`), porque el repo es público.

## Puntos a vigilar

- **Figma y el navegador pueden diferir en titulares grandes.** No está confirmado qué versión de Inter usa Figma; si no incluye `opsz`, el navegador dibujará los titulares algo más cerrados que en las maquetas. Comprobarlo con el primer texto real.
- **Tildes en mayúsculas:** con interlineado del 95 % quedan justas. No bajar de ese valor.
- **Presupuesto de fuentes:** ~100 KB (solo normal) o ~205 KB con cursiva. Cargar la cursiva solo si el diseño la usa.
