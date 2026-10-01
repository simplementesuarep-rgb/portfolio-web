/* ==========================================================================
   1. Configuración
   ========================================================================== */

gsap.registerPlugin(ScrollTrigger, SplitText);

document.documentElement.classList.add("js");

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const isVirtualScroll = () => document.body.dataset.scroll === "virtual";

// Raíz de la web (script.js vive en /js/), para encontrar los audios desde cualquier página
const SITE_ROOT = new URL("../", document.currentScript.src);

// Efectos de sonido: no hacen nada hasta que se activa "Sound" (ver initSound).
// sfx.play("nombre") suena una vez; sfx.scrub(píxeles) suena al ritmo del scroll.
const sfx = { play: () => {}, scrub: () => {} };

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
  let lastScroll = 0;
  lenis.on("scroll", (instance) => {
    sfx.scrub(instance.scroll - lastScroll);
    lastScroll = instance.scroll;
  });

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
    sfx.scrub(virtual.current - before);
  });
}


/* ==========================================================================
   4. Menú de trabajos
   "Works," abre la lista de proyectos a pantalla completa. Detrás va la foto
   del proyecto señalado, con un velo blanco y desenfoque. La lista empieza en
   el centro de la pantalla y da vueltas sin final con la rueda o el dedo: se
   repite tantas veces como haga falta para llenar el alto. La fila que queda
   bajo el ratón, sea porque lo mueves o porque la lista pasa por debajo, se
   marca con el relleno blanco, la disciplina (izquierda) y el año (derecha).
   Todo va con inercia para que se sienta suave. "Close," aparta los nombres
   que pasan a su altura: la lista hace una onda hacia la derecha y lo rodea,
   para no entrar en un proyecto sin querer al ir a cerrar.
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
  wheel: 0.6,            // píxeles que avanza la lista por cada unidad de rueda
  touch: 1.5,            // píxeles que avanza por cada píxel que se arrastra el dedo
  scrollEase: 0.08,      // inercia del scroll de la lista (menos = más suave)
  repelGap: 30,          // aire entre "Close," y los nombres que lo rodean
  repelRadius: 80,       // alto de la onda: a qué distancia vertical de "Close," empieza a apartar
};

function initMenu(transition) {
  const toggle = document.querySelector(".header__toggle");
  const menu = document.querySelector(".menu");
  if (!toggle || !menu) return;

  const labels = toggle.querySelectorAll(".header__toggle-text");
  const list = menu.querySelector(".menu__list");
  const items = [...list.querySelectorAll(".menu__item")];
  const links = items.map((item) => item.querySelector("a"));
  const count = items.length;
  const typeBox = menu.querySelector(".menu__label");
  const yearBox = menu.querySelector(".menu__year");
  const backdrops = [...menu.querySelectorAll(".menu__image img")];
  const fill = menu.querySelector(".menu__fill");

  let open = false;
  let pointerY = 0;
  let followY = 0;
  let over = false;   // el ratón está sobre la lista
  let focused = -1;   // fila con el foco del teclado
  let active = -1;    // fila marcada ahora mismo

  // Cada texto tiene dos capas apiladas: la nueva entra con un barrido desde la
  // izquierda, como el texto del ratón en la home, y la vieja sale por la derecha
  const swapper = (box) => {
    const spans = [...box.querySelectorAll(".menu__type")];
    let current = -1;
    const wipe = (span, from, to) => {
      if (reducedMotion) gsap.set(span, { clipPath: to });
      else gsap.fromTo(span, { clipPath: from }, { clipPath: to, duration: MENU.wipe, ease: MENU.wipeEase, overwrite: true });
    };
    return {
      show(text) {
        const now = spans[current];
        if (now && now.textContent === text && now.dataset.shown === "1") return;
        const next = spans[(current + 1) % spans.length];
        next.textContent = text;
        next.dataset.shown = "1";
        wipe(next, "inset(0% 100% 0% 0%)", "inset(0% 0% 0% 0%)");
        if (now && now.dataset.shown === "1") {
          now.dataset.shown = "0";
          wipe(now, "inset(0% 0% 0% 0%)", "inset(0% 0% 0% 100%)");
        }
        current = spans.indexOf(next);
      },
      hide() {
        const now = spans[current];
        if (!now || now.dataset.shown !== "1") return;
        now.dataset.shown = "0";
        wipe(now, "inset(0% 0% 0% 0%)", "inset(0% 0% 0% 100%)");
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

  /* ---- Lista sin final ---------------------------------------------------- */

  // Las copias solo sirven para rellenar la pantalla: el lector de pantalla y
  // el tabulador ven únicamente la lista original
  let rows = [];
  let rowH = 0;
  let total = 0;
  let startY = 0;
  let wrap = (value) => value;
  let scroll = 0;
  let scrollTarget = 0;
  let repelY = 0;     // centro vertical de "Close,"
  let repelPush = 0;  // cuánto hay que apartar una fila para dejarlo libre

  const build = () => {
    list.querySelectorAll(".menu__item--copy").forEach((copy) => copy.remove());
    rowH = items[0].offsetHeight;
    const copies = Math.max(1, Math.ceil((window.innerHeight + rowH * 2) / (rowH * count)));
    const elements = [...items];
    for (let c = 1; c < copies; c++) {
      items.forEach((item) => {
        const copy = item.cloneNode(true);
        copy.classList.add("menu__item--copy");
        copy.setAttribute("aria-hidden", "true");
        copy.querySelector("a").tabIndex = -1;
        list.append(copy);
        elements.push(copy);
      });
    }
    rows = elements.map((el, k) => ({ el, index: k % count, y: 0, indent: 0 }));
    total = rows.length * rowH;
    startY = window.innerHeight / 2 - rowH / 2; // "View all" arranca en el centro
    wrap = gsap.utils.wrap(-rowH, total - rowH);
    active = -1;

    const button = toggle.getBoundingClientRect();
    repelY = button.top + button.height / 2;
    repelPush = Math.max(0, button.right - list.getBoundingClientRect().left + MENU.repelGap);
  };

  // Onda alrededor de "Close,": empuje completo a su altura y se suaviza hasta
  // cero a MENU.repelRadius de distancia
  const repel = (center) => {
    const distance = Math.abs(center - repelY);
    if (distance >= MENU.repelRadius) return 0;
    return repelPush * (Math.cos((distance / MENU.repelRadius) * Math.PI) + 1) / 2;
  };

  // Lleva la lista, por el camino más corto, hasta dejar la fila i en el centro
  const scrollToRow = (i) => {
    const desired = -i * rowH;
    scrollTarget = desired + Math.round((scrollTarget - desired) / total) * total;
  };

  ScrollTrigger.observe({
    target: menu,
    type: "wheel,touch",
    preventDefault: true,
    onChangeY: (self) => {
      if (!open) return;
      const wheel = self.event.type === "wheel";
      scrollTarget += wheel ? -self.deltaY * MENU.wheel : self.deltaY * MENU.touch;
    },
  });

  /* ---- Relleno blanco de la fila marcada ---------------------------------- */

  let fillY = 0;
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

  // La caja (22 px) queda centrada en la línea de texto, que está 2,5 px por debajo del centro de la fila
  const fillFor = (row) => row.y + rowH / 2 - 8.5;

  // Cambia la fila marcada: relleno, disciplina, año y foto de fondo
  const mark = (k) => {
    if (k === active) return;
    const was = active;
    active = k;
    if (k < 0) {
      sweepFill(false);
      type.hide();
      year.hide();
      showBackdrop(0);
      return;
    }
    const { index } = rows[k];
    sfx.play("menu");
    if (was < 0) {
      fillY = fillFor(rows[k]);
      sweepFill(true);
    }
    showBackdrop(index);
    type.show(links[index].dataset.type || "");
    year.show(links[index].dataset.year || "");
  };

  const tick = () => {
    const before = scroll;
    scroll += (scrollTarget - scroll) * (reducedMotion ? 1 : smoothing(MENU.scrollEase));
    sfx.scrub(scroll - before);

    const follow = reducedMotion ? 1 : smoothing(MENU.follow);
    followY += (pointerY - followY) * follow;
    const labelY = followY - typeBox.offsetHeight / 2;
    typeBox.style.transform = yearBox.style.transform = `translate3d(0, ${labelY}px, 0)`;

    // Posición de cada fila y cuál queda bajo el ratón
    const ease = reducedMotion ? 1 : smoothing(MENU.indentEase);
    let under = -1;
    rows.forEach((row, k) => {
      row.y = wrap(startY + k * rowH + scroll);
      if (over && pointerY >= row.y && pointerY < row.y + rowH) under = k;

      const center = row.y + rowH / 2;
      const distance = Math.abs(pointerY - center);
      const closeness = distance < MENU.radius ? Math.cos((distance / MENU.radius) * (Math.PI / 2)) : 0;
      row.indent += ((over ? closeness * MENU.indent : 0) - row.indent) * ease;
      row.el.style.transform = `translate3d(${row.indent + repel(center)}px, ${row.y}px, 0)`;
    });
    mark(over ? under : focused);

    if (active >= 0) {
      fillY += (fillFor(rows[active]) - fillY) * (reducedMotion ? 1 : smoothing(MENU.fill));
      fill.style.transform = `translate3d(0, ${fillY}px, 0)`;
    }
  };

  list.addEventListener("pointerenter", (event) => {
    over = true;
    pointerY = followY = event.clientY;
    placeFill();
  });
  list.addEventListener("pointermove", (event) => (pointerY = event.clientY));
  list.addEventListener("pointerleave", () => (over = false));

  // Con el teclado, la fila con el foco viaja al centro y se marca
  links.forEach((link, i) => {
    link.addEventListener("focus", () => {
      focused = i;
      pointerY = followY = startY + rowH / 2;
      placeFill();
      scrollToRow(i);
    });
    link.addEventListener("blur", () => (focused = -1));
  });

  /* ---- Abrir y cerrar ---------------------------------------------------- */

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
      build();
      placeFill();
      scroll = scrollTarget = 0;
      tick();
      gsap.ticker.add(tick);
    } else {
      lenis?.start();
      over = false;
      focused = -1;
      active = -1;
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
    if (!open) return;
    if (event.key === "Escape") {
      set(false);
      toggle.focus();
    } else if (event.key === "ArrowDown") {
      scrollTarget -= rowH;
    } else if (event.key === "ArrowUp") {
      scrollTarget += rowH;
    }
  });
  window.addEventListener("resize", () => {
    if (!open) return;
    build();
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
   Cortinas: hover de las fotos que llevan a un proyecto
   Al pasar el ratón, la foto se cubre con franjas verticales que se despliegan
   una tras otra de izquierda a derecha, como cortinas. Cada franja enseña la
   misma foto al doble de ancho, encuadrada en el trozo que le toca y con un
   pequeño desfase, así que la imagen se ve partida, como a través de un
   cristal acanalado. Al salir, las franjas se recogen hacia la derecha.
   La foto de dentro no se mueve. Se aplica a las tarjetas de la home y del
   índice y al bloque del siguiente proyecto.
   ========================================================================== */

const CURTAINS = {
  count: 9,              // número de franjas
  step: 3.75,            // desfase en píxeles que se acumula hacia el centro
  duration: 0.2,         // despliegue de cada franja (segundos)
  stagger: 0.02,         // retardo entre una franja y la siguiente (segundos)
};

function initCurtains() {
  if (!finePointer || reducedMotion) return;

  const selector = ".card[data-cursor-title], .next[data-cursor-title]";
  if (!document.querySelector(selector)) return;

  const layers = new Map();

  // Las franjas se construyen la primera vez que se pasa por cada foto, con la
  // imagen que el navegador ya ha cargado. En el siguiente proyecto van dentro
  // de la foto, por debajo del velo y del texto.
  const build = (host) => {
    const source = host.querySelector("img");
    const holder = host.matches(".next") ? host.querySelector(".next__image") : host;
    const layer = document.createElement("div");
    layer.className = "curtains";
    layer.setAttribute("aria-hidden", "true");
    const last = CURTAINS.count - 1;
    const middle = last / 2;
    for (let i = 0; i < CURTAINS.count; i++) {
      const strip = document.createElement("div");
      strip.className = "curtains__strip";
      strip.style.transition = `transform ${CURTAINS.duration}s ease-out ${i * CURTAINS.stagger}s`;
      const image = document.createElement("img");
      image.alt = "";
      image.src = source.currentSrc || source.src;
      // Encuadre de cada franja: de izquierda (0 %) a derecha (100 %), con un
      // desfase que crece desde los bordes hacia el centro, en sentidos opuestos
      const offset = Math.min(i, last - i) * CURTAINS.step * (i < middle ? -1 : 1);
      image.style.objectPosition = `calc(${(i / last) * 100}% + ${offset}px) center`;
      strip.append(image);
      layer.append(strip);
    }
    holder.append(layer);
    layer.getBoundingClientRect(); // fija el estado cerrado antes de abrir por primera vez
    layers.set(host, layer);
    return layer;
  };

  // Cada apertura y cierre suena como unas lamas que pasan de izquierda a derecha
  const show = (host) => {
    (layers.get(host) || build(host)).classList.add("is-open");
    sfx.play("image");
  };
  const hide = (host) => {
    const layer = layers.get(host);
    if (!layer?.classList.contains("is-open")) return;
    layer.classList.remove("is-open");
    sfx.play("imageOut");
  };

  const pointer = { x: -1, y: -1 };
  let current = null;

  const check = (element) => {
    const host = element?.closest?.(selector) || null;
    if (host === current) return;
    if (current) hide(current);
    current = host;
    if (current) show(current);
  };

  // Igual que la etiqueta del ratón: lo que hay debajo también cambia con el scroll
  const checkUnderPointer = () => check(document.elementFromPoint(pointer.x, pointer.y));

  window.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse") return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    check(event.target);
  });
  document.addEventListener("mouseout", (event) => {
    if (!event.relatedTarget) check(null);
  });
  window.addEventListener("virtualscroll", checkUnderPointer);
  window.addEventListener("scroll", checkUnderPointer, { passive: true });
}


