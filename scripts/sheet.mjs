// Contact sheet for quick visual review. usage: node scripts/sheet.mjs <dir> <out.png> [filter] [cols] [tileW]
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'
const [dir = 'art/raw', out = 'qa/sheet.png', filter = '', cols = '4', tileW = '480'] = process.argv.slice(2)
const files = fs.readdirSync(dir).filter((f) => /\.(png|jpe?g)$/.test(f) && new RegExp(filter).test(f)).sort()
const W = +tileW
const metas = await Promise.all(files.map((f) => sharp(path.join(dir, f)).metadata()))
const H = Math.round((W * metas[0].height) / metas[0].width)
const COLS = Math.min(+cols, files.length)
const rows = Math.ceil(files.length / COLS)
const tiles = await Promise.all(
  files.map(async (f, i) => ({
    input: await sharp(path.join(dir, f)).resize(W, H, { fit: 'cover', position: 'top' }).png().toBuffer(),
    left: (i % COLS) * (W + 6),
    top: Math.floor(i / COLS) * (H + 6),
  })),
)
await sharp({ create: { width: (W + 6) * COLS, height: (H + 6) * rows, channels: 3, background: '#222' } }).composite(tiles).png().toFile(out)
console.log(files.map((f, i) => `${i}:${f}`).join('  '))
