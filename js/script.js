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
   3. Arranque
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  initLenis();

  // Los textos se parten y se miden con la fuente final ya cargada
  await document.fonts.ready;
});
