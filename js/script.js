/* ==========================================================================
   1. Configuración
   ========================================================================== */

gsap.registerPlugin(ScrollTrigger, SplitText);

document.documentElement.classList.add("js");

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const isVirtualScroll = () => document.body.dataset.scroll === "virtual";

// Factor de suavizado por fotograma corregido para que no dependa de los fps
const smoothing = (factor) => 1 - Math.pow(1 - factor, gsap.ticker.deltaRatio());


/* ==========================================================================
   2. Scroll suave (Lenis), en las páginas con scroll nativo
   ========================================================================== */

let lenis = null;

function initLenis() {
  if (reducedMotion || isVirtualScroll()) return;

  lenis = new Lenis({
    autoRaf: false,
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
  });
  lenis.on("scroll", ScrollTrigger.update);

  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}


/* ==========================================================================
   3. Scroll virtual y carruseles (home e índice de proyectos)
   La página no tiene scroll: la rueda y el dedo mueven un valor que cada
   carrusel usa para colocar sus tarjetas en bucle. Dentro de cada tarjeta la
   foto va ampliada y se desplaza (parallax).
   ========================================================================== */

const VIRTUAL = {
  wheel: 1,       // píxeles por unidad de rueda
  touch: 2.5,     // píxeles por píxel de arrastre
  keyStep: 120,   // flechas
  ease: 0.08,     // suavizado por fotograma
  shift: 8,       // recorrido del parallax de la foto (% de su alto)
};

const virtual = { target: 0, current: 0, locked: false };
const carousels = [];

function createCarousel(root) {
  const cards = [...root.querySelectorAll(".card")];
  const images = cards.map((card) => card.querySelector(".card__image"));
  let size = 0;
  let view = 0;
  let wrap = null;

  const measure = () => {
    size = cards[0].offsetHeight;
    view = root.clientHeight;
    // Cada tarjeta vive entre justo encima del carrusel y el final de la fila
    wrap = gsap.utils.wrap(-size, cards.length * size - size);
  };

  const render = (scroll) => {
    cards.forEach((card, i) => {
      const y = wrap(i * size - scroll);
      const shift = gsap.utils.mapRange(view, -size, -VIRTUAL.shift, VIRTUAL.shift, y);
      card.style.transform = `translate3d(0, ${y}px, 0)`;
      images[i].style.transform = `translate3d(0, ${shift}%, 0) scale(1.2)`;
    });
  };

  measure();
  new ResizeObserver(measure).observe(root);
  return { render };
}

function initVirtualScroll() {
  if (!isVirtualScroll()) return;

  document.querySelectorAll("[data-carousel]").forEach((root) => carousels.push(createCarousel(root)));
  if (!carousels.length) return;

  ScrollTrigger.observe({
    target: window,
    type: "wheel,touch",
    preventDefault: true,
    onChangeY: (self) => {
      if (virtual.locked) return;
      const wheel = self.event.type === "wheel";
      virtual.target += wheel ? self.deltaY * VIRTUAL.wheel : -self.deltaY * VIRTUAL.touch;
    },
  });

  window.addEventListener("keydown", (event) => {
    if (virtual.locked) return;
    const steps = {
      ArrowDown: VIRTUAL.keyStep,
      ArrowUp: -VIRTUAL.keyStep,
      PageDown: window.innerHeight * 0.8,
      PageUp: -window.innerHeight * 0.8,
      " ": window.innerHeight * 0.8,
    };
    if (event.key in steps) virtual.target += steps[event.key];
  });

  gsap.ticker.add(() => {
    const k = reducedMotion ? 1 : smoothing(VIRTUAL.ease);
    const before = virtual.current;
    virtual.current += (virtual.target - virtual.current) * k;
    carousels.forEach((carousel) => carousel.render(virtual.current));
    if (Math.abs(virtual.current - before) > 0.1) window.dispatchEvent(new Event("virtualscroll"));
  });
}


/* ==========================================================================
   4. Works: lista de proyectos en bucle (works.html)
   No hay scroll nativo: la rueda, el dedo y las flechas mueven la lista, que
   da vueltas sin final. El proyecto que pasa por el centro es el activo: su
   foto pasa a ser el fondo, su título aparece en cursiva, su número viaja al
   borde izquierdo y su año al derecho. Al soltar, la lista encaja en una fila.
   ========================================================================== */

const ARCHIVE = {
  row: 24,        // píxeles entre filas
  gap: 46,        // píxeles extra alrededor del activo, para su título
  reach: 5,       // filas visibles a cada lado del centro
  wheel: 0.0025,  // filas por unidad de rueda
  touch: 0.008,   // filas por píxel de arrastre
  ease: 0.09,     // suavizado por fotograma
  snap: 160,      // milisegundos quieto antes de encajar en una fila
};

