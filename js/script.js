/* ==========================================================================
   1. Configuración
   ========================================================================== */

gsap.registerPlugin(ScrollTrigger, SplitText);

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;


/* ==========================================================================
   2. Scroll suave (Lenis)
   ========================================================================== */

let lenis = null;

const isInfiniteScroll = () => document.body.dataset.scroll === "infinite";

function initLenis() {
  if (reducedMotion) return;

  // Frenada exponencial larga (más suave que Almira Kho, que usa 1,2 s y 0,8).
  // Con data-scroll="infinite" en el body, al llegar al final se vuelve al principio.
  const infinite = isInfiniteScroll();
  lenis = new Lenis({
    autoRaf: false,
    duration: 1.8,
    easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
    wheelMultiplier: 0.7,
    infinite,
    syncTouch: infinite, // Lenis lo necesita para el scroll infinito en táctil
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

// Variante para formas rellenas (la etiqueta del cursor): antes del desenfoque,
// un ruido deforma los bordes para que la mancha sea orgánica y no un rectángulo
// con esquinas redondeadas. render({ blur, a, b, distort })
function createMorphFilter() {
  const filter = createInkFilter();
  const node = document.getElementById(filter.id);
  const blur = node.querySelector("feGaussianBlur");

  const noise = document.createElementNS(SVG_NS, "feTurbulence");
  noise.setAttribute("type", "fractalNoise");
  noise.setAttribute("baseFrequency", "0.06");
  noise.setAttribute("numOctaves", "2");
  noise.setAttribute("result", "noise");

  const displace = document.createElementNS(SVG_NS, "feDisplacementMap");
  displace.setAttribute("in", "SourceGraphic");
  displace.setAttribute("in2", "noise");
  displace.setAttribute("xChannelSelector", "R");
  displace.setAttribute("yChannelSelector", "G");
  displace.setAttribute("result", "shape");

  node.prepend(noise, displace);
  blur.setAttribute("in", "shape");

  return {
    ...filter,
    render: (state) => {
      displace.setAttribute("scale", state.distort);
      filter.render(state);
    },
  };
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
   pasar el ratón, se abre en ella una mancha blanca (morph en WebGL). En la
   home el scroll es infinito: la galería se repite sin final.
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

// Morph del hover (a partir del de GRIDS): al pasar el ratón se abre en la foto
// una mancha blanca que sigue al puntero con inercia y deja una estela de gotas
// que se funden entre sí (metaballs) y se van cerrando. El borde ondula y cada
// gota manda una onda que dobla la foto, como al tocar agua. Es un shader de
// WebGL en un <canvas> que solo existe mientras dura el efecto.
const MORPH = {
  size: 96,          // radio de cada gota a 1440 px de ancho
  hold: 0.62,        // la gota bajo el puntero, respecto a size
  every: 10,         // px de movimiento entre gotas de la estela
  glide: 0.17,       // inercia de la gota bajo el puntero (por fotograma a 60 fps)
  grow: 0.22,        // s que tarda una gota en crecer
  fade: 1.5,         // s que tarda en cerrarse
  edge: 0.035,       // dureza del borde de la mancha
  wobble: 44,        // px que ondula el borde
  wobbleSize: 105,   // tamaño de cada lóbulo de la ondulación
  wobbleSpeed: 0.5,
  ripple: [300, 105, 75, 1.15], // onda: velocidad (px/s), longitud, ancho, caída
  bend: 26,          // px que la onda dobla la foto
  wakeIn: 0.3,       // s de entrada del hover
  wakeOut: 0.55,     // s de salida
};

const MORPH_DROPS = 16; // la primera es la del puntero; el resto, la estela

const MORPH_VERTEX = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const MORPH_FRAGMENT = `
precision highp float;

const int DROPS = ${MORPH_DROPS};

uniform sampler2D uPhoto;
uniform vec2 uResolution;   // canvas, en píxeles reales
uniform float uDpr;
uniform vec2 uPhotoOffset;  // dónde está la foto dentro del marco (px CSS)
uniform vec2 uPhotoSize;    // y cuánto mide (ampliada por el parallax)
uniform vec4 uDrops[DROPS]; // x, y, nacimiento, radio
uniform float uNow;
uniform float uHover;       // 0 sin hover, 1 con hover
uniform vec3 uPaper;        // color que se ve por la mancha
uniform float uGrow;
uniform float uFade;
uniform float uEdge;
uniform float uWobble;
uniform float uWobbleSize;
uniform float uWobbleSpeed;
uniform vec4 uRipple;
uniform float uBend;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

vec3 photo(vec2 px) {
  return texture2D(uPhoto, clamp((px - uPhotoOffset) / uPhotoSize, 0.0, 1.0)).rgb;
}

void main() {
  // Coordenadas como en el DOM: px CSS desde la esquina superior izquierda
  vec2 px = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y) / uDpr;

  // El borde de la mancha ondula: se mide sobre un plano deformado por ruido
  vec2 q = px / uWobbleSize;
  float t = uNow * uWobbleSpeed;
  vec2 wobble = vec2(
    noise(q + vec2(t, t * 0.6)),
    noise(q + vec2(5.2, 1.3) - vec2(t * 0.7, t * 0.4))
  ) - 0.5;
  wobble += (vec2(
    noise(q * 2.3 - vec2(t * 1.2, 0.0)),
    noise(q * 2.3 + vec2(3.1, 7.7) + vec2(0.0, t))
  ) - 0.5) * 0.5;
  vec2 at = px + wobble * uWobble;

  float field = 0.0;
  vec2 push = vec2(0.0);

  for (int i = 0; i < DROPS; i++) {
    vec4 drop = uDrops[i];
    float age = uNow - drop.z;
    if (drop.w <= 0.0 || age < 0.0) continue;

    // Metaballs: cada gota suma r² / d² y la mancha es donde el campo pasa de 1
    float radius = drop.w;
    if (i > 0) {
      float life = max(0.0, 1.0 - age / uFade);
      radius *= min(1.0, age / uGrow) * life * life;
    }
    vec2 toDrop = at - drop.xy;
    field += (radius * radius) / max(dot(toDrop, toDrop), 1.0);

    // Onda que sale de cada gota de la estela y empuja la foto hacia fuera
    if (i > 0 && age < 4.0) {
      vec2 away = px - drop.xy;
      float dist = length(away);
      float offset = dist - age * uRipple.x;
      float envelope = exp(-(offset * offset) / (uRipple.z * uRipple.z))
        * exp(-age * uRipple.w) * (1.0 - exp(-age / 0.1));
      float wave = sin(offset * 6.2831853 / uRipple.y);
      push += away / max(dist, 0.001) * wave * envelope * uBend;
    }
  }

  float inside = smoothstep(1.0 - uEdge, 1.0 + uEdge, field) * uHover;
  vec3 color = photo(px - push * uHover);
  gl_FragColor = vec4(mix(color, uPaper, inside), 1.0);
}
`;

const morphSupported = !reducedMotion
  && window.matchMedia("(hover: hover) and (pointer: fine)").matches
  && "WebGLRenderingContext" in window;

// Color del fondo de la web (--color-bg) como vec3
function paperColor() {
  const probe = document.createElement("span");
  probe.style.color = "var(--color-bg)";
  document.body.append(probe);
  const [r, g, b] = getComputedStyle(probe).color.match(/\d+/g).map(Number);
  probe.remove();
  return [r / 255, g / 255, b / 255];
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;

  console.warn(gl.getShaderInfoLog(shader));
  return null;
}

// Canvas con su contexto WebGL, la foto como textura y los uniforms del shader
function createMorphLayer(photo, img) {
  const canvas = document.createElement("canvas");
  canvas.className = "photo__morph";
  canvas.setAttribute("aria-hidden", "true");

  const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
  if (!gl) return null;

  const vertex = compileShader(gl, gl.VERTEX_SHADER, MORPH_VERTEX);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, MORPH_FRAGMENT);
  if (!vertex || !fragment) return null;

  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.useProgram(program);

  // Un triángulo que cubre todo el canvas
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "aPosition");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);

  const u = Object.fromEntries([
    "uResolution", "uDpr", "uPhotoOffset", "uPhotoSize", "uDrops", "uNow", "uHover",
    "uPaper", "uGrow", "uFade", "uEdge", "uWobble", "uWobbleSize", "uWobbleSpeed",
    "uRipple", "uBend",
  ].map((name) => [name, gl.getUniformLocation(program, name)]));

  gl.uniform3fv(u.uPaper, paperColor());
  gl.uniform1f(u.uGrow, MORPH.grow);
  gl.uniform1f(u.uFade, MORPH.fade);
  gl.uniform1f(u.uEdge, MORPH.edge);
  gl.uniform1f(u.uWobbleSpeed, MORPH.wobbleSpeed);

  photo.append(canvas);

  const destroy = () => {
    gl.deleteTexture(texture);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    canvas.remove();
  };

  return { gl, canvas, u, destroy };
}

function initPhotoMorph(photo) {
  if (!morphSupported) return;

  const img = photo.querySelector("img");
  const state = { hover: 0 };
  const drops = [];             // estela: { x, y, born, radius } en px del marco
  const data = new Float32Array(MORPH_DROPS * 4);
  let layer = null;
  let pointer = null;           // posición del puntero en la ventana
  let glide = null;             // gota bajo el puntero, con inercia
  let last = null;              // dónde se soltó la última gota
  let now = Math.random() * 60; // cada foto arranca con un ruido distinto

  const scale = () => window.innerWidth / 1440;

  const draw = () => {
    const { gl, canvas, u } = layer;
    const frame = photo.getBoundingClientRect();
    const picture = img.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const width = Math.round(frame.width * dpr);
    const height = Math.round(frame.height * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }

    const s = scale();
    if (pointer) {
      const local = { x: pointer.x - frame.left, y: pointer.y - frame.top };
      glide ??= { ...local };
      const ease = 1 - Math.pow(1 - MORPH.glide, gsap.ticker.deltaRatio());
      glide.x += (local.x - glide.x) * ease;
      glide.y += (local.y - glide.y) * ease;
    }

    data.fill(0);
    if (glide) data.set([glide.x, glide.y, now, MORPH.size * MORPH.hold * s], 0);
    drops.forEach((drop, i) => data.set([drop.x, drop.y, drop.born, drop.radius], (i + 1) * 4));

    gl.uniform2f(u.uResolution, width, height);
    gl.uniform1f(u.uDpr, dpr);
    gl.uniform2f(u.uPhotoOffset, picture.left - frame.left, picture.top - frame.top);
    gl.uniform2f(u.uPhotoSize, picture.width, picture.height);
    gl.uniform4fv(u.uDrops, data);
    gl.uniform1f(u.uNow, now);
    gl.uniform1f(u.uHover, state.hover);
    gl.uniform1f(u.uWobble, MORPH.wobble * s);
    gl.uniform1f(u.uWobbleSize, MORPH.wobbleSize * s);
    gl.uniform4f(u.uRipple, MORPH.ripple[0] * s, MORPH.ripple[1] * s, MORPH.ripple[2] * s, MORPH.ripple[3]);
    gl.uniform1f(u.uBend, MORPH.bend * s);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const stop = () => {
    gsap.ticker.remove(tick);
    layer.destroy();
    layer = null;
    drops.length = 0;
    glide = null;
    last = null;
  };

  // Se dibuja mientras hay hover y hasta que la mancha se ha cerrado del todo
  function tick(time, deltaTime) {
    now += deltaTime / 1000;
    draw();
    if (!pointer && state.hover <= 0) stop();
  }

  photo.addEventListener("pointerenter", (event) => {
    if (!img.complete || !img.naturalWidth) return;
    if (!layer) {
      layer = createMorphLayer(photo, img);
      if (!layer) return;
      gsap.ticker.add(tick);
    }

    pointer = { x: event.clientX, y: event.clientY };
    gsap.to(state, { hover: 1, duration: MORPH.wakeIn, ease: "power2.out", overwrite: true });
  });

  photo.addEventListener("pointermove", (event) => {
    if (!layer) return;

    pointer = { x: event.clientX, y: event.clientY };
    const frame = photo.getBoundingClientRect();
    const local = { x: pointer.x - frame.left, y: pointer.y - frame.top };
    if (last && Math.hypot(local.x - last.x, local.y - last.y) < MORPH.every * scale()) return;

    if (last) {
      drops.push({ ...local, born: now, radius: MORPH.size * scale() });
      if (drops.length > MORPH_DROPS - 1) drops.shift();
    }
    last = local;
  });

  photo.addEventListener("pointerleave", () => {
    if (!layer) return;

    pointer = null;
    glide = null;
    last = null;
    gsap.to(state, { hover: 0, duration: MORPH.wakeOut, ease: "power2.inOut", overwrite: true });
  });
}

// Scroll infinito: se añaden copias de las fotos hasta cubrir una pantalla y la
// galería se recorta a (alto de las originales + una pantalla). Así el final se
// ve igual que el principio y Lenis puede volver a 0 sin que se note.
function initInfiniteGallery(gallery) {
  const originals = [...gallery.children];
  const sets = () => gallery.children.length / originals.length;

  const addCopy = () => {
    originals.forEach((photo) => {
      const copy = photo.cloneNode(true);
      copy.setAttribute("aria-hidden", "true");
      const img = copy.querySelector("img");
      img.alt = "";
      img.style.transform = ""; // sin el parallax copiado de la original
      gallery.append(copy);
      initPhotoParallax(copy);
      initPhotoMorph(copy);
    });
  };

  const fit = () => {
    if (sets() === 1) addCopy();

    const cycle = gallery.children[originals.length].offsetTop - originals[0].offsetTop;
    while ((sets() - 1) * cycle < window.innerHeight) addCopy();

    gallery.style.height = `${cycle + window.innerHeight}px`;
  };

  fit();
  window.addEventListener("resize", fit);
}

function initGallery() {
  const gallery = document.querySelector(".gallery");
  if (!gallery || reducedMotion) return;

  gallery.querySelectorAll(".photo").forEach((photo) => {
    initPhotoParallax(photo);
    initPhotoMorph(photo);
  });
  document.querySelectorAll(".home__feature").forEach(initPhotoMorph);

  if (lenis?.options.infinite) initInfiniteGallery(gallery);
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

  // Con scroll infinito no hay final de página: el nombre se queda separado
  if (!name || isInfiniteScroll()) return;

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
   al ratón con inercia. Entra y sale con morph de tinta. Solo con ratón.
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
  // animación sigue desde donde está en vez de saltar. Disuelta, el corte del
  // alfa es tan alto que la mancha desaparece; al bajar se condensa en la etiqueta.
  const filter = createMorphFilter();
  const DISSOLVED = { blur: 9, a: INK_AMPLITUDE, b: -19, distort: 18 };
  const INKED = { blur: 0, a: INK_AMPLITUDE, b: INK_CUT, distort: 0 };
  const state = { ...DISSOLVED };
  const render = () => filter.render(state);

  gsap.set(tag, { xPercent: -50, yPercent: -50 });
  render();

  const place = () => gsap.set(tag, { x: pos.x, y: pos.y });

  // Cada cambio de estado corta la animación anterior y sigue desde ahí
  let animation = null;
  const animate = (timeline) => {
    animation?.kill();
    animation = timeline;
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
    animate(gsap.timeline({ onComplete: () => { tag.style.filter = ""; } })
      .to(state, { ...INKED, duration: 0.55, ease: "power3.out", onUpdate: render })
      .to(state, { a: 1, b: 0, duration: 0.15, ease: "power1.in", onUpdate: render }));
  };

  const hide = () => {
    if (!shown) return;
    shown = false;

    tag.style.filter = `url(#${filter.id})`;
    animate(gsap.timeline({
      onComplete: () => {
        visible = false;
        tag.style.visibility = "hidden";
        tag.style.filter = "";
      },
    })
      .to(state, { a: INKED.a, b: INKED.b, duration: 0.08, ease: "none", onUpdate: render })
      .to(state, { ...DISSOLVED, duration: 0.5, ease: "power2.in", onUpdate: render }));
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
