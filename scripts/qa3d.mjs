// Does anything cut through anything else? Exact mesh tests, run in the 3D bench (needs the dev server).
//   node scripts/qa3d.mjs            worn, and every item's way out and back, for a wide and a tall window
//   node scripts/qa3d.mjs shots      also photographs every item part of the way out, into qa/shots/exits
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
const ROOT = path.resolve(import.meta.dirname, '..')
const base = process.env.BASE || 'http://localhost:5183'
const shots = process.argv[2] === 'shots'
const OUT = path.join(ROOT, 'qa/shots/exits')
if (shots) fs.mkdirSync(OUT, { recursive: true })

// Contacts that are meant: things that are attached to, sit on, or wrap what they touch.
// Worn, these pairs may meet. On the way out an item may still be touching its own seat for the first
// moments (`CLEAR_BY`), and nothing else, ever.
const SEATS = {
  acc_glasses: ['body'],
  acc_cap: ['body'],
  acc_tickets: ['acc_cap'],
  acc_pencil: ['acc_cap', 'body'],
  acc_headset: ['body'],
  acc_tie: ['body'],
  acc_watch: ['arm_l'],
  acc_walkie: ['body'],
  acc_backpack: ['body'],
  acc_helper: ['acc_backpack'],
  helper_arm: ['acc_helper'],
  acc_price: ['acc_backpack'],
  acc_magnifier: ['arm_r'],
  acc_belt: ['body'],
  acc_keys: ['acc_belt'],
  acc_receipt: ['acc_belt'],
  acc_sneakers: ['body'],
  arm_l: ['body'],
  arm_r: ['body'],
  eye_l: ['body'],
  eye_r: ['body'],
  watch_hand_h: ['acc_watch'],
  watch_hand_m: ['acc_watch'],
  watch_hand_s: ['acc_watch'],
}
const seated = (a, b) => (SEATS[a] || []).includes(b) || (SEATS[b] || []).includes(a)
const CLEAR_BY = 0.42 // of the move, by which an item must have let go of its seat (it has barely begun to travel)
const CLEAR_BY_LATE = 0.6 // the same for the three that wait for something to make room first
const LATE = ['cap', 'tool-belt', 'sneakers']

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
let bad = 0
for (const [name, vp] of [['wide 1440×900', { width: 1440, height: 900 }], ['tall 390×844', { width: 390, height: 844 }]]) {
  const page = await (await browser.newContext({ viewport: vp, deviceScaleFactor: 1 })).newPage()
  page.on('pageerror', (e) => console.log('[pageerror]', String(e.stack || e).slice(0, 500)))
  await page.goto(`${base}/dev.html?manual&still&nohud`, { waitUntil: 'load' })
  await page.waitForFunction(() => window.__bench?.check, null, { timeout: 60000 })
  console.log(`\n── ${name} ──`)
  if (name.startsWith('wide')) {
    const rest = await page.evaluate(() => window.__bench.check.rest())
    const odd = rest.filter((k) => !seated(...k.split(' × ')))
    console.log(`worn: ${rest.length} pairs of parts touch, ${odd.length} of them not meant to`)
    for (const k of odd) console.log('  ✗', k)
    bad += odd.length
  }
  const n = await page.evaluate(() => window.__bench.path.sections.length - 2)
  for (let i = 0; i < n; i++) {
    const { id, spans, reach, out, rest, lay } = await page.evaluate((i) => {
      const { id, target, lay } = window.__bench.at(i)
      return { id, lay, ...window.__bench.check.path(id, target, 72) }
    }, i)
    const lines = []
    // on screen: nothing may leave the frame at any point of the move, and once the item is out it must
    // stand clear of the Pebble and of the column (or sheet) of type
    const r = (o) => `${Math.round(o.left)},${Math.round(o.top)} → ${Math.round(o.right)},${Math.round(o.bottom)}`
    const edge = lay.f + 3
    if (reach.left < edge || reach.top < edge || reach.right > lay.W - edge || reach.bottom > lay.H - edge) {
      bad++
      lines.push(`  ✗ leaves the frame during the move: ${r(reach)}`)
    }
    const c = lay.caption
    const gapPebble = lay.wide ? rest.left - out.right : out.top - rest.bottom
    const gapType = lay.wide ? out.left - (c.left + c.width) : c.top - out.bottom
    if (gapPebble < 6 || gapType < 6) {
      bad++
      lines.push(`  ✗ floating at ${r(out)}: ${Math.round(gapPebble)}px from the Pebble (${r(rest)}), ${Math.round(gapType)}px from the type`)
    } else lines.push(`  · floats ${Math.round(out.right - out.left)}×${Math.round(out.bottom - out.top)}px, ${Math.round(gapPebble)}px from the Pebble, ${Math.round(gapType)}px from the type`)
    for (const [key, s] of Object.entries(spans)) {
      const [a, b] = key.split(' × ')
      const ok = seated(a, b) && s.to <= (LATE.includes(id) ? CLEAR_BY_LATE : CLEAR_BY)
      if (!ok) {
        bad++
        lines.push(`  ✗ ${key}  from ${s.from.toFixed(2)} to ${s.to.toFixed(2)}`)
      } else lines.push(`  · ${key}  lets go at ${s.to.toFixed(2)}`)
    }
    console.log(`${String(i + 1).padStart(2, '0')} ${id}${lines.length ? '' : '  clear all the way'}`)
    if (lines.length) console.log(lines.join('\n'))
    if (shots) {
      for (const t of [0.25, 0.45, 0.65]) {
        await page.evaluate(([i, t]) => {
          const { id, target } = window.__bench.at(i)
          window.__bench.check.hold(id, target, t)
        }, [i, t])
        await page.screenshot({ path: path.join(OUT, `${name.split(' ')[0]}-${String(i + 1).padStart(2, '0')}-${id}-${String(Math.round(t * 100)).padStart(3, '0')}.jpg`), type: 'jpeg', quality: 88 })
      }
    }
  }
  await page.close()
}
await browser.close()
console.log(bad ? `\n${bad} PROBLEM(S)` : '\nnothing cuts through anything')
process.exitCode = bad ? 1 : 0
