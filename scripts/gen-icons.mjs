/**
 * Generates the PWA icon set (Module 10.1) into `public/` from the lucide
 * GraduationCap mark — the same icon the app uses for branding — rendered white
 * on the near-black primary color (--primary, oklch(0.205 0 0) ~ #1a1a1a).
 *
 * Run from the project root:  node scripts/gen-icons.mjs
 * Outputs: icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png
 */
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const BG = "#1a1a1a";
const FG = "#ffffff";

// lucide GraduationCap, viewBox 0 0 24 24, stroke-based.
const cap = (sw) => `
  <g fill="none" stroke="${FG}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/>
    <path d="M22 10v6"/>
    <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>
  </g>`;

// SVG at `size` with the 24x24 icon scaled to `frac` of the canvas, centered.
function svg({ size, frac, radius = 0 }) {
  const icon = frac * size;
  const offset = (size - icon) / 2;
  const scale = icon / 24;
  const sw = 2.6 / scale; // slightly bolder than the 2px lucide default for presence
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${BG}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">${cap(sw)}</g>
</svg>`;
}

async function render(name, opts) {
  await sharp(Buffer.from(svg(opts))).png().toFile(path.join(OUT, name));
  console.log("wrote", name);
}

// Regular icons: icon fills ~62% of the tile, slightly rounded corners.
await render("icon-192.png", { size: 192, frac: 0.62, radius: 34 });
await render("icon-512.png", { size: 512, frac: 0.62, radius: 90 });
// Maskable: full-bleed background, icon kept inside the ~80% safe zone.
await render("icon-maskable-512.png", { size: 512, frac: 0.5 });
// Apple touch icon: opaque, square (iOS rounds it itself).
await render("apple-touch-icon.png", { size: 180, frac: 0.62 });
