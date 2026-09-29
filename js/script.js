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
   3. Navbar
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
   4. Footer: el nombre se junta al llegar al final
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

  // Ancho de las dos palabras más un espacio
  const joinedWidth = () => {
    const space = parseFloat(getComputedStyle(name).fontSize) * 0.28;
    return words.reduce((sum, word) => sum + word.offsetWidth, 0) + space;
  };

  const timeline = gsap.timeline({ paused: true, defaults: { duration: 0.9, ease: "power3.inOut" } })
    .fromTo(name, { width: "100%" }, { width: joinedWidth })
    .fromTo(name, { opacity: () => getComputedStyle(name).opacity }, { opacity: 1 }, 0);

  let joined = false;

  const update = () => {
    const atEnd = isAtPageEnd();
    if (atEnd === joined) return;

    joined = atEnd;
    joined ? timeline.play() : timeline.reverse();
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
   5. Arranque
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  initLenis();
  initSoundToggle();

  // Los textos se parten y se miden con la fuente final ya cargada
  await document.fonts.ready;

  initFooter();
});
