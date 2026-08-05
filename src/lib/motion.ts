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

// Cuenta regresiva a la fecha de la clase. Lee `data-cuenta-hasta` (ISO
// con offset) de cada contenedor que la use — hay más de uno (hero grande,
// barra flotante compacta), así que actualiza todos desde un único
// intervalo en vez de uno por instancia. `data-cuenta-formato="compacto"`
// pinta un texto corto ("2d 14h 30m"); si no, escribe en los campos
// `[data-cuenta-campo]` que ya existen en el HTML con ceros de partida —
// si el JS no llega a correr, esos ceros son el peor caso, no un hueco.
function formatearRestante(msRestante: number) {
  const total = Math.max(0, Math.floor(msRestante / 1000));
  return {
    dias: Math.floor(total / 86400),
    horas: Math.floor((total % 86400) / 3600),
    minutos: Math.floor((total % 3600) / 60),
    segundos: total % 60,
  };
}

function iniciarCuentaRegresiva(): void {
  const contenedores = document.querySelectorAll<HTMLElement>('[data-cuenta-hasta]');
  if (contenedores.length === 0) return;

  const actualizar = (): void => {
    contenedores.forEach((el) => {
      const destino = new Date(el.dataset.cuentaHasta ?? '').getTime();
      if (Number.isNaN(destino)) return;
      const restante = destino - Date.now();
      const { dias, horas, minutos, segundos } = formatearRestante(restante);

      if (el.dataset.cuentaFormato === 'compacto') {
        el.textContent = restante <= 0 ? 'En vivo ahora' : `${dias}d ${horas}h ${minutos}m`;
        return;
      }

      const escribir = (campo: string, valor: number): void => {
        const destinoEl = el.querySelector<HTMLElement>(`[data-cuenta-campo="${campo}"]`);
        if (destinoEl) destinoEl.textContent = String(valor).padStart(2, '0');
      };
      escribir('dias', dias);
      escribir('horas', horas);
      escribir('minutos', minutos);
      escribir('segundos', segundos);

      if (restante <= 0) {
        const enVivo = el.querySelector<HTMLElement>('[data-cuenta-en-vivo]');
        if (enVivo) enVivo.hidden = false;
      }
    });
  };

  actualizar();
  window.setInterval(actualizar, 1000);
}

export function iniciarMotion(): void {
  iniciarReveal();
  iniciarCounter();
  iniciarCuentaRegresiva();
}
