/* ==========================================================================
   1. Configuración
   ========================================================================== */

gsap.registerPlugin(ScrollTrigger, SplitText);

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;


/* ==========================================================================
   2. Scroll suave (Lenis)
   ========================================================================== */

let lenis = null;

function initLenis() {
  if (reducedMotion) return;

  // Misma sensación que Almira Kho: rueda al 80 % y frenada exponencial de 1,2 s
  lenis = new Lenis({
    autoRaf: false,
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
    wheelMultiplier: 0.8,
  });
  lenis.on("scroll", ScrollTrigger.update);

  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}


/* ==========================================================================
   3. Efecto tinta (umbral)
   Filtro SVG: desenfoque + matriz de color que corta el canal alfa. Al bajar
   el desenfoque, las manchas se condensan hasta formar el texto nítido.
   Cada animación usa su propio filtro para que no se pisen entre sí.
   ========================================================================== */

const SVG_NS = "http://www.w3.org/2000/svg";

// Matriz alfa: alfa final = amplitud * alfa + corte. Con -4 se ven las manchas
// en trazos finos; valores más negativos las hacen desaparecer.
const INK_AMPLITUDE = 20;
const INK_CUT = -4;

let inkDefs = null;
let inkCount = 0;

// Contenedor oculto donde viven los filtros SVG; se crea la primera vez que hace falta
function ensureInkDefs() {
  if (inkDefs) return;

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("ink-defs");
  inkDefs = document.createElementNS(SVG_NS, "defs");
  svg.append(inkDefs);
  document.body.append(svg);
}

function createInkFilter() {
  ensureInkDefs();

  const id = `ink-${++inkCount}`;
  const filter = document.createElementNS(SVG_NS, "filter");
  filter.id = id;
  filter.setAttribute("x", "-50%");
  filter.setAttribute("y", "-50%");
  filter.setAttribute("width", "200%");
  filter.setAttribute("height", "200%");
  filter.setAttribute("color-interpolation-filters", "sRGB");

  const blur = document.createElementNS(SVG_NS, "feGaussianBlur");
  blur.setAttribute("in", "SourceGraphic");
  blur.setAttribute("stdDeviation", "0");
  blur.setAttribute("result", "blur");

  const matrix = document.createElementNS(SVG_NS, "feColorMatrix");
  matrix.setAttribute("in", "blur");
  matrix.setAttribute("type", "matrix");

  filter.append(blur, matrix);
  inkDefs.append(filter);

  // Pinta el estado { blur, a, b } en el filtro; a y b son la amplitud y el corte del alfa
  const render = ({ blur: amount, a, b }) => {
    blur.setAttribute("stdDeviation", amount);
    matrix.setAttribute("values", `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${a} ${b}`);
  };

  return { id, render, remove: () => filter.remove() };
}

// Revela un elemento: las manchas de tinta se condensan en el texto
function ink(el, { duration = 1.2, delay = 0, blur } = {}) {
  const timeline = gsap.timeline({ delay });

  if (reducedMotion) return timeline.set(el, { autoAlpha: 1 });

  const filter = createInkFilter();
  const size = parseFloat(getComputedStyle(el).fontSize) || 16;
  const state = { blur: blur ?? size * 0.6, a: INK_AMPLITUDE, b: INK_CUT };
  const render = () => filter.render(state);

  const cleanup = () => {
    el.style.filter = "";
    filter.remove();
  };

  return timeline
    .call(render)
    .set(el, { autoAlpha: 1, filter: `url(#${filter.id})` })
    .to(state, { blur: 0, duration, ease: "power2.out", onUpdate: render })
    .to(state, { a: 1, b: 0, duration: duration * 0.5, ease: "power1.in", onUpdate: render }, duration * 0.5)
    .eventCallback("onComplete", cleanup);
}