/* ==========================================================================
   Pantalla de carga
   Solo en la primera página de la visita. Una cuadrícula de porcentajes
   escritos en palabras ("Five", "Ten"… "One hundred") cuenta hacia arriba
   como una onda que nace en el centro y se abre hacia las esquinas. La cuenta
   nunca va por delante de lo que de verdad lleva cargado la página: en un
   ordenador rápido corre seguida y en uno lento espera. Cada palabra que
   llega a "One hundred" sale con el barrido lateral de la web; cuando no
   queda ninguna, aparece el nombre en el centro y las franjas abren la página.
   ========================================================================== */

const LOADER = {
  desktop: { cols: 8, rows: 7 }, // filas alternas con una palabra menos, a tresbolillo
  mobile: { cols: 3, rows: 9 },
  step: 0.11,            // tiempo entre un número y el siguiente (segundos)
  spread: 1,             // lo que tarda la onda en llegar del centro a las esquinas
  hold: 0.12,            // "One hundred" se queda un instante antes de irse
  wipe: 0.3,             // barrido de entrada y salida de cada palabra
  ease: "power3.inOut",
  name: 0.9,             // tiempo que se ve el nombre antes de abrir
};

const LOADER_WORDS = ["Five", "Ten", "Fifteen", "Twenty", "Twenty-five", "Thirty", "Thirty-five", "Forty", "Forty-five", "Fifty",
  "Fifty-five", "Sixty", "Sixty-five", "Seventy", "Seventy-five", "Eighty", "Eighty-five", "Ninety", "Ninety-five", "One hundred"];

