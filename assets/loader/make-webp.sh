#!/usr/bin/env bash
# Makes the loading screen's two pictures (js/loader.js, the inline styles in index.html).
#
# Drop the full-size paintings in this folder as mountain-bare.png and mountain-snow.png (the same
# size, lined up exactly), then run this from the site's folder:   bash assets/loader/make-webp.sh
# Until they exist, it uses the small -preview.jpg placeholders instead.
#
# It writes two sizes of each as .webp (the page picks one for the screen, like the posters):
#   mountain-bare-1280.webp, mountain-bare-1920.webp, mountain-snow-1280.webp, mountain-snow-1920.webp
# A picture is never made bigger than it is (a small source just gives two small files).
# Needs ffmpeg (winget install ffmpeg).
set -e
cd "$(dirname "$0")"
for name in mountain-bare mountain-snow; do
  src="$name.png"
  [ -f "$src" ] || src="$name-preview.jpg"
  for w in 1280 1920; do
    # scale: shrink to w wide if larger, keep the shape; quality 78 is plenty for a soft painting
    ffmpeg -y -v error -i "$src" -vf "scale='min($w,iw)':-2" -c:v libwebp -quality 78 -compression_level 6 "$name-$w.webp"
  done
  echo "$name: from $src"
done
ls -l ./*.webp
