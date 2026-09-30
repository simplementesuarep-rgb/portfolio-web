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
   3. Laboratorio: prototipos de la home (páginas de lab/)
   Cada página lleva <body data-lab="nombre"> y aquí se arranca su prototipo.
   Todos dibujan en WebGL 2 a pantalla completa y pasan por el mismo filtro:
   la imagen se descompone en bloques de color plano de tamaño variable, con
   franjas donde hay más detalle, y cada color se ajusta a una paleta.
   ========================================================================== */

// Vértice: un triángulo que cubre toda la pantalla
const LAB_VERTEX = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// Cabecera del fragmento: paleta y la función field(), que define cada prototipo
const LAB_HEAD = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;
uniform float uThreshold;

const vec3 PAL[8] = vec3[8](
  vec3(0.361, 0.176, 0.353), // morado (fondo)
  vec3(1.000, 0.118, 0.098), // rojo
  vec3(1.000, 0.420, 0.100), // naranja
  vec3(1.000, 0.700, 0.000), // amarillo
  vec3(1.000, 0.370, 0.660), // rosa
  vec3(0.830, 0.700, 0.940), // lavanda
  vec3(0.930, 0.860, 0.810), // crema
  vec3(0.100, 0.100, 0.100)  // casi negro
);

vec3 field(vec2 uv);
`;

// Filtro: elige el tamaño de bloque más grande que aguante sin perder el color
// (64, 32, 16 u 8 px). En el más fino, si hay mucho cambio, dibuja franjas.
const LAB_MAIN = `
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float gap(vec3 a, vec3 b) {
  vec3 d = a - b;
  return dot(d, d);
}

vec3 snap(vec3 c) {
  float best = 1e9;
  vec3 result = PAL[0];
  for (int i = 0; i < 8; i++) {
    float e = gap(c, PAL[i]);
    if (e < best) { best = e; result = PAL[i]; }
  }
  return result;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec3 result = PAL[0];

  for (int i = 0; i < 4; i++) {
    float s = exp2(6.0 - float(i));
    vec2 cell = floor(frag / s);
    vec2 o = cell * s;

    vec3 m = field((o + 0.5 * s) / uRes);
    vec3 a = field((o + vec2(0.1, 0.1) * s) / uRes);
    vec3 b = field((o + vec2(0.9, 0.1) * s) / uRes);
    vec3 c = field((o + vec2(0.1, 0.9) * s) / uRes);
    vec3 d = field((o + vec2(0.9, 0.9) * s) / uRes);

    float dev = max(max(gap(m, a), gap(m, b)), max(gap(m, c), gap(m, d)));
    float limit = uThreshold * (0.5 + hash(cell + s));

    if (dev < limit || i == 3) {
      result = snap((m * 2.0 + a + b + c + d) / 6.0);
      if (i == 3 && dev >= limit * 2.0) {
        float bar = hash(cell) < 0.5 ? frag.x : frag.y;
        result = mod(floor(bar / 2.0), 2.0) < 1.0 ? snap(a) : snap(d);
      }
      break;
    }
  }

  outColor = vec4(result, 1.0);
}`;

function labUnsupported() {
  const hint = document.querySelector(".lab__hint");
  if (hint) hint.textContent = "Este prototipo necesita WebGL 2.";
}

// Compila un programa (vértice común + fragmento) y devuelve sus utilidades
function labProgram(gl, fragment) {
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  };

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, LAB_VERTEX));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));

  const locations = {};
  const at = (name) => (name in locations ? locations[name] : (locations[name] = gl.getUniformLocation(program, name)));

  return {
    use: () => gl.useProgram(program),
    float: (name, ...values) => gl[`uniform${values.length}f`](at(name), ...values),
    int: (name, value) => gl.uniform1i(at(name), value),
  };
}

// Textura 2D con el formato indicado, con filtro lineal y sin repetir
function labTexture(gl, { internal, format, type, width, height, data = null }) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, width, height, 0, format, type, data);
  return texture;
}

// Llama a callback ahora y cada vez que cambia el tamaño de la ventana
function labOnResize(callback) {
  let timer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(timer);
    timer = setTimeout(callback, 150);
  });
  callback();
}

// Ratón o dedo: posición en píxeles y si está pulsado
function labPointer() {
  const pointer = { x: 0, y: 0, active: false, down: false };
  window.addEventListener("pointermove", (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
  });
  window.addEventListener("pointerdown", (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
    pointer.down = true;
  });
  window.addEventListener("pointerup", () => (pointer.down = false));
  window.addEventListener("pointercancel", () => (pointer.down = false));
  document.documentElement.addEventListener("pointerleave", () => (pointer.active = pointer.down = false));
  return pointer;
}


/* --------------------------------------------------------------------------
   Organismo: miles de agentes tipo moho (Physarum) que dejan rastro y siguen
   el rastro de los demás. Crecen como venas, buscan el cursor y se comen las
   letras del nombre. Pulsar los dispersa y borra el rastro.
   -------------------------------------------------------------------------- */

const ORGANISM = {
  width: 420,         // celdas de ancho del campo (el alto sale de la pantalla)
  agents: 30000,
  sensorAngle: 0.6,   // separación entre los tres sensores (rad)
  sensorDist: 9,      // hasta dónde mira cada agente (celdas)
  turn: 0.4,          // giro por fotograma (rad)
  speed: 1.1,         // celdas por fotograma
  deposit: 1,         // rastro que deja cada agente
  diffuse: 0.55,      // cuánto se difumina el rastro
  decay: 0.92,        // cuánto rastro queda al siguiente fotograma
  tone: 14,           // rastro a partir del cual el color va por la mitad de la paleta
  food: 0.9,          // rastro que emiten las letras por fotograma
  foodRamp: 12,       // segundos hasta que las letras emiten a plena fuerza
  cursorRadius: 6,    // celdas
  cursorGain: 5,      // rastro que deja el cursor por fotograma
  pressRadius: 30,    // celdas
  threshold: 0.12,    // cuánta variación de color aguanta un bloque antes de dividirse
};

const ORGANISM_FIELD = `
uniform sampler2D uField;

