// The 3D half of the page: loads the Blender-built Pebble, draws it the way a mid-90s console would
// (coarse pixels, vertex lighting, snapped vertices, 15-bit colour) on a transparent canvas, and can
// lift any accessory off the Pebble, float it enlarged in front of the camera, and put it back.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { STOPS } from '../config.js'

export const VFOV = 30
export const PEBBLE_CENTRE = new THREE.Vector3(0, 1.11, 0)
export const PEBBLE_HEIGHT = 2.24 // soles to the top of the headset band

const LINES = 430 // the picture is this many pixels tall, whatever the screen
const SWAY = 0.42 // how far an item that only rocks turns each way, in radians
const BOB = 0.035 // and how far a floating item drifts up and down, in metres

const vertexShader = /* glsl */ `
  uniform vec2 uGrid;
  uniform vec3 uLight;
  uniform float uAmbient;
  uniform float uDiffuse;
  uniform float uAffine;
  varying vec2 vUv;
  varying vec3 vShade;
  void main() {
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    // old hardware had no sub-pixel precision: every vertex lands on a whole pixel
    clip.xy = floor(clip.xy / clip.w * uGrid + 0.5) / uGrid * clip.w;
    // nor any sense of depth when it filled a triangle: textures and shading were stretched flat across
    // the screen, which is why they swim. (Lettering is spared, so the labels stay readable.)
    gl_Position = uAffine > 0.5 ? vec4(clip.xyz / clip.w, 1.0) : clip;
    vec3 n = normalize(mat3(modelMatrix) * normal);
    float d = max(dot(n, uLight), 0.0);
    // vertex colours come out of Blender linear; everything here is done in display space
    vShade = pow(color.rgb, vec3(1.0 / 2.2)) * (uAmbient + uDiffuse * d);
    vUv = uv;
  }`
const BAYER = /* glsl */ `
  float bayer(vec2 p) {
    int x = int(mod(p.x, 4.0));
    int y = int(mod(p.y, 4.0));
    int i = x + y * 4;
    float m = 0.0;
    if (i == 0) m = 0.0; else if (i == 1) m = 8.0; else if (i == 2) m = 2.0; else if (i == 3) m = 10.0;
    else if (i == 4) m = 12.0; else if (i == 5) m = 4.0; else if (i == 6) m = 14.0; else if (i == 7) m = 6.0;
    else if (i == 8) m = 3.0; else if (i == 9) m = 11.0; else if (i == 10) m = 1.0; else if (i == 11) m = 9.0;
    else if (i == 12) m = 15.0; else if (i == 13) m = 7.0; else if (i == 14) m = 13.0; else m = 5.0;
    return m / 16.0;
  }`
