// Pixel textures for the Pebble model, drawn here pixel by pixel and saved into assets-src/blender/tex/.
// Two kinds: small repeating "cloth" tiles (grey detail that the model's vertex colours tint), and one
// atlas of labels (everything with lettering). assets-src/blender/build_pebble.py reads atlas.json to place them.
// usage: node scripts/textures.mjs
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT = path.join(ROOT, 'assets-src/blender/tex')
fs.mkdirSync(OUT, { recursive: true })

function rng(seed) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}
const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255]

class Canvas {
  constructor(w, h, fill = [0, 0, 0, 0]) {
    this.w = w
    this.h = h
    this.d = new Uint8ClampedArray(w * h * 4)
    this.rect(0, 0, w, h, fill)
  }
  px(x, y, c) {
    x |= 0
    y |= 0
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    const i = (y * this.w + x) * 4
    const a = c[3] === undefined ? 255 : c[3]
    if (a === 255) {
      this.d[i] = c[0]
      this.d[i + 1] = c[1]
      this.d[i + 2] = c[2]
      this.d[i + 3] = 255
    } else {
      const t = a / 255
      this.d[i] = this.d[i] * (1 - t) + c[0] * t
      this.d[i + 1] = this.d[i + 1] * (1 - t) + c[1] * t
      this.d[i + 2] = this.d[i + 2] * (1 - t) + c[2] * t
      this.d[i + 3] = Math.max(this.d[i + 3], a)
    }
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c)
  }
  frame(x, y, w, h, c) {
    this.rect(x, y, w, 1, c)
    this.rect(x, y + h - 1, w, 1, c)
    this.rect(x, y, 1, h, c)
    this.rect(x + w - 1, y, 1, h, c)
  }
  line(x0, y0, x1, y1, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
    for (let i = 0; i <= n; i++) this.px(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c)
  }
  disc(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) this.px(x, y, c)
  }
  blit(src, dx, dy) {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const i = (y * src.w + x) * 4
        this.px(dx + x, dy + y, [src.d[i], src.d[i + 1], src.d[i + 2], src.d[i + 3]])
      }
  }
  // sprinkle: nudge every pixel a little lighter or darker, so flat areas read as printed, not as plastic
  grain(r, amount) {
    for (let i = 0; i < this.d.length; i += 4) {
      if (!this.d[i + 3]) continue
      const k = 1 + (r() - 0.5) * amount
      this.d[i] *= k
      this.d[i + 1] *= k
      this.d[i + 2] *= k
    }
    return this
  }
  save(file) {
    return sharp(Buffer.from(this.d.buffer), { raw: { width: this.w, height: this.h, channels: 4 } }).png().toFile(path.join(OUT, file))
  }
}