function runLoader() {
  const root = document.querySelector(".loader");
  if (!root || !document.documentElement.classList.contains("is-loading")) return Promise.resolve();

  try {
    sessionStorage.setItem("loaded", "1");
  } catch {}
  lenis?.stop();
  virtual.locked = true;

  const finish = () => {
    root.remove();
    lenis?.start();
    virtual.locked = false;
  };

  const enter = (element) => gsap.fromTo(element, { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: LOADER.wipe, ease: LOADER.ease });
  const exit = (element, onComplete) => gsap.to(element, { clipPath: "inset(0% 0% 0% 100%)", duration: LOADER.wipe, ease: LOADER.ease, onComplete });

  // El nombre en el centro: entra, se queda un momento y sale; luego se abre la página
  const showName = (resolve) => {
    const name = document.createElement("p");
    name.className = "loader__name";
    name.innerHTML = `<span class="loader__word">Simplementesuarep</span>`;
    root.append(name);
    const word = name.firstElementChild;
    const done = () => {
      finish();
      resolve();
    };
    if (reducedMotion) {
      gsap.set(word, { clipPath: "inset(0% 0% 0% 0%)" });
      gsap.delayedCall(LOADER.name, done);
      return;
    }
    enter(word);
    gsap.delayedCall(LOADER.wipe + LOADER.name, () => exit(word, done));
  };

  // Cuánto lleva cargado: las fotos que no esperan al scroll. El 100 % solo
  // llega cuando el navegador da la página por cargada.
  const images = [...document.images].filter((image) => image.loading !== "lazy");
  const progress = () => {
    if (document.readyState === "complete") return 1;
    const done = images.filter((image) => image.complete).length;
    return Math.min(0.95, done / Math.max(1, images.length));
  };

  return new Promise((resolve) => {
    if (reducedMotion) {
      if (document.readyState === "complete") showName(resolve);
      else window.addEventListener("load", () => showName(resolve), { once: true });
      return;
    }

    // Cuadrícula a tresbolillo: las filas pares llevan una palabra más que las
    // impares, y la del centro cae justo en el medio de la pantalla
    const layout = window.innerWidth < 768 ? LOADER.mobile : LOADER.desktop;
    const cells = [];
    for (let row = 0; row < layout.rows; row++) {
      const odd = row % 2 === 1;
      for (let col = 0; col < layout.cols - (odd ? 1 : 0); col++) {
        const x = (col + (odd ? 1 : 0.5)) / layout.cols;
        const y = (row + 0.5) / layout.rows;
        const cell = document.createElement("span");
        cell.className = "loader__cell";
        cell.style.left = `${x * 100}%`;
        cell.style.top = `${y * 100}%`;
        const word = document.createElement("span");
        word.className = "loader__word";
        cell.append(word);
        root.append(cell);
        const distance = Math.hypot((x - 0.5) * window.innerWidth, (y - 0.5) * window.innerHeight);
        cells.push({ word, distance, step: -1, reached: 0, gone: false });
      }
    }
    const farthest = Math.max(...cells.map((cell) => cell.distance)) || 1;
    cells.forEach((cell) => (cell.delay = (cell.distance / farthest) * LOADER.spread));

    const last = LOADER_WORDS.length - 1;
    const start = performance.now();
    let left = cells.length;

    const update = () => {
      const time = (performance.now() - start) / 1000;
      const loaded = progress();
      const cap = loaded >= 1 ? last : Math.floor(loaded * last);
      cells.forEach((cell) => {
        if (cell.gone) return;
        const step = Math.min(Math.floor((time - cell.delay) / LOADER.step), cap);
        if (step > cell.step) {
          if (cell.step < 0) enter(cell.word);
          cell.step = step;
          cell.word.textContent = LOADER_WORDS[step];
          if (step === last) cell.reached = time;
        }
        if (cell.step === last && time - cell.reached > LOADER.hold) {
          cell.gone = true;
          exit(cell.word, () => {
            left -= 1;
            if (left === 0) showName(resolve);
          });
        }
      });
      if (cells.every((cell) => cell.gone)) gsap.ticker.remove(update);
    };
    gsap.ticker.add(update);
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
    sfx.play("enter");
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
    sfx.play("sweep");
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
    document.dispatchEvent(new CustomEvent("page:leave"));
    sfx.play("sweep");
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

  // Solo suena el choque si el cuadrado está a la vista: el pie va pegado abajo
  // y el contenido de encima lo tapa hasta que se llega al final
  const cover = area.previousElementSibling;
  const inView = () => {
    const top = cover ? cover.getBoundingClientRect().bottom : 0;
    const square = box.getBoundingClientRect();
    return square.bottom > top && square.top < window.innerHeight;
  };

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
      if (inView()) sfx.play("bounce");
      index = (index + 1) % images.length;
      showImage();
    }
    place();
  });
}


