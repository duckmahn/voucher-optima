// Run with: node scripts/generate-brand-assets.mjs
// Uses sharp, which is included with Next.js.
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

await mkdir(new URL("../public/icons/", import.meta.url), { recursive: true });
const icon = new URL("../app/icon.svg", import.meta.url);
for (const size of [192, 512]) {
  await sharp(icon.pathname).resize(size, size).png()
    .toFile(new URL(`../public/icons/icon-${size}.png`, import.meta.url).pathname);
}
await sharp(icon.pathname).resize(180, 180).png()
  .toFile(new URL("../app/apple-icon.png", import.meta.url).pathname);

// ICO directory with PNG entries for standard and high-density browser tabs.
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map(size => sharp(icon.pathname).resize(size, size).png().toBuffer()));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
images.forEach((image, i) => {
  const entry = 6 + i * 16;
  header[entry] = sizes[i];
  header[entry + 1] = sizes[i];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(image.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
await writeFile(new URL("../app/favicon.ico", import.meta.url), Buffer.concat([header, ...images]));
await sharp(new URL("../public/social-preview.svg", import.meta.url).pathname).png()
  .toFile(new URL("../public/social-preview.png", import.meta.url).pathname);
