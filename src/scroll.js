// Nothing on the page really scrolls. A virtual scrollbar (smooth-scrollbar) eases towards wherever the
// wheel or finger asked for, and its offset is the single number everything else reads. The offset may
// land between pixels (renderByPixels: false), so a slow camera move never advances in visible steps.
// Two small plugins shape the feel:
//   limit: no single wheel tick may ask for more than STEP px, and no more than PENDING px may be
//          waiting, so the camera can never be flung past an item;
//   lock:  swallows input while a section glides to its resting place.
import Scrollbar, { ScrollbarPlugin } from 'smooth-scrollbar'

const clamp = (min, max, v) => Math.min(max, Math.max(min, v))
const STEP = 200
const PENDING = 140
const DAMPING = 0.12

class LimitPlugin extends ScrollbarPlugin {
  static pluginName = 'limit'
  static defaultOptions = { isLimited: false }
  transformDelta(delta) {
    return this.options.isLimited ? { x: clamp(-STEP, STEP, delta.x), y: clamp(-STEP, STEP, delta.y) } : delta
  }
  onRender(remain) {
    if (this.options.isLimited) this.scrollbar.setMomentum(clamp(-PENDING, PENDING, remain.x), clamp(-PENDING, PENDING, remain.y))
  }
}
class LockPlugin extends ScrollbarPlugin {
  static pluginName = 'lock'
  static defaultOptions = { isLock: false }
  transformDelta(delta) {
    return this.options.isLock ? { x: 0, y: 0 } : delta
  }
}
Scrollbar.use(LimitPlugin, LockPlugin)

export function createScrollPage(root, { limited = false, onProgress = () => {} } = {}) {
  const wrapper = root.querySelector('.scroll-wrapper')
  const content = root.querySelector('.scroll-length')
  const sb = Scrollbar.init(wrapper, { damping: DAMPING, renderByPixels: false, alwaysShowTracks: false, delegateTo: document.body, plugins: { overscroll: false } })
  sb.updatePluginOptions('limit', { isLimited: limited })
  let locked = false
  let active = true
  let progress = 0
  sb.addListener(() => {
    const { offset, limit } = sb
    progress = limit.y > 0 ? clamp(0, 1, offset.y / limit.y) : 0
    if (active) onProgress(progress)
  })
  const api = {
    sb,
    get progress() {
      return progress
    },
    get limit() {
      return sb.limit.y
    },
    get locked() {
      return locked
    },
    setLength(px) {
      content.style.height = px + 'px'
      sb.update()
    },
    lock(v) {
      locked = v
      sb.updatePluginOptions('lock', { isLock: v })
    },
    // every target is nudged by a thousandth, so a section is already "active" on arrival
    offsetFor(p) {
      return sb.limit.y * (p + 0.001)
    },
    scrollTo(p, ms = 0, done) {
      sb.scrollTo(0, api.offsetFor(p), ms, { callback: done })
    },
    jump(p) {
      sb.setMomentum(0, 0)
      sb.setPosition(0, sb.limit.y * p)
    },
    stop() {
      sb.setMomentum(0, 0)
    },
    nudge(dy) {
      if (!locked) sb.addTransformableMomentum(0, dy, new WheelEvent('wheel'))
    },
    destroy() {
      active = false
      sb.destroy()
    },
  }
  return api
}
