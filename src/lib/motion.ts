/**
 * Motion de nivel T2: reveal y contador — Web Animations API +
 * IntersectionObserver, sin librería. `split`, `parallax` y `pin` no se
 * implementan aquí: necesitan GSAP/ScrollTrigger (T3) para verse bien;
 * forzarlos a pelo se ve peor que no animarlos, así que en T2 degradan a
 * reveal.
 *
 * El marquee NO vive aquí: es CSS puro (.marquee-pista/.marquee-fila en
 * sitio.css) — un loop infinito de verdad, en vez del rebote que daba
 * calcular el ancho en JS y animar con .animate(). `prefers-reduced-motion`
 * ya lo apaga la regla global de tokens.css.
 *
 * Se anima con `.animate()`, no con una clase CSS: el elemento nunca
 * depende de una regla externa que lo esconda de entrada. Si el JS falla o
 * lo bloquean, el contenido queda visible tal cual está en el HTML — nunca
 * invisible por no poder animarse.
 */

const ESCALON_RETRASO_MS = 70;

const sinMovimiento = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// `data-motion-retraso="N"` escalona la entrada de tarjetas que aparecen
// juntas (una grilla, una lista) — N son pasos de 70ms, no milisegundos
// literales: ajustar el ritmo es cambiar un entero pequeño.
function revelar(el: HTMLElement): void {
  const retraso = Number(el.dataset.motionRetraso ?? 0) * ESCALON_RETRASO_MS;
  el.animate(
    [
      { opacity: 0, transform: 'translateY(16px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ],
    { duration: 500, delay: retraso, easing: 'ease-out', fill: 'both' },
  );
}

function iniciarReveal(): void {
  const objetivo = document.querySelectorAll<HTMLElement>(
    '[data-motion="reveal"], [data-motion="split"], [data-motion="parallax"], [data-motion="pin"]',
  );
  if (objetivo.length === 0) return;

  if (
    sinMovimiento() ||
    !('IntersectionObserver' in window) ||
    !('animate' in Element.prototype)
  ) {
    return; // sin animar: el contenido ya está visible en el HTML de base
  }

  const observador = new IntersectionObserver(
    (entradas) => {
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue;
        revelar(entrada.target as HTMLElement);
        observador.unobserve(entrada.target);
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.1 },
  );

  objetivo.forEach((el) => observador.observe(el));
}

function iniciarCounter(): void {
  const contadores = document.querySelectorAll<HTMLElement>(
    '[data-motion="counter"] [data-to]',
  );
  if (contadores.length === 0) return;

  const pintar = (el: HTMLElement, v: number): void => {
    el.textContent = String(v) + (el.dataset.sufijo ?? '');
  };

  if (sinMovimiento() || !('IntersectionObserver' in window)) {
    contadores.forEach((el) => pintar(el, Number(el.dataset.to ?? 0)));
    return;
  }

  const observador = new IntersectionObserver(
    (entradas) => {
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue;
        const el = entrada.target as HTMLElement;
        observador.unobserve(el);

        const destino = Number(el.dataset.to ?? 0);
        const duracion = 900;
        const inicio = performance.now();

        const paso = (ahora: number): void => {
          const t = Math.min((ahora - inicio) / duracion, 1);
          const suave = 1 - Math.pow(1 - t, 3);
          pintar(el, Math.round(destino * suave));
          if (t < 1) requestAnimationFrame(paso);
        };
        requestAnimationFrame(paso);
      }
    },
    { threshold: 0.5 },
  );

  contadores.forEach((el) => observador.observe(el));
}

export function iniciarMotion(): void {
  iniciarReveal();
  iniciarCounter();
}
