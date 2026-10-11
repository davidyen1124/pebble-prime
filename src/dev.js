// Bench for the 3D stage alone: no page furniture. Not part of the build.
//   dev.html?section=3        hold on a section, its item out
//   dev.html?section=3&worn   the same view with everything worn
//   dev.html?p=0.42           any scroll progress
//   dev.html?orbit            hand the camera to the mouse
//   dev.html?az=-14&el=4&h=0.7&x=0.5&y=0.5   a hand-set portrait
//   dev.html?manual           nothing moves by itself: scripts/qa3d.mjs drives it through window.__bench
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createStage, PEBBLE_CENTRE, PEBBLE_HEIGHT, VFOV } from './webgl/stage.js'
import { buildPath, layoutFor } from './webgl/path.js'
import { createChecker } from './qa3d.js'

const q = new URLSearchParams(location.search)
document.body.style.background = q.get('bg') ? '#' + q.get('bg') : '#faf3e3'
const stage = await createStage(document.getElementById('canvas'))
const path = buildPath()
const mid = (s) => (s.a + s.b) / 2
let p = q.has('p') ? +q.get('p') : mid(path.sections[+(q.get('section') || 0)])
let worn = q.has('worn')
const hud = document.getElementById('hud')
if (q.has('nohud')) hud.remove()
stage.hover.amount = q.has('still') ? 0 : 1
const custom = q.has('az') ? { az: (+q.get('az') * Math.PI) / 180, el: (+(q.get('el') || 5) * Math.PI) / 180, h: +(q.get('h') || 0.6), x: +(q.get('x') || 0.5), y: +(q.get('y') || 0.5) } : null
let orbit = null
if (q.has('orbit')) {
  orbit = new OrbitControls(stage.camera, stage.renderer.domElement)
  orbit.target.copy(PEBBLE_CENTRE)
  stage.camera.position.set(0, 1.6, 7)
}
addEventListener('keydown', (e) => {
  const i = path.sections.findIndex((s) => p >= s.a - 1e-6 && p <= s.b + 1e-6)
  const cur = i < 0 ? path.sections.findIndex((s) => s.a > p) - 0.5 : i
  if (e.key === 'ArrowRight') p = mid(path.sections[Math.min(path.sections.length - 1, Math.floor(cur) + 1)])
  if (e.key === 'ArrowLeft') p = mid(path.sections[Math.max(0, Math.ceil(cur) - 1)])
  if (e.key === 'w') worn = !worn
})
addEventListener('wheel', (e) => (p = Math.min(1, Math.max(0, p + e.deltaY * 0.00006))), { passive: true })
const manual = q.has('manual')
window.__bench = { stage, path, THREE, layoutFor, set p(v) { p = v }, get p() { return p }, set worn(v) { worn = v }, get worn() { return worn } }
if (manual) {
  // the camera and the slot for item number `index`, as the page would have them in this window
  const at = (index) => {
    const { W, H } = stage.size
    const lay = layoutFor(W, H)
    const pose = path.stopPose(index, lay)
    Object.assign(stage.pose, pose)
    const id = path.sections[index + 1].id
    return { id, lay, target: stage.slot(id, pose, lay.item) }
  }
  Object.assign(window.__bench, { check: createChecker(stage), at })
  window.__frames = 99
}
let last = performance.now()
let frames = 0
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05)
  last = now
  const { W, H } = stage.size
  const lay = layoutFor(W, H)
  const s = path.sections.find((s) => p >= s.a && p <= s.b)
  if (orbit) {
    orbit.update()
    stage.renderer.clear()
    stage.renderer.render(stage.scene, stage.camera)
  } else {
    Object.assign(stage.pose, path.poseAt(p, lay))
    if (custom) {
      stage.pose.az = custom.az
      stage.pose.el = custom.el
      stage.pose.dist = PEBBLE_HEIGHT / custom.h / (2 * Math.tan((VFOV * Math.PI) / 360))
      stage.pose.shiftX = custom.x - 0.5
      stage.pose.shiftY = custom.y - 0.5
    }
    if (s && s.stop && !worn && !custom) stage.show(s.stop.id, stage.slot(s.stop.id, path.stopPose(s.index, lay), lay.item))
    else stage.show(null)
    stage.render(dt)
  }
  if (hud.isConnected) hud.textContent = `p ${p.toFixed(4)}  ${s ? s.id : '…'}  ${worn ? 'worn' : 'out'}`
  window.__frames = ++frames
  requestAnimationFrame(loop)
}
if (!manual) requestAnimationFrame(loop)
