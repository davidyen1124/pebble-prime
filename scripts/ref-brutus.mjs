// Reference captures of brutus.jp: screenshots plus the type and colour it uses. Reference only; nothing here ships.
// usage: node scripts/ref-brutus.mjs
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
const ROOT = path.resolve(import.meta.dirname, '..')
const OUT = path.join(ROOT, 'qa/ref/brutus')
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const report = {}
async function visit(name, url, vp, { full = false, shots = 3 } = {}) {
  const ctx = await browser.newContext({ ...vp, locale: 'ja-JP' })
  const page = await ctx.newPage()
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(4000)
    for (let i = 0; i < shots; i++) {
      await page.screenshot({ path: path.join(OUT, `${name}-${i}.jpg`), type: 'jpeg', quality: 80, fullPage: false })
      await page.mouse.wheel(0, vp.viewport.height * 0.9)
      await page.waitForTimeout(1200)
    }
    report[name] = await page.evaluate(() => {
      const fonts = {}
      const colors = {}
      const bgs = {}
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el)
        const t = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
        if (t) {
          const k = `${cs.fontFamily.slice(0, 90)} | ${cs.fontWeight} | ${cs.fontSize} | ls ${cs.letterSpacing} | lh ${cs.lineHeight}`
          fonts[k] = (fonts[k] || 0) + 1
          colors[cs.color] = (colors[cs.color] || 0) + 1
        }
        if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)') bgs[cs.backgroundColor] = (bgs[cs.backgroundColor] || 0) + 1
      }
      const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n)
      return {
        title: document.title,
        url: location.href,
        fonts: top(fonts, 28),
        colors: top(colors, 10),
        bgs: top(bgs, 10),
        fontFaces: [...document.fonts].map((f) => `${f.family} ${f.weight} ${f.status}`).filter((v, i, a) => a.indexOf(v) === i).slice(0, 40),
        links: [...document.querySelectorAll('a[href]')].map((a) => a.href).filter((h, i, a) => a.indexOf(h) === i).filter((h) => /magazine|issue|backnumber/i.test(h)).slice(0, 40),
        images: [...document.images].map((i) => ({ src: i.currentSrc || i.src, w: i.naturalWidth, h: i.naturalHeight, alt: i.alt.slice(0, 60) })).filter((i) => i.w > 200).slice(0, 40),
        headings: [...document.querySelectorAll('h1,h2,h3')].map((h) => h.textContent.trim().replace(/\s+/g, ' ').slice(0, 70)).filter(Boolean).slice(0, 40),
      }
    })
  } catch (e) {
    report[name] = { error: String(e).slice(0, 300) }
  }
  await ctx.close()
}
const D = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }
const M = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
await visit('home-d', 'https://brutus.jp/', D, { shots: 4 })
await visit('home-m', 'https://brutus.jp/', M, { shots: 3 })
await visit('magazine-d', 'https://brutus.jp/magazine/', D, { shots: 4 })
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1))
await browser.close()
for (const [k, v] of Object.entries(report)) console.log(k, v.error || `${v.title} | ${v.url}`)
