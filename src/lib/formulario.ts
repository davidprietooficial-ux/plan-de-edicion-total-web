/**
 * Formulario de contacto con los CUATRO estados.
 *
 *   éxito · carga · error · vacío
 *
 * El que casi siempre falta es "carga": se pulsa Enviar, no pasa nada
 * visible durante dos segundos, y el usuario vuelve a pulsar. Ahora hay dos
 * mensajes duplicados y un cliente convencido de que la web no funciona.
 *
 * Reglas de tiempo (de references/ux-estados.md):
 *   < 1 s   no se muestra nada — un spinner corto se siente MÁS lento
 *   2-5 s   spinner
 *   > 5 s   spinner con texto que cambia
 *   > 10 s  barra de progreso
 *
 * La validación de aquí es cortesía para el usuario. La de verdad está en
 * el backend (automatizaciones/formulario-google-sheets.gs, un Google Apps
 * Script), y se repite entera.
 *
 * Apps Script no puede devolver un status HTTP distinto de 200 — así que
 * el éxito NO se decide solo por respuesta.ok, hace falta leer el cuerpo
 * JSON (`{ ok, mensaje }`) que el propio backend manda.
 */

import { permitido } from './consentimiento';

type Estado = 'vacio' | 'cargando' | 'exito' | 'error';

// Marca los mensajes que ya vienen aprobados para mostrarse tal cual (los
// que arma el propio backend, nunca una excepción cruda) — así el catch
// de abajo puede distinguirlos de un fallo de red genérico sin adivinar.
class RespuestaBackend extends Error {}

const RETRASO_SPINNER_MS = 900; // por debajo de esto no se muestra nada
const TIEMPO_MAXIMO_MS = 15_000;

interface Campo {
  input: HTMLInputElement | HTMLTextAreaElement;
  error: HTMLElement | null;
  validar: (v: string) => string | null;
}

// ── Validaciones ──────────────────────────────────────────────────────

const obligatorio =
  (etiqueta: string) =>
  (v: string): string | null =>
    v.trim().length === 0 ? `${etiqueta} hace falta para poder responderte.` : null;

const correo = (v: string): string | null => {
  if (v.trim().length === 0) return 'Necesito tu correo para responderte.';
  // Deliberadamente permisiva: rechazar correos válidos raros cuesta
  // clientes. El servidor vuelve a validar.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())
    ? null
    : 'Revisa el correo: parece que falta algo.';
};

const telefono = (v: string): string | null => {
  const limpio = v.replace(/[\s()\-.]/g, '');
  if (limpio.length === 0) return null; // opcional
  // Tolerante con el formato: con guiones, con espacios, con o sin +.
  return /^\+?\d{7,15}$/.test(limpio) ? null : 'Ese teléfono no me cuadra. ¿Lo revisas?';
};

// ── Montaje ───────────────────────────────────────────────────────────

