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
  const links = [...document.querySelectorAll(".footer__link")];
  const idleOpacity = parseFloat(getComputedStyle(name).opacity);

  // Las dos palabras pegadas: SIMPLEMENTESUAREP
  const joinedWidth = () => words.reduce((sum, word) => sum + word.offsetWidth, 0);

  const timeline = gsap.timeline({ paused: true, defaults: { duration: 0.9, ease: "power3.inOut" } })
    .fromTo(name, { width: "100%" }, { width: joinedWidth })
    .fromTo(name, { opacity: idleOpacity }, { opacity: 1 }, 0);

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

  window.addEventListener("resize", () => {
    timeline.invalidate();
    if (joined) timeline.progress(1);
  });

  update();
}


/* ==========================================================================
   6. Carga: el nombre se abre mientras un contador va de 0 a 100 y baja al
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

  // Al volver el scroll aparece la barra y cambia el ancho útil: se mide ya con ella
  lenis?.start();
  gsap.set(name, { width: "100%" });

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