const mod = (n, m) => ((n % m) + m) % m;
const smooth = (t) => t * t * (3 - 2 * t);

function initArchive() {
  const root = document.querySelector(".archive");
  if (!root) return;

  const sources = [...root.querySelectorAll(".archive__index a")];
  const backdrops = [...root.querySelectorAll(".archive__bg img")];
  const count = sources.length;
  if (!count) return;

  const items = sources.map((a) => ({
    title: a.textContent.trim(),
    numeral: a.dataset.numeral,
    type: a.dataset.type,
    year: a.dataset.year,
  }));

  const style = getComputedStyle(document.documentElement);
  const margin = parseFloat(style.getPropertyValue("--margin"));
  const street = parseFloat(style.getPropertyValue("--gutter")) * 2; // media calle central

  // Las filas se reutilizan: solo hay las visibles y cada una cambia de proyecto al salir de pantalla
  const stage = document.createElement("div");
  stage.className = "archive__stage";
  stage.setAttribute("aria-hidden", "true");
  root.append(stage);

  const rows = Array.from({ length: ARCHIVE.reach * 2 + 2 }, () => {
    const el = document.createElement("div");
    el.className = "archive__row";
    el.innerHTML =
      '<span class="archive__num"></span><span class="archive__name"></span>' +
      '<span class="archive__year"></span><span class="archive__title"></span><span class="archive__kind"></span>';
    stage.append(el);
    return {
      el,
      num: el.children[0],
      name: el.children[1],
      year: el.children[2],
      title: el.children[3],
      kind: el.children[4],
      index: -1,
      offset: 0,
      virtual: 0,
    };
  });

  // Ancho de cada número y año, para saber cuánto tienen que viajar hasta el borde
  const numWidth = items.map(() => 24);
  const yearWidth = items.map(() => 32);
  document.fonts.ready.then(() => {
    const probe = rows[0];
    items.forEach((item, i) => {
      probe.num.textContent = item.numeral;
      probe.year.textContent = item.year;
      numWidth[i] = probe.num.offsetWidth;
      yearWidth[i] = probe.year.offsetWidth;
    });
    probe.index = -1;
  });

  let target = 0;
  let current = 0;
  let active = -1;
  let timer = 0;

  const nudge = (delta) => {
    target += delta;
    clearTimeout(timer);
    timer = setTimeout(() => (target = Math.round(target)), ARCHIVE.snap);
  };

  const step = (delta) => {
    clearTimeout(timer);
    target = Math.round(target) + delta;
  };

  const render = () => {
    const width = window.innerWidth;
    const half = width / 2;
    const base = Math.floor(current);

    rows.forEach((row, i) => {
      const virtualIndex = base - ARCHIVE.reach + i;
      const d = virtualIndex - current;
      const ad = Math.abs(d);
      const idx = mod(virtualIndex, count);
      const item = items[idx];

      if (row.index !== idx) {
        row.index = idx;
        row.num.textContent = item.numeral;
        row.name.textContent = item.title;
        row.year.textContent = item.year;
        row.title.textContent = item.title;
        row.kind.textContent = item.type;
      }

      // Cerca del centro las filas se separan para hacer sitio al título
      const y = d * ARCHIVE.row + Math.sign(d) * Math.min(ad, 1) * ARCHIVE.gap;
      const p = smooth(1 - Math.min(ad, 1)); // 1 en el centro, 0 a una fila de distancia
      const fade = Math.min(1, Math.max(0, 1 - (ad - 0.6) / (ARCHIVE.reach - 0.6)));

      row.offset = y;
      row.virtual = virtualIndex;
      row.el.style.transform = `translate3d(0, ${y}px, 0)`;
      row.el.style.opacity = fade;

      const numTravel = half - street - margin - numWidth[idx];
      const yearTravel = half - street - margin - yearWidth[idx];
      row.num.style.transform = `translate3d(${-numTravel * p}px, -50%, 0)`;
      row.year.style.transform = `translate3d(${yearTravel * p}px, -50%, 0)`;
      row.name.style.opacity = Math.max(0, 1 - p * 2.2);
      row.year.style.opacity = Math.min(1, Math.max(0, (p - 0.35) * 2.5));
      row.title.style.opacity = row.kind.style.opacity = Math.min(1, Math.max(0, (p - 0.5) * 2.2));
    });

    const now = mod(Math.round(current), count);
    if (now !== active) {
      active = now;
      backdrops.forEach((image, i) => image.classList.toggle("is-active", i === now));
    }
  };

  const open = (index) => sources[index].click();

  ScrollTrigger.observe({
    target: window,
    type: "wheel,touch",
    preventDefault: true,
    onChangeY: (self) => {
      const wheel = self.event.type === "wheel";
      nudge(wheel ? self.deltaY * ARCHIVE.wheel : -self.deltaY * ARCHIVE.touch);
    },
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "PageDown") step(1);
    else if (event.key === "ArrowUp" || event.key === "PageUp") step(-1);
    else if (event.key === "Enter" && document.activeElement === document.body) open(mod(Math.round(target), count));
  });

  // Un clic en el proyecto activo lo abre; en otra fila, lleva la lista hasta él
  stage.addEventListener("click", (event) => {
    const centre = window.innerHeight / 2;
    let best = null;
    rows.forEach((row) => {
      const distance = Math.abs(event.clientY - (centre + row.offset));
      if (!best || distance < best.distance) best = { row, distance };
    });
    if (!best || best.distance > ARCHIVE.row) return;

    if (Math.abs(best.row.virtual - Math.round(current)) === 0) open(best.row.index);
    else step(best.row.virtual - Math.round(target));
  });

  gsap.ticker.add(() => {
    const k = reducedMotion ? 1 : smoothing(ARCHIVE.ease);
    current += (target - current) * k;
    if (Math.abs(target - current) < 0.0005) current = target;
    render();
  });
}