// ── two pixel fonts ───────────────────────────────────────────────────────
const F57 = {
  A: '.###.#...##...#######...##...##...#', B: '####.#...##...#####.#...##...#####.', C: '.###.#...##....#....#....#...#.###.', D: '####.#...##...##...##...##...#####.',
  E: '######....#....####.#....#....#####', F: '######....#....####.#....#....#....', G: '.###.#...##....#.####...##...#.###.', H: '#...##...##...#######...##...##...#',
  I: '.###...#....#....#....#....#...###.', J: '..###...#....#....#....#.#..#..##..', K: '#...##..#.#.#..##...#.#..#..#.#...#', L: '#....#....#....#....#....#....#####',
  M: '#...###.###.#.##.#.##...##...##...#', N: '#...###..##.#.##..###...##...##...#', O: '.###.#...##...##...##...##...#.###.', P: '####.#...##...#####.#....#....#....',
  Q: '.###.#...##...##...##.#.##..#..##.#', R: '####.#...##...#####.#.#..#..#.#...#', S: '.#####....#.....###.....#....#####.', T: '#####..#....#....#....#....#....#..',
  U: '#...##...##...##...##...##...#.###.', V: '#...##...##...##...##...#.#.#...#..', W: '#...##...##...##.#.##.#.###.###...#', X: '#...##...#.#.#...#...#.#.#...##...#',
  Y: '#...##...#.#.#...#....#....#....#..', Z: '#####....#...#...#...#...#....#####',
  0: '.###.#...##..###.#.###..##...#.###.', 1: '..#...##....#....#....#....#...###.', 2: '.###.#...#....#...#...#...#...#####', 3: '####.....#....#.###.....#....#####.',
  4: '...#...##..#.#.#..#.#####...#....#.', 5: '######....####.....#....##...#.###.', 6: '.###.#....#....####.#...##...#.###.', 7: '#####....#...#...#....#....#....#..',
  8: '.###.#...##...#.###.#...##...#.###.', 9: '.###.#...##...#.####....#....#.###.',
  $: '..#...#####.#...###...#.#####...#..', '/': '....#....#...#...#...#...#....#....', '~': '...........#...#.#.#...#...........', '.': '.........................##...##...',
  '+': '.......#....#..#####..#....#.......', '-': '...............#####...............', ':': '......##...##.........##...##......', ' ': '...................................',
  '!': '..#....#....#....#....#.........#..', '?': '.###.#...#....#...#...#.........#..', '¥': '#...#.#.#.#####..#..#####..#....#..', '>': '.#.....#.....#.....#...#...#...#...',
}
const F35 = {
  A: '.#.#.#####.##.#', B: '##.#.###.#.###.', C: '.###..#..#...##', D: '##.#.##.##.###.', E: '####..##.#..###', F: '####..##.#..#..', G: '.###..#.##.#.##', H: '#.##.#####.##.#',
  I: '###.#..#..#.###', J: '..#..#..##.#.#.', K: '#.##.###.#.##.#', L: '#..#..#..#..###', M: '#.########.##.#', N: '##.#.##.##.##.#', O: '.#.#.##.##.#.#.', P: '##.#.###.#..#..',
  Q: '.#.#.##.#.#..##', R: '##.#.###.#.##.#', S: '.###...#...###.', T: '###.#..#..#..#.', U: '#.##.##.##.####', V: '#.##.##.##.#.#.', W: '#.##.#######.##', X: '#.##.#.#.#.##.#',
  Y: '#.##.#.#..#..#.', Z: '###..#.#.#..###',
  0: '####.##.##.####', 1: '.#.##..#..#.###', 2: '##...#.#.#..###', 3: '##...#.#...###.', 4: '#.##.####..#..#', 5: '####..##...###.', 6: '.###..####.####', 7: '###..#.#..#..#.',
  8: '####.#####.####', 9: '####.####..###.', $: '.####..#..####.', '/': '..#..#.#.#..#..', '+': '....#.###.#....', '-': '......###......', '.': '.............#.', ':': '....#.....#....', ' ': '...............', '~': '....#.#.#......',
}
function text(cv, str, x, y, c, { font = F57, scale = 1, spacing = 1 } = {}) {
  const [gw, gh] = font === F57 ? [5, 7] : [3, 5]
  let cx = x
  for (const ch of String(str).toUpperCase()) {
    const g = font[ch] || font[' ']
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) if (g[j * gw + i] === '#') cv.rect(cx + i * scale, y + j * scale, scale, scale, c)
    cx += (gw + spacing) * scale
  }
  return cx - x - spacing * scale
}
const width = (str, { font = F57, scale = 1, spacing = 1 } = {}) => String(str).length * ((font === F57 ? 5 : 3) + spacing) * scale - spacing * scale
const centred = (cv, str, cx, y, c, o = {}) => text(cv, str, Math.round(cx - width(str, o) / 2), y, c, o)

