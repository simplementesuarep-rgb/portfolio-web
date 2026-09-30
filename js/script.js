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
   4. Menú de trabajos
   "Works," abre la lista de proyectos a pantalla completa. Detrás va la foto
   del proyecto señalado, con un velo blanco y desenfoque. Con el ratón sobre
   la lista pasan tres cosas, todas con inercia para que se sientan suaves:
   la disciplina (izquierda) y el año (derecha) siguen al ratón en vertical,
   y las filas cercanas al puntero se desplazan hacia la derecha.
   ========================================================================== */

const MENU = {
  rollOut: 130,          // % que se desplaza la palabra saliente (más de 100 para que no asome)
  follow: 0.05,          // inercia con la que disciplina y año siguen al ratón
  indent: 20,            // píxeles que se desplaza la fila más cercana al puntero
  radius: 30,            // a qué distancia vertical del puntero empieza a notarse
  indentEase: 0.15,      // inercia del desplazamiento de las filas
  wipe: 0.45,            // barrido lateral con el que entra y sale la disciplina y el año
  wipeEase: "power3.inOut",
  fill: 0.05,            // inercia con la que el relleno blanco pasa de una fila a otra (menos = más retardado)
  fillPad: 6,            // píxeles que el relleno sobresale por los lados del texto
  fillReveal: 0.4,       // barrido de entrada y salida del relleno
};

