// Turns the list of items into (1) the scroll layout: where each section is "active", and (2) a camera
// pose for any scroll progress. The camera walks a circle round the Pebble, keeping it the same size,
// and holds still while an item is out. Where the Pebble, the item and the type sit depends on the
// window: side by side on a wide one, stacked on a tall one. layoutFor() is the one place that decides.
import * as THREE from 'three'
import { STOPS, LENGTHS } from '../config.js'
import { VFOV, PEBBLE_CENTRE, PEBBLE_HEIGHT } from './stage.js'

const RAD = Math.PI / 180
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const clamp01 = (v) => clamp(v, 0, 1)
const inout = (t) => t * t * t * (t * (t * 6 - 15) + 10)
const tanHalf = Math.tan((VFOV * RAD) / 2)

// The Pebble, dressed, is about this wide for its height, and the camera aims a little below its middle.
export const PEBBLE_ASPECT = 0.8 // seen from the front; from the side the backpack and the cap's brim make it nearer 0.88
const ABOVE = (PEBBLE_HEIGHT - PEBBLE_CENTRE.y) / PEBBLE_HEIGHT // share of its height above the aim point
const HEADROOM = 0.42 // the most anything rises above the Pebble's head while it changes, as a share of its height

// Everything in pixels except the 3D placements, which are fractions of the window (x, y) and of its
// height (h, fill). `m` carries two measured widths, in ems: the masthead word and the headline's longer line.
export function layoutFor(W, H, m = {}) {
  const mastEm = m.mastEm || 3.55
  const headEm = m.headEm || 4.95
  const aspect = W / H
  // side by side when the window is wider than tall and has the width for it; also when it is too short
  // to stack anything (a phone on its side)
  const wide = (aspect >= 1.15 && W >= 700) || (H < 560 && W >= 480 && aspect >= 0.95)
  const small = Math.min(W, H) < 600
  const f = small ? 7 : 13 // the red frame's inset
  const pixel = m.pixel || 2 // CSS pixels to one pixel of the 3D picture
  // the border is drawn in those pixels: a solid band, a gap, a dashed line (see src/paper.js)
  const band = Math.min(W, H) * 0.032 >= 9 * pixel ? 3 : 2
  const art = (band + 2) * pixel
  // the gutter between the border and everything else; on a wide window it also has to hold the cover's
  // line of small print down the right edge
  const pad = Math.round(clamp(Math.min(W, H) * 0.032, wide ? art + 15 : Math.max(13, art + 7), 32))
  const L = f + pad
  const R = W - f - pad
  const T = f + pad
  const B = H - f - pad
  const u = wide ? clamp(Math.min(W / 1440, H / 860), 0.5, 1.3) : clamp(W / 390, 0.9, 1.7) // type scale
  const place = (top, hpx, x) => ({ x, y: (top + ABOVE * hpx) / H, h: hpx / H, top, hpx })
  // The Pebble's feet are nearer the camera than its head, so on screen they reach a little lower than
  // its nominal height says, the more so the larger it is drawn. The tallest it can be in `room` pixels:
  const tallest = (room) => room / (1 + (0.09 * room) / H)
  const lay = { W, H, aspect, wide, small, f, pad, L, R, T, B, u, pixel, band, art }

  if (wide) {
    // ── cover ──
    const stripH = clamp(13 * u, 10.5, 15) * 1.5
    const fs = Math.min((R - L) / mastEm, 0.36 * H)
    const cap = 0.7 * fs
    const mastY = T + stripH + 0.012 * H
    const top = mastY + cap * 0.62 // its head stands in front of the foot of the masthead
    const hpx = Math.min(0.62 * H, 0.4 * W, tallest(B - 0.03 * H - top))
    const gap = clamp(0.02 * W, 14, 34)
    const pebbleLeft = W / 2 - (PEBBLE_ASPECT / 2) * hpx
    const subFs = clamp(22 * u, 13, 27)
    const headFs = Math.min(0.105 * H, (pebbleLeft - L - gap) / headEm)
    const headH = headFs * 0.86 * 2
    const headTop = B - subFs * 1.5 - 0.012 * H - headH
    const footFs = clamp(28 * u, 14, 34)
    const badge = clamp(104 * u, 62, 124)
    const bullets = 26
    lay.mast = { fs, x: (W - fs * mastEm) / 2, y: mastY, cap, logoFs: clamp(34 * u, 22, 40), logoX: L, logoY: T }
    lay.cover = place(top, hpx, 0.5)
    lay.coverBox = {
      stripFs: stripH / 1.5,
      headFs,
      headTop,
      subFs,
      footFs,
      badge,
      // the two columns of small captions either side of the Pebble
      left: { x0: L, x1: pebbleLeft - gap, top: mastY + cap + 0.034 * H, bottom: headTop - 0.03 * H },
      right: { x0: W - pebbleLeft + gap, x1: R - bullets, top: mastY + cap + 0.034 * H + 26 * u + 8, bottom: B - footFs * 1.3 - 0.02 * H },
    }
    // ── an item out: the item is the subject, large in the middle; the Pebble stands by on the right ──
    // (on a very wide window the three stay together in the middle rather than drifting apart)
    const ox = Math.max(0, (W - H * 1.9) / 2)
    const Lc = Math.max(L, ox)
    const Rc = Math.min(R, W - ox)
    const ph = Math.min(0.46, 0.32 * aspect) * H
    const pebbleX = Math.min(Rc - bullets - 0.5 * ph - 6, 0.835 * W)
    lay.pebble = place(0.52 * H - ph / 2, ph, pebbleX / W)
    const fillPx = Math.min(0.46, 0.27 * aspect) * H
    const itemX = pebbleX - 0.45 * ph - clamp(0.035 * W, 20, 56) - fillPx / 2
    lay.item = { x: itemX / W, y: 0.5, w: fillPx, h: Math.min(0.54 * H, fillPx * 1.14) }
    const logoH = lay.mast.logoFs * 0.7
    const capTop = T + logoH + clamp(0.03 * H, 10, 30)
    const capBottom = B - clamp(30 * u, 20, 36) // the running foot is under it
    lay.caption = { left: Lc, top: capTop, width: itemX - fillPx / 2 - gap - Lc, height: capBottom - capTop, centre: true }
    // ── back cover ──
    const oh = Math.min(0.62, 0.42 * aspect) * H
    const outroX = Rc - bullets - 0.45 * oh - clamp(0.04 * W, 20, 70)
    lay.outro = place(0.52 * H - oh / 2, oh, outroX / W)
    lay.outroBox = { left: Lc, top: capTop, width: outroX - 0.45 * oh - gap * 1.5 - Lc, height: capBottom - capTop, centre: true }
    lay.bullets = { x: R - 4, y: H / 2, gap: clamp(18 * u, 11, 19) }
    lay.turn = 34 // stand this far round from the item, so it sits on the edge of the Pebble nearest its slot
    return lay
  }

  // ── tall windows: everything stacked ──
  const stripFs = clamp(10.5 * u, 10, 15)
  const stripH = stripFs * 1.5 * 2
  const fs = (R - L) / mastEm
  const cap = 0.7 * fs
  const mastY = T + stripH + 0.008 * H
  const subFs = clamp(17 * u, 15, 26)
  const footFs = clamp(15 * u, 13, 24)
  const noFs = clamp(10.5 * u, 10, 15)
  const headFs = Math.min(0.1 * H, (R - L) / headEm)
  const headH = headFs * 0.86 * 2
  const headTop = B - noFs * 1.5 - footFs * 1.45 - subFs * 1.6 - 0.012 * H - headH
  const top = mastY + cap * 0.62
  const hpx = Math.min(tallest(headTop - 0.03 * H - top), (0.77 * W) / PEBBLE_ASPECT)
  lay.mast = { fs, x: L, y: mastY, cap, logoFs: clamp(24 * u, 20, 36), logoX: L, logoY: T }
  // (if there is room to spare it stands a little lower, but always with its head over the masthead)
  lay.cover = place(Math.min(top + (tallest(headTop - 0.03 * H - top) - hpx) * 0.5, mastY + cap * 0.86), hpx, 0.5)
  lay.coverBox = { stripFs, headFs, headTop, subFs, footFs, noFs, badge: clamp(headFs * 0.82, 44, 96), left: null, right: null }
  const top0 = T + lay.mast.logoFs * 0.7 + 12
  const capH = clamp(0.28 * H, 216 * Math.min(u, 1.5), 290 * Math.min(u, 1.5))
  const zoneB = B - capH - 0.012 * H
  const Z = zoneB - top0
  // The Pebble above, the item below it and larger. Above the Pebble there is air: it hops out of
  // its belt and its sneakers, and its headset lifts to let the cap out.
  const edge = f + 6
  const split = top0 + 0.47 * Z
  const ph = Math.min(tallest(split - edge) / (1 + HEADROOM), (0.6 * W) / PEBBLE_ASPECT)
  lay.pebble = place(split - ph * (1 + (0.09 * ph) / H), ph, 0.5)
  const itemTop = split + 0.032 * H
  const itemBottom = zoneB - 0.012 * H
  lay.item = { x: 0.5, y: (itemTop + itemBottom) / 2 / H, w: Math.min(0.7 * W, R - L - 40), h: itemBottom - itemTop }
  lay.caption = { left: L, top: B - capH, width: R - L, height: capH, centre: false }
  const oh = Math.min(tallest(0.96 * Z), (0.74 * W) / PEBBLE_ASPECT)
  lay.outro = place(top0 + (0.96 * Z - oh * (1 + (0.09 * oh) / H)) / 2, oh, 0.5)
  lay.outroBox = { left: L, top: B - capH, width: R - L, height: capH, centre: false }
  // (the dots start below the masthead: a red dot level with its last letter would read as a full stop)
  const dotGap = clamp(Z / 22, 8, 16)
  lay.bullets = { x: R - 1, y: Math.max((top0 + zoneB) / 2, mastY + cap + 14 + 9 * dotGap), gap: dotGap }
  lay.turn = 24
  return lay
}