/* ==========================================================================
   Nombre del pie (solo en los proyectos, donde el scroll tiene final)
   Mientras bajas, "Simplemente" y "Suarep" esperan en las esquinas de abajo en
   gris. Al llegar al pie se deslizan hacia el centro al ritmo del scroll hasta
   juntarse en una sola palabra negra. Cuando se cierra, LinkedIn e Instagram
   entran en las esquinas con el barrido lateral de la web; si vuelves a subir,
   salen y el nombre se separa de nuevo.
   ========================================================================== */

const SIGNATURE = {
  show: 0.98,            // progreso a partir del cual entran las redes
  hide: 0.9,             // y por debajo del cual salen (margen para que no parpadeen)
  wipe: 0.45,            // barrido de las redes
  stagger: 0.08,
  ease: "power3.inOut",
};

function initSignature() {
  const sign = document.querySelector(".signature");
  const footer = document.querySelector(".footer");
  if (!sign || !footer) return;

  const [start, end] = sign.querySelectorAll(".signature__part");
  const socials = [...footer.querySelectorAll(".footer__social")];
  const cover = footer.previousElementSibling; // lo que tapa el pie hasta llegar al final
  const styles = getComputedStyle(document.documentElement);
  const color = gsap.utils.interpolate(styles.getPropertyValue("--color-muted").trim(), styles.getPropertyValue("--color-text").trim());
  let shown = false;

  const wipe = (on) => {
    shown = on;
    const clipPath = on ? "inset(0% 0% 0% 0%)" : "inset(0% 0% 0% 100%)";
    if (reducedMotion) {
      gsap.set(socials, { clipPath: on ? clipPath : "inset(0% 100% 0% 0%)" });
      return;
    }
    if (on) {
      sfx.play("soft2");
      gsap.fromTo(socials, { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath, duration: SIGNATURE.wipe, ease: SIGNATURE.ease, stagger: SIGNATURE.stagger, overwrite: true });
    } else {
      gsap.to(socials, { clipPath, duration: SIGNATURE.wipe, ease: SIGNATURE.ease, stagger: SIGNATURE.stagger, overwrite: true });
    }
  };

  const update = () => {
    // 0 mientras el contenido tapa el pie, 1 cuando el pie está entero a la vista
    const covered = cover ? cover.getBoundingClientRect().bottom : 0;
    const progress = gsap.utils.clamp(0, 1, 1 - covered / window.innerHeight);
    const eased = progress * progress * (3 - 2 * progress);

    // Dónde queda cada mitad con la palabra cerrada y centrada
    const width = sign.clientWidth;
    const margin = parseFloat(getComputedStyle(sign).paddingLeft);
    const joined = (width - start.offsetWidth - end.offsetWidth) / 2;
    const startX = (joined - margin) * eased;
    const endX = (joined + start.offsetWidth - (width - margin - end.offsetWidth)) * eased;
    start.style.transform = `translate3d(${startX}px, 0, 0)`;
    end.style.transform = `translate3d(${endX}px, 0, 0)`;
    sign.style.color = color(eased);

    if (!shown && progress >= SIGNATURE.show) wipe(true);
    else if (shown && progress < SIGNATURE.hide) wipe(false);
  };

  gsap.ticker.add(update);
}