function initMenu(transition) {
  const toggle = document.querySelector(".header__toggle");
  const menu = document.querySelector(".menu");
  if (!toggle || !menu) return;

  const labels = toggle.querySelectorAll(".header__toggle-text");
  const list = menu.querySelector(".menu__list");
  const items = [...list.querySelectorAll(".menu__item")];
  const links = items.map((item) => item.querySelector("a"));
  const typeBox = menu.querySelector(".menu__label");
  const yearBox = menu.querySelector(".menu__year");
  const backdrops = [...menu.querySelectorAll(".menu__image img")];
  const fill = menu.querySelector(".menu__fill");

  let open = false;
  let pointerY = 0;
  let followY = 0;
  let over = false; // el ratón está sobre la lista
  let centers = [];
  const indents = items.map(() => 0);

  // Cada texto tiene dos capas apiladas: la nueva entra con un barrido desde la
  // izquierda, como el texto del ratón en la home, y la vieja sale por la derecha
  const swapper = (box) => {
    const spans = [...box.querySelectorAll(".menu__type")];
    let active = -1;
    const wipe = (span, from, to) => {
      if (reducedMotion) gsap.set(span, { clipPath: to });
      else gsap.fromTo(span, { clipPath: from }, { clipPath: to, duration: MENU.wipe, ease: MENU.wipeEase, overwrite: true });
    };
    return {
      show(text) {
        const current = spans[active];
        if (current && current.textContent === text && current.dataset.shown === "1") return;
        const next = spans[(active + 1) % spans.length];
        next.textContent = text;
        next.dataset.shown = "1";
        wipe(next, "inset(0% 100% 0% 0%)", "inset(0% 0% 0% 0%)");
        if (current && current.dataset.shown === "1") {
          current.dataset.shown = "0";
          wipe(current, "inset(0% 0% 0% 0%)", "inset(0% 0% 0% 100%)");
        }
        active = spans.indexOf(next);
      },
      hide() {
        const current = spans[active];
        if (!current || current.dataset.shown !== "1") return;
        current.dataset.shown = "0";
        wipe(current, "inset(0% 0% 0% 0%)", "inset(0% 0% 0% 100%)");
      },
    };
  };
  const type = swapper(typeBox);
  const year = swapper(yearBox);

  // Las fotos se cargan la primera vez que se abre el menú
  let loaded = false;
  const loadBackdrops = () => {
    if (loaded) return;
    loaded = true;
    backdrops.forEach((image) => (image.src = image.dataset.src));
  };

  const showBackdrop = (index) => backdrops.forEach((image, i) => image.classList.toggle("is-active", i === index));

  const measure = () => {
    centers = items.map((item) => {
      const box = item.getBoundingClientRect();
      return box.top + box.height / 2;
    });
  };

  // Relleno blanco de la fila señalada: entra y sale con un barrido lateral, y
  // entre filas se desliza con inercia
  let fillY = 0;
  let fillTarget = 0;
  const placeFill = () => {
    // De la disciplina (izquierda) al año (derecha): de margen a margen, más el respiro
    const margin = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--margin"));
    fill.style.left = `${margin - MENU.fillPad}px`;
    fill.style.width = `${window.innerWidth - (margin - MENU.fillPad) * 2}px`;
  };

  const sweepFill = (on) => {
    gsap.killTweensOf(fill);
    if (reducedMotion) {
      gsap.set(fill, { clipPath: on ? "inset(0% 0% 0% 0%)" : "inset(0% 100% 0% 0%)" });
      return;
    }
    if (on) {
      gsap.fromTo(fill, { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: MENU.fillReveal, ease: "power3.out" });
    } else {
      gsap.to(fill, { clipPath: "inset(0% 0% 0% 100%)", duration: MENU.fillReveal, ease: "power3.inOut" });
    }
  };

  const tick = () => {
    const follow = reducedMotion ? 1 : smoothing(MENU.follow);
    followY += (pointerY - followY) * follow;
    const y = followY - typeBox.offsetHeight / 2;
    typeBox.style.transform = yearBox.style.transform = `translate3d(0, ${y}px, 0)`;

    fillY += (fillTarget - fillY) * (reducedMotion ? 1 : smoothing(MENU.fill));
    fill.style.transform = `translate3d(0, ${fillY}px, 0)`;

    const ease = reducedMotion ? 1 : smoothing(MENU.indentEase);
    items.forEach((item, i) => {
      const distance = Math.abs(pointerY - centers[i]);
      const closeness = distance < MENU.radius ? Math.cos((distance / MENU.radius) * (Math.PI / 2)) : 0;
      indents[i] += ((over ? closeness * MENU.indent : 0) - indents[i]) * ease;
      item.style.transform = `translate3d(${indents[i]}px, 0, 0)`;
    });
  };

  list.addEventListener("pointerenter", (event) => {
    over = true;
    pointerY = followY = event.clientY;
    placeFill();
    sweepFill(true);
  });
  list.addEventListener("pointermove", (event) => (pointerY = event.clientY));
  list.addEventListener("pointerleave", () => {
    over = false;
    sweepFill(false);
    type.hide();
    year.hide();
    showBackdrop(0);
  });

  items.forEach((item, i) => {
    const hover = () => {
      showBackdrop(i);
      // La caja (22 px) queda centrada en la línea de texto, que está 2,5 px por debajo del centro de la fila
      fillTarget = centers[i] - 8.5;
      if (!over) fillY = fillTarget;
      type.show(links[i].dataset.type || "");
      year.show(links[i].dataset.year || "");
    };
    item.addEventListener("pointerenter", hover);
    links[i].addEventListener("focus", hover);
  });

  // El menú se abre y se cierra con las mismas franjas que al cambiar de página:
  // se cierran, el cambio ocurre por detrás y se abren mostrando el resultado
  const apply = (value) => {
    open = value;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close" : "Works");
    menu.inert = !open;
    virtual.locked = open;

    // "Works," y "Close," se intercambian sin cambiar el ancho de la caja
    gsap.set(labels[0], { yPercent: open ? -MENU.rollOut : 0 });
    gsap.set(labels[1], { yPercent: open ? 0 : MENU.rollOut });
    gsap.set(menu, { autoAlpha: open ? 1 : 0 });

    if (open) {
      lenis?.stop();
      loadBackdrops();
      showBackdrop(0);
      measure();
      gsap.ticker.add(tick);
    } else {
      lenis?.start();
      over = false;
      gsap.killTweensOf(fill);
      gsap.set(fill, { clipPath: "inset(0% 100% 0% 0%)" });
      type.hide();
      year.hide();
      gsap.ticker.remove(tick);
    }
  };

  let busy = false;
  const set = (value) => {
    if (busy || value === open) return;
    if (reducedMotion) {
      apply(value);
      return;
    }
    busy = true;
    transition.run(() => apply(value), () => (busy = false));
  };

  gsap.set(menu, { autoAlpha: 0 });
  gsap.set(labels[1], { yPercent: MENU.rollOut });
  gsap.set(fill, { clipPath: "inset(0% 100% 0% 0%)" });

  toggle.addEventListener("click", () => set(!open));
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && open) {
      set(false);
      toggle.focus();
    }
  });
  window.addEventListener("resize", () => {
    if (!open) return;
    measure();
    placeFill();
  });
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