vec3 ramp(float v) {
  vec3 c = PAL[0];
  c = mix(c, PAL[1], smoothstep(0.10, 0.28, v));
  c = mix(c, PAL[2], smoothstep(0.30, 0.48, v));
  c = mix(c, PAL[3], smoothstep(0.50, 0.66, v));
  c = mix(c, PAL[6], smoothstep(0.70, 0.86, v));
  return c;
}

vec3 field(vec2 uv) {
  return ramp(texture(uField, vec2(uv.x, 1.0 - uv.y)).r);
}
`;

function labOrganismo() {
  const canvas = document.querySelector(".lab__canvas");
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false });
  if (!gl) return labUnsupported();

  const P = ORGANISM;
  const program = labProgram(gl, LAB_HEAD + ORGANISM_FIELD + LAB_MAIN);
  const pointer = labPointer();

  let W, H, trail, next, pixels, agents, foodCells, frame, texture;

  // Las letras del nombre, dibujadas en el campo, son la comida del organismo
  const buildFood = () => {
    const paper = document.createElement("canvas");
    paper.width = W;
    paper.height = H;
    const ctx = paper.getContext("2d", { willReadFrequently: true });
    const lines = ["SIMPLEMENTE", "SUAREP"];

    ctx.font = '800 100px "Mona Sans"';
    const size = (100 * W * 0.9) / ctx.measureText(lines[0]).width;
    ctx.font = `800 ${size}px "Mona Sans"`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    lines.forEach((line, i) => ctx.fillText(line, W / 2, H / 2 + (i - 0.5) * size * 0.95));

    const data = ctx.getImageData(0, 0, W, H).data;
    const cells = [];
    for (let i = 0; i < W * H; i++) if (data[i * 4 + 3] > 128) cells.push(i);
    foodCells = Uint32Array.from(cells);
  };

  const setup = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);

    W = P.width;
    H = Math.max(8, Math.round((W * canvas.height) / canvas.width));
    trail = new Float32Array(W * H);
    next = new Float32Array(W * H);
    pixels = new Uint8Array(W * H);
    foodCells = new Uint32Array(0);
    frame = 0;

    // Los agentes nacen repartidos por toda la pantalla y se van juntando en venas
    agents = new Float32Array(P.agents * 3);
    for (let i = 0; i < agents.length; i += 3) {
      agents[i] = 1 + Math.random() * (W - 2);
      agents[i + 1] = 1 + Math.random() * (H - 2);
      agents[i + 2] = Math.random() * Math.PI * 2;
    }

    texture = labTexture(gl, { internal: gl.R8, format: gl.RED, type: gl.UNSIGNED_BYTE, width: W, height: H });
    document.fonts.load('800 100px "Mona Sans"').then(buildFood);
  };

  const sample = (x, y) => {
    const ix = x | 0;
    const iy = y | 0;
    return ix < 0 || iy < 0 || ix >= W || iy >= H ? 0 : trail[iy * W + ix];
  };

  const step = () => {
    const { sensorAngle, sensorDist, turn, speed, deposit } = P;
    const px = (pointer.x / canvas.width) * W;
    const py = (pointer.y / canvas.height) * H;
    const pressR2 = P.pressRadius * P.pressRadius;

    for (let i = 0; i < agents.length; i += 3) {
      let x = agents[i];
      let y = agents[i + 1];
      let a = agents[i + 2];

      const c = sample(x + Math.cos(a) * sensorDist, y + Math.sin(a) * sensorDist);
      const l = sample(x + Math.cos(a - sensorAngle) * sensorDist, y + Math.sin(a - sensorAngle) * sensorDist);
      const r = sample(x + Math.cos(a + sensorAngle) * sensorDist, y + Math.sin(a + sensorAngle) * sensorDist);

      if (c > l && c > r) {
        // sigue recto
      } else if (c < l && c < r) {
        a += (Math.random() - 0.5) * 2 * turn;
      } else if (l < r) {
        a += turn;
      } else if (r < l) {
        a -= turn;
      }

      if (pointer.down) {
        const dx = x - px;
        const dy = y - py;
        const d2 = dx * dx + dy * dy;
        if (d2 < pressR2) {
          a = Math.atan2(dy, dx);
          x += (dx / (Math.sqrt(d2) + 1)) * 3;
          y += (dy / (Math.sqrt(d2) + 1)) * 3;
        }
      }

      x += Math.cos(a) * speed;
      y += Math.sin(a) * speed;

      if (x < 1 || x >= W - 1 || y < 1 || y >= H - 1) {
        x = Math.min(W - 2, Math.max(1, x));
        y = Math.min(H - 2, Math.max(1, y));
        a = Math.random() * Math.PI * 2;
      }

      trail[(y | 0) * W + (x | 0)] += deposit;
      agents[i] = x;
      agents[i + 1] = y;
      agents[i + 2] = a;
    }

    // Las letras emiten rastro, cada vez con más fuerza
    const gain = P.food * Math.min(1, frame / (P.foodRamp * 60));
    for (let k = 0; k < foodCells.length; k++) trail[foodCells[k]] += gain;

    if (pointer.active) {
      const R = pointer.down ? P.pressRadius : P.cursorRadius;
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const x = Math.round(px) + dx;
          const y = Math.round(py) + dy;
          if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1 || dx * dx + dy * dy > R * R) continue;
          if (pointer.down) trail[y * W + x] *= 0.6;
          else trail[y * W + x] += P.cursorGain;
        }
      }
    }

    // Difumina y evapora el rastro, y de paso lo pasa a 8 bits para la textura
    const { diffuse, decay, tone } = P;
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        const blur =
          (trail[i - W - 1] + trail[i - W] + trail[i - W + 1] +
           trail[i - 1] + trail[i] + trail[i + 1] +
           trail[i + W - 1] + trail[i + W] + trail[i + W + 1]) / 9;
        const value = (trail[i] + (blur - trail[i]) * diffuse) * decay;
        next[i] = value;
        pixels[i] = (255 * value) / (value + tone);
      }
    }
    [trail, next] = [next, trail];
    frame++;
  };

  const draw = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RED, gl.UNSIGNED_BYTE, pixels);
    program.use();
    program.float("uRes", canvas.width, canvas.height);
    program.float("uThreshold", P.threshold);
    program.int("uField", 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  labOnResize(setup);

  if (reducedMotion) {
    // Sin movimiento: se deja crecer un rato y se muestra una imagen fija
    for (let i = 0; i < 400; i++) step();
    draw();
    return;
  }

  gsap.ticker.add(() => {
    step();
    draw();
  });
}


/* ==========================================================================
   4. Arranque
   ========================================================================== */

const LABS = {
  organismo: labOrganismo,
};

document.addEventListener("DOMContentLoaded", () => {
  const lab = LABS[document.body.dataset.lab];
  if (lab) lab();
  else initLenis();
});