export function buildPath() {
  // ── scroll layout, in pixels first ─────────────────────────────────────
  const L = LENGTHS
  const sections = []
  const segs = []
  let px = 0
  const keys = [{ id: 'cover', phi: 0, el: 6, place: 'cover' }, ...STOPS.map((s) => ({ id: s.id, phi: s.phi, el: s.el, place: 'pebble', stop: s })), { id: 'outro', phi: 374, el: 6, place: 'outro' }]
  sections.push({ id: 'cover', label: 'Cover', a: 0, b: L.cover })
  px = L.cover
  STOPS.forEach((s, i) => {
    const turn = Math.abs(keys[i + 1].phi - keys[i].phi)
    const len = Math.round(THREE.MathUtils.clamp(L.travel * (0.8 + turn / 160), L.travel * 0.8, L.travel * 1.9))
    segs.push({ a: px, b: px + len, k0: i, k1: i + 1 })
    px += len
    sections.push({ id: s.id, label: s.title, a: px, b: px + L.hold, stop: s, index: i, autoScroll: true })
    px += L.hold
  })
  segs.push({ a: px, b: px + L.toOutro, k0: STOPS.length, k1: STOPS.length + 1 })
  px += L.toOutro
  sections.push({ id: 'outro', label: 'Turnstone', a: px, b: px + L.outro })
  px += L.outro
  const total = px
  for (const s of [...segs, ...sections]) {
    s.a /= total
    s.b /= total
  }
  // A section's page of type is up for longer than the section itself: it arrives while the camera is
  // still on its way there, and stays a moment after it has left, so the paper is never blank for long.
  sections.forEach((sec, i) => {
    const before = i ? sec.a - sections[i - 1].b : 0
    const after = i < sections.length - 1 ? sections[i + 1].a - sec.b : 0
    sec.from = sec.a - before * (sec.id === 'cover' ? 0 : 0.45)
    sec.to = sec.b + after * (sec.id === 'cover' ? 0 : 0.12)
  })
  // the cover holds for its first part and starts turning away after that
  segs[0].a = sections[0].b * 0.45

  const out = { target: PEBBLE_CENTRE.clone(), az: 0, el: 0, dist: 1, shiftX: 0, shiftY: 0 }
  const at = (key, lay) => {
    const place = lay[key.place]
    return { az: (key.phi + (key.place === 'pebble' ? lay.turn : 0)) * RAD, el: key.el * RAD, x: place.x, y: place.y, h: place.h }
  }
  // pose for scroll progress p (0..1)
  function poseAt(p, lay) {
    let seg = segs[0]
    for (const s of segs) if (p >= s.a) seg = s
    const u = inout(clamp01((p - seg.a) / (seg.b - seg.a)))
    const A = at(keys[seg.k0], lay)
    const B = at(keys[seg.k1], lay)
    const mix = (k) => A[k] + (B[k] - A[k]) * u
    out.az = mix('az')
    out.el = mix('el')
    out.dist = PEBBLE_HEIGHT / mix('h') / (2 * tanHalf)
    out.shiftX = mix('x') - 0.5
    out.shiftY = mix('y') - 0.5
    return out
  }
  // the pose the camera holds at a section: -1 the cover, 0..15 an item, 16 the back cover
  function stopPose(index, lay) {
    const A = at(keys[index + 1], lay)
    return { target: PEBBLE_CENTRE.clone(), az: A.az, el: A.el, dist: PEBBLE_HEIGHT / A.h / (2 * tanHalf), shiftX: A.x - 0.5, shiftY: A.y - 0.5 }
  }
  // how far the cover has been left behind: 0 on the cover, 1 by the first item
  const coverGone = (p) => clamp01((p - segs[0].a) / (segs[0].b - segs[0].a))

  return { sections, segs, total, poseAt, stopPose, coverGone }
}