export function iniciarFormulario(): void {
  const form = document.querySelector<HTMLFormElement>('[data-formulario]');
  if (!form) return;

  const boton = form.querySelector<HTMLButtonElement>('[data-enviar]');
  const zonaEstado = form.querySelector<HTMLElement>('[data-estado]');
  if (!boton || !zonaEstado) return;

  const campo = (nombre: string, validar: Campo['validar']): Campo | null => {
    const input = form.querySelector<HTMLInputElement>(`[name="${nombre}"]`);
    if (!input) return null;
    return {
      input,
      error: form.querySelector<HTMLElement>(`[data-error-de="${nombre}"]`),
      validar,
    };
  };

  const campos = [
    campo('nombre', obligatorio('Tu nombre')),
    campo('email', correo),
    campo('telefono', telefono),
    campo('mensaje', obligatorio('Contarme qué necesitas')),
  ].filter((c): c is Campo => c !== null);

  // ── Estado visual ───────────────────────────────────────────────────

  let temporizadorSpinner: number | undefined;

  const ponerEstado = (estado: Estado, mensaje = ''): void => {
    zonaEstado.dataset.estado = estado;
    zonaEstado.textContent = mensaje;
    zonaEstado.hidden = estado === 'vacio';

    // role="alert" solo en error: en éxito interrumpiría al lector de
    // pantalla en mitad de la confirmación.
    zonaEstado.setAttribute('role', estado === 'error' ? 'alert' : 'status');

    const cargando = estado === 'cargando';
    boton.disabled = cargando;
    boton.setAttribute('aria-busy', String(cargando));
    form.setAttribute('aria-busy', String(cargando));
  };

  // ── Validación al salir del campo, no al enviar ─────────────────────

  const mostrarError = (c: Campo, texto: string | null): void => {
    c.input.setAttribute('aria-invalid', texto ? 'true' : 'false');
    if (c.error) {
      c.error.textContent = texto ?? '';
      c.error.hidden = !texto;
    }
  };

  for (const c of campos) {
    c.input.addEventListener('blur', () => mostrarError(c, c.validar(c.input.value)));
    // Al corregir se limpia en vivo, pero no se marca error mientras escribe:
    // señalar un correo incompleto en la tercera letra es hostil.
    c.input.addEventListener('input', () => {
      if (c.input.getAttribute('aria-invalid') === 'true' && !c.validar(c.input.value)) {
        mostrarError(c, null);
      }
    });
  }

  // ── Envío ───────────────────────────────────────────────────────────

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    let primerFallo: Campo | null = null;
    for (const c of campos) {
      const error = c.validar(c.input.value);
      mostrarError(c, error);
      if (error && !primerFallo) primerFallo = c;
    }
    if (primerFallo) {
      primerFallo.input.focus();
      ponerEstado('error', 'Falta algo por revisar arriba.');
      return;
    }

    // Se dispara ya, síncrono y sin esperar a la respuesta del backend:
    // un await antes de esta línea retrasaría el evento, y en el redirect
    // de más abajo el pixel necesita haber salido antes de que la página
    // cambie de sitio.
    if (window.fbq) window.fbq('track', 'Lead');

    // El spinner solo aparece si de verdad tarda.
    temporizadorSpinner = window.setTimeout(
      () => ponerEstado('cargando', 'Enviando…'),
      RETRASO_SPINNER_MS,
    );
    boton.disabled = true;

    const control = new AbortController();
    const corte = window.setTimeout(() => control.abort(), TIEMPO_MAXIMO_MS);

    try {
      const respuesta = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        signal: control.signal,
        headers: { Accept: 'application/json' },
      });

      window.clearTimeout(temporizadorSpinner);
      window.clearTimeout(corte);

      // Apps Script devuelve siempre HTTP 200 — el resultado real viene
      // en el cuerpo. Si el cuerpo no llega a ser JSON válido, se trata
      // como fallo: mejor un error genérico que dar por bueno un envío
      // que no sabemos qué hizo.
      let cuerpo: { ok?: boolean; mensaje?: string } | null = null;
      try {
        cuerpo = await respuesta.json();
      } catch {
        cuerpo = null;
      }

      if (!respuesta.ok || !cuerpo || cuerpo.ok === false) {
        throw new RespuestaBackend(
          cuerpo?.mensaje ||
            'No he podido enviarlo. Prueba otra vez, o escríbeme por WhatsApp.',
        );
      }

      ponerEstado('exito', zonaEstado.dataset.mensajeExito ?? '¡Recibido!');
      form.reset();
      campos.forEach((c) => mostrarError(c, null));

      // Se avisa a la analítica solo si hay permiso.
      if (permitido('marketing')) {
        document.dispatchEvent(
          new CustomEvent('conversion', { detail: { tipo: 'formulario' } }),
        );
      }

      // Si el formulario declara a dónde ir tras el éxito (p. ej. el grupo
      // de WhatsApp), se navega ahí. 400ms de margen: el mínimo para que
      // el evento Lead del pixel salga antes de que la página cambie de
      // sitio, sin que se note como espera.
      const redirigeA = form.dataset.exitoRedirige;
      if (redirigeA) {
        window.setTimeout(() => {
          window.location.href = redirigeA;
        }, 400);
      }
    } catch (e) {
      window.clearTimeout(temporizadorSpinner);
      window.clearTimeout(corte);

      // El usuario ve un mensaje genérico (o el que el propio backend ya
      // preparó como seguro para mostrar) y una salida alternativa.
      // Cualquier otro tipo de excepción (red caída, CORS, etc.) no se
      // enseña cruda: cada línea de un error real es información gratis
      // para quien esté mirando.
      const abortado = e instanceof DOMException && e.name === 'AbortError';
      ponerEstado(
        'error',
        abortado
          ? 'Está tardando demasiado. Prueba otra vez, o escríbeme por WhatsApp.'
          : e instanceof RespuestaBackend
            ? e.message
            : 'No he podido enviarlo. Prueba otra vez, o escríbeme por WhatsApp.',
      );
      boton.disabled = false;
    }
  });

  ponerEstado('vacio');
}
