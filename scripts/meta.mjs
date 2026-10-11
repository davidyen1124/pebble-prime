// Favicon, app icons and the social card, photographed from the site itself so they always match it:
// the icons from the 3D bench (dev.html), the card from the cover. Needs the dev server on :5183
// (npm run dev -- --port 5183), or set BASE.
import { chromium } from 'playwright'
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const PUB = path.join(ROOT, 'public')
const base = process.env.BASE || 'http://localhost:5183'
const PAPER = '#faf3e3'
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
async function portrait(size, query) {
  const page = await (await browser.newContext({ viewport: { width: size, height: size }, deviceScaleFactor: 2 })).newPage()
  await page.goto(`${base}/dev.html?still&nohud&${query}`, { waitUntil: 'load' })
  await page.waitForFunction(() => window.__frames > 20, null, { timeout: 60000 })
  await page.waitForTimeout(500)
  const buf = await page.screenshot({ type: 'png' })
  await page.close()
  return buf
}

// head and shoulders, turned a little
const SRC = await portrait(512, 'az=16&el=4&h=1.36&x=0.5&y=0.89')
for (const [file, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]])
  await sharp(SRC).resize(size, size, { kernel: 'nearest' }).png({ compressionLevel: 9 }).toFile(path.join(PUB, file))

// browser-tab sizes: closer on the face so it still reads at 16px, corners rounded
const FACE = await portrait(512, 'az=10&el=4&h=1.8&x=0.5&y=0.92')
async function tab(size) {
  const r = Math.round(size * 0.22)
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}"/></svg>`)
  return sharp(FACE).resize(size, size, { kernel: 'lanczos3' }).composite([{ input: mask, blend: 'dest-in' }]).png({ compressionLevel: 9 }).toBuffer()
}
const sizes = [16, 32, 48]
const pngs = {}
for (const s of sizes) pngs[s] = await tab(s)
fs.writeFileSync(path.join(PUB, 'favicon-32.png'), pngs[32])
// favicon.ico with PNG-compressed entries
const header = Buffer.alloc(6)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(sizes.length, 4)
let offset = 6 + 16 * sizes.length
const entries = sizes.map((s) => {
  const e = Buffer.alloc(16)
  e.writeUInt8(s, 0)
  e.writeUInt8(s, 1)
  e.writeUInt16LE(1, 4)
  e.writeUInt16LE(32, 6)
  e.writeUInt32LE(pngs[s].length, 8)
  e.writeUInt32LE(offset, 12)
  offset += pngs[s].length
  return e
})
fs.writeFileSync(path.join(PUB, 'favicon.ico'), Buffer.concat([header, ...entries, ...sizes.map((s) => pngs[s])]))

fs.writeFileSync(
  path.join(PUB, 'site.webmanifest'),
  JSON.stringify(
    {
      name: 'PEBBLE: Well-Equipped',
      short_name: 'Pebble',
      description: 'A stylebook of the sixteen things a Turnstone Pebble carries. A fan-made page.',
      start_url: '/',
      display: 'browser',
      background_color: PAPER,
      theme_color: PAPER,
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    null,
    2,
  ) + '\n',
)

// social card, 1200 × 630: the cover itself
{
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 })).newPage()
  await page.goto(`${base}/?still`, { waitUntil: 'load' })
  await page.waitForFunction(() => window.__pebble?.ready, null, { timeout: 60000 })
  await page.waitForTimeout(600)
  await page.addStyleTag({ content: '.start, .bullets { visibility: hidden !important }' })
  const buf = await page.screenshot({ type: 'png' })
  await sharp(buf).resize(1200, 630).jpeg({ quality: 90, mozjpeg: true }).toFile(path.join(PUB, 'og.jpg'))
  await page.close()
}

await browser.close()
for (const f of ['favicon.ico', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'site.webmanifest', 'og.jpg'])
  console.log(f.padEnd(22), (fs.statSync(path.join(PUB, f)).size / 1024).toFixed(1) + ' KB')