// "Close," vuelve a la página desde la que se llegó (o a la home si se entró directamente)
function initClose() {
  const close = document.querySelector("[data-close]");
  if (!close || !document.referrer) return;

  const from = new URL(document.referrer);
  if (from.origin === window.location.origin && from.pathname !== window.location.pathname) close.href = from.href;
}


/* ==========================================================================
   5. Etiqueta del cursor
   Sobre cada proyecto aparece una etiqueta con su tipo (arriba, pequeño) y
   su nombre (debajo). Cuelga del ratón, abajo a la derecha, y lo sigue con
   inercia. Cada línea entra y sale con un barrido de clip-path, una detrás
   de otra.
   ========================================================================== */

const CURSOR = { inertia: 0.1, duration: 0.4, stagger: 0.06, ease: "power3.inOut", offset: 14, edge: 10 };

function initCursorTag() {
  const tag = document.querySelector(".cursor-tag");
  if (!tag || !finePointer) return;

  const type = tag.querySelector(".cursor-tag__type");
  const title = tag.querySelector(".cursor-tag__title");
  const lines = [type, title];
  const pointer = { x: 0, y: 0 };
  const position = { x: 0, y: 0 };
  let visible = false;

  const show = (host) => {
    type.textContent = host.dataset.cursorType || "";
    title.textContent = host.dataset.cursorTitle;
    type.hidden = !type.textContent;
    if (visible) return;
    visible = true;
    position.x = pointer.x;
    position.y = pointer.y;
    gsap.fromTo(lines, { clipPath: "inset(0% 100% 0% 0%)" }, {
      clipPath: "inset(0% 0% 0% 0%)",
      duration: CURSOR.duration,
      ease: CURSOR.ease,
      stagger: CURSOR.stagger,
      overwrite: true,
    });
  };

  const hide = () => {
    if (!visible) return;
    visible = false;
    gsap.to(lines, {
      clipPath: "inset(0% 0% 0% 100%)",
      duration: CURSOR.duration,
      ease: CURSOR.ease,
      stagger: CURSOR.stagger,
      overwrite: true,
    });
  };

  const check = (element) => {
    const host = element?.closest?.("[data-cursor-title]");
    if (host) show(host);
    else hide();
  };

  // Lo que hay bajo el ratón también cambia al hacer scroll sin moverlo
  const checkUnderPointer = () => check(document.elementFromPoint(pointer.x, pointer.y));

  window.addEventListener("pointermove", (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    check(event.target);
  });
  document.addEventListener("mouseout", (event) => {
    if (!event.relatedTarget) hide();
  });
  window.addEventListener("virtualscroll", checkUnderPointer);
  window.addEventListener("scroll", checkUnderPointer, { passive: true });

  gsap.ticker.add(() => {
    const k = smoothing(CURSOR.inertia);
    position.x += (pointer.x - position.x) * k;
    position.y += (pointer.y - position.y) * k;
    // Cuelga del ratón, abajo a la derecha; junto a un borde se queda dentro de la pantalla
    const x = Math.min(position.x + CURSOR.offset, window.innerWidth - tag.offsetWidth - CURSOR.edge);
    const y = Math.min(position.y + CURSOR.offset, window.innerHeight - tag.offsetHeight - CURSOR.edge);
    tag.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  });
}


