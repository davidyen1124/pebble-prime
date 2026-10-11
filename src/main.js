// Boot, the frame loop, and the one rule the page runs on: scroll progress decides everything.
// The camera pose, which item is off the Pebble, which page of type is up: all are read from `progress`.
import '@fontsource-variable/jost/index.css'
import './fonts.css'
import './styles.css'
import { COVER, OUTRO, STOPS } from './config.js'
import { gsap } from './anim.js'
import { createScrollPage } from './scroll.js'
import { createUI } from './ui.js'
import { createPaper } from './paper.js'
import { createStage } from './webgl/stage.js'
import { buildPath, layoutFor } from './webgl/path.js'

const q = new URLSearchParams(location.search)
const app = document.getElementById('app')
const canvas = document.getElementById('canvas')
const paper = createPaper(document.getElementById('paper'))
const boot = document.querySelector('[data-boot]')
const count = boot.querySelector('[data-boot-count]')

const path = buildPath()
const sections = path.sections
const mid = (s) => (s.a + s.b) / 2
const ui = createUI({ app, sections, onGo: (i) => go(i) })

// the model, and the faces the type is set in (asking for the Japanese by its text fetches only the subsets it needs)
const japanese = [...COVER.top, COVER.sub, COVER.price, COVER.side, OUTRO.kicker, OUTRO.sub, ...STOPS.map((s) => s.jp)].join('')
const fonts = Promise.race([
  Promise.all([
    document.fonts.load('900 100px "Jost Variable"', 'PEBBLE'),
    document.fonts.load('700 40px "Jost Variable"', 'WELL-EQUIPPED'),
    document.fonts.load('400 16px "Jost Variable"', 'Turnstone'),
    document.fonts.load('700 16px "Zen Kaku Gothic New"', japanese),
    document.fonts.load('500 16px "Zen Kaku Gothic New"', japanese),
  ]),
  new Promise((r) => setTimeout(r, 5000)),
]).catch(() => {})
const [stage] = await Promise.all([createStage(canvas, { onProgress: (v) => (count.textContent = Math.round(v * 100)) }), fonts])
count.textContent = '100'

const scroll = createScrollPage(app, { limited: true, onProgress: (p) => (progress = p) })
const metrics = ui.measure()
let lay
let progress = 0
let current // the section the scroll is in: undefined before the first frame, null between sections
let open // the section whose page of type is up (it comes up a little before the scroll gets there)
let jumping = false
const still = q.has('still') // for photographs: no sway
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
let turn = 0.13

const slotFor = (sec) => stage.slot(sec.stop.id, path.stopPose(sec.index, lay), lay.item)

function relayout() {
  stage.resize()
  const { W, H, pixel } = stage.size
  lay = layoutFor(W, H, { ...metrics, pixel })
  paper.resize({ W, H, pixel, frame: lay.f, band: lay.band })
  ui.layout(lay)
  ui.placeLabels(stage, path.stopPose(-1, lay))
  // the page is as long as the window is tall, so the pace is the same on a laptop and a tall monitor
  scroll.setLength(H + (path.total * Math.min(H, 1000)) / 900)
  if (current && current.stop) stage.retarget(current.stop.id, slotFor(current))
}

// a section glides to its resting place, and input waits while it does
function settle(sec) {
  if (Math.abs(progress - mid(sec) - 0.001) * scroll.limit < 3) return
  scroll.lock(true)
  scroll.scrollTo(mid(sec), 720, () => scroll.lock(false))
}
function enter(sec) {
  current = sec
  if (sec && sec.stop) stage.show(sec.stop.id, slotFor(sec))
  else stage.show(null)
  if (sec && sec.autoScroll && !jumping) settle(sec)
}

// go to a section by number: a glide if it is near, a quick cut behind blank paper if it is far
const indexAt = (p) => {
  let best = 0
  sections.forEach((s, i) => {
    if (Math.abs(mid(s) - p) < Math.abs(mid(sections[best]) - p)) best = i
  })
  return best
}
function go(i) {
  i = Math.min(sections.length - 1, Math.max(0, i))
  if (jumping) return
  const target = i === 0 ? 0 : mid(sections[i])
  const from = current ? sections.indexOf(current) : indexAt(progress)
  const done = () => {
    jumping = false
    current = open = undefined
    scroll.lock(false)
  }
  jumping = true
  scroll.lock(true)
  scroll.stop()
  enter(null)
  ui.setSection((open = null))
  if (Math.abs(i - from) <= 2) return scroll.scrollTo(target, 900 + 350 * Math.abs(i - from), done)
  app.classList.add('is-jumping')
  setTimeout(() => {
    stage.home()
    scroll.jump(target)
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        app.classList.remove('is-jumping')
        done()
      }),
    )
  }, 240)
}
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  const onControl = e.target.closest && e.target.closest('a, button')
  const p = progress
  const next = () => sections.findIndex((s) => s.a > p + 1e-4)
  const prev = () => sections.findLastIndex((s) => s.b < p - 1e-4)
  let to = -1
  if (e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey && !onControl)) to = next()
  else if (e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey && !onControl)) to = prev()
  else if (e.key === 'Home') to = 0
  else if (e.key === 'End') to = sections.length - 1
  else return
  e.preventDefault()
  if (to >= 0) go(to)
})

let last = performance.now()
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05)
  last = now
  const p = progress
  Object.assign(stage.pose, path.poseAt(p, lay))
  if (!jumping) {
    const sec = sections.find((s) => p >= s.a && p <= s.b) || null
    if (sec !== current) enter(sec)
    const page = sections.find((s) => p >= s.from && p <= s.to) || null
    if (page !== open) ui.setSection((open = page))
  }
  ui.setCover(path.coverGone(p))
  ui.setBullet(indexAt(p))
  stage.hover.amount = still ? 0 : current && current.stop ? 0.5 : 1
  stage.render(dt)
  ui.frame(stage)
  // The rays come from behind whatever the page is about: the Pebble, or the item that is out, and they
  // follow it there as it flies. They turn, very slowly.
  const { W, H } = stage.size
  let hx = (0.5 + stage.pose.shiftX) * W
  let hy = (0.5 + stage.pose.shiftY) * H
  const out = stage.out()
  if (out) {
    const s = stage.toScreen(out.where)
    const k = out.t * out.t * (3 - 2 * out.t)
    hx += (s.x - hx) * k
    hy += (s.y - hy) * k
  }
  if (!still && !calm) turn += dt * 0.022
  paper.render(hx, hy, turn)
  requestAnimationFrame(frame)
}

relayout()
addEventListener('resize', relayout)
if (q.has('p')) scroll.jump(+q.get('p'))
window.__pebble = {
  stage,
  path,
  scroll,
  ui,
  go,
  sections: sections.map(({ id, a, b }) => ({ id, a, b })),
  get progress() {
    return progress
  },
  get section() {
    return current ? current.id : null
  },
  get layout() {
    return lay
  },
  get jumping() {
    return jumping
  },
  ready: false,
}

// open: the counter goes, the paper stays, the cover sets itself
requestAnimationFrame(frame)
app.style.visibility = 'visible'
gsap.fromTo(canvas, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', delay: 0.15, clearProps: 'opacity,transform' })
gsap.to(boot, { opacity: 0, duration: 0.25, ease: 'none', onComplete: () => boot.remove() })
ui.intro().then(() => (window.__pebble.ready = true))
