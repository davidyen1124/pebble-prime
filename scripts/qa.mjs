// Drives the real page, photographs it, and measures it: is any type cut off, on top of other type, or
// on top of the Pebble or the item that is out? Is anything 3D outside the frame, or one thing over another?
// Is every button on top where it is drawn?
//   node scripts/qa.mjs check [device ...]     every section on every device (default: all), measured
//   node scripts/qa.mjs sweep [device] [steps] the whole scroll by wheel, the way a person would, photographed
// Photographs land in qa/shots/<mode>-<device>/. Expects the built site on :5184 (npm run preview), or set BASE.
// BROWSER=webkit uses Safari's engine instead of Chrome's.
import { chromium, webkit } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const mode = process.argv[2] || 'check'
const base = process.env.BASE || 'http://localhost:5184'
const phone = { deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' }
const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  wide: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  ultrawide: { viewport: { width: 2560, height: 1080 }, deviceScaleFactor: 1 },
  laptop: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 },
  short: { viewport: { width: 1280, height: 600 }, deviceScaleFactor: 1 },
  'tablet-wide': { viewport: { width: 1180, height: 820 }, ...phone },
  tablet: { viewport: { width: 820, height: 1180 }, ...phone },
  mobile: { viewport: { width: 390, height: 844 }, ...phone },
  large: { viewport: { width: 430, height: 932 }, ...phone },
  small: { viewport: { width: 360, height: 640 }, ...phone },
  landscape: { viewport: { width: 844, height: 390 }, ...phone },
}
const names = mode === 'check' ? (process.argv.length > 3 ? process.argv.slice(3) : Object.keys(DEVICES)) : [process.argv[3] || 'desktop']

