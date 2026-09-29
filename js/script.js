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

  lenis = new Lenis({ autoRaf: false });
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

function createInkFilter() {
  if (!inkDefs) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("ink-defs");
    inkDefs = document.createElementNS(SVG_NS, "defs");
    svg.append(inkDefs);
    document.body.append(svg);
  }

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
   5. Footer: el nombre se junta al llegar al final
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
  const idleOpacity = parseFloat(getComputedStyle(name).opacity);

  // Ancho de las dos palabras más un espacio
  const joinedWidth = () => {
    const space = parseFloat(getComputedStyle(name).fontSize) * 0.28;
    return words.reduce((sum, word) => sum + word.offsetWidth, 0) + space;
  };

  const timeline = gsap.timeline({ paused: true, defaults: { duration: 0.9, ease: "power3.inOut" } })
    .fromTo(name, { width: "100%" }, { width: joinedWidth })
    .fromTo(name, { opacity: idleOpacity }, { opacity: 1 }, 0);

  let joined = false;

  const update = () => {
    const atEnd = isAtPageEnd();
    if (atEnd === joined) return;

    joined = atEnd;
    if (joined) {
      timeline.play();
      words.forEach((word) => inkPulse(word, { duration: 0.9 }));
    } else {
      timeline.reverse();
    }
  };

  if (lenis) lenis.on("scroll", update);
  else window.addEventListener("scroll", update, { passive: true });

  window.addEventListener("resize", () => {
    timeline.invalidate();
    if (joined) timeline.progress(1);
  });

  update();
}


/* ==========================================================================
   6. Carga: el nombre se forma con tinta (solo la primera vez por sesión)
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

  // Espera a que cargue la página, pero nunca más de 4 s
  await Promise.race([pageLoaded(), wait(4000)]);

  await ink(loader.querySelector(".loader__name"), { duration: 1.4 });
  await gsap.to(loader, { clipPath: "inset(0 0 100% 0)", duration: 0.8, ease: "power4.inOut", delay: 0.3 });

  loader.remove();
  lenis?.start();
}


/* ==========================================================================
   7. Arranque
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

  await runLoader();
  revealIntro();
});
