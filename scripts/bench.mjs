// Screenshots of the 3D bench (dev.html) at every section, or along the scroll. Dev only.
// usage: node scripts/bench.mjs sections|sweep|travel [desktop|mobile] [base] [frames]
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
const ROOT = path.resolve(import.meta.dirname, '..')
const mode = process.argv[2] || 'sections'
const which = process.argv[3] || 'desktop'
const base = process.argv[4] || 'http://localhost:5183'
const OUT = path.join(ROOT, 'qa/bench', `${mode}-${which}`)
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })
const VP = { desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } }[which]
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await (await browser.newContext(VP)).newPage()
page.on('console', (m) => m.type() === 'error' && console.log('[console.error]', m.text().slice(0, 300)))
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)))
await page.goto(`${base}/dev.html?still&nohud&section=0`, { waitUntil: 'load' })
await page.waitForFunction(() => window.__frames > 5, null, { timeout: 60000 })
const sections = await page.evaluate(() => window.__bench.path.sections.map((s) => ({ id: s.id, a: s.a, b: s.b })))
const shots = []
if (mode === 'sections') sections.forEach((s, i) => shots.push([`${String(i).padStart(2, '0')}-${s.id}`, (s.a + s.b) / 2]))
else if (mode === 'travel') {
  // only the stretches between sections, where the camera is on the move
  const n = +(process.argv[5] || 10)
  for (let i = 0; i + 1 < sections.length; i++)
    for (let k = 1; k < n; k++) shots.push([`${String(i).padStart(2, '0')}-${sections[i].id}-to-${sections[i + 1].id}-${String(k).padStart(2, '0')}`, sections[i].b + ((sections[i + 1].a - sections[i].b) * k) / n])
} else {
  const n = +(process.argv[5] || 120)
  for (let i = 0; i <= n; i++) shots.push([`p${String(Math.round((i / n) * 1000)).padStart(4, '0')}`, i / n])
}
for (const [name, p] of shots) {
  await page.evaluate((v) => (window.__bench.p = v), p)
  await page.waitForTimeout(mode === 'sections' ? 1500 : 260)
  await page.screenshot({ path: path.join(OUT, name + '.jpg'), type: 'jpeg', quality: 86 })
}
await browser.close()
console.log(shots.length, 'frames →', OUT)