// Pasada corta de tinta sobre un elemento ya visible (hover, cambios de estado)
function inkPulse(el, { blur, duration = 0.5 } = {}) {
  if (reducedMotion || el.style.filter || el.inkPulse?.isActive()) return;

  const filter = createInkFilter();
  const size = parseFloat(getComputedStyle(el).fontSize) || 16;
  const peak = blur ?? size * 0.07;
  const state = { blur: 0, a: INK_AMPLITUDE, b: INK_CUT };
  const render = () => filter.render(state);

  render();
  el.style.filter = `url(#${filter.id})`;

  el.inkPulse = gsap.timeline({
    onComplete: () => {
      el.style.filter = "";
      filter.remove();
    },
  })
    .to(state, { blur: peak, duration: duration / 2, ease: "power2.out", onUpdate: render })
    .to(state, { blur: 0, duration: duration / 2, ease: "power2.in", onUpdate: render });
}

// Disolución: el texto se funde en manchas y desaparece (inversa de ink)
function inkOut(el, { duration = 0.8 } = {}) {
  const timeline = gsap.timeline();

  if (reducedMotion) return timeline.set(el, { autoAlpha: 0 });

  const filter = createInkFilter();
  const size = parseFloat(getComputedStyle(el).fontSize) || 16;
  const state = { blur: 0, a: 1, b: 0 };
  const render = () => filter.render(state);

  render();
  el.style.filter = `url(#${filter.id})`;

  return timeline
    .to(state, { a: INK_AMPLITUDE, b: INK_CUT, duration: duration * 0.3, ease: "power1.out", onUpdate: render })
    .to(state, { blur: size * 0.6, duration: duration * 0.8, ease: "power2.in", onUpdate: render }, duration * 0.1)
    .set(el, { autoAlpha: 0 }, duration * 0.9)
    .call(() => {
      el.style.filter = "";
      filter.remove();
    });
}

// Entrada de los textos que ya están en pantalla al cargar
function revealIntro() {
  const items = document.querySelectorAll('[data-ink]:not([data-ink="scroll"])');
  items.forEach((el, i) => ink(el, { delay: i * 0.08 }));
}

// Textos que entran línea a línea al hacer scroll: data-ink="scroll"
function initScrollInk() {
  document.querySelectorAll('[data-ink="scroll"]').forEach((el) => {
    const split = SplitText.create(el, { type: "lines" });

    gsap.set(el, { autoAlpha: 1 });
    gsap.set(split.lines, { autoAlpha: 0 });

    split.lines.forEach((line, i) => {
      ScrollTrigger.create({
        trigger: line,
        start: "top 90%",
        once: true,
        onEnter: () => ink(line, { delay: i * 0.08 }),
      });
    });
  });
}

function initInkHover() {
  document.querySelectorAll("[data-ink-hover]").forEach((el) => {
    el.addEventListener("mouseenter", () => inkPulse(el));
  });
}


/* ==========================================================================
   4. Navbar
   ========================================================================== */

// De momento solo cambia de estado; el audio llegará con los vídeos
function initSoundToggle() {
  const button = document.querySelector(".nav__link--sound");
  if (!button) return;

  button.addEventListener("click", () => {
    const isOn = button.getAttribute("aria-pressed") === "true";
    button.setAttribute("aria-pressed", String(!isOn));
  });
}


/* ==========================================================================
   5. Galería
   Cada foto se mueve por dentro de su marco al hacer scroll (parallax) y, al
   pasar el ratón, la tinta muerde sus bordes de forma irregular.
   ========================================================================== */

// Parallax: la foto está ampliada dentro del marco y se desplaza en vertical
const PHOTO_SCALE = 1.2;
const PHOTO_SHIFT = 8; // % de su alto hacia cada lado (el margen es del 10 %)

function initPhotoParallax(photo) {
  const img = photo.querySelector("img");

  gsap.set(img, { scale: PHOTO_SCALE });
  gsap.fromTo(img, { yPercent: -PHOTO_SHIFT }, {
    yPercent: PHOTO_SHIFT,
    ease: "none",
    scrollTrigger: { trigger: photo, start: "top bottom", end: "bottom top", scrub: true },
  });
}