// ── tiles: grey detail around white, 32px square, repeating ───────────────
const TILE = 32
function tile(name, paint) {
  const cv = new Canvas(TILE, TILE, [255, 255, 255, 255])
  paint(cv, rng(name.length * 7919 + name.charCodeAt(0) * 31))
  return cv.save(`tile_${name}.png`)
}
const grey = (v) => [v, v, v, 255]
const tiles = [
  tile('skin', (cv, r) => {
    // a river stone: mostly even, with scattered darker and lighter flecks
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) cv.px(x, y, grey(236 + Math.floor(r() * 14)))
    for (let i = 0; i < 26; i++) cv.px(r() * TILE, r() * TILE, grey(196 + Math.floor(r() * 22)))
    for (let i = 0; i < 16; i++) cv.px(r() * TILE, r() * TILE, grey(255))
    for (let i = 0; i < 5; i++) {
      const x = Math.floor(r() * TILE)
      const y = Math.floor(r() * TILE)
      cv.rect(x, y, 2, 1, grey(204))
      cv.px(x, y + 1, grey(214))
    }
  }),
  tile('fabric', (cv, r) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) cv.px(x, y, grey(((x >> 1) + (y >> 1)) % 2 ? 236 : 212 + Math.floor(r() * 10)))
    for (let y = 0; y < TILE; y += 2) for (let x = y % 4 ? 1 : 0; x < TILE; x += 4) cv.px(x, y, grey(196))
  }),
  tile('leather', (cv, r) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) cv.px(x, y, grey(222 + Math.floor(r() * 26)))
    for (let i = 0; i < 36; i++) cv.px(r() * TILE, r() * TILE, grey(184 + Math.floor(r() * 20)))
    for (let i = 0; i < 4; i++) {
      let x = Math.floor(r() * TILE)
      let y = Math.floor(r() * TILE)
      for (let k = 0; k < 6; k++) {
        cv.px(x % TILE, y % TILE, grey(190))
        x += r() < 0.5 ? 1 : 0
        y += 1
      }
    }
  }),
  tile('metal', (cv, r) => {
    for (let y = 0; y < TILE; y++) {
      const row = 224 + Math.floor(r() * 26)
      for (let x = 0; x < TILE; x++) cv.px(x, y, grey(row + Math.floor(r() * 8)))
    }
    for (let i = 0; i < 7; i++) cv.rect(Math.floor(r() * TILE), Math.floor(r() * TILE), 3 + Math.floor(r() * 5), 1, grey(255))
  }),
  tile('plastic', (cv, r) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) cv.px(x, y, grey(240 + Math.floor(r() * 10)))
    for (let i = 0; i < 10; i++) cv.px(r() * TILE, r() * TILE, grey(224))
  }),
  tile('paper', (cv, r) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) cv.px(x, y, grey(238 + Math.floor(r() * 14)))
    for (let i = 0; i < 12; i++) cv.rect(Math.floor(r() * TILE), Math.floor(r() * TILE), 2, 1, grey(222))
  }),
  tile('wood', (cv, r) => {
    for (let x = 0; x < TILE; x++) {
      const col = 222 + Math.floor(r() * 26)
      for (let y = 0; y < TILE; y++) cv.px(x, y, grey(col + Math.floor(r() * 8)))
    }
    for (let i = 0; i < 4; i++) cv.rect(Math.floor(r() * TILE), 0, 1, TILE, grey(190))
  }),
  tile('rubber', (cv, r) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) cv.px(x, y, grey(228 + Math.floor(r() * 22)))
    for (let y = 3; y < TILE; y += 8) cv.rect(0, y, TILE, 1, grey(204))
  }),
]

// ── label atlas ───────────────────────────────────────────────────────────
const C = {
  ink: hex(0x1a1a22), navy: hex(0x1c2a4f), cream: hex(0xf3ead6), white: hex(0xfbf8f0), gold: hex(0xe0b04a), goldDark: hex(0x8a6418), kraft: hex(0xd3b182), kraftDark: hex(0x6b4a22),
  red: hex(0xc8323a), blue: hex(0x5d92e6), green: hex(0x9fd49b), lcd: hex(0xb7d8b0), lcdInk: hex(0x1d3a22), grey: hex(0x9a9aa2), leather: hex(0x6f4222), tan: hex(0xf2dcb8),
}
const A = (c, a) => [...c, a]
const labels = {}
const art = []
function label(name, w, h, paint) {
  const cv = new Canvas(w, h, [0, 0, 0, 0])
  paint(cv, rng(name.length * 131 + w * 17 + h))
  art.push({ name, cv })
}

