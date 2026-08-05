import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';

const r = (ruta: string) => fileURLToPath(new URL(ruta, import.meta.url));

export default defineConfig({
  plugins: [tailwindcss()],

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

    // El registro, la confirmación de gracias tras el envío del formulario
    // (redirige ahí src/lib/formulario.ts), y las 4 páginas legales que
    // pidió el cliente en el pie — cada carpeta necesita su propia entrada
    // de Vite para que el build genere su index.html.
    rollupOptions: {
      input: {
        inicio: r('index.html'),
        gracias: r('gracias/index.html'),
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