const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vShade;
  ${BAYER}
  void main() {
    vec3 c = texture2D(map, vUv).rgb * vShade;
    // five bits a channel, ordered dither in between
    c = floor(c * 31.0 + bayer(gl_FragCoord.xy)) / 31.0;
    gl_FragColor = vec4(c, uOpacity);
  }`

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

// BASE_URL is './' in the build and '/' in dev, so the model is found wherever the page is served from
// (the same address index.html preloads)
export async function createStage(canvas, { onProgress = () => {}, model = import.meta.env.BASE_URL + 'models/pebble.glb' } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance', stencil: false })
  renderer.setClearColor(0x000000, 0)
  renderer.autoClear = false
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(VFOV, 1, 0.4, 80)

  const shared = {
    uGrid: { value: new THREE.Vector2(320, 240) },
    uLight: { value: new THREE.Vector3(-0.42, 0.62, 0.66).normalize() },
    uAmbient: { value: 0.74 },
    uDiffuse: { value: 0.4 },
  }
  const materials = new Map()
  function retro(src) {
    const key = src.map ? src.map.uuid : src.name
    if (materials.has(key)) return materials.get(key)
    let m
    if (!src.map) {
      // glass: a flat, see-through tint
      m = new THREE.MeshBasicMaterial({ color: 0xcfe9ff, transparent: true, opacity: 0.3, depthWrite: false })
    } else {
      const map = src.map
      map.magFilter = map.minFilter = THREE.NearestFilter
      map.generateMipmaps = false
      map.colorSpace = THREE.NoColorSpace
      map.needsUpdate = true
      m = new THREE.ShaderMaterial({ vertexShader, fragmentShader, vertexColors: true, uniforms: { ...shared, map: { value: map }, uOpacity: { value: 1 }, uAffine: { value: src.name === 'labels' ? 0 : 1 } } })
    }
    m.name = src.name
    materials.set(key, m)
    return m
  }

  const gltf = await new GLTFLoader().loadAsync(model, (e) => e.total && onProgress(e.loaded / e.total))
  const pebble = new THREE.Group()
  pebble.name = 'pebble'
  pebble.add(...gltf.scene.children.slice())
  scene.add(pebble)
  const nodes = {}
  pebble.traverse((o) => {
    if (o.name) nodes[o.name] = o
    if (o.isMesh) {
      o.material = retro(o.material)
      o.frustumCulled = false
      if (o.material.transparent) o.renderOrder = 2
    }
  })

  // the flat octagonal shadow old games put under a character
  {
    const g = new THREE.CircleGeometry(1, 8)
    g.rotateX(-Math.PI / 2)
    const blob = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x3a2a1c, transparent: true, opacity: 0.16, depthWrite: false }))
    blob.scale.set(0.98, 1, 0.92)
    blob.position.y = 0.004
    blob.renderOrder = -1
    scene.add(blob)
  }
  scene.updateMatrixWorld(true)

  // ── drawn in picture pixels, one layer behind the scene and one in front: hairlines, dots, the mark
  // that shows where an item is worn. One-pixel lines with stair-steps, like everything else; they fade
  // by dither, not by transparency. ─────────────────────────────────────────────────────────────
  const flat = new THREE.OrthographicCamera(0, 1, 0, 1, -1, 1)
  const flatMaterial = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `attribute vec4 tint; varying vec4 vTint; void main() { vTint = tint; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `varying vec4 vTint; ${BAYER} void main() { if (vTint.a <= bayer(gl_FragCoord.xy)) discard; gl_FragColor = vec4(vTint.rgb, 1.0); }`,
  })
  const makeLayer = () => {
    const layer = { scene: new THREE.Scene(), nl: 0, nq: 0 }
    for (const [key, n, Kind] of [['quads', 256 * 6, THREE.Mesh], ['lines', 512 * 2, THREE.LineSegments]]) {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage))
      g.setAttribute('tint', new THREE.BufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage))
      const o = new Kind(g, flatMaterial)
      o.frustumCulled = false
      layer.scene.add(o)
      layer[key] = g
    }
    return layer
  }
  const layers = { back: makeLayer(), front: makeLayer() }
  const vert = (g, i, x, y, c, a) => {
    g.attributes.position.setXYZ(i, x, y, 0)
    g.attributes.tint.setXYZW(i, c[0], c[1], c[2], a)
  }
  const PAPER = [0.98, 0.953, 0.89]
  const overlay = {
    INK: [0.078, 0.078, 0.078],
    RED: [0.647, 0.098, 0.18],
    begin() {
      for (const k in layers) layers[k].nl = layers[k].nq = 0
    },
    // a one-pixel line between two points given in CSS pixels; `halo` lays a paper-coloured line beside it,
    // which keeps it visible where it crosses the dark parts of the Pebble
    line(where, x0, y0, x1, y1, color, alpha = 1, halo = true) {
      const L = layers[where]
      const a = [Math.floor(x0 / pixel) + 0.5, Math.floor(y0 / pixel) + 0.5, Math.floor(x1 / pixel) + 0.5, Math.floor(y1 / pixel) + 0.5]
      for (const [dx, dy, c] of halo ? [[1, 1, PAPER], [0, 0, color]] : [[0, 0, color]]) {
        if (L.nl >= 512) return
        vert(L.lines, L.nl * 2, a[0] + dx, a[1] + dy, c, alpha)
        vert(L.lines, L.nl * 2 + 1, a[2] + dx, a[3] + dy, c, alpha)
        L.nl++
      }
    },
    // a filled square, `size` picture pixels across, centred on a point given in CSS pixels
    square(where, x, y, size, color, alpha = 1, halo = true) {
      const L = layers[where]
      const cx = Math.floor(x / pixel) - Math.floor(size / 2)
      const cy = Math.floor(y / pixel) - Math.floor(size / 2)
      for (const [grow, c] of halo ? [[1, PAPER], [0, color]] : [[0, color]]) {
        if (L.nq >= 256) return
        const x0 = cx - grow
        const y0 = cy - grow
        const x1 = cx + size + grow
        const y1 = cy + size + grow
        const i = L.nq * 6
        vert(L.quads, i, x0, y0, c, alpha)
        vert(L.quads, i + 1, x1, y0, c, alpha)
        vert(L.quads, i + 2, x1, y1, c, alpha)
        vert(L.quads, i + 3, x0, y0, c, alpha)
        vert(L.quads, i + 4, x1, y1, c, alpha)
        vert(L.quads, i + 5, x0, y1, c, alpha)
        L.nq++
      }
    },
    end() {
      for (const k in layers) {
        const L = layers[k]
        for (const [g, n] of [[L.lines, L.nl * 2], [L.quads, L.nq * 6]]) {
          g.setDrawRange(0, n)
          g.attributes.position.needsUpdate = true
          g.attributes.tint.needsUpdate = true
        }
      }
    },
  }
  overlay.begin()
  overlay.end()

  // ── the accessories ────────────────────────────────────────────────────
  const box = new THREE.Box3()
  const items = {}
  const depth = (o) => {
    let d = 0
    for (let p = o.parent; p; p = p.parent) d++
    return d
  }
  for (const stop of STOPS) {
    const node = nodes[stop.node]
    if (!node) throw new Error(`model has no object called ${stop.node}`)
    box.setFromObject(node)
    const centre = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    items[stop.id] = {
      id: stop.id,
      node,
      cfg: stop,
      homePos: node.position.clone(),
      // offset of the visual centre from the pivot, and how big it is, measured where it normally sits
      centre: centre.sub(node.getWorldPosition(new THREE.Vector3())),
      size,
      radius: size.length() / 2,
      exit: new THREE.Vector3(...stop.exit),
      grow: stop.grow || 1,
      late: !!(stop.clears || stop.hop), // something has to make room for it first
      aside: 0, // how far it has been asked to move over for something else (0..1 of its own first move)
      t: 0, // 0 = worn, 1 = fully out
      goal: 0,
      spin: 0,
      target: { pos: new THREE.Vector3(), scale: 1, yaw: 0 },
      where: new THREE.Vector3(),
      depth: depth(node),
      anchor: new THREE.Vector3(), // where it is worn, in world space (for the caption's leader line)
    }
    items[stop.id].anchor.copy(node.getWorldPosition(new THREE.Vector3())).add(items[stop.id].centre)
    // every vertex of it (and of whatever rides along with it), relative to its visual centre
    const cloud = []
    node.traverse((o) => {
      if (!o.isMesh) return
      const pos = o.geometry.attributes.position
      for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).sub(items[stop.id].anchor)
        cloud.push(v.x, v.y, v.z)
      }
    })
    items[stop.id].cloud = new Float32Array(cloud)
    // the spot a caption's hairline points at: its middle, unless the item is a ring round the Pebble
    items[stop.id].mark = stop.mark ? new THREE.Vector3(...stop.mark) : items[stop.id].anchor.clone()
    // and the spot its own page points back to: where it is worn, on the side that page looks from
    items[stop.id].home = stop.home ? new THREE.Vector3(...stop.home) : items[stop.id].mark
  }
  const ordered = Object.values(items).sort((a, b) => a.depth - b.depth)

  // ── sizing: a fixed number of picture lines, scaled up with hard pixel edges ─────────────
  let W = 2
  let H = 2
  let pixel = 2
  function resize() {
    W = window.innerWidth
    H = window.innerHeight
    const dpr = window.devicePixelRatio || 1
    const device = Math.max(1, Math.round((H * dpr) / LINES)) // device pixels per picture pixel
    pixel = device / dpr
    const bw = Math.ceil(W / pixel)
    const bh = Math.ceil(H / pixel)
    renderer.setPixelRatio(1)
    renderer.setSize(bw, bh, false)
    canvas.style.width = bw * pixel + 'px'
    canvas.style.height = bh * pixel + 'px'
    shared.uGrid.value.set(bw / 2, bh / 2)
    camera.aspect = bw / bh
    camera.updateProjectionMatrix()
    flat.right = bw
    flat.bottom = bh
    flat.updateProjectionMatrix()
  }
  resize()
  window.addEventListener('resize', resize)

  const Y = new THREE.Vector3(0, 1, 0)
  const X = new THREE.Vector3(1, 0, 0)

  // ── camera rig ─────────────────────────────────────────────────────────
  const pose = { target: PEBBLE_CENTRE.clone(), az: 0, el: 0.1, dist: 8, shiftX: 0, shiftY: 0 }
  const hover = { x: 0, y: 0, tx: 0, ty: 0, amount: 1 }
  const drag = { yaw: 0, pitch: 0, vy: 0, vp: 0, down: false }
  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return
      hover.tx = (e.clientX / W) * 2 - 1
      hover.ty = (e.clientY / H) * 2 - 1
    },
    { passive: true },
  )
  const off = new THREE.Vector3()
  function place(cam, p, extraAz = 0, extraEl = 0) {
    const az = p.az + extraAz
    const el = THREE.MathUtils.clamp(p.el + extraEl, -0.25, 1.3)
    off.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(p.dist)
    cam.position.copy(p.target).add(off)
    cam.lookAt(p.target)
    const bw = Math.ceil(W / pixel)
    const bh = Math.ceil(H / pixel)
    if (p.shiftX || p.shiftY) cam.setViewOffset(bw, bh, -p.shiftX * bw, -p.shiftY * bh, bw, bh)
    else if (cam.view) cam.clearViewOffset()
    cam.updateMatrixWorld()
    return cam
  }
  function applyPose() {
    hover.x += (hover.tx - hover.x) * 0.05
    hover.y += (hover.ty - hover.y) * 0.05
    if (!drag.down) {
      drag.yaw += drag.vy
      drag.pitch += drag.vp
      drag.vy *= 0.9
      drag.vp *= 0.9
    }
    drag.yaw = THREE.MathUtils.clamp(drag.yaw, -0.7, 0.7)
    drag.pitch = THREE.MathUtils.clamp(drag.pitch, -0.3, 0.45)
    place(camera, pose, -hover.x * 0.04 * hover.amount - drag.yaw, hover.y * 0.025 * hover.amount + drag.pitch)
  }

  // Where an accessory should float for a given camera pose, and how large: centred on the screen
  // point (x, y) (fractions of the window), a little nearer the camera than the Pebble, and as big as
  // fits a box w by h pixels through its whole turn (or rock). Measured vertex by vertex, so nothing
  // that sticks out of an item can stray over the type or the Pebble.
  const probe = new THREE.PerspectiveCamera(VFOV, 1, 0.4, 80)
  const ray = new THREE.Vector3()
  const fwd = new THREE.Vector3()
  const vp = new THREE.Matrix4()
  const sq = new THREE.Quaternion()
  const st = new THREE.Quaternion()
  const sv = new THREE.Vector3()
  function slot(id, p, { x: sx, y: sy, w, h }) {
    const it = items[id]
    probe.aspect = camera.aspect
    probe.updateProjectionMatrix()
    place(probe, p)
    const D = Math.max(2.2, p.dist - 1.6)
    ray.set(sx * 2 - 1, -(sy * 2 - 1), 0.5).unproject(probe).sub(probe.position).normalize()
    probe.getWorldDirection(fwd)
    // distance along the ray so that the point is D in front of the camera plane
    const pos = probe.position.clone().addScaledVector(ray, D / ray.dot(fwd))
    const metre = H / (2 * D * Math.tan(THREE.MathUtils.degToRad(VFOV) / 2)) // pixels to a metre at that depth
    const turning = it.cfg.spin === 'full'
    // turn it to face the camera: its "front" is the way it comes off the Pebble
    const toCam = Math.atan2(probe.position.x - pos.x, probe.position.z - pos.z)
    const front = it.cfg.face !== undefined ? THREE.MathUtils.degToRad(it.cfg.face) : Math.hypot(it.exit.x, it.exit.z) > 0.05 ? Math.atan2(it.exit.x, it.exit.z) : 0
    const yaw = toCam - front + (turning ? 0.35 : 0)
    // Size: project every vertex, at every angle it will be seen from, and scale until the furthest
    // of them touches the box. (Projection is not quite linear in the scale, so do it a few times.)
    vp.multiplyMatrices(probe.projectionMatrix, probe.matrixWorldInverse)
    let scale = Math.min(w, h) / (2 * it.radius * metre)
    const n = turning ? 24 : 5
    for (let pass = 0; pass < 3; pass++) {
      let ex = 0
      let ey = 0
      for (let k = 0; k < n; k++) {
        sq.setFromAxisAngle(Y, turning ? yaw + (k / n) * Math.PI * 2 : yaw + (k / (n - 1) - 0.5) * 2 * SWAY)
        if (it.cfg.tilt) sq.multiply(st.setFromAxisAngle(X, it.cfg.tilt))
        for (let i = 0; i < it.cloud.length; i += 3) {
          sv.set(it.cloud[i], it.cloud[i + 1], it.cloud[i + 2]).applyQuaternion(sq).multiplyScalar(scale).add(pos).applyMatrix4(vp)
          ex = Math.max(ex, Math.abs((sv.x * 0.5 + 0.5 - sx) * W))
          ey = Math.max(ey, Math.abs((-sv.y * 0.5 + 0.5 - sy) * H))
        }
      }
      scale *= Math.min(w / 2 / ex, (h / 2 - BOB * metre) / ey)
    }
    scale *= it.cfg.fit || 1
    return { pos, scale: THREE.MathUtils.clamp(scale, 0.3, 6), yaw }
  }

  // ── every frame ────────────────────────────────────────────────────────
  const M = new THREE.Matrix4()
  const inv = new THREE.Matrix4()
  const hp = new THREE.Vector3()
  const hq = new THREE.Quaternion()
  const hs = new THREE.Vector3()
  const qs = new THREE.Quaternion()
  const qt = new THREE.Quaternion()
  const p1 = new THREE.Vector3()
  const p2 = new THREE.Vector3()
  const p3 = new THREE.Vector3()
  const ctrl = new THREE.Vector3()
  const toCam = new THREE.Vector3()
  const ONE = new THREE.Vector3(1, 1, 1)
  const IDENT = new THREE.Quaternion()
  const OUT_TIME = 0.85

  function updateItems(time, dt) {
    // Some things are in the way of others: the headset's band goes over the cap, the belt goes round
    // the Pebble's middle, and the Pebble stands in its sneakers. So while one of those leaves, something
    // makes room and then settles back: the headset lifts (part of its own way out), or the whole Pebble
    // hops, and what is leaving stays where it was until the Pebble is out of it.
    let hop = 0
    for (const it of ordered) it.aside = 0
    for (const it of ordered) {
      const dir = Math.sign(it.goal - it.t)
      if (dir) it.t = THREE.MathUtils.clamp(it.t + (dir * dt) / OUT_TIME, 0, 1)
      if (it.t <= 0 || !it.late) continue
      const e = easeInOut(it.t)
      const up = smooth(0.1, 0.4, e)
      // (the headset can sit back down as soon as the cap is out from under it; the Pebble stays up until its belt or shoes are well away)
      for (const id in it.cfg.clears || {}) items[id].aside = Math.max(items[id].aside, it.cfg.clears[id] * up * (1 - smooth(0.6, 0.8, e)))
      if (it.cfg.hop) hop = Math.max(hop, it.cfg.hop * up * (1 - smooth(0.8, 0.98, e)))
    }
    pebble.position.y = hop
    for (const it of ordered) {
      const n = it.node
      if (it.t <= 0 && it.aside <= 0) {
        if (!n.matrixAutoUpdate) {
          n.matrixAutoUpdate = true
          n.position.copy(it.homePos)
          n.quaternion.identity()
          n.scale.set(1, 1, 1)
        }
        continue
      }
      const e = easeInOut(it.t)
      // The first move takes it clear of the Pebble; a ring widens before it travels, so it is loose by
      // the time it slides. Something that waits for room does its widening early and its moving late.
      const a = Math.max(smooth(0, 0.55, e), it.aside)
      const widen = it.late ? smooth(0, 0.16, e) : it.grow !== 1 ? smooth(0, 0.5, a) : a
      const travel = it.late ? smooth(0.34, 0.66, e) : it.grow !== 1 ? smooth(0.3, 1, a) : a
      // the second move: across to where it floats
      const b = it.late ? smooth(0.46, 1, e) : smooth(0.32, 1, e)
      n.parent.updateWorldMatrix(true, false)
      M.copy(n.parent.matrixWorld).multiply(inv.makeTranslation(it.homePos.x, it.homePos.y, it.homePos.z)).decompose(hp, hq, hs)
      p1.copy(hp).addScaledVector(it.exit, travel)
      if (it.cfg.hop) p1.y -= hop // it stays where it was while the Pebble is in the air
      it.spin += dt * (it.cfg.spin === 'full' ? 0.55 : 0)
      const yaw = it.target.yaw + (it.cfg.spin === 'full' ? it.spin : Math.sin(time * 0.7) * SWAY)
      qs.setFromAxisAngle(Y, yaw)
      if (it.cfg.tilt) qs.multiply(qt.setFromAxisAngle(X, it.cfg.tilt))
      const S = it.target.scale
      // the pivot goes wherever puts the visual centre on the slot
      p2.copy(it.centre).multiplyScalar(S).applyQuaternion(qs).negate().add(it.target.pos)
      p2.y += Math.sin(time * 1.3 + it.depth) * BOB * b
      // It does not fly straight there, which could take it through the Pebble: it comes towards the
      // camera first, a little further than its slot is, and only then slides across (a quadratic curve),
      // and it does not start to turn until it is on its way.
      toCam.set(Math.sin(pose.az), 0, Math.cos(pose.az))
      ctrl.copy(p1).addScaledVector(toCam, Math.max(0, p3.subVectors(p2, p1).dot(toCam)) * 1.3)
      p1.multiplyScalar((1 - b) * (1 - b)).addScaledVector(ctrl, 2 * b * (1 - b)).addScaledVector(p2, b * b)
      hq.slerp(qs, smooth(0.25, 1, b))
      // start from whatever size its parent currently is, in case that is on the move too
      const s = THREE.MathUtils.lerp(hs.x * THREE.MathUtils.lerp(1, it.grow, widen), S, b)
      M.compose(p1, hq, hs.copy(ONE).multiplyScalar(s))
      it.where.copy(it.centre).applyMatrix4(M) // where its middle is now, for anything that wants to follow it
      inv.copy(n.parent.matrixWorld).invert()
      n.matrix.multiplyMatrices(inv, M)
      n.matrixAutoUpdate = false
      n.matrixWorldNeedsUpdate = true
    }
  }

  // small signs of life
  let blinkAt = 2.4
  let blink = 0
  const armHome = { arm_l: nodes.arm_l?.quaternion.clone(), arm_r: nodes.arm_r?.quaternion.clone() }
  const hands = ['h', 'm', 's'].map((k) => nodes[`watch_hand_${k}`]).filter(Boolean)
  const axis = new THREE.Vector3()
  function life(time, dt) {
    if (time > blinkAt) {
      blink = 1
      blinkAt = time + 2.6 + Math.random() * 3.4
    }
    blink = Math.max(0, blink - dt * 7)
    const lid = 1 - Math.sin(Math.min(blink, 1) * Math.PI) * 0.92
    for (const k of ['eye_l', 'eye_r']) if (nodes[k]) nodes[k].scale.y = lid
    for (const [k, s] of [['arm_l', 1], ['arm_r', -1]]) if (nodes[k]) nodes[k].quaternion.copy(armHome[k]).multiply(qt.setFromAxisAngle(X, Math.sin(time * 1.1 + s) * 0.03))
    if (nodes.helper_arm) nodes.helper_arm.rotation.z = Math.sin(time * 5.2) * 0.3
    for (const [id, amp, speed] of [['price-tag', 0.07, 1.3], ['key-ring', 0.05, 1.5]]) {
      const it = items[id]
      if (it && it.t <= 0) it.node.rotation.z = Math.sin(time * speed) * amp
    }
    if (hands.length) {
      const now = new Date()
      const sec = now.getSeconds() + now.getMilliseconds() / 1000
      const min = now.getMinutes() + sec / 60
      const hr = (now.getHours() % 12) + min / 60
      ;[hr / 12, min / 60, Math.floor(sec) / 60].forEach((f, i) => {
        const h = hands[i]
        if (!h) return
        axis.fromArray(h.userData.axis)
        h.quaternion.setFromAxisAngle(axis, -f * Math.PI * 2)
      })
    }
  }

  let time = 0
  function render(dt) {
    time += dt
    life(time, dt)
    updateItems(time, dt)
    applyPose()
    renderer.clear()
    renderer.render(layers.back.scene, flat)
    renderer.render(scene, camera)
    renderer.render(layers.front.scene, flat)
  }

  const v = new THREE.Vector3()
  function toScreen(world, out = { x: 0, y: 0 }) {
    v.copy(world).project(camera)
    out.x = (v.x * 0.5 + 0.5) * W
    out.y = (-v.y * 0.5 + 0.5) * H
    return out
  }
  // the same for a camera pose that is not the current one (used to lay the cover's captions out)
  function projectAt(p, world, out = { x: 0, y: 0 }) {
    probe.aspect = camera.aspect
    probe.updateProjectionMatrix()
    place(probe, p)
    probe.matrixWorldInverse.copy(probe.matrixWorld).invert()
    v.copy(world).project(probe)
    out.x = (v.x * 0.5 + 0.5) * W
    out.y = (-v.y * 0.5 + 0.5) * H
    return out
  }
  // on-screen rectangle of an object as it is right now (used by the captions and by QA)
  const corners = Array.from({ length: 8 }, () => new THREE.Vector3())
  function screenRect(object) {
    object.updateWorldMatrix(true, true)
    box.makeEmpty()
    object.traverse((o) => {
      if (!o.isMesh) return
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox()
      const bb = o.geometry.boundingBox
      let i = 0
      for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) corners[i++].set(x, y, z).applyMatrix4(o.matrixWorld)
      for (const c of corners) {
        v.copy(c).project(camera)
        box.expandByPoint(v)
      }
    })
    return { left: (box.min.x * 0.5 + 0.5) * W, right: (box.max.x * 0.5 + 0.5) * W, top: (-box.max.y * 0.5 + 0.5) * H, bottom: (-box.min.y * 0.5 + 0.5) * H }
  }

  return {
    renderer,
    scene,
    camera,
    pebble,
    nodes,
    items,
    pose,
    hover,
    drag,
    resize,
    render,
    slot,
    overlay,
    toScreen,
    projectAt,
    screenRect,
    // lift one accessory out (or none), and send every other one home
    show(id, target) {
      for (const it of ordered) {
        if (it.id === id) {
          if (it.goal !== 1) it.spin = 0
          it.goal = 1
          it.target.pos.copy(target.pos)
          it.target.scale = target.scale
          it.target.yaw = target.yaw
        } else it.goal = 0
      }
    },
    // the item that is furthest out at the moment, if any is
    out() {
      let best = null
      for (const it of ordered) if (it.t > 0 && (!best || it.t > best.t)) best = it
      return best
    },
    // everything back on the Pebble, at once
    home() {
      for (const it of ordered) it.t = it.goal = 0
    },
    retarget(id, target) {
      const it = items[id]
      it.target.pos.copy(target.pos)
      it.target.scale = target.scale
      it.target.yaw = target.yaw
    },
    get size() {
      return { W, H, aspect: W / H, pixel }
    },
    get busy() {
      return ordered.some((it) => it.t > 0)
    },
  }
}
