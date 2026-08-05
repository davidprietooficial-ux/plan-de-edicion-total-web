/**
 * Punto de entrada.
 *
 * El orden importa y no es arbitrario:
 *   1. Estilos, para que no haya destello sin estilar.
 *   2. Consentimiento, porque todo lo demás depende de él.
 *   3. Interfaz (navegación, revelado, formulario): funciona sin permisos.
 *   4. Tracking, que queda en cola hasta que haya consentimiento.
 *
 * Todo el JS de este archivo es de mejora progresiva: si falla, la página
 * sigue leyéndose y los enlaces siguen funcionando.
 */

import './estilos/tokens.css';
import './estilos/sitio.css';

import { iniciarConsentimiento } from './lib/consentimiento';
import { iniciarMotion } from './lib/motion';
import { iniciarFormulario } from './lib/formulario';
import { iniciarTracking, registrarConversiones } from './lib/tracking';

// ── Navegación ────────────────────────────────────────────────────────

function iniciarNavegacion(): void {
  const barra = document.querySelector<HTMLElement>('[data-navbar]');
  const boton = document.querySelector<HTMLButtonElement>('[data-menu-boton]');
  const menu = document.querySelector<HTMLElement>('[data-menu]');

  // Fondo sólido al bajar. Se usa un IntersectionObserver sobre un centinela
  // en vez de escuchar scroll: no dispara en cada píxel.
  if (barra) {
    const centinela = document.createElement('div');
    centinela.setAttribute('aria-hidden', 'true');
    centinela.style.cssText = 'position:absolute;top:0;height:1px;width:1px';
    document.body.prepend(centinela);
    new IntersectionObserver(
      ([entrada]) => barra.classList.toggle('compacta', !entrada?.isIntersecting),
      { threshold: 0 },
    ).observe(centinela);
  }

  if (!boton || !menu) return;

  const alternar = (abierto: boolean): void => {
    boton.setAttribute('aria-expanded', String(abierto));
    menu.hidden = !abierto;
    // Bloquea el scroll del fondo solo en móvil, donde el menú es pantalla
    // completa. En escritorio el menú siempre está visible.
    document.body.style.overflow = abierto ? 'hidden' : '';
  };

  boton.addEventListener('click', () =>
    alternar(boton.getAttribute('aria-expanded') !== 'true'),
  );

  menu.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a')) alternar(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && boton.getAttribute('aria-expanded') === 'true') {
      alternar(false);
      boton.focus();
    }
  });

  // Si se pasa a escritorio con el menú abierto, se restaura el scroll.
  window.matchMedia('(min-width: 768px)').addEventListener('change', (e) => {
    if (e.matches) alternar(false);
  });
}

// ── Preguntas frecuentes ──────────────────────────────────────────────

function iniciarFaq(): void {
  // Se usa <details>, que ya es accesible y funciona sin JS. Esto solo
  // añade el cierre de las demás al abrir una.
  const grupo = document.querySelectorAll<HTMLDetailsElement>('[data-faq] details');
  grupo.forEach((d) => {
    d.addEventListener('toggle', () => {
      if (!d.open) return;
      grupo.forEach((otra) => {
        if (otra !== d) otra.open = false;
      });
    });
  });
}

// ── Toggle "Instrucciones / más información" ────────────────────────────
// Revela el bloque de video, oculto por defecto. El botón sigue siendo
// enfocable y accesible con aria-expanded aunque el JS falle en cargar —
// en ese caso el panel simplemente queda visible (sin el atributo
// `hidden` no hay nada que abrir, así que no es una trampa sin salida).
function iniciarToggleVideo(): void {
  const boton = document.querySelector<HTMLButtonElement>('[data-toggle-video]');
  const panel = document.querySelector<HTMLElement>('[data-panel-video]');
  if (!boton || !panel) return;

  panel.hidden = true;
  boton.setAttribute('aria-expanded', 'false');

  boton.addEventListener('click', () => {
    const abierto = boton.getAttribute('aria-expanded') === 'true';
    boton.setAttribute('aria-expanded', String(!abierto));
    panel.hidden = abierto;
    if (!abierto) {
      const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      panel.scrollIntoView({ behavior: sinMovimiento ? 'auto' : 'smooth', block: 'start' });
    }
  });
}

// ── Cupos disponibles — simulados ────────────────────────────────────────
// El cliente pidió un contador de cupos que arranca ~100 y baja de forma
// progresiva y aleatoria. Es urgencia simulada, no un inventario real —
// por eso el techo y el piso viven en data-* en vez de un número mágico
// en el JS, y por eso nunca baja de un piso: llegar a 0 se leería como
// que la clase ya no acepta gente, y sigue abierta hasta el formulario.
function iniciarCuposSimulados(): void {
  const config = document.querySelector<HTMLElement>('[data-cupos-config]');
  const objetivos = document.querySelectorAll<HTMLElement>('[data-cupos]');
  if (!config || objetivos.length === 0) return;

  const piso = Number(config.dataset.cuposPiso ?? 6);
  let actual = Number(config.dataset.cuposInicial ?? 100);

  const pintar = (): void => {
    objetivos.forEach((el) => {
      el.textContent = String(actual);
    });
  };
  pintar();

  const programarSiguiente = (): void => {
    if (actual <= piso) return;
    const espera = 6000 + Math.random() * 14000;
    window.setTimeout(() => {
      actual = Math.max(piso, actual - 1);
      pintar();
      programarSiguiente();
    }, espera);
  };
  programarSiguiente();
}

// ── Año del pie ───────────────────────────────────────────────────────

function actualizarAno(): void {
  const el = document.querySelector('[data-ano]');
  if (el) el.textContent = String(new Date().getFullYear());
}

// ── Arranque ──────────────────────────────────────────────────────────

function iniciar(): void {
  // El <html> viene con class="no-js" y el CSS lo usa para mostrar todo el
  // contenido sin animaciones. Se quita solo cuando este archivo llega a
  // ejecutarse: si el JS falla o lo bloquean, la página se lee entera.
  document.documentElement.classList.remove('no-js');

  iniciarConsentimiento();

  iniciarNavegacion();
  iniciarMotion();
  iniciarFaq();
  iniciarToggleVideo();
  iniciarCuposSimulados();
  iniciarFormulario();
  actualizarAno();

  iniciarTracking();
  registrarConversiones();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciar, { once: true });
} else {
  iniciar();
}