const TRANSITION = {
  duration: 0.5,         // cambio de página
  stagger: 0.03,
  ease: "power4.inOut",
  menu: { duration: 0.3, stagger: 0.015 }, // Works / Close: más rápido, va y vuelve
};

function initTransition() {
  const strips = document.querySelectorAll(".transition span");
  if (!strips.length) return { reveal: () => {}, run: (swap, done) => { swap(); done?.(); } };

  const reveal = (done, timing = TRANSITION) => {
    if (reducedMotion) {
      gsap.set(strips, { scaleY: 0 });
      done?.();
      return;
    }
    gsap.fromTo(strips, { scaleY: 1 }, {
      scaleY: 0,
      transformOrigin: "50% 100%",
      duration: timing.duration,
      ease: TRANSITION.ease,
      stagger: timing.stagger,
      overwrite: true,
      onComplete: done,
    });
  };

  // Cierra las franjas, hace el cambio con la pantalla tapada y las abre de nuevo
  const run = (swap, done) => {
    gsap.fromTo(strips, { scaleY: 0 }, {
      scaleY: 1,
      transformOrigin: "50% 0%",
      duration: TRANSITION.menu.duration,
      ease: TRANSITION.ease,
      stagger: TRANSITION.menu.stagger,
      overwrite: true,
      onComplete: () => {
        swap();
        reveal(done, TRANSITION.menu);
      },
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

  return { reveal, run };
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
   Hover de las cajas de la cabecera
   Al pasar el ratón, una caja negra con el texto en blanco entra con un barrido
   desde la izquierda, como la etiqueta del ratón, y al retirarlo sale por la
   derecha. Se aplica al nombre, a "Works,"/"Close," y a "Sound".
   ========================================================================== */

const LINK = { duration: 0.45, ease: "power3.inOut" };

function initLinks() {
  if (reducedMotion) return;

  document.querySelectorAll(".link, .header__toggle").forEach((box) => {
    const fill = document.createElement("span");
    fill.className = "link__fill";
    fill.setAttribute("aria-hidden", "true");
    box.append(fill);

    // La capa repite el texto de la caja y lo sigue si cambia ("Works," <-> "Close,", "Sound on")
    const read = () => (box.matches(".header__toggle") ? `${box.getAttribute("aria-label")},` : box.querySelector(".link__text").textContent);
    const sync = () => {
      const text = read();
      if (fill.textContent !== text) fill.textContent = text;
    };
    sync();
    new MutationObserver(sync).observe(box, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["aria-label"] });

    box.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "mouse") return;
      gsap.fromTo(fill, { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: LINK.duration, ease: LINK.ease, overwrite: true });
    });
    box.addEventListener("pointerleave", (event) => {
      if (event.pointerType !== "mouse") return;
      gsap.to(fill, { clipPath: "inset(0% 0% 0% 100%)", duration: LINK.duration, ease: LINK.ease, overwrite: true });
    });
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
  initCursorTag();
  initBounce();
  initSound();
  initLinks();
  const transition = initTransition();
  initMenu(transition);

  await document.fonts.ready;
  transition.reveal();
});