label('cap_patch', 64, 44, (cv, r) => {
  cv.rect(0, 0, 64, 44, A(C.cream, 255))
  cv.frame(1, 1, 62, 42, A(C.gold, 255))
  cv.frame(3, 3, 58, 38, A(C.navy, 90))
  cv.disc(32, 16, 9, 11, A(C.blue, 255))
  cv.rect(28, 11, 2, 4, A(C.ink, 255))
  cv.rect(34, 11, 2, 4, A(C.ink, 255))
  centred(cv, 'PEBBLE', 32, 31, A(C.navy, 255))
  cv.grain(r, 0.08)
})
for (let n = 1; n <= 3; n++)
  label(`ticket_${n}`, 36, 72, (cv, r) => {
    cv.rect(0, 0, 36, 72, A(C.gold, 255))
    for (let y = 0; y < 72; y++) cv.rect(0, y, 36, 1, A(hex(0xf6d98a), Math.max(0, 120 - y * 3)))
    cv.frame(1, 1, 34, 70, A(C.goldDark, 255))
    cv.frame(3, 3, 30, 66, A(C.goldDark, 120))
    centred(cv, 'ADMIT', 18, 7, A(C.goldDark, 255), { font: F35 })
    centred(cv, 'ONE', 18, 14, A(C.goldDark, 255), { font: F35 })
    // INVITE runs down the ticket, one letter per row
    ;[...'INVITE'].forEach((ch, i) => centred(cv, ch, 18, 22 + i * 6, A(hex(0x5a3c0c), 255), { font: F35 }))
    for (let x = 4; x < 32; x += 3) cv.px(x, 59, A(C.goldDark, 255))
    centred(cv, `${n}/3`, 18, 62, A(hex(0x5a3c0c), 255), { font: F57 })
    cv.grain(r, 0.07)
  })