/* ==========================================================================
   6. Transición entre páginas
   Al salir, 10 franjas bajan y tapan la pantalla; al entrar, se retiran hacia
   abajo. Las franjas arrancan tapando (CSS) para que no se vea un salto.
   ========================================================================== */

const TRANSITION = { duration: 0.5, stagger: 0.03, ease: "power4.inOut" };

function initTransition() {
  const strips = document.querySelectorAll(".transition span");
  if (!strips.length) return { reveal: () => {} };

  const reveal = () => {
    if (reducedMotion) {
      gsap.set(strips, { scaleY: 0 });
      return;
    }
    gsap.fromTo(strips, { scaleY: 1 }, {
      scaleY: 0,
      transformOrigin: "50% 100%",
      duration: TRANSITION.duration,
      ease: TRANSITION.ease,
      stagger: TRANSITION.stagger,
      overwrite: true,
    });
  };

  const leave = (href) => {
    lenis?.stop();
    virtual.locked = true;
    if (reducedMotion) {
      window.location.assign(href);
      return;
    }
    gsap.fromTo(strips, { scaleY: 0 }, {
      scaleY: 1,
      transformOrigin: "50% 0%",
      duration: TRANSITION.duration,
      ease: TRANSITION.ease,
      stagger: TRANSITION.stagger,
      overwrite: true,
      onComplete: () => window.location.assign(href),
    });
  };

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.target === "_blank" || link.hasAttribute("download")) return;

    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    if (url.pathname === window.location.pathname && url.hash) return;

    event.preventDefault();
    leave(url.href);
  });

  // Al volver con el botón atrás la página sale de la caché con las franjas puestas
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    lenis?.start();
    virtual.locked = false;
    reveal();
  });

  return { reveal };
}


/* ==========================================================================
   7. Footer: cuadrado que rebota
   Se mueve solo en diagonal a velocidad constante; en cada choque con un
   borde cambia a la siguiente foto del proyecto.
   ========================================================================== */

const BOUNCE = { speed: 180 }; // píxeles por segundo en cada eje

function initBounce() {
  const box = document.querySelector(".bounce");
  if (!box) return;

  const images = [...box.querySelectorAll("img")];
  const area = box.parentElement;
  let index = 0;
  let x = Math.random() * (area.clientWidth - box.offsetWidth);
  let y = Math.random() * (area.clientHeight - box.offsetHeight);
  let vx = BOUNCE.speed;
  let vy = BOUNCE.speed;

  const showImage = () => images.forEach((image, i) => image.classList.toggle("is-active", i === index));
  const place = () => (box.style.transform = `translate3d(${x}px, ${y}px, 0)`);

  showImage();
  place();
  if (reducedMotion) return;

  gsap.ticker.add((time, delta) => {
    const dt = Math.min(delta, 100) / 1000;
    const maxX = area.clientWidth - box.offsetWidth;
    const maxY = area.clientHeight - box.offsetHeight;
    let hit = false;

    x += vx * dt;
    y += vy * dt;
    if (x <= 0 || x >= maxX) {
      x = gsap.utils.clamp(0, maxX, x);
      vx = x <= 0 ? BOUNCE.speed : -BOUNCE.speed;
      hit = true;
    }
    if (y <= 0 || y >= maxY) {
      y = gsap.utils.clamp(0, maxY, y);
      vy = y <= 0 ? BOUNCE.speed : -BOUNCE.speed;
      hit = true;
    }
    if (hit) {
      index = (index + 1) % images.length;
      showImage();
    }
    place();
  });
}


/* ==========================================================================
   8. Sound
   Botón de la cabecera: por ahora solo cambia de estado y se acuerda de él
   entre páginas; el audio llegará con los vídeos.
   ========================================================================== */

function initSound() {
  const button = document.querySelector(".header__sound");
  if (!button) return;

  const text = button.querySelector(".link__text");
  const set = (on) => {
    button.setAttribute("aria-pressed", String(on));
    text.textContent = on ? "Sound on" : "Sound";
    try {
      sessionStorage.setItem("sound", on ? "1" : "0");
    } catch {}
  };

  let on = false;
  try {
    on = sessionStorage.getItem("sound") === "1";
  } catch {}
  set(on);

  button.addEventListener("click", () => set(button.getAttribute("aria-pressed") !== "true"));
}


/* ==========================================================================
   9. Arranque
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  initLenis();
  initVirtualScroll();
  initArchive();
  initClose();
  initCursorTag();
  initBounce();
  initSound();
  const transition = initTransition();

  await document.fonts.ready;
  transition.reveal();
});