// Máscara del hover: un campo de 0 (borde) a 1 (interior) con ruido suave,
// para que al subir el umbral la foto se coma desde los bordes en manchas.
// Se calcula una vez por proporción; el hover solo mueve el umbral.
const EDGE_DEPTH = 0.18; // parte del lado corto donde actúa la tinta
const EDGE_NOISE = 0.25; // peso del ruido frente a la distancia al borde
const EDGE_SLOPE = 40;   // dureza del corte
const EDGE_REST = -0.05; // umbral sin hover: toda la foto visible
const EDGE_HOVER = 0.12; // umbral con hover

const edgeMasks = new Map();

function edgeMask(ratio) {
  const key = ratio.toFixed(2);
  if (edgeMasks.has(key)) return edgeMasks.get(key);

  const w = 480;
  const h = Math.round(w / ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  // Ruido: una retícula aleatoria pequeña ampliada y desenfocada, en dos escalas.
  // Se dibuja más grande que el lienzo para que el desenfoque no oscurezca los bordes.
  const octave = (cells, alpha) => {
    const grid = document.createElement("canvas");
    grid.width = cells;
    grid.height = Math.max(2, Math.round(cells / ratio));
    const gctx = grid.getContext("2d");
    const pixels = gctx.createImageData(grid.width, grid.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = Math.random() * 255;
      pixels.data[i + 3] = 255;
    }
    gctx.putImageData(pixels, 0, 0);

    const cell = w / cells;
    ctx.globalAlpha = alpha;
    ctx.filter = `blur(${cell / 2}px)`;
    ctx.drawImage(grid, -cell, -cell, w + cell * 2, h + cell * 2);
  };
  octave(10, 1);
  octave(28, 0.5);

  // Normaliza el ruido y lo combina con la distancia al borde
  const image = ctx.getImageData(0, 0, w, h);
  const data = image.data;
  let min = 255;
  let max = 0;
  for (let i = 0; i < data.length; i += 4) {
    min = Math.min(min, data[i]);
    max = Math.max(max, data[i]);
  }

  const depth = EDGE_DEPTH * Math.min(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const noise = (data[i] - min) / (max - min || 1);
      const edge = Math.min(1, Math.min(x, w - 1 - x, y, h - 1 - y) / depth);
      const value = edge * (1 - EDGE_NOISE) + noise * EDGE_NOISE;
      data[i] = data[i + 1] = data[i + 2] = value * 255;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  const url = canvas.toDataURL();
  edgeMasks.set(key, url);
  return url;
}

function createEdgeFilter(ratio) {
  ensureInkDefs();

  const id = `ink-${++inkCount}`;
  const filter = document.createElementNS(SVG_NS, "filter");
  filter.id = id;
  filter.setAttribute("x", "0");
  filter.setAttribute("y", "0");
  filter.setAttribute("width", "1");
  filter.setAttribute("height", "1");
  filter.setAttribute("color-interpolation-filters", "sRGB");

  const mask = document.createElementNS(SVG_NS, "feImage");
  mask.setAttribute("href", edgeMask(ratio));
  mask.setAttribute("preserveAspectRatio", "none");
  mask.setAttribute("result", "field");

  const threshold = document.createElementNS(SVG_NS, "feColorMatrix");
  threshold.setAttribute("in", "field");
  threshold.setAttribute("type", "matrix");
  threshold.setAttribute("result", "mask");

  const clip = document.createElementNS(SVG_NS, "feComposite");
  clip.setAttribute("in", "SourceGraphic");
  clip.setAttribute("in2", "mask");
  clip.setAttribute("operator", "in");

  filter.append(mask, threshold, clip);
  inkDefs.append(filter);

  // Alfa = pendiente * (valor - umbral) + 0,5: visible donde el campo supera el umbral
  const render = (limit) => {
    const cut = 0.5 - EDGE_SLOPE * limit;
    threshold.setAttribute("values", `0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${EDGE_SLOPE} 0 0 0 ${cut}`);
  };

  return { id, render };
}

function initPhotoHover(photo) {
  const state = { limit: EDGE_REST };
  let filter = null;

  const render = () => filter.render(state.limit);

  photo.addEventListener("mouseenter", () => {
    filter ??= createEdgeFilter(photo.offsetWidth / photo.offsetHeight);
    render();
    photo.style.filter = `url(#${filter.id})`;
    gsap.to(state, { limit: EDGE_HOVER, duration: 0.6, ease: "power3.out", overwrite: true, onUpdate: render });
  });

  photo.addEventListener("mouseleave", () => {
    if (!filter) return;
    gsap.to(state, {
      limit: EDGE_REST,
      duration: 0.5,
      ease: "power2.inOut",
      overwrite: true,
      onUpdate: render,
      onComplete: () => { photo.style.filter = ""; },
    });
  });
}

function initGallery() {
  if (reducedMotion) return;

  document.querySelectorAll(".photo").forEach((photo) => {
    initPhotoParallax(photo);
    initPhotoHover(photo);
  });
}


/* ==========================================================================
   6. Footer: el nombre se junta al llegar al final
   ========================================================================== */

function isAtPageEnd() {
  if (lenis) return lenis.scroll >= lenis.limit - 2;

  const { scrollHeight } = document.documentElement;
  return window.scrollY + window.innerHeight >= scrollHeight - 2;
}

function initFooter() {
  const name = document.querySelector(".footer__name");
  if (!name) return;

  const words = [...name.querySelectorAll(".footer__word")];
  const links = [...document.querySelectorAll(".footer__link")];
  const idleOpacity = parseFloat(getComputedStyle(name).opacity);

  // Ancho útil del footer (sin sus márgenes). Se da en píxeles: con "100%" GSAP
  // cuenta el padding y el nombre se sale 20 px por la derecha al empezar.
  const fullWidth = () => {
    const footer = name.parentElement;
    const { paddingLeft, paddingRight } = getComputedStyle(footer);
    return footer.clientWidth - parseFloat(paddingLeft) - parseFloat(paddingRight);
  };

  // Las dos palabras pegadas: SIMPLEMENTESUAREP
  const joinedWidth = () => words.reduce((sum, word) => sum + word.offsetWidth, 0);

  // Progreso 0 (separado) a 1 (junto). El ancho se calcula en cada fotograma para
  // que un cambio de tamaño de ventana no deje valores antiguos.
  const state = { progress: 0 };
  const apply = () => {
    name.style.width = `${gsap.utils.interpolate(fullWidth(), joinedWidth(), state.progress)}px`;
    name.style.opacity = gsap.utils.interpolate(idleOpacity, 1, state.progress);
  };

  const timeline = gsap.timeline({ paused: true })
    .to(state, { progress: 1, duration: 0.9, ease: "power3.inOut", onUpdate: apply });

  let joined = false;
  let linkReveals = [];

  // LinkedIn e Instagram solo existen con el nombre junto
  const showLinks = () => {
    linkReveals = links.map((link) => ink(link, { duration: 0.9, delay: 0.5 }));
  };

  const hideLinks = () => {
    linkReveals.forEach((reveal) => reveal.progress(1).kill());
    linkReveals = [];
    gsap.to(links, { autoAlpha: 0, duration: 0.3, ease: "power2.out" });
  };

  const update = () => {
    const atEnd = isAtPageEnd();
    if (atEnd === joined) return;

    joined = atEnd;
    if (joined) {
      timeline.play();
      words.forEach((word) => inkPulse(word, { duration: 0.9 }));
      showLinks();
    } else {
      timeline.reverse();
      hideLinks();
    }
  };

  if (lenis) lenis.on("scroll", update);
  else window.addEventListener("scroll", update, { passive: true });

  window.addEventListener("resize", apply);

  apply();
  update();
}


/* ==========================================================================
   7. Etiqueta del cursor
   Sobre los elementos con data-cursor="Texto" aparece una píldora que sigue
   al ratón con inercia. Entra y sale con el efecto de tinta. Solo con ratón.
   ========================================================================== */

const CURSOR_INERTIA = 0.1; // fracción de la distancia que recorre por fotograma a 60 fps

function initCursorTag() {
  const tag = document.querySelector(".cursor-tag");
  if (!tag || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  const target = { x: 0, y: 0 };
  const pos = { x: 0, y: 0 };
  let moved = false;
  let shown = false;   // debería verse (el puntero está sobre un data-cursor)
  let visible = false; // está en pantalla, aunque sea disolviéndose

  // Un solo estado de tinta para entrar y salir: si se cambia a mitad, la
  // animación sigue desde donde está en vez de saltar
  const filter = createInkFilter();
  const DISSOLVED = { blur: 10, a: INK_AMPLITUDE, b: INK_CUT, opacity: 0 };
  const state = { ...DISSOLVED };
  const render = () => {
    filter.render(state);
    tag.style.opacity = state.opacity;
  };

  gsap.set(tag, { xPercent: -50, yPercent: -50 });
  render();

  const place = () => gsap.set(tag, { x: pos.x, y: pos.y });

  // Cada cambio de estado corta la animación anterior y sigue desde ahí
  let tweens = [];
  const animate = (...next) => {
    tweens.forEach((tween) => tween.kill());
    tweens = next;
  };

  const show = (text) => {
    tag.textContent = text;
    if (shown) return;
    shown = true;

    // Si ya no se veía, aparece directamente bajo el puntero
    if (!visible) {
      visible = true;
      pos.x = target.x;
      pos.y = target.y;
      place();
      tag.style.visibility = "visible";
    }

    tag.style.filter = `url(#${filter.id})`;
    animate(
      gsap.to(state, { blur: 0, opacity: 1, duration: 0.6, ease: "power3.out", onUpdate: render }),
      gsap.to(state, {
        a: 1,
        b: 0,
        duration: 0.3,
        delay: 0.3,
        ease: "power1.in",
        onUpdate: render,
        onComplete: () => { tag.style.filter = ""; },
      }),
    );
  };

  const hide = () => {
    if (!shown) return;
    shown = false;

    tag.style.filter = `url(#${filter.id})`;
    animate(
      gsap.to(state, { a: DISSOLVED.a, b: DISSOLVED.b, duration: 0.15, ease: "power1.out", onUpdate: render }),
      gsap.to(state, {
        blur: DISSOLVED.blur,
        opacity: 0,
        duration: 0.5,
        ease: "power2.in",
        onUpdate: render,
        onComplete: () => {
          visible = false;
          tag.style.visibility = "hidden";
          tag.style.filter = "";
        },
      }),
    );
  };

  // Muestra u oculta la etiqueta según lo que haya bajo el puntero
  const check = () => {
    const owner = document.elementFromPoint(target.x, target.y)?.closest("[data-cursor]");
    if (owner) show(owner.dataset.cursor);
    else hide();
  };

  window.addEventListener("pointermove", (event) => {
    target.x = event.clientX;
    target.y = event.clientY;
    moved = true;
  }, { passive: true });

  document.addEventListener("pointerover", (event) => {
    const owner = event.target.closest?.("[data-cursor]");
    if (owner) show(owner.dataset.cursor);
    else hide();
  });

  // El puntero sale de la ventana
  document.addEventListener("mouseout", (event) => {
    if (!event.relatedTarget) hide();
  });

  // Al hacer scroll con el ratón quieto cambia lo que hay debajo
  const onScroll = () => moved && check();
  if (lenis) lenis.on("scroll", onScroll);
  else window.addEventListener("scroll", onScroll, { passive: true });

  // Sigue al puntero también mientras se disuelve, para que no se quede clavada
  gsap.ticker.add(() => {
    if (!visible) return;

    // Independiente de la tasa de fotogramas: equivale a 0,1 por fotograma a 60 fps
    const ease = 1 - Math.pow(1 - CURSOR_INERTIA, gsap.ticker.deltaRatio());
    pos.x += (target.x - pos.x) * ease;
    pos.y += (target.y - pos.y) * ease;
    place();
  });
}


/* ==========================================================================
   8. Carga: el nombre se abre mientras un contador va de 0 a 100 y baja al
   footer (solo la primera vez por sesión)
   ========================================================================== */

const LOADER_KEY = "loader-seen";

function loaderSeen() {
  try {
    return sessionStorage.getItem(LOADER_KEY) === "1";
  } catch {
    return false;
  }
}

function markLoaderSeen() {
  try {
    sessionStorage.setItem(LOADER_KEY, "1");
  } catch {
    // Sin almacenamiento la carga se repite en cada página; no pasa nada
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function pageLoaded() {
  if (document.readyState === "complete") return Promise.resolve();
  return new Promise((resolve) => window.addEventListener("load", resolve, { once: true }));
}

async function runLoader() {
  const loader = document.querySelector(".loader");
  if (!loader) return;

  if (reducedMotion || loaderSeen()) {
    loader.remove();
    return;
  }

  markLoaderSeen();
  lenis?.stop();

  const name = loader.querySelector(".loader__name");
  const words = [...loader.querySelectorAll(".loader__word")];
  const count = loader.querySelector(".loader__count");
  const stage = loader.querySelector(".loader__stage");

  // El nombre arranca junto y centrado; se abre hasta ocupar todo el ancho
  const joined = words.reduce((sum, word) => sum + word.offsetWidth, 0);
  const open = stage.clientWidth;
  gsap.set(name, { width: joined });

  // El nombre entra junto, con tinta
  await Promise.all(words.map((word) => ink(word, { duration: 0.9 })));

  // Contador: cada cambio de cifra hace una pasada corta de tinta
  const countFilter = createInkFilter();
  const size = parseFloat(getComputedStyle(count).fontSize);
  const morph = { blur: 0, a: 1, b: 0 };
  const renderMorph = () => countFilter.render(morph);
  const openEase = gsap.parseEase("power2.out");

  const progress = { value: 0 };
  let shown = 0;
  let countState = "hidden"; // hidden -> revealing -> ready

  const update = () => {
    gsap.set(name, { width: gsap.utils.interpolate(joined, open, openEase(progress.value / 100)) });

    // El contador entra cuando el nombre ya ha abierto hueco
    if (countState === "hidden" && progress.value >= 6) {
      countState = "revealing";
      ink(count, { duration: 0.6 }).then(() => {
        renderMorph();
        count.style.filter = `url(#${countFilter.id})`;
        countState = "ready";
      });
    }

    const next = Math.round(progress.value);
    if (next === shown) return;

    shown = next;
    count.textContent = next;

    if (countState !== "ready") return;
    gsap.fromTo(morph,
      { blur: size * 0.12, a: INK_AMPLITUDE, b: INK_CUT },
      { blur: 0, a: 1, b: 0, duration: 0.3, ease: "power2.out", overwrite: true, onUpdate: renderMorph });
  };

  // Hasta el 90 % sigue un ritmo fijo; el resto espera a que cargue la página (máx. 4 s)
  await gsap.to(progress, { value: 90, duration: 2.2, ease: "power1.inOut", onUpdate: update });
  await Promise.race([pageLoaded(), wait(4000)]);
  await gsap.to(progress, { value: 100, duration: 0.5, ease: "power1.out", onUpdate: update });

  await wait(250);

  // El contador se disuelve y el nombre baja a la posición exacta del footer
  const footerName = document.querySelector(".footer__name");
  const dy = footerName.getBoundingClientRect().top - name.getBoundingClientRect().top;

  countFilter.remove();
  count.style.filter = "";

  await Promise.all([
    inkOut(count, { duration: 0.8 }),
    gsap.to(name, { y: dy, duration: 1, ease: "power3.inOut", delay: 0.1 }),
  ]);

  // Ya colocado, la capa sube y aparece la web
  await gsap.to(loader, { clipPath: "inset(0 0 100% 0)", duration: 0.8, ease: "power4.inOut", delay: 0.2 });

  loader.remove();
  lenis?.start();
}


/* ==========================================================================
   9. Arranque
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  initLenis();
  initSoundToggle();

  // Los textos se parten y se miden con la fuente final ya cargada
  await document.fonts.ready;
  document.documentElement.classList.add("ink-ready");

  initFooter();
  initInkHover();
  initScrollInk();
  initGallery();
  initCursorTag();

  await runLoader();
  revealIntro();
});
