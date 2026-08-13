#!/usr/bin/env bash
#
# Regenera public/og.jpg — la miniatura que sale al compartir el enlace
# por WhatsApp, Facebook o LinkedIn.
#
#   npm run og
#
# Parte de public/video-hero.jpg (1280x720) y produce 1200x630, que es la
# medida que piden los tres. Si se deja otra proporción, cada uno recorta
# por su cuenta y la miniatura sale distinta en cada sitio.
#
# El tratamiento es deliberadamente discreto: la foto manda, y encima solo
# van un oscurecido progresivo en la franja de abajo y la barra naranja de
# marca. Sin texto: el título y la descripción ya aparecen debajo de la
# imagen en la tarjeta; meterlos también dentro compite con ellos y se
# corta en pantallas pequeñas.
#
# Para cambiar la foto de origen, sustituye public/video-hero.jpg (o edita
# ORIGEN) y vuelve a correr esto.
set -euo pipefail

cd "$(dirname "$0")/.."

ORIGEN="public/video-hero.jpg"
DESTINO="public/og.jpg"
NARANJA="0xFF6A00" # --color-primario en src/estilos/tokens.css
OSCURO="0x0B0908"  # --color-fondo

[ -f "$ORIGEN" ] || { echo "No está $ORIGEN"; exit 1; }
command -v ffmpeg >/dev/null || { echo "Hace falta ffmpeg"; exit 1; }

# El degradado se hace con bandas apiladas de opacidad creciente: ffmpeg no
# trae un degradado lineal que se pueda componer encima sin complicarlo
# mucho más, y a 16 bandas la transición ya no se distingue de una real.
scrim=""
for i in $(seq 0 15); do
  y=$((630 - 240 + i * 15))
  alfa=$(echo "scale=3; 0.035*($i+1)" | bc)
  scrim="${scrim}drawbox=x=0:y=${y}:w=1200:h=16:color=${OSCURO}@${alfa}:t=fill,"
done

ffmpeg -y -loglevel error -i "$ORIGEN" -vf "
  crop=1280:672:0:24,
  scale=1200:630,
  eq=brightness=-0.03:saturation=1.08,
  ${scrim}
  drawbox=x=0:y=614:w=1200:h=16:color=${NARANJA}@1:t=fill
" -q:v 2 "$DESTINO"

echo "$DESTINO listo — $(du -h "$DESTINO" | cut -f1)"
