/**
 * Imprime el hash sha256 de cada <script> inline de dist/, en el formato
 * que espera la directiva script-src de public/.htaccess.
 *
 * Se lee dist/ y no index.html a propósito: lo que el navegador compara
 * contra la CSP es el texto SERVIDO, y el build puede tocarlo. Hashear la
 * fuente da un valor que parece correcto y bloquea el script igual.
 *
 *   npm run build && npm run csp:hash
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const dist = join(raiz, 'dist');

function paginas(directorio) {
  const encontradas = [];
  for (const entrada of readdirSync(directorio)) {
    const ruta = join(directorio, entrada);
    if (statSync(ruta).isDirectory()) {
      encontradas.push(...paginas(ruta));
    } else if (entrada.endsWith('.html')) {
      encontradas.push(ruta);
    }
  }
  return encontradas;
}

let total = 0;

try {
  statSync(dist);
} catch {
  console.error('No hay dist/. Corre `npm run build` antes.');
  process.exit(1);
}

for (const ruta of paginas(dist)) {
  const html = readFileSync(ruta, 'utf8');
  // Solo los inline: un <script src="..."> no lleva hash, va por origen.
  for (const [, etiqueta, cuerpo] of html.matchAll(
    /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g,
  )) {
    if (!cuerpo.trim()) continue;

    // Un <script type="application/ld+json"> es un bloque de datos, no
    // código: el navegador nunca lo ejecuta y no le pide hash a la CSP.
    // Hashearlo llenaría script-src de valores que no protegen nada y que
    // caducan cada vez que se toca el JSON-LD.
    const tipo = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(etiqueta);
    const ejecutable =
      !tipo || /^(module|text\/javascript|application\/javascript)$/i.test(tipo[1]);
    if (!ejecutable) continue;
    const hash = createHash('sha256').update(cuerpo, 'utf8').digest('base64');
    console.log(`${relative(raiz, ruta)}\n  'sha256-${hash}'\n`);
    total++;
  }
}

console.log(
  total === 0
    ? 'Sin scripts inline: script-src no necesita ningún hash.'
    : `${total} script(s) inline. Pega el/los hash en script-src de public/.htaccess.`,
);
