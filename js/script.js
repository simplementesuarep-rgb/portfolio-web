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
   "Works," abre la lista de proyectos a pantalla completa; al pasar por uno
   se ve su foto de fondo y, a la izquierda, su disciplina.
   ========================================================================== */

const MENU = {
  duration: 0.8,
  ease: "power4.inOut",
  stagger: 0.04,
  label: 0.7,
  labelEase: "power3.inOut",
  rollOut: 130,    // % que se desplaza la palabra saliente; más de 100 para que no asome por el relleno de la caja
  typeMove: 0.5,   // lo que tarda la disciplina en pasar de una fila a otra
  typeEase: "power3.out",
  typeFade: 0.3,
};

function initMenu() {
  const toggle = document.querySelector(".header__toggle");
  const menu = document.querySelector(".menu");
  if (!toggle || !menu) return;

  const labels = toggle.querySelectorAll(".header__toggle-text");
  const type = menu.querySelector(".menu__label");
  const list = menu.querySelector(".menu__list");
  const links = menu.querySelectorAll(".menu__item a");
  const image = menu.querySelector(".menu__image img");
  let open = false;

  const set = (value) => {
    open = value;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close" : "Works");

    // "Works," sube y sale y "Close," entra desde abajo, sin cambiar el ancho de la caja
    const roll = [{ yPercent: open ? -MENU.rollOut : 0 }, { yPercent: open ? 0 : MENU.rollOut }];
    labels.forEach((label, i) => {
      if (reducedMotion) gsap.set(label, roll[i]);
      else gsap.to(label, { ...roll[i], duration: MENU.label, ease: MENU.labelEase, overwrite: true });
    });
    menu.inert = !open;
    virtual.locked = open;
    if (open) lenis?.stop();
    else lenis?.start();

    const clip = open ? "inset(0% 0% 0% 0%)" : "inset(0% 0% 100% 0%)";
    if (reducedMotion) {
      gsap.set(menu, { clipPath: clip });
      return;
    }
    gsap.to(menu, { clipPath: clip, duration: MENU.duration, ease: MENU.ease, overwrite: true });
    if (open) {
      gsap.fromTo(links, { yPercent: 110 }, {
        yPercent: 0,
        duration: MENU.duration,
        ease: "power4.out",
        stagger: MENU.stagger,
        delay: MENU.duration * 0.35,
        overwrite: true,
      });
    }
  };

  gsap.set(labels[1], { yPercent: MENU.rollOut });
  toggle.addEventListener("click", () => set(!open));
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && open) {
      set(false);
      toggle.focus();
    }
  });

  // La disciplina del proyecto aparece a la izquierda, a la altura de su fila,
  // y se desliza de una fila a otra siguiendo al ratón
  const first = links[0].closest(".menu__item");
  let typeShown = false;

  const showType = (link) => {
    const text = link.dataset.type;
    if (!text) return hideType();

    const y = link.closest(".menu__item").getBoundingClientRect().top - first.getBoundingClientRect().top;
    type.textContent = text;
    if (reducedMotion || !typeShown) {
      gsap.killTweensOf(type);
      gsap.set(type, { y });
    } else {
      gsap.to(type, { y, duration: MENU.typeMove, ease: MENU.typeEase, overwrite: "auto" });
    }
    gsap.to(type, { opacity: 1, duration: reducedMotion ? 0 : MENU.typeFade, overwrite: "auto" });
    typeShown = true;
  };

  const hideType = () => {
    typeShown = false;
    gsap.to(type, { opacity: 0, duration: reducedMotion ? 0 : MENU.typeFade, overwrite: "auto" });
  };

  links.forEach((link) => {
    if (link.dataset.image) {
      link.addEventListener("pointerenter", () => {
        image.src = link.dataset.image;
        menu.classList.add("has-image");
      });
      link.addEventListener("pointerleave", () => menu.classList.remove("has-image"));
    }
    link.addEventListener("pointerenter", () => showType(link));
    link.addEventListener("focus", () => showType(link));
  });
  list.addEventListener("pointerleave", hideType);
  list.addEventListener("focusout", hideType);
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
  initMenu();
  initCursorTag();
  initBounce();
  initSound();
  const transition = initTransition();

  await document.fonts.ready;
  transition.reveal();
});
