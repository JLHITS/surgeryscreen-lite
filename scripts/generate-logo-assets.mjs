// Regenerates the SurgeryScreen logo assets from the single source of truth in
// src/lib/logo-art.ts.  Run with: npm run logo  (or: node scripts/generate-logo-assets.mjs)
//
// Produces:
//   public/icon.svg              theme-adaptive mark, transparent background
//   public/logo.svg              full lockup (mark + wordmark), transparent
//   src/app/icon.svg             SVG favicon (modern browsers)
//   src/app/favicon.ico          16/32/48 raster favicon (legacy)
//   src/app/apple-icon.png       180x180 home-screen icon
//   src/app/opengraph-image.png  1200x630 social share card (+ .alt.txt)
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { MARK_PATH, ICON_VIEWBOX, WORDMARK } from "../src/lib/logo-art.ts";

// --- oklch() -> #rrggbb, so brand colours stay in sync with globals.css ---
function oklchToHex(L, C, H) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const g = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
  return (
    "#" +
    lin
      .map((c) => Math.max(0, Math.min(255, Math.round(g(c) * 255))).toString(16).padStart(2, "0"))
      .join("")
  );
}

const C = {
  primary: oklchToHex(0.55, 0.19, 264),
  foreground: oklchToHex(0.21, 0.02, 260),
  foregroundDark: oklchToHex(0.96, 0.004, 250),
  background: oklchToHex(0.985, 0.002, 250),
  muted: oklchToHex(0.53, 0.02, 262),
  white: "#ffffff",
};

// --- standalone icon.svg: theme-adaptive mark on a transparent background ---
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ICON_VIEWBOX}" width="512" height="512" role="img" aria-label="${WORDMARK}">
  <style>.m{fill:${C.foreground}}@media (prefers-color-scheme:dark){.m{fill:${C.foregroundDark}}}</style>
  <path class="m" fill-rule="evenodd" d="${MARK_PATH}"/>
</svg>
`;
writeFileSync("public/icon.svg", iconSvg);
writeFileSync("src/app/icon.svg", iconSvg);

// --- standalone full lockup logo.svg (mark + wordmark text) ---
// textLength locks the wordmark width so the lockup proportions hold even when
// the viewer lacks the Geist font.
const FONT = "'Geist', 'Geist Sans', Inter, 'Segoe UI', system-ui, -apple-system, Arial, sans-serif";
const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2070 377" role="img" aria-label="${WORDMARK}">
  <style>.f{fill:${C.foreground}}@media (prefers-color-scheme:dark){.f{fill:${C.foregroundDark}}}</style>
  <path class="f" fill-rule="evenodd" d="${MARK_PATH}"/>
  <text class="f" x="546" y="262" font-family="${FONT}" font-weight="600" font-size="256" letter-spacing="-8" textLength="1500" lengthAdjust="spacingAndGlyphs">${WORDMARK}</text>
</svg>
`;
writeFileSync("public/logo.svg", logoSvg);

// Helper: an SVG with a solid background + single-colour mark.
const filledIcon = (vb, bg, fg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">` +
  `<rect x="-9999" y="-9999" width="19998" height="19998" fill="${bg}"/>` +
  `<path fill="${fg}" fill-rule="evenodd" d="${MARK_PATH}"/></svg>`;

// --- apple-icon.png: 180x180, brand background, white mark ---
await sharp(Buffer.from(filledIcon("-70 -114 605 605", C.primary, C.white)))
  .resize(180, 180)
  .png()
  .toFile("src/app/apple-icon.png");

// --- favicon.ico: 16/32/48 PNGs (brand bg, white mark) packed into an ICO ---
const faviconSvg = filledIcon("-24 -68 513 513", C.primary, C.white);
const sizes = [16, 32, 48];
const pngs = await Promise.all(
  sizes.map((s) => sharp(Buffer.from(faviconSvg)).resize(s, s).png().toBuffer())
);
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  const dir = Buffer.alloc(16 * images.length);
  let offset = 6 + 16 * images.length;
  images.forEach((img, i) => {
    const e = i * 16;
    dir.writeUInt8(sizes[i], e + 0);
    dir.writeUInt8(sizes[i], e + 1);
    dir.writeUInt16LE(1, e + 4); // colour planes
    dir.writeUInt16LE(32, e + 6); // bits per pixel
    dir.writeUInt32LE(img.length, e + 8);
    dir.writeUInt32LE(offset, e + 12);
    offset += img.length;
  });
  return Buffer.concat([header, dir, ...images]);
}
writeFileSync("src/app/favicon.ico", buildIco(pngs));

// --- opengraph-image.png: 1200x630 social card ---
const W = 1200, H = 630;
const markH = 150, markW = Math.round((markH * 465) / 377), scale = markH / 377;
const gap = 40, textLen = 600, fontSize = 104;
const startX = Math.round((W - (markW + gap + textLen)) / 2);
const centerY = 268;
const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${C.background}"/>
  <rect width="${W}" height="10" fill="${C.primary}"/>
  <g transform="translate(${startX} ${centerY - markH / 2}) scale(${scale})"><path fill="${C.primary}" fill-rule="evenodd" d="${MARK_PATH}"/></g>
  <text x="${startX + markW + gap}" y="${centerY + fontSize * 0.34}" font-family="${FONT}" font-weight="600" font-size="${fontSize}" letter-spacing="-3" textLength="${textLen}" lengthAdjust="spacingAndGlyphs" fill="${C.foreground}">${WORDMARK}</text>
  <text x="${W / 2}" y="430" text-anchor="middle" font-family="${FONT}" font-weight="400" font-size="40" fill="${C.muted}">Open-source waiting-room slideshow displays</text>
  <text x="${W / 2}" y="486" text-anchor="middle" font-family="${FONT}" font-weight="400" font-size="40" fill="${C.muted}">for GP practices &amp; PCNs.</text>
</svg>`;
await sharp(Buffer.from(ogSvg)).png().toFile("src/app/opengraph-image.png");
writeFileSync(
  "src/app/opengraph-image.alt.txt",
  "SurgeryScreen — open-source waiting-room slideshow displays for GP practices and PCNs."
);

console.log("Logo assets regenerated.");
