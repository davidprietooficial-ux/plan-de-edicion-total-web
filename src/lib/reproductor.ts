/**
 * Reproductor de video a medida (estilo Vturb): botón grande de
 * play/pausa, barra de progreso solo visual y retomar desde localStorage.
 *
 * El <video> arranca con el atributo `controls` puesto en el HTML —
 * fail-open: si este módulo no llega a correr, el navegador muestra sus
 * controles nativos en vez de dejar el video sin forma de reproducirse.
 * Recién se quita al final de iniciarReproductor(), cuando el botón y la
 * barra ya están enganchados.
 */

const CLAVE_PROGRESO = 'reproductor-progreso';
const UMBRAL_RETOMAR_SEG = 5; // menos que esto no vale la pena preguntar

function leerProgresoGuardado(id: string): number | null {
  try {
    const crudo = window.localStorage.getItem(`${CLAVE_PROGRESO}:${id}`);
    if (!crudo) return null;
    const segundos = Number(crudo);
    return Number.isFinite(segundos) && segundos > 0 ? segundos : null;
  } catch {
    return null; // privado/incógnito o localStorage bloqueado: se sigue viendo el video igual, sin retomar
  }
}

function guardarProgreso(id: string, segundos: number): void {
  try {
    window.localStorage.setItem(`${CLAVE_PROGRESO}:${id}`, String(Math.floor(segundos)));
  } catch {
    // sin cuota o bloqueado — no es crítico
  }
}

function borrarProgreso(id: string): void {
  try {
    window.localStorage.removeItem(`${CLAVE_PROGRESO}:${id}`);
  } catch {
    // idem
  }
}

export function iniciarReproductor(): void {
  const contenedor = document.querySelector<HTMLElement>('[data-reproductor]');
  if (!contenedor) return;

  const video = contenedor.querySelector<HTMLVideoElement>('[data-reproductor-video]');
  const boton = contenedor.querySelector<HTMLButtonElement>('[data-reproductor-boton]');
  const iconoPlay = contenedor.querySelector<SVGElement>('[data-icono-play]');
  const iconoPausa = contenedor.querySelector<SVGElement>('[data-icono-pausa]');
  const barra = contenedor.querySelector<HTMLElement>('[data-reproductor-barra]');
  const relleno = contenedor.querySelector<HTMLElement>('[data-reproductor-relleno]');
  const resumen = contenedor.querySelector<HTMLElement>('[data-reproductor-resumen]');
  const botonContinuar = contenedor.querySelector<HTMLButtonElement>(
    '[data-reproductor-continuar]',
  );
  const botonReiniciar = contenedor.querySelector<HTMLButtonElement>(
    '[data-reproductor-reiniciar]',
  );

  if (!video || !boton || !iconoPlay || !iconoPausa || !barra || !relleno) return;

  const id = contenedor.dataset.reproductor ?? 'video';
  let ultimoTiempoValido = 0;
  let saltoPermitido = false;
  let ultimoSegundoGuardado = -1;

  const actualizarIcono = (): void => {
    if (video.paused) {
      iconoPlay.removeAttribute('hidden');
      iconoPausa.setAttribute('hidden', '');
    } else {
      iconoPlay.setAttribute('hidden', '');
      iconoPausa.removeAttribute('hidden');
    }
    boton.setAttribute('aria-label', video.paused ? 'Reproducir video' : 'Pausar video');
  };

  const alternarReproduccion = (): void => {
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };

  // Un solo listener delegado: cubre el clic en el botón (burbujea hasta
  // acá) y en cualquier otra parte del video, sin duplicar el toggle.
  contenedor.addEventListener('click', () => {
    if (resumen && !resumen.hidden) return; // el diálogo de retomar manda mientras está abierto
    alternarReproduccion();
  });

  video.addEventListener('play', actualizarIcono);
  video.addEventListener('pause', actualizarIcono);

  video.addEventListener('timeupdate', () => {
    ultimoTiempoValido = video.currentTime;
    if (!video.duration) return;

    const porcentaje = (video.currentTime / video.duration) * 100;
    relleno.style.width = `${porcentaje}%`;
    barra.setAttribute('aria-valuenow', String(Math.round(porcentaje)));

    const segundoActual = Math.floor(video.currentTime);
    if (segundoActual !== ultimoSegundoGuardado) {
      ultimoSegundoGuardado = segundoActual;
      guardarProgreso(id, video.currentTime);
    }
  });

  // Sin scrub: cualquier salto de tiempo que no venga de nuestro propio
  // salto al retomar se revierte. No es solo "no dibujamos una barra
  // arrastrable" — cubre cualquier vía nativa que pueda aparecer igual
  // (pantalla completa, clic derecho).
  video.addEventListener('seeking', () => {
    if (saltoPermitido) {
      saltoPermitido = false;
      return;
    }
    if (Math.abs(video.currentTime - ultimoTiempoValido) > 0.5) {
      video.currentTime = ultimoTiempoValido;
    }
  });

  video.addEventListener('ended', () => borrarProgreso(id));

  const progresoGuardado = leerProgresoGuardado(id);
  if (
    progresoGuardado &&
    progresoGuardado > UMBRAL_RETOMAR_SEG &&
    resumen &&
    botonContinuar &&
    botonReiniciar
  ) {
    resumen.hidden = false;

    botonContinuar.addEventListener('click', (evento) => {
      evento.stopPropagation(); // si no, burbujea al listener del contenedor y duplica el toggle
      resumen.hidden = true;
      video.addEventListener(
        'loadedmetadata',
        () => {
          saltoPermitido = true;
          video.currentTime = progresoGuardado;
          ultimoTiempoValido = progresoGuardado;
        },
        { once: true },
      );
      video.play().catch(() => {});
    });

    botonReiniciar.addEventListener('click', (evento) => {
      evento.stopPropagation();
      resumen.hidden = true;
      borrarProgreso(id);
      video.play().catch(() => {});
    });
  }

  actualizarIcono();
  video.removeAttribute('controls'); // recién ahora: el botón y la barra ya están enganchados
}