/* ==========================================================================
   Hover de las cajas de la cabecera
   El mismo barrido que la disciplina del menú: la caja blanca se queda quieta
   y el texto se recorta hacia la derecha hasta desaparecer y vuelve a entrar
   recortándose desde la izquierda. Se aplica al nombre, a "Works,"/"Close," y
   a "Sound".
   ========================================================================== */

const LINK = {
  out: 0.2,              // el texto sale por la derecha, acelerando
  outEase: "power2.in",
  gap: 0.1,              // instante en que la caja queda vacía
  in: 0.2,               // y vuelve a entrar por la izquierda, frenando
  inEase: "power2.out",
};

function initLinks() {
  if (reducedMotion) return;

  document.querySelectorAll(".link, .header__toggle").forEach((box) => {
    const text = box.querySelector(".link__inner, .header__toggle-inner");
    if (!text) return;

    let busy = false;
    box.addEventListener("pointerenter", (event) => {
      // Si el barrido anterior no ha terminado, se deja acabar en vez de reiniciarlo
      if (event.pointerType !== "mouse" || busy) return;
      busy = true;
      gsap.timeline({ onComplete: () => (busy = false) })
        .to(text, { clipPath: "inset(0% 0% 0% 100%)", duration: LINK.out, ease: LINK.outEase })
        .set(text, { clipPath: "inset(0% 100% 0% 0%)" })
        .to(text, { clipPath: "inset(0% 0% 0% 0%)", duration: LINK.in, ease: LINK.inEase, delay: LINK.gap });
    });
  });
}