// ── what runs in the page ──────────────────────────────────────────────────
// Everything measured at one moment: type (the ink of each line), the 3D things, the controls.
function measure() {
  const P = window.__pebble
  const { stage } = P
  const lay = P.layout
  const W = innerWidth
  const H = innerHeight
  const out = { W, H, section: P.section, problems: [], notes: [] }
  const shown = (el) => {
    let o = 1
    for (let p = el; p && p.nodeType === 1; p = p.parentElement) {
      const c = getComputedStyle(p)
      if (c.visibility === 'hidden' || c.display === 'none') return 0
      o *= parseFloat(c.opacity)
    }
    return o
  }
  const label = (el) => (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : el.tagName.toLowerCase()) + ' “' + el.textContent.trim().replace(/\s+/g, ' ').slice(0, 26) + '”'
  // type: one rectangle for each line of each element that holds text of its own
  const lines = []
  const walker = document.createTreeWalker(document.getElementById('app'), NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  const ctx = document.createElement('canvas').getContext('2d')
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.nodeValue.trim()) continue
    const el = n.parentElement
    if (el.closest('.visually-hidden, .tip, svg') || shown(el) < 0.5) continue
    range.selectNodeContents(n)
    const cs = getComputedStyle(el)
    const vertical = cs.writingMode.startsWith('vertical')
    // the box of a line of type is taller than its ink: ask the font where the letters really are
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    const text = cs.textTransform === 'uppercase' ? n.nodeValue.toUpperCase() : n.nodeValue
    const tm = ctx.measureText(text.trim())
    for (const r of range.getClientRects()) {
      if (r.width < 1 || r.height < 1) continue
      const ink = vertical
        ? { left: r.left + r.width * 0.18, right: r.right - r.width * 0.18, top: r.top, bottom: r.bottom }
        : { left: r.left, right: r.right, top: r.top + (tm.fontBoundingBoxAscent - tm.actualBoundingBoxAscent) * (r.height / (tm.fontBoundingBoxAscent + tm.fontBoundingBoxDescent)), bottom: r.top + (tm.fontBoundingBoxAscent + tm.actualBoundingBoxDescent) * (r.height / (tm.fontBoundingBoxAscent + tm.fontBoundingBoxDescent)) } // (scaled, for the masthead when it is the small logo)
      const key = el.closest('.cap-title, .cover-headline, .cap-no, .cover-no, li, p, a, button, h1, h2') || el
      lines.push({ el, key, name: label(key), ...ink })
    }
  }
  const hit = (a, b, pad = 0) => a.left < b.right - pad && b.left < a.right - pad && a.top < b.bottom - pad && b.top < a.bottom - pad
  const inside = (a, b, pad = 0) => a.left >= b.left - pad && a.right <= b.right + pad && a.top >= b.top - pad && a.bottom <= b.bottom + pad
  const fmt = (r) => `${Math.round(r.left)},${Math.round(r.top)}→${Math.round(r.right)},${Math.round(r.bottom)}`
  const frame = { left: lay.f + 2, top: lay.f + 2, right: W - lay.f - 2, bottom: H - lay.f - 2 }
  const mast = document.querySelector('[data-masthead]')

  // 1. type inside the frame, and not cut by a box that clips
  for (const l of lines) {
    if (!inside(l, frame, 0.5)) out.problems.push(`type outside the frame: ${l.name} at ${fmt(l)}`)
    for (let p = l.el; p && p.id !== 'app'; p = p.parentElement) {
      const c = getComputedStyle(p)
      if (c.overflowX === 'visible' && c.overflowY === 'visible') continue
      const r = p.getBoundingClientRect()
      if (!inside(l, r, 1)) out.problems.push(`type cut by its box: ${l.name} (${fmt(l)} in ${fmt(r)})`)
    }
  }
  for (const el of document.querySelectorAll('.cap-no, .cover-no, .cover-strip, .caption, .cap-in, .pill, .cover-labels li')) {
    if (shown(el) < 0.5) continue
    if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible') out.problems.push(`type wider than its box: ${label(el)}`)
  }
  for (const el of document.querySelectorAll('.caption')) {
    if (shown(el) < 0.5) continue
    const r = el.getBoundingClientRect()
    const inner = el.firstElementChild.getBoundingClientRect()
    if (inner.height > r.height + 1 || inner.width > r.width + 1) out.problems.push(`page of type larger than its box: ${el.dataset.caption} (${Math.round(inner.width)}×${Math.round(inner.height)} in ${Math.round(r.width)}×${Math.round(r.height)})`)
    out.notes.push(`type ${el.dataset.caption}: ${Math.round(inner.height)}px of ${Math.round(r.height)}px, scale ${el.style.getPropertyValue('--k')}, body ${parseFloat(getComputedStyle(el.querySelector('.cap-text, .note')).fontSize).toFixed(1)}px`)
  }
  // 2. no type on top of other type (the masthead is the one thing the page lets things stand in front of)
  for (let i = 0; i < lines.length; i++)
    for (let k = i + 1; k < lines.length; k++) {
      const a = lines[i]
      const b = lines[k]
      if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue
      if (hit(a, b, 0.5)) out.problems.push(`type on type: ${a.name} (${fmt(a)}) × ${b.name} (${fmt(b)})`)
    }
  // 3. the 3D: exact rectangles, every vertex projected
  const V = stage.pose.target.clone()
  const M = stage.camera.projectionMatrix.clone()
  const rectOf = (meshes) => {
    const r = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity }
    for (const mesh of meshes) {
      M.multiplyMatrices(stage.camera.projectionMatrix, stage.camera.matrixWorldInverse).multiply(mesh.matrixWorld)
      const pos = mesh.geometry.attributes.position
      for (let i = 0; i < pos.count; i++) {
        V.fromBufferAttribute(pos, i).applyMatrix4(M)
        const x = (V.x * 0.5 + 0.5) * W
        const y = (-V.y * 0.5 + 0.5) * H
        if (x < r.left) r.left = x
        if (x > r.right) r.right = x
        if (y < r.top) r.top = y
        if (y > r.bottom) r.bottom = y
      }
    }
    return r
  }
  const all = []
  stage.pebble.traverse((o) => o.isMesh && all.push(o))
  const flying = Object.values(stage.items).filter((it) => it.t > 0)
  const mine = new Set()
  for (const it of flying) it.node.traverse((o) => o.isMesh && mine.add(o))
  const pebble = rectOf(all.filter((m) => !mine.has(m)))
  out.pebble = fmt(pebble)
  if (!inside(pebble, frame, 0)) out.problems.push(`the Pebble is outside the frame: ${fmt(pebble)}`)
  let item = null
  let box = null
  if (flying.length) {
    item = rectOf([...mine])
    box = { left: lay.item.x * W - lay.item.w / 2, right: lay.item.x * W + lay.item.w / 2, top: lay.item.y * H - lay.item.h / 2, bottom: lay.item.y * H + lay.item.h / 2 }
    out.item = fmt(item)
    if (flying.some((it) => it.t < 1)) out.problems.push('an item is still on the move')
    if (!inside(item, box, 2)) out.problems.push(`the item is outside its box: ${fmt(item)} not in ${fmt(box)}`)
    if (!inside(box, frame, 0)) out.problems.push(`the item's box is outside the frame: ${fmt(box)}`)
    if (hit(box, pebble)) out.problems.push(`the item's box overlaps the Pebble: ${fmt(box)} × ${fmt(pebble)}`)
    const gap = lay.wide ? pebble.left - box.right : box.top - pebble.bottom
    out.notes.push(`item ${Math.round(item.right - item.left)}×${Math.round(item.bottom - item.top)}px, ${Math.round(gap)}px clear of the Pebble`)
  }
  for (const l of lines) {
    const onMast = mast.contains(l.el)
    if (hit(l, pebble, 1)) {
      if (onMast && P.progress < 0.03) out.notes.push(`masthead behind the Pebble (meant): ${Math.round(((Math.min(l.right, pebble.right) - Math.max(l.left, pebble.left)) / (l.right - l.left)) * 100)}% of its width, ${Math.round(((Math.min(l.bottom, pebble.bottom) - Math.max(l.top, pebble.top)) / (l.bottom - l.top)) * 100)}% of its height`)
      else out.problems.push(`type on the Pebble: ${l.name} (${fmt(l)}) × Pebble (${fmt(pebble)})`)
    }
    if (box && hit(l, box, 1)) out.problems.push(`type on the item: ${l.name} (${fmt(l)}) × item box (${fmt(box)})`)
  }
  // 4. controls: on top where they are drawn, inside the frame, clear of the 3D
  const controls = [...document.querySelectorAll('.pill, .start, .bullet, [data-masthead]')].filter((el) => shown(el) > 0.5)
  for (const el of controls) {
    const r = el.getBoundingClientRect()
    const isBullet = el.classList.contains('bullet')
    const top = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2)
    if (!top || !(el === top || el.contains(top))) out.problems.push(`control is covered: ${label(el)} by ${top ? label(top) : 'nothing'}`)
    const dot = isBullet ? el.firstElementChild.getBoundingClientRect() : r
    if (!inside(dot, frame, 0)) out.problems.push(`control outside the frame: ${label(el)} ${fmt(dot)}`)
    if (el !== mast && hit(dot, pebble, 0)) out.problems.push(`control on the Pebble: ${label(el)} (${fmt(dot)}) × Pebble (${fmt(pebble)})`)
    if (box && hit(dot, box, 0)) out.problems.push(`control on the item: ${label(el)} (${fmt(dot)})`)
    if (!isBullet && el !== mast) for (const l of lines) if (!el.contains(l.el) && hit(l, r, 0)) out.problems.push(`type on a control: ${l.name} × ${label(el)}`)
  }
  // 5. the layers are stacked the way the page means them to be
  const z = (sel) => +getComputedStyle(document.querySelector(sel)).zIndex
  const order = ['#paper', '[data-masthead]', '#canvas', '[data-ui]', '[data-bullets]'].map(z)
  if (order.some((v, i) => Number.isNaN(v) || (i && v < order[i - 1]))) out.problems.push('layers out of order: ' + order.join(' '))
  // the border is drawn in the paper, not in the page: make sure the type keeps clear of where it is drawn
  const art = { left: lay.f + lay.art + 1, top: lay.f + lay.art + 1, right: W - lay.f - lay.art - 1, bottom: H - lay.f - lay.art - 1 }
  for (const l of lines) if (!inside(l, art, 0)) out.problems.push(`type on the border: ${l.name} at ${fmt(l)}`)
  // 6. the type is type: nothing that holds text is blurred, stretched by a filter, or drawn as coarse pixels
  for (const l of lines) {
    for (let p = l.el; p && p.id !== 'app'; p = p.parentElement) {
      const c = getComputedStyle(p)
      if (/blur/.test(c.filter)) out.problems.push(`type is blurred: ${l.name}`)
    }
    if (l.el.closest('canvas')) out.problems.push(`type is drawn in a canvas: ${l.name}`)
  }
  // 7. nothing of the old page furniture
  if (document.querySelector('.progress')) out.problems.push('a progress bar is in the page')
  for (const t of document.querySelectorAll('.scrollbar-track')) if (getComputedStyle(t).display !== 'none') out.problems.push('the scroll track is showing')
  out.lines = lines.length
  return out
}

