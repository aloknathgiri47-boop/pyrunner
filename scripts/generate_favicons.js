/**
 * Generate favicon PNGs / ICO / manifest.json from the existing /public/logo.svg.
 *
 * The source SVG contains a CSS breathe animation that toggles opacity between
 * 0.7 and 1.0 — for a favicon we want a static, fully-opaque render, so we
 * rewrite the animation class to a fixed opacity 1 before rasterizing.
 *
 * Outputs (all into /home/z/my-project/public/):
 *   - favicon-16x16.png
 *   - favicon-32x32.png
 *   - favicon-48x48.png
 *   - apple-touch-icon.png   (180x180)
 *   - icon-192.png            (PWA manifest)
 *   - icon-512.png            (PWA manifest)
 *   - icon.svg                (favicon SVG — copy of logo.svg, static)
 *   - favicon.ico            (multi-resolution: 16, 32, 48)
 *   - manifest.json
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC = '/home/z/my-project/public/logo.svg';
const OUT_DIR = '/home/z/my-project/public';

async function main() {
  if (!fs.existsSync(SRC)) {
    throw new Error(`Source SVG not found: ${SRC}`);
  }

  const raw = fs.readFileSync(SRC, 'utf8');

  // Strip the breathe animation: replace the .z-breathe { animation... } block
  // with a fixed opacity:1 so the PNG renders the Z mark at full strength.
  // We also add a solid background so transparent favicons don't get a black
  // box on Windows / older Edge.
  const staticSvg = raw
    .replace(/\.z-breathe\s*\{[^}]*\}/, '.z-breathe { opacity: 1; }')
    .replace(/@keyframes breathe\s*\{[^}]*\}/, '')
    // Add explicit white-ish background rect (the rounded square already has
    // a #2D2D2D fill from .st194, so this is just a safety net for any
    // environment that ignores <defs><style>).
    .replace(
      /(<svg[^>]*>)/,
      '$1<rect x="0" y="0" width="30" height="30" rx="4" fill="#2D2D2D"/>',
    );

  // Persist a static copy as icon.svg (used by some browsers as a vector favicon).
  fs.writeFileSync(path.join(OUT_DIR, 'icon.svg'), staticSvg);

  // Rasterize to the various sizes we need.
  const sizes = [
    { name: 'favicon-16x16.png', size: 16 },
    { name: 'favicon-32x32.png', size: 32 },
    { name: 'favicon-48x48.png', size: 48 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'icon-192.png', size: 192 },
    { name: 'icon-512.png', size: 512 },
  ];

  const buffers = {};
  for (const { name, size } of sizes) {
    const png = await sharp(Buffer.from(staticSvg), { density: 384 })
      .resize(size, size, { fit: 'contain', background: { r: 45, g: 45, b: 45, alpha: 1 } })
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(OUT_DIR, name), png);
    buffers[name] = png;
    console.log(`✓ wrote ${name} (${size}x${size})`);
  }

  // Build a multi-resolution .ico file containing 16, 32, 48.
  // ICO format spec:
  //   header (6 bytes)
  //   directory entries (16 bytes each, one per image)
  //   image data (raw PNG bytes for each image, in entry order)
  const icoEntries = [
    { size: 16, data: buffers['favicon-16x16.png'] },
    { size: 32, data: buffers['favicon-32x32.png'] },
    { size: 48, data: buffers['favicon-48x48.png'] },
  ];

  const headerSize = 6;
  const entrySize = 16;
  const directorySize = icoEntries.length * entrySize;
  let dataOffset = headerSize + directorySize;

  // Pre-compute offsets
  const entries = icoEntries.map((e) => {
    const offset = dataOffset;
    dataOffset += e.data.length;
    return { ...e, offset };
  });

  const icoBuf = Buffer.alloc(dataOffset);
  // ICONDIR header
  icoBuf.writeUInt16LE(0, 0); // reserved
  icoBuf.writeUInt16LE(1, 2); // type = 1 (icon)
  icoBuf.writeUInt16LE(entries.length, 4); // image count
  // Directory entries
  entries.forEach((e, i) => {
    const base = headerSize + i * entrySize;
    icoBuf.writeUInt8(e.size === 256 ? 0 : e.size, base + 0); // width
    icoBuf.writeUInt8(e.size === 256 ? 0 : e.size, base + 1); // height
    icoBuf.writeUInt8(0, base + 2); // palette count (0 for PNG)
    icoBuf.writeUInt8(0, base + 3); // reserved
    icoBuf.writeUInt16LE(1, base + 4); // color planes
    icoBuf.writeUInt16LE(32, base + 6); // bits per pixel
    icoBuf.writeUInt32LE(e.data.length, base + 8); // image size
    icoBuf.writeUInt32LE(e.offset, base + 12); // image offset
  });
  // Image data
  entries.forEach((e) => {
    e.data.copy(icoBuf, e.offset);
  });

  fs.writeFileSync(path.join(OUT_DIR, 'favicon.ico'), icoBuf);
  console.log(`✓ wrote favicon.ico (${icoBuf.length} bytes)`);

  // PWA manifest
  const manifest = {
    name: 'PyRunner — Online Python Compiler',
    short_name: 'PyRunner',
    description: 'Write, run, and share Python code right in your browser.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
  fs.writeFileSync(
    path.join(OUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
  );
  console.log('✓ wrote manifest.json');

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