/* ==========================================================================
   8. Sound (howler.js)
   "Sound" activa un tono de sala en bucle y los efectos de toda la web, con
   sonidos físicos, secos y cortos de estudio fotográfico, sin notas:
   - franjas de la transición: un pase de página al cerrarse y un soplo al abrirse
   - hover de cualquier enlace o botón: la punta de un lápiz; clic: un obturador
   - fotos: una hoja que se desliza; filas del menú: un tic finísimo
   - scroll (carruseles, menú y proyectos): el avance de un carrete
   - rebote del cuadrado del pie: un toque sobre fieltro
   - activar / desactivar el sonido: obturador completo / un solo golpe
   Todos los sonidos son originales, sintetizados para esta web. Los efectos
   van juntos en un solo archivo (sprite). El estado y el punto del bucle se
   guardan al cambiar de página para que el ambiente siga donde iba.
   Nota: el navegador no deja sonar nada hasta el primer clic o tecla en cada
   página; si llegas con el sonido activado, arranca en cuanto interactúas.
   ========================================================================== */

const SOUND = {
  volume: 0.3,           // volumen del ambiente
  fadeIn: 1.5,           // segundos de fundido al activarlo
  fadeOut: 0.8,          // segundos de fundido al desactivarlo
  leave: 0.4,            // fundido al salir de la página
  scrubStep: 70,         // píxeles de scroll entre grano y grano
  gap: 40,               // milisegundos mínimos entre dos veces el mismo efecto
  // Volumen de cada efecto
  levels: { sweep: 0.18, enter: 0.14, hit: 0.3, soft: 0.14, soft2: 0.2, menu: 0.16, image: 0.15, imageOut: 0.1, scrub: 0.1, bounce: 0.18, on: 0.35, off: 0.3 },
  // Posición de cada efecto dentro de sfx.webm / sfx.mp3 [inicio, duración] en ms
  sprite: {"sweep":[0,500],"enter":[620,700],"hit":[1440,90],"soft":[1650,40],"soft2":[1810,50],"menu":[1980,30],"image":[2130,300],"scrub":[2550,20],"bounce":[2690,60],"on":[2870,140],"off":[3130,60],"imageOut":[3310,300]},
};

