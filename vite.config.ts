import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';

const r = (ruta: string) => fileURLToPath(new URL(ruta, import.meta.url));

/**
 * Quita los comentarios HTML del build.
 *
 * El <head> de index.html lleva un bloque largo de notas internas: los
 * pendientes del cliente, decisiones de cada vuelta, el detalle de qué
 * hace el backend y por qué el token del formulario no es un secreto de
 * verdad. Todo eso viajaba tal cual a producción y se leía con "ver
 * código fuente". No es un agujero — el token está a la vista en el
 * campo oculto por diseño — pero es entregarle a cualquiera el mapa del
 * sitio y el historial de lanzamientos anteriores.
 *
 * Los comentarios se quedan en el código fuente, que es donde sirven.
 * Solo desaparecen del HTML servido.
 *
 * Se salta lo que hay dentro de <script> y <style>: ahí un "<!--" puede
 * ser código legítimo, y tocar un script inline invalidaría el hash
 * sha256 de la CSP — el navegador lo bloquearía sin decir nada.
 */
function quitarComentariosHtml() {
  return {
    name: 'quitar-comentarios-html',
    // 'post' para que corra después de que Vite inyecte sus etiquetas.
    transformIndexHtml: {
      order: 'post' as const,
      handler(html: string) {
        const bloques = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
        let salida = '';
        let cursor = 0;

        for (const bloque of html.matchAll(bloques)) {
          const inicio = bloque.index ?? 0;
          salida += html.slice(cursor, inicio).replace(/<!--[\s\S]*?-->/g, '');
          salida += bloque[0];
          cursor = inicio + bloque[0].length;
        }
        salida += html.slice(cursor).replace(/<!--[\s\S]*?-->/g, '');

        // Las líneas que quedan vacías tras quitar un bloque de notas.
        return salida.replace(/\n\s*\n\s*\n+/g, '\n\n');
      },
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), quitarComentariosHtml()],

  // Hostinger sirve desde la raíz del dominio, así que el build por
  // defecto asume base '/'. GitHub Pages de proyecto sirve desde
  // /<repo>/ — el workflow de Pages pasa VITE_BASE_PATH para ese caso
  // sin tocar el build normal.
  base: process.env.VITE_BASE_PATH || '/',

  build: {
    // Sin sourcemaps en producción: publican el código fuente completo.
    // Es la verificación 6 del gate.
    sourcemap: false,

    // Hostinger sirve estáticos sin problema con nombres con hash, y el hash
    // es lo que permite cachear un año con seguridad (ver public/.htaccess).
    assetsDir: 'assets',

    // El registro y las 4 páginas legales que pidió el cliente en el pie —
    // cada carpeta necesita su propia entrada de Vite para que el build
    // genere su index.html. (La página de gracias se archivó: el envío del
    // formulario redirige directo a WhatsApp, sin paso intermedio.)
    rollupOptions: {
      input: {
        inicio: r('index.html'),
        terminos: r('terminos-y-condiciones/index.html'),
        cookies: r('politica-de-cookies/index.html'),
        avisoLegal: r('aviso-legal/index.html'),
        privacidad: r('politica-de-privacidad/index.html'),
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },

    // Aviso si el JS crece más de la cuenta. Una landing no debería pasar de
    // ~25 KB de JS propio; si lo hace, algo se está haciendo con librería.
    chunkSizeWarningLimit: 40,
  },

  server: {
    port: 5173,
    open: true,
  },
});
