// The Japanese face comes in about 120 slices per weight, each with its own @font-face rule. The page
// uses a few dozen characters, so this writes src/fonts.css with only the slices those characters are in.
// Run it again whenever the Japanese copy in src/config.js changes:  node scripts/fonts.mjs
import fs from 'node:fs'
import path from 'node:path'
const ROOT = path.resolve(import.meta.dirname, '..')
const PKG = path.join(ROOT, 'node_modules/@fontsource/zen-kaku-gothic-new')
const { COVER, OUTRO, STOPS } = await import(path.join(ROOT, 'src/config.js'))
const text = [COVER, OUTRO, ...STOPS].map((o) => JSON.stringify(o)).join('') + '・「」、。'
const wanted = new Set([...text].map((c) => c.codePointAt(0)).filter((c) => c > 0x2ff)) // Latin is set in Jost
const inRange = (range, cp) =>
  range.split(',').some((part) => {
    const m = part.trim().match(/^U\+([0-9A-F?]+)(?:-([0-9A-F]+))?$/i)
    if (!m) return false
    const lo = parseInt(m[1].replace(/\?/g, '0'), 16)
    const hi = m[2] ? parseInt(m[2], 16) : parseInt(m[1].replace(/\?/g, 'F'), 16)
    return cp >= lo && cp <= hi
  })
let out = '/* Written by scripts/fonts.mjs: the slices of Zen Kaku Gothic New this page has characters in. */\n'
let kept = 0
const found = new Set()
for (const weight of [500, 700]) {
  const css = fs.readFileSync(path.join(PKG, `${weight}.css`), 'utf8')
  for (const block of css.match(/@font-face\s*{[^}]*}/g)) {
    const range = (block.match(/unicode-range:\s*([^;]+);/) || [])[1]
    const file = (block.match(/url\(\.\/files\/([^)]+\.woff2)\)/) || [])[1]
    if (!range || !file) continue
    const hits = [...wanted].filter((cp) => inRange(range, cp))
    if (!hits.length) continue
    hits.forEach((cp) => found.add(cp))
    kept++
    out += `@font-face {\n  font-family: 'Zen Kaku Gothic New';\n  font-style: normal;\n  font-display: swap;\n  font-weight: ${weight};\n  src: url(../node_modules/@fontsource/zen-kaku-gothic-new/files/${file}) format('woff2');\n  unicode-range: ${range};\n}\n`
  }
}
fs.writeFileSync(path.join(ROOT, 'src/fonts.css'), out)
const missing = [...wanted].filter((cp) => !found.has(cp)).map((cp) => String.fromCodePoint(cp))
console.log(`${wanted.size} characters, ${kept} slices kept → src/fonts.css (${(out.length / 1024).toFixed(1)} KB)${missing.length ? '; not in the font: ' + missing.join(' ') : ''}`)
