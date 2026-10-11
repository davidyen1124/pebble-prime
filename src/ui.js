// The printed half of the page: the cover's type, the small captions, the page for each item, the back
// cover, the dots. All of it is real type, so it stays sharp; the hairlines that join type to the Pebble
// are handed to the 3D stage, which draws them in its own coarse pixels. Where things go comes from
// layoutFor() (src/webgl/path.js).
import { COVER, OUTRO, STOPS, LINKS } from './config.js'
import { gsap, reducedMotion } from './anim.js'
import { inkTexture } from './paper.js'

const pad2 = (n) => String(n).padStart(2, '0')
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const lerp = (a, b, t) => a + (b - a) * t
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
const inout = (t) => t * t * t * (t * (t * 6 - 15) + 10)
const h = (html) => {
  const t = document.createElement('template')
  t.innerHTML = html.trim()
  return t.content.firstElementChild
}
// left / right / top / bottom in pixels; the ones not given are released
const pin = (el, { left, right, top, bottom, ...rest }) => {
  const s = el.style
  for (const [k, v] of Object.entries({ left, right, top, bottom })) s[k] = v === undefined ? 'auto' : v + 'px'
  for (const k in rest) s[k] = typeof rest[k] === 'number' ? rest[k] + 'px' : rest[k]
}
// an arrow made of squares, like everything the console draws
const ARROW = '<svg viewBox="0 0 9 7" shape-rendering="crispEdges" aria-hidden="true"><path d="M0 3h8v1H0zM5 0h1v1H5zM6 1h1v1H6zM7 2h1v1H7zM7 4h1v1H7zM6 5h1v1H6zM5 6h1v1H5z" fill="currentColor"/></svg>'
// "Walkie-Talkie" → ["Walkie-", "Talkie"]: a word may break after its hyphen
const atHyphens = (word) => word.split('-').map((part, i, all) => (i < all.length - 1 ? part + '-' : part)).filter(Boolean)
// a heading as words that can rise out of their own line
const titleHTML = (title) =>
  title
    .split(' ')
    .flatMap((word) => atHyphens(word).map((part, i, all) => `<span class="w${i < all.length - 1 ? ' glue' : ''}"><span>${part}</span></span>`))
    .join('')