label('price', 56, 80, (cv, r) => {
  cv.rect(0, 0, 56, 80, A(C.kraft, 255))
  cv.frame(2, 2, 52, 76, A(C.kraftDark, 255))
  cv.disc(28, 9, 3.2, 3.2, A(C.kraftDark, 255))
  cv.disc(28, 9, 1.6, 1.6, A(hex(0x2b1d10), 255))
  centred(cv, 'FREE PLAN', 28, 17, A(hex(0x3b2610), 255), { font: F35 })
  centred(cv, '$0', 28, 27, A(hex(0x3b2610), 255), { scale: 4 })
  centred(cv, 'YOUR FIRST', 28, 59, A(hex(0x3b2610), 255), { font: F35 })
  centred(cv, 'BRAIN + 50', 28, 65, A(hex(0x3b2610), 255), { font: F35 })
  centred(cv, 'RUNS / MONTH', 28, 71, A(hex(0x3b2610), 255), { font: F35 })
  cv.grain(r, 0.12)
})
label('tie', 24, 96, (cv, r) => {
  cv.rect(0, 0, 24, 96, A(C.navy, 255))
  for (let k = -24; k < 96; k += 12) {
    cv.line(0, k + 12, 23, k, A(C.gold, 255))
    cv.line(0, k + 13, 23, k + 1, A(C.gold, 255))
    cv.line(0, k + 16, 23, k + 4, A(hex(0x3a4c7e), 255))
  }
  cv.grain(r, 0.08)
})
label('watch', 48, 48, (cv, r) => {
  cv.disc(24, 24, 24, 24, A(C.gold, 255))
  cv.disc(24, 24, 20.5, 20.5, A(C.cream, 255))
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const big = i % 3 === 0
    cv.line(24 + Math.sin(a) * (big ? 14 : 16.5), 24 - Math.cos(a) * (big ? 14 : 16.5), 24 + Math.sin(a) * 19, 24 - Math.cos(a) * 19, A(C.navy, 255))
  }
  centred(cv, 'RUNS', 24, 30, A(C.red, 255), { font: F35 })
  cv.grain(r, 0.05)
})
label('walkie', 40, 72, (cv, r) => {
  cv.rect(0, 0, 40, 72, A(hex(0x2a2d35), 255))
  cv.rect(5, 6, 30, 18, A(C.lcd, 255))
  cv.frame(4, 5, 32, 20, A(hex(0x101216), 255))
  centred(cv, 'MCP', 20, 9, A(C.lcdInk, 255))
  centred(cv, 'AGENTS:3', 20, 18, A(C.lcdInk, 255), { font: F35 })
  for (let y = 31; y < 56; y += 4) cv.rect(7, y, 26, 2, A(hex(0x0e1014), 255))
  cv.rect(30, 26, 3, 3, A(hex(0x58ff80), 255))
  centred(cv, 'PUSH', 20, 59, A(C.gold, 255), { font: F35 })
  centred(cv, 'TO TALK', 20, 65, A(C.gold, 255), { font: F35 })
  cv.grain(r, 0.06)
})
label('pack_label', 124, 28, (cv, r) => {
  cv.rect(0, 0, 124, 28, A(C.leather, 255))
  for (let x = 3; x < 121; x += 4) {
    cv.rect(x, 2, 2, 1, A(C.tan, 220))
    cv.rect(x, 25, 2, 1, A(C.tan, 220))
  }
  centred(cv, 'ON YOUR MAC', 62, 5, A(C.tan, 255))
  centred(cv, '~/LIBRARY/TURNSTONE', 62, 15, A(C.tan, 255))
  cv.grain(r, 0.1)
})
;[
  ['PEOPLE', 0xe9c46a],
  ['PROJECTS', 0x8fb7e8],
  ['DECISIONS', 0xe8a08f],
  ['COMPANY', 0xa8cfa0],
].forEach(([t, col], i) =>
  label(`tab_${i}`, 60, 13, (cv, r) => {
    cv.rect(0, 0, 60, 13, A(hex(col), 255))
    cv.rect(2, 2, 56, 9, A(C.white, 235))
    centred(cv, t, 30, 3, A(hex(0x2b2118), 255))
    cv.grain(r, 0.05)
  }),
)
label('receipt', 44, 168, (cv, r) => {
  cv.rect(0, 0, 44, 168, A(C.white, 255))
  centred(cv, 'BRAIN', 22, 6, A(C.ink, 255))
  centred(cv, 'UPDATED', 22, 17, A(C.ink, 255), { font: F35 })
  const dash = (y) => {
    for (let x = 3; x < 41; x += 3) cv.rect(x, y, 2, 1, A(C.ink, 255))
  }
  dash(25)
  ;['+ SHORT', '  EMAILS', '+ SSO BY', '  END Q3', '~ RENEWAL', '  IN SEPT', '- OLD', '  PRICING'].forEach((l, i) => text(cv, l, 3, 30 + i * 7, A(C.ink, 255), { font: F35 }))
  dash(89)
  text(cv, '4 CHANGES', 3, 94, A(C.ink, 255), { font: F35 })
  text(cv, 'SAVED', 3, 101, A(C.ink, 255), { font: F35 })
  cv.frame(3, 111, 18, 11, A(C.ink, 255))
  cv.frame(23, 111, 18, 11, A(C.ink, 255))
  text(cv, 'EDIT', 5, 114, A(C.ink, 255), { font: F35, spacing: 0 })
  text(cv, 'UNDO', 25, 114, A(C.ink, 255), { font: F35, spacing: 0 })
  dash(128)
  for (let x = 4; x < 40; ) {
    const w = 1 + Math.floor(r() * 3)
    cv.rect(x, 133, w, 18, A(C.ink, 255))
    x += w + 1 + Math.floor(r() * 2)
  }
  centred(cv, 'THANK YOU', 22, 156, A(C.ink, 255), { font: F35 })
  cv.grain(r, 0.05)
})
label('notebook', 30, 42, (cv, r) => {
  cv.rect(0, 0, 30, 42, A(hex(0x23262e), 255))
  cv.rect(3, 9, 24, 12, A(C.cream, 255))
  centred(cv, 'NOTES', 15, 12, A(hex(0x23262e), 255), { font: F35 })
  cv.rect(24, 0, 2, 42, A(C.gold, 255))
  cv.grain(r, 0.08)
})
label('envelope', 40, 28, (cv, r) => {
  cv.rect(0, 0, 40, 28, A(C.white, 255))
  cv.frame(0, 0, 40, 28, A(hex(0xc9c1b2), 255))
  cv.line(1, 1, 20, 15, A(hex(0xc9c1b2), 255))
  cv.line(38, 1, 20, 15, A(hex(0xc9c1b2), 255))
  cv.rect(31, 3, 6, 7, A(C.red, 255))
  cv.rect(32, 4, 4, 5, A(C.white, 255))
  cv.grain(r, 0.04)
})
label('recorder', 20, 40, (cv, r) => {
  cv.rect(0, 0, 20, 40, A(hex(0xe2ded5), 255))
  for (let y = 4; y < 14; y += 3) for (let x = 4; x < 16; x += 3) cv.rect(x, y, 2, 1, A(hex(0x2a2d35), 255))
  cv.disc(10, 22, 4, 4, A(C.red, 255))
  centred(cv, 'REC', 10, 31, A(hex(0x2a2d35), 255), { font: F35 })
  cv.grain(r, 0.05)
})
;[
  ['CHATGPT', 0x5fa58a],
  ['CLAUDE', 0xd0774a],
  ['GROK', 0x2c2d33],
  ['CURSOR', 0x6a7ea8],
  ['OPENROUTER', 0x8873c4],
].forEach(([t, col], i) =>
  label(`key_${i}`, 46, 15, (cv, r) => {
    cv.rect(0, 0, 46, 15, A(hex(col), 255))
    cv.frame(0, 0, 46, 15, A([0, 0, 0], 70))
    cv.disc(5, 7.5, 2, 2, A([0, 0, 0], 120))
    const o = t.length > 8 ? { font: F35 } : {}
    centred(cv, t, 26, t.length > 8 ? 5 : 4, A(C.white, 255), o)
    cv.grain(r, 0.06)
  }),
)
label('folder_front', 32, 20, (cv, r) => {
  cv.rect(0, 0, 32, 20, A(hex(0xe2bd6b), 255))
  cv.rect(0, 0, 32, 1, A(hex(0xa9812f), 255))
  cv.grain(r, 0.08)
})

// shelf-pack the labels into one square sheet, with a transparent gutter between them
const SHEET = 512
const sheet = new Canvas(SHEET, SHEET, [0, 0, 0, 0])
let x = 2
let y = 2
let rowH = 0
for (const { name, cv } of art.sort((a, b) => b.cv.h - a.cv.h)) {
  if (x + cv.w + 2 > SHEET) {
    x = 2
    y += rowH + 4
    rowH = 0
  }
  // bleed one pixel of the label's own edge into the gutter, so nearest sampling never picks up a neighbour
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) sheet.blit(cv, x + dx, y + dy)
  sheet.blit(cv, x, y)
  labels[name] = { x, y, w: cv.w, h: cv.h }
  x += cv.w + 4
  rowH = Math.max(rowH, cv.h)
}
if (y + rowH > SHEET) throw new Error('label sheet is full')
await Promise.all([...tiles, sheet.save('labels.png')])
fs.writeFileSync(path.join(OUT, 'atlas.json'), JSON.stringify({ size: SHEET, tile: TILE, labels }, null, 1))
console.log(`tiles: ${tiles.length}, labels: ${Object.keys(labels).length}, sheet used down to y=${y + rowH} of ${SHEET}`)
