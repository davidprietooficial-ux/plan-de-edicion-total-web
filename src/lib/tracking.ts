/**
 * Píxeles y analítica. Todo en cola hasta el consentimiento.
 *
 * Si un ID está vacío, ese proveedor sencillamente no se registra: no se
 * carga un script "por si acaso".
 */

import { alConsentir } from './consentimiento';

// Vacío = no se carga.
//
// metaPixel NO está aquí: por decisión explícita del cliente (2026-08-06)
// dispara sin esperar consentimiento, incrustado directo en el <head> de
// index.html — Meta no lo detectaba en cola porque su verificador no
// acepta cookies. Queda fuera de la cola de este archivo para no
// duplicar el init() ni el PageView.
//
// ── GA4 y GTM: rellena UNO de los dos, no los dos ────────────────────
// Si se ponen los dos Y el contenedor de GTM lleva dentro una etiqueta
// de GA4, cada visita se cuenta DOS veces: una por el gtag de aquí y
// otra por la que dispara GTM. No da ningún error — simplemente los
// números salen al doble y la tasa de conversión, a la mitad.
//
//   Solo GA4  → ga4: 'G-XXXXXXXXXX', gtm: ''
//   Con GTM   → gtm: 'GTM-XXXXXXX',  ga4: ''   y la etiqueta de GA4 se
//               configura dentro del contenedor de GTM.
//
// La CSP de public/.htaccess ya tiene abiertos los dominios de Google,
// así que con poner el ID aquí y volver a desplegar basta.
//
// ── clarity: mapas de calor y grabaciones ────────────────────────────
// Microsoft Clarity. Está aquí y no en GTM porque GTM NO hace mapas de
// calor: GTM solo inyecta scripts de otros, y el mapa de calor lo tiene
// que dar la herramienta que se inyecte. Clarity es gratis y sin límite
// de sesiones, así que no hace falta meter GTM por el medio.
//
// El ID es el del proyecto de Clarity (10 caracteres, p. ej. 'q7x2m9k4p1'),
// no una URL. La CSP ya lo tiene contemplado.
//
// OJO con lo que graba: Clarity guarda vídeo de la sesión, y el
// formulario de esta página pide nombre, correo y teléfono. Por defecto
// Clarity enmascara el contenido de los campos, pero eso hay que dejarlo
// confirmado en su panel (Settings → Masking → Balanced o Strict) antes
// de abrir inscripciones. Va en la categoría 'analitica', así que solo
// graba a quien acepta en el banner.
export const IDS = {
  ga4: 'G-QKYH7ZEGHQ',
  gtm: '',
  googleAds: '',
  tiktokPixel: '',
  clarity: '',
} as const;

/**
 * Carga un script externo de forma diferida.
 * Se marca async y se añade al final: nunca bloquea el render.
 */
function cargarScript(src: string, atributos: Record<string, string> = {}): Promise<void> {
  return new Promise((resolver, rechazar) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    for (const [k, v] of Object.entries(atributos)) s.setAttribute(k, v);
    s.onload = () => resolver();
    s.onerror = () => rechazar(new Error(`No se pudo cargar ${src}`));
    document.head.append(s);
  });
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    ttq?: { load: (id: string) => void; page: () => void };
  }
}

export function iniciarTracking(): void {
  // ── Google Analytics 4 · categoría analítica ────────────────────────
  if (IDS.ga4) {
    alConsentir('analitica', 'Google Analytics 4', async () => {
      await cargarScript(`https://www.googletagmanager.com/gtag/js?id=${IDS.ga4}`);
      window.dataLayer = window.dataLayer ?? [];
      const gtag = (...args: unknown[]): void => {
        window.dataLayer!.push(args);
      };
      window.gtag = gtag;
      gtag('js', new Date());
      gtag('config', IDS.ga4, { anonymize_ip: true });
    });
  }

  // ── Google Tag Manager · analítica ──────────────────────────────────
  if (IDS.gtm) {
    alConsentir('analitica', 'Google Tag Manager', async () => {
      window.dataLayer = window.dataLayer ?? [];
      window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
      await cargarScript(`https://www.googletagmanager.com/gtm.js?id=${IDS.gtm}`);
    });
  }

  // ── Microsoft Clarity · categoría analítica ─────────────────────────
  // Se carga por src en vez de con el snippet inline que da Clarity: un
  // inline nuevo obligaría a recalcular el hash de la CSP en cada cambio,
  // y el fallo sería silencioso. El tag de Clarity se arranca solo.
  if (IDS.clarity) {
    alConsentir('analitica', 'Microsoft Clarity', async () => {
      await cargarScript(`https://www.clarity.ms/tag/${IDS.clarity}`);
    });
  }

  // ── TikTok · marketing ──────────────────────────────────────────────
  if (IDS.tiktokPixel) {
    alConsentir('marketing', 'TikTok Pixel', async () => {
      await cargarScript('https://analytics.tiktok.com/i18n/pixel/events.js');
      window.ttq?.load(IDS.tiktokPixel);
      window.ttq?.page();
    });
  }
}

/**
 * Conversiones. Se disparan desde la interfaz (clic en WhatsApp, envío de
 * formulario) y solo llegan a los proveedores que tengan permiso.
 */
export function registrarConversiones(): void {
  const enviar = (nombre: string, datos: Record<string, unknown> = {}): void => {
    window.gtag?.('event', nombre, datos);
    window.fbq?.('trackCustom', nombre, datos);
  };

  document.addEventListener('conversion', (e) => {
    const detalle = (e as CustomEvent<{ tipo: string }>).detail;
    enviar('conversion', { tipo: detalle?.tipo ?? 'desconocido' });
  });

  // Clic en WhatsApp: es la conversión principal en la mayoría de landings
  // de servicio, y la que más se olvida de medir.
  document
    .querySelectorAll<HTMLAnchorElement>('a[href*="wa.me"], a[href^="https://api.whatsapp"]')
    .forEach((a) => {
      a.addEventListener('click', () => enviar('clic_whatsapp', { destino: a.href }));
    });

  document.querySelectorAll<HTMLAnchorElement>('a[href^="tel:"]').forEach((a) => {
    a.addEventListener('click', () => enviar('clic_telefono'));
  });
}