export function createUI({ app, sections, onGo }) {
  const main = app.querySelector('[data-ui]')
  const mast = app.querySelector('[data-masthead]')
  const nav = app.querySelector('[data-bullets]')
  const live = app.querySelector('[data-live]')
  const [headA, headB] = atHyphens(COVER.headline)

  // ── cover ──────────────────────────────────────────────────────────────
  const cover = h(`<section class="cover" data-cover>
    <p class="cover-strip" lang="ja"><span>${COVER.top[0]}</span><span>${COVER.top[1]}</span></p>
    <p class="cover-no"><span class="n"><i>No.</i><b>${COVER.number}</b></span><span>${COVER.date}</span><span lang="ja">${COVER.price}</span><span class="fan">Fan-made・Unofficial</span></p>
    <ul class="cover-labels">${STOPS.map((s) => `<li data-id="${s.id}"><span class="jp" lang="ja">${s.jp}</span><span class="en">${s.title}</span></li>`).join('')}</ul>
    <h1 class="cover-headline" aria-label="${COVER.headline}"><span class="ln"><span>${headA}</span></span><span class="ln"><span>${headB}</span></span></h1>
    <p class="cover-sub" lang="ja">${COVER.sub}</p>
    <p class="cover-foot">${COVER.foot}</p>
    <p class="cover-side">${COVER.side}</p>
    <button class="start" type="button" aria-label="Open the stylebook: go to the first item"><span>${COVER.scroll}</span>${ARROW}</button>
  </section>`)
  main.append(cover)
  const $ = (sel) => cover.querySelector(sel)
  const strip = $('.cover-strip')
  const no = $('.cover-no')
  const headline = $('.cover-headline')
  const sub = $('.cover-sub')
  const foot = $('.cover-foot')
  const side = $('.cover-side')
  const badge = $('.start')
  const labelList = $('.cover-labels')
  badge.addEventListener('click', () => onGo(1))
  mast.addEventListener('click', (e) => {
    e.preventDefault()
    onGo(0)
  })

  // one small caption for each item; its hairline is drawn by the stage, every frame (see frame())
  const labels = STOPS.map((s) => ({ stop: s, el: labelList.querySelector(`[data-id="${s.id}"]`), mark: null, back: false, sx: 0, sy: 0, ex: 0 }))
  let labelsOn = false
  const lines = { shown: 1 } // 0..1: how much of the cover's hairlines is drawn (they dither in when the page opens)

  // ── item pages and the back cover ──────────────────────────────────────
  const captions = STOPS.map((s, i) => {
    const el = h(`<article class="caption" data-caption="${s.id}" aria-hidden="true"><div class="cap-in">
      <p class="cap-no"><span class="no">No.<b>${pad2(i + 1)}</b><i>/ ${STOPS.length}</i></span><span class="rule"></span><span class="tag">${s.tag}<em>${s.ver}</em></span></p>
      <p class="cap-jp" lang="ja">${s.jp}</p>
      <h2 class="cap-title" aria-label="${s.title}">${titleHTML(s.title)}</h2>
      <p class="cap-text">${s.text}</p>
      ${s.button ? `<a class="pill" href="${s.button[1]}" target="_blank" rel="noopener">${s.button[0]}${ARROW}</a>` : ''}
    </div></article>`)
    main.append(el)
    return el
  })
  const outro = h(`<section class="caption outro" data-caption="outro" aria-hidden="true"><div class="cap-in">
    <p class="cap-no"><span class="no" lang="ja">${OUTRO.kicker}</span><span class="rule"></span><span class="tag">Turnstone</span></p>
    <h2 class="cap-title" aria-label="${OUTRO.title}">${titleHTML(OUTRO.title)}</h2>
    <p class="cap-jp" lang="ja">${OUTRO.sub}</p>
    <div class="actions"><a class="pill solid" href="${LINKS.turnstone}" target="_blank" rel="noopener">${OUTRO.button}${ARROW}</a><button class="pill up" type="button">${OUTRO.again}${ARROW}</button></div>
    <p class="note">${OUTRO.note}</p>
  </div></section>`)
  main.append(outro)
  outro.querySelector('button').addEventListener('click', () => onGo(0))
  // the running foot every inside page of a magazine has (wide windows only: a tall one has no room for it)
  const folio = h(`<p class="folio"><span>${COVER.foot}</span><span>Fan-made・Unofficial</span></p>`)
  main.append(folio)
  const pages = Object.fromEntries([...captions.map((el, i) => [STOPS[i].id, el]), ['outro', outro]])

  // ── dots ───────────────────────────────────────────────────────────────
  const bullets = sections.map((s, i) => {
    const label = s.stop ? `${pad2(s.index + 1)} ${s.stop.title}` : s.id === 'cover' ? 'Cover' : 'Back cover'
    const b = h(`<button class="bullet" type="button" aria-label="${label}"><i></i><span class="tip">${label}</span></button>`)
    b.addEventListener('click', () => onGo(i))
    nav.append(b)
    return b
  })

  let L = null
  let coverC = -1
  let coverAlpha = 1
  let activeId
  let lineItem = null
  const tmp = { x: 0, y: 0 }

  // widths, in ems, of the two words that are sized to the window
  function measure() {
    mast.style.transform = 'none'
    mast.style.fontSize = '200px'
    headline.style.fontSize = '100px'
    const mastEm = mast.firstElementChild.getBoundingClientRect().width / 200
    const headEm = Math.max(...[...headline.children].map((ln) => ln.getBoundingClientRect().width)) / 100
    return { mastEm, headEm }
  }

  function layout(lay) {
    L = lay
    const { W, H, L: left, R, T, B } = lay
    const c = lay.coverBox
    const right = W - R
    const bottom = H - B
    app.style.setProperty('--f', lay.f + 'px')
    app.style.setProperty('--u', lay.u.toFixed(3))
    app.classList.toggle('is-wide', lay.wide)
    app.classList.toggle('is-narrow', !lay.wide)
    mast.style.fontSize = lay.mast.fs + 'px'
    // The largest type is filled by the console: a dithered run of reds, clipped to the letters. The
    // letters themselves are still type, so their edges are as sharp as any other.
    app.style.setProperty('--px', lay.pixel + 'px')
    const ink = (el, px) => {
      const rows = Math.max(2, Math.ceil(px / lay.pixel))
      el.style.backgroundImage = inkTexture(rows, [201, 38, 62], [128, 14, 32])
      el.style.backgroundSize = `${4 * lay.pixel}px ${rows * lay.pixel}px`
    }
    ink(mast.firstElementChild, lay.mast.cap)
    for (const ln of headline.children) ink(ln.firstElementChild, c.headFs * 0.86)
    if (lay.wide) {
      const noFs = clamp(13 * lay.u, 10.5, 15)
      pin(strip, { left, right, top: T, fontSize: c.stripFs })
      pin(no, { right: right + 30, top: lay.mast.y + lay.mast.cap + 0.034 * H, fontSize: noFs })
      pin(headline, { left, top: c.headTop, fontSize: c.headFs })
      pin(sub, { left, bottom, fontSize: c.subFs })
      pin(foot, { right, bottom, fontSize: c.footFs })
      pin(badge, { right, bottom: bottom + c.footFs * 1.3 + 0.02 * H, fontSize: clamp(12 * lay.u, 10, 13.5), width: '', height: '' })
      // (the small print down the edge is one line: on a short window it is set smaller, so it still fits)
      // it runs down the gutter, between the border's dashed line and everything else
      const sideFs = Math.min(clamp((B - T - 6) / 39, 6.5, 9.5), lay.pad - lay.art - 4)
      pin(side, { right: lay.f + lay.art + (lay.pad - lay.art - sideFs) / 2, top: T, fontSize: sideFs })
    } else {
      pin(strip, { left, top: T, fontSize: c.stripFs })
      pin(no, { left, right, bottom, fontSize: c.noFs })
      pin(foot, { left, bottom: bottom + c.noFs * 1.5, fontSize: c.footFs })
      pin(sub, { left, bottom: bottom + c.noFs * 1.5 + c.footFs * 1.45, fontSize: c.subFs })
      pin(headline, { left, top: c.headTop, fontSize: c.headFs })
      pin(badge, { right: right + 2 * lay.pixel, top: c.headTop + c.headFs * 0.04, width: Math.min(c.badge, 50), height: Math.min(c.badge, 50) })
      pin(side, {})
    }
    pin(folio, { left, right, bottom, fontSize: clamp(11 * lay.u, 9.5, 12.5) })
    pin(nav, { left: lay.bullets.x, top: lay.bullets.y })
    for (const b of bullets) b.style.height = lay.bullets.gap + 'px'
    fit()
    const keep = coverC
    coverC = -1
    setCover(Math.max(0, keep))
  }

  // every page of type is shrunk, if it has to be, until nothing runs out of its box
  function fit() {
    const base = L.wide ? clamp(17 * L.u, 13, 21) : clamp(15 * L.u, 14, 22)
    for (const el of [...captions, outro]) {
      const box = el === outro ? L.outroBox : L.caption
      pin(el, { left: box.left, top: box.top, width: box.width, height: box.height })
      el.classList.toggle('centre', box.centre)
      el.classList.remove('tight')
      el.style.setProperty('--base', base + 'px')
      el.style.setProperty('--k', 1)
      const inner = el.firstElementChild
      const title = el.querySelector('.cap-title')
      title.style.setProperty('--tk', 1)
      // the heading: no word may be wider than the column
      // (on a narrow window an item's name stays on one line, so it is the whole name that has to fit)
      let widest = 0
      if (!L.wide && el !== outro) widest = title.scrollWidth
      else for (const w of title.children) widest = Math.max(widest, w.firstElementChild.getBoundingClientRect().width)
      if (widest > box.width) title.style.setProperty('--tk', ((box.width / widest) * 0.99).toFixed(4))
      // the top row: drop the detail if the row cannot hold it
      const row = el.querySelector('.cap-no')
      if (row.scrollWidth > row.clientWidth + 0.5) el.classList.add('tight')
      let k = 1
      while (inner.offsetHeight > box.height && k > 0.6) {
        k -= 0.03
        el.style.setProperty('--k', k.toFixed(2))
      }
    }
  }

  // The cover's captions: two columns either side of the Pebble, each joined to its item by a hairline.
  // `stage` projects the items for the cover's camera; lines to items round the back pass behind the Pebble.
  function placeLabels(stage, pose) {
    const c = L.coverBox
    const fs = clamp(12.5 * L.u, 10, 14)
    let mode = 'none'
    if (L.wide && c.left && c.left.x1 - c.left.x0 > 150 && c.right.x1 - c.right.x0 > 150) {
      const pitch = Math.min((c.left.bottom - c.left.top) / 7, (c.right.bottom - c.right.top) / 9)
      mode = pitch >= fs * 2.7 ? 'two' : pitch >= fs * 1.55 ? 'one' : 'none'
    }
    labelsOn = mode !== 'none'
    labelList.style.display = labelsOn ? '' : 'none'
    if (!labelsOn) return
    labelList.classList.toggle('one-line', mode === 'one')
    labelList.style.fontSize = fs + 'px'
    for (const p of labels) {
      p.mark = stage.items[p.stop.id].mark
      p.back = p.mark.z < -0.2
      const s = stage.projectAt(pose, p.mark)
      p.px = s.x
      p.py = s.y
    }
    // which side: the side its item is on, unless the item says otherwise, then evened out
    const byX = [...labels].sort((a, b) => a.px - b.px)
    const lefts = byX.filter((p) => p.stop.side === 'left')
    const rights = byX.filter((p) => p.stop.side === 'right')
    const free = byX.filter((p) => !p.stop.side)
    const take = Math.max(0, Math.min(free.length, Math.round(labels.length / 2 - 0.6) - lefts.length))
    lefts.push(...free.slice(0, take))
    rights.push(...free.slice(take))
    for (const [col, list, sideName] of [[c.left, lefts, 'left'], [c.right, rights, 'right']]) {
      // each caption as near the height of its item as it can be, without touching its neighbours
      list.sort((a, b) => a.py - b.py)
      const pitch = mode === 'two' ? fs * 2.7 : fs * 1.55
      const lo = col.top + pitch / 2
      const hi = col.bottom - pitch / 2
      const ys = list.map((p) => clamp(p.py, lo, hi))
      for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + pitch)
      ys[ys.length - 1] = Math.min(ys[ys.length - 1], hi)
      for (let i = ys.length - 2; i >= 0; i--) ys[i] = Math.min(ys[i], ys[i + 1] - pitch)
      list.forEach((p, i) => {
        const x = sideName === 'left' ? col.x1 : col.x0
        p.el.className = sideName
        pin(p.el, { left: x, top: ys[i] })
        p.sy = ys[i]
        p.sx = x + (sideName === 'left' ? 8 : -8)
        p.ex = x + (sideName === 'left' ? 18 : -18)
      })
    }
  }

  // c: 0 on the cover, 1 once it has been left. The masthead shrinks into the corner and becomes the logo.
  function setCover(c) {
    if (c === coverC || !L) return
    coverC = c
    coverAlpha = 1 - smooth(0, 0.42, c)
    cover.style.opacity = coverAlpha.toFixed(3)
    cover.style.visibility = coverAlpha > 0.002 ? 'visible' : 'hidden'
    const inside = smooth(0.6, 1, c)
    folio.style.opacity = inside.toFixed(3)
    folio.style.visibility = inside > 0.002 ? 'visible' : 'hidden'
    const t = inout(c)
    const m = L.mast
    mast.style.transform = `translate(${lerp(m.x, m.logoX, t).toFixed(2)}px, ${lerp(m.y, m.logoY, t).toFixed(2)}px) scale(${lerp(1, m.logoFs / m.fs, t).toFixed(5)})`
  }

  function show(el) {
    gsap.killTweensOf(el)
    el._tl?.kill()
    el.setAttribute('aria-hidden', 'false')
    gsap.set(el, { visibility: 'visible', opacity: 1 })
    const q = (s) => el.querySelectorAll(s)
    const d = reducedMotion() ? 0.01 : 1
    const tl = gsap.timeline()
    tl.fromTo(q('.cap-no'), { opacity: 0 }, { opacity: 1, duration: 0.35 * d, ease: 'none' }, 0)
    tl.fromTo(q('.rule'), { scaleX: 0 }, { scaleX: 1, duration: 0.8 * d, ease: 'power3.out' }, 0)
    tl.fromTo(q('.cap-in > .cap-jp'), { opacity: 0, y: '0.7em' }, { opacity: 1, y: 0, duration: 0.5 * d, ease: 'power2.out' }, 0.1 * d)
    tl.fromTo(q('.cap-title .w > span'), { yPercent: 110 }, { yPercent: 0, duration: 0.7 * d, ease: 'power4.out', stagger: 0.06 * d }, 0.1 * d)
    tl.fromTo(q('.cap-in > .cap-text, .cap-in > .pill, .cap-in > .actions, .cap-in > .note'), { opacity: 0, y: '0.9em' }, { opacity: 1, y: 0, duration: 0.55 * d, ease: 'power2.out', stagger: 0.08 * d }, 0.28 * d)
    el._tl = tl
  }
  function hide(el) {
    el.setAttribute('aria-hidden', 'true')
    gsap.to(el, { opacity: 0, duration: 0.18, ease: 'none', overwrite: true, onComplete: () => gsap.set(el, { visibility: 'hidden' }) })
  }

  // which section is open: its page of type comes up, its dot lights
  function setSection(sec) {
    const id = sec ? sec.id : null
    if (id === activeId) return
    if (pages[activeId]) hide(pages[activeId])
    activeId = id
    if (pages[id]) show(pages[id])
    if (sec && sec.stop) lineItem = sec.stop.id
    if (sec) live.textContent = sec.stop ? `No. ${sec.index + 1} of ${STOPS.length}: ${sec.stop.title}. ${sec.stop.text}` : sec.id === 'cover' ? `Cover. ${COVER.headline}` : `${OUTRO.title}. ${OUTRO.note}`
  }
  // the dot follows the scroll even between sections
  function setBullet(i) {
    bullets.forEach((b, k) => {
      b.classList.toggle('is-active', k === i)
      if (k === i) b.setAttribute('aria-current', 'true')
      else b.removeAttribute('aria-current')
    })
  }

  // Once a frame: the hairlines, which follow the 3D scene, are handed to the stage to draw in its own
  // pixels. Lines to items round the back go on the layer behind the Pebble, so it hides them.
  function frame(stage) {
    if (!L) return
    const o = stage.overlay
    o.begin()
    const a = coverAlpha * lines.shown
    if (labelsOn && a > 0.002) {
      for (const p of labels) {
        const s = stage.toScreen(p.mark, tmp)
        const where = p.back ? 'back' : 'front'
        o.line(where, p.sx, p.sy, p.ex, p.sy, o.INK, a)
        o.line(where, p.ex, p.sy, s.x, s.y, o.INK, a)
        if (!p.back) o.square(where, s.x, s.y, 3, o.INK, a)
      }
    }
    // an item that is out: a square mark on the Pebble where it is worn and, when the two are side by
    // side, a line to it (stacked, the line would have to cross the Pebble, so the mark stands alone)
    const it = lineItem && stage.items[lineItem]
    const b = it ? smooth(0.6, 1, it.t) : 0
    if (b > 0.002) {
      const s = stage.toScreen(it.home, tmp)
      const cx = L.item.x * L.W
      const cy = L.item.y * L.H
      const dx = s.x - cx
      const dy = s.y - cy
      const d = Math.hypot(dx, dy) || 1
      // (the line starts at the edge of the item's box, on the side its place is)
      const r = Math.min(L.item.w / 2 / (Math.abs(dx / d) || 1e-6), L.item.h / 2 / (Math.abs(dy / d) || 1e-6)) + 8
      if (d > r + 16) {
        const m = 5 * L.pixel // half the mark's width
        if (L.wide) o.line('front', cx + (dx / d) * r, cy + (dy / d) * r, s.x - (dx / d) * (m + 2 * L.pixel), s.y - (dy / d) * (m + 2 * L.pixel), o.INK, b)
        // the mark: four corners of a square and a dot, the way a game marks a target
        for (const [ux, uy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          o.line('front', s.x + ux * m, s.y + uy * m, s.x + ux * (m - 3 * L.pixel), s.y + uy * m, o.RED, b)
          o.line('front', s.x + ux * m, s.y + uy * m, s.x + ux * m, s.y + uy * (m - 3 * L.pixel), o.RED, b)
        }
        o.square('front', s.x, s.y, 2, o.RED, b)
      }
    }
    o.end()
  }

  // the cover assembling itself, once, when the page opens
  function intro() {
    const d = reducedMotion() ? 0.01 : 1
    const tl = gsap.timeline()
    // (the masthead rises out of its own line: it is clipped only while it does)
    mast.style.overflow = 'hidden'
    tl.fromTo(mast.firstElementChild, { yPercent: 104 }, { yPercent: 0, duration: 1.0 * d, ease: 'power4.out', clearProps: 'transform', onComplete: () => (mast.style.overflow = '') }, 0)
    tl.fromTo([strip, no, side], { opacity: 0 }, { opacity: 1, duration: 0.5 * d, ease: 'none', stagger: 0.08 * d, clearProps: 'opacity' }, 0.35 * d)
    tl.fromTo(headline.querySelectorAll('.ln > span'), { yPercent: 108 }, { yPercent: 0, duration: 0.9 * d, ease: 'power4.out', stagger: 0.09 * d, clearProps: 'transform' }, 0.4 * d)
    tl.fromTo([sub, foot], { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6 * d, ease: 'power2.out', stagger: 0.08 * d, clearProps: 'opacity,transform' }, 0.7 * d)
    if (labelsOn) {
      const order = [...labels].sort((a, b) => a.sy - b.sy)
      tl.fromTo(order.map((p) => p.el), { opacity: 0 }, { opacity: 1, duration: 0.4 * d, ease: 'none', stagger: 0.035 * d, clearProps: 'opacity' }, 0.75 * d)
      tl.fromTo(lines, { shown: 0 }, { shown: 1, duration: 0.9 * d, ease: 'none' }, 0.8 * d)
    }
    tl.fromTo(badge, { opacity: 0 }, { opacity: 1, duration: 0.3 * d, ease: 'steps(3)', clearProps: 'opacity' }, 1.0 * d)
    tl.fromTo(nav, { opacity: 0 }, { opacity: 1, duration: 0.5 * d, ease: 'none', clearProps: 'opacity' }, 0.9 * d)
    return tl
  }

  return { measure, layout, placeLabels, setCover, setSection, setBullet, frame, intro, pages, cover, labels }
}