// ── the run ────────────────────────────────────────────────────────────────
// BROWSER=webkit runs the same in Safari's engine
const browser = process.env.BROWSER === 'webkit' ? await webkit.launch() : await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
let total = 0
for (const name of names) {
  const device = DEVICES[name]
  if (!device) throw new Error('no such device: ' + name)
  const OUT = path.join(ROOT, 'qa/shots', `${mode}-${name}${process.env.BROWSER === 'webkit' ? '-webkit' : ''}`)
  fs.rmSync(OUT, { recursive: true, force: true }) // (this script's own previous photographs)
  fs.mkdirSync(OUT, { recursive: true })
  const page = await (await browser.newContext(device)).newPage()
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text().slice(0, 300)))
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)))
  page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()))
  await page.goto(base + '/?still', { waitUntil: 'load' })
  await page.waitForFunction(() => window.__pebble?.ready, null, { timeout: 60000 })
  await page.waitForTimeout(400)
  const sections = await page.evaluate(() => window.__pebble.sections)
  const { width, height } = device.viewport
  let bad = 0
  const report = (tag, m) => {
    const uniq = [...new Set(m.problems)]
    bad += uniq.length
    console.log(`  ${uniq.length ? '✗' : '✓'} ${tag.padEnd(22)} ${uniq.length ? '' : (m.notes.find((n) => n.startsWith('item')) || m.notes.find((n) => n.startsWith('masthead')) || '')}`)
    for (const p of uniq) console.log('      ' + p)
    return m
  }
  console.log(`\n── ${name} ${width}×${height} ──`)
  if (mode === 'check') {
    const notes = []
    for (let i = 0; i < sections.length; i++) {
      if (i) {
        await page.evaluate((i) => window.__pebble.go(i), i)
        await page.waitForFunction(() => !window.__pebble.jumping && !window.__pebble.scroll.locked, null, { timeout: 20000 })
        await page.waitForFunction((id) => window.__pebble.section === id && Object.values(window.__pebble.stage.items).every((it) => it.t === 0 || it.t === 1), sections[i].id, { timeout: 20000 })
        await page.waitForTimeout(1500)
      }
      const m = report(`${String(i).padStart(2, '0')} ${sections[i].id}`, await page.evaluate(measure))
      notes.push(...m.notes.filter((n) => n.startsWith('type')))
      await page.screenshot({ path: path.join(OUT, `${String(i).padStart(2, '0')}-${sections[i].id}.png`) })
    }
    // the smallest type on any page of this device
    const sizes = notes.map((n) => +n.match(/body ([\d.]+)px/)[1])
    const scales = notes.map((n) => +(n.match(/scale ([\d.]+)/) || [0, 1])[1])
    console.log(`  body type ${Math.min(...sizes).toFixed(1)}–${Math.max(...sizes).toFixed(1)}px; pages shrunk to fit: ${scales.filter((s) => s < 1).length} (smallest ×${Math.min(...scales).toFixed(2)})`)
    // back to the cover the long way, and by keyboard
    await page.keyboard.press('Home')
    await page.waitForFunction(() => !window.__pebble.jumping && window.__pebble.section === 'cover', null, { timeout: 20000 })
    await page.waitForTimeout(900)
    report('cover again (Home)', await page.evaluate(measure))
    await page.keyboard.press('ArrowDown')
    await page.waitForFunction(() => !window.__pebble.jumping && window.__pebble.section === 'glasses', null, { timeout: 20000 }).catch(() => (errors.push('ArrowDown did not reach the first item'), 0))
    // the window changes shape while an item is out (a phone turned on its side, a browser dragged narrow)
    const alt = width > height ? { width: 820, height: 1180 } : { width: height, height: width }
    await page.waitForTimeout(1200)
    await page.setViewportSize(alt)
    await page.waitForTimeout(1600)
    report(`resized to ${alt.width}×${alt.height}`, await page.evaluate(measure))
    await page.screenshot({ path: path.join(OUT, `resized-${alt.width}x${alt.height}.png`) })
    await page.evaluate(() => window.__pebble.go(12))
    await page.waitForFunction(() => !window.__pebble.jumping && !window.__pebble.scroll.locked && window.__pebble.section === 'tool-belt' && Object.values(window.__pebble.stage.items).every((it) => it.t === 0 || it.t === 1), null, { timeout: 20000 })
    await page.waitForTimeout(1500)
    report('then on to the belt', await page.evaluate(measure))
  } else {
    // by wheel (or by finger), in small steps, photographing as it goes
    const steps = +(process.argv[4] || 150)
    await page.mouse.move(width / 2, height / 2)
    let n = 0
    let outside = 0
    for (let i = 0; i < steps; i++) {
      const p = await page.evaluate(() => window.__pebble.progress)
      if (p > 0.9995) break
      for (let k = 0; k < 4; k++) {
        await page.mouse.wheel(0, 110)
        await page.waitForTimeout(45)
      }
      await page.waitForTimeout(110)
      const m = await page.evaluate(() => {
        const P = window.__pebble
        const r = P.stage.screenRect(P.stage.pebble)
        return { p: P.progress, section: P.section, out: r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight }
      })
      if (m.out) outside++
      await page.screenshot({ path: path.join(OUT, `${String(n++).padStart(3, '0')}-p${String(Math.round(m.p * 1000)).padStart(4, '0')}${m.section ? '-' + m.section : ''}.jpg`), type: 'jpeg', quality: 80 })
    }
    console.log(`  ${n} frames, the last at progress ${(await page.evaluate(() => window.__pebble.progress)).toFixed(3)}; frames with something 3D near the window's edge (loose boxes): ${outside}`)
  }
  for (const e of [...new Set(errors)]) console.log('  ✗ ' + e)
  bad += new Set(errors).size
  total += bad
  await page.close()
}
await browser.close()
console.log(total ? `\n${total} PROBLEM(S)` : '\nno problems found')
process.exitCode = total ? 1 : 0