function initSound() {
  const button = document.querySelector(".header__sound");
  if (!button) return;

  const text = button.querySelector(".link__text");
  const store = (key, value) => {
    try {
      sessionStorage.setItem(key, value);
    } catch {}
  };
  const read = (key) => {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  };

  const audio = (name) => [`${SITE_ROOT}assets/audio/${name}.webm`, `${SITE_ROOT}assets/audio/${name}.mp3`];
  const hasHowler = typeof Howl !== "undefined";
  let ambient = null;
  let effects = null;
  let on = false;

  const load = () => {
    if (ambient || !hasHowler) return;
    ambient = new Howl({ src: audio("ambient"), loop: true, volume: 0 });
    effects = new Howl({ src: audio("sfx"), sprite: SOUND.sprite });
    // Si venimos de otra página con el sonido puesto, el bucle sigue donde iba
    const at = parseFloat(read("sound-at"));
    if (at > 0) ambient.once("load", () => ambient.seek(at % ambient.duration()));
  };

  /* ---- Efectos ---- */

  const last = {};
  const play = (name, { force = false, rate = 0.97 + Math.random() * 0.06, volume = 1 } = {}) => {
    if ((!on && !force) || !effects) return;
    const now = performance.now();
    if (now - (last[name] || 0) < SOUND.gap) return;
    last[name] = now;
    const id = effects.play(name);
    effects.volume(SOUND.levels[name] * volume, id);
    effects.rate(rate, id); // cada vez suena un poco distinto
  };
  sfx.play = (name) => play(name);

  // El scroll va soltando granos: más seguidos y más agudos cuanto más rápido
  let travelled = 0;
  sfx.scrub = (delta) => {
    if (!on) return;
    travelled += Math.abs(delta);
    if (travelled < SOUND.scrubStep) return;
    travelled %= SOUND.scrubStep;
    const speed = Math.min(1, Math.abs(delta) / 40);
    play("scrub", { rate: 0.95 + speed * 0.15 + Math.random() * 0.05, volume: 0.5 + speed * 0.5 });
  };

  // Hover y clic de cualquier enlace o botón. Las fotos y las filas del menú
  // tienen su propio sonido, así que aquí se saltan.
  const own = "[data-cursor-title], .menu__list a";
  document.addEventListener("pointerover", (event) => {
    if (event.pointerType !== "mouse") return;
    const target = event.target.closest("a, button");
    if (!target || target.matches(own) || target.contains(event.relatedTarget)) return;
    play("soft");
  });
  document.addEventListener("pointerdown", (event) => {
    const target = event.target.closest("a, button");
    if (!target || target === button) return;
    play("hit");
  });

  /* ---- Ambiente ---- */

  const start = (fade) => {
    load();
    if (!ambient) return;
    ambient.off("fade");
    if (!ambient.playing()) ambient.play();
    ambient.fade(ambient.volume(), SOUND.volume, fade * 1000);
  };

  const stop = (fade) => {
    if (!ambient) return;
    ambient.off("fade");
    ambient.fade(ambient.volume(), 0, fade * 1000);
    ambient.once("fade", () => {
      if (!on) ambient.pause();
    });
  };

  const set = (value, fade = true) => {
    on = value;
    button.setAttribute("aria-pressed", String(on));
    text.textContent = on ? "Sound on" : "Sound";
    store("sound", on ? "1" : "0");
    if (on) start(fade ? SOUND.fadeIn : 0);
    else stop(fade ? SOUND.fadeOut : 0);
  };

  // Al salir de la página: se guarda el punto del bucle y el ambiente se apaga suave
  document.addEventListener("page:leave", () => {
    if (!ambient || !on) return;
    store("sound-at", String(ambient.seek()));
    ambient.fade(ambient.volume(), 0, SOUND.leave * 1000);
  });
  window.addEventListener("pagehide", () => {
    if (ambient && on && ambient.playing()) store("sound-at", String(ambient.seek()));
  });

  // Al volver con el botón atrás la página sale de la caché con el ambiente apagado
  window.addEventListener("pageshow", (event) => {
    if (event.persisted && on) start(SOUND.fadeIn);
  });

  set(read("sound") === "1");
  button.addEventListener("click", () => {
    set(!on);
    play(on ? "on" : "off", { force: true, rate: 1 });
  });
}


/* ==========================================================================
   9. Arranque
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  initLenis();
  initVirtualScroll();
  initCursorTag();
  initCurtains();
  initBounce();
  initSignature();
  initSound();
  initLinks();
  const transition = initTransition();
  initMenu(transition);

  await document.fonts.ready;
  await runLoader();
  // Tras la pantalla de carga las franjas vuelven a su color de siempre
  transition.reveal(() => document.documentElement.classList.remove("is-loading"));
});
