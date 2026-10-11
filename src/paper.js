// The paper, drawn the way the console draws everything else: big shaded triangles, 15-bit colour and
// an ordered dither, at the same coarse pixel size as the 3D. On it, the two things a Japanese games
// magazine of the 90s would have put there: rays fanning out from behind whatever the page is about
// (集中線), and a chunky two-colour border, a solid band with a dashed line inside it and a block in
// each corner. It has its own canvas underneath everything, so type can sit on it and the Pebble in
// front of that.
import * as THREE from 'three'

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
export const PAPER = [250, 243, 227]
export const RED = [165, 25, 46]
export const YELLOW = [240, 178, 40]
const quantise = (v, x, y) => (Math.min(31, Math.max(0, Math.floor((v / 255) * 31 + BAYER[(x & 3) + (y & 3) * 4] / 16))) / 31) * 255
const vec = (c) => `vec3(${c.map((v) => (v / 255).toFixed(4)).join(', ')})`

const fragmentShader = /* glsl */ `
  uniform vec2 uRes;    // the picture, in its own pixels
  uniform vec2 uCentre; // where the rays come from, in the same pixels, from the top left
  uniform float uTurn;
  uniform float uInset; // the border: how far in from the edge, and how thick its band is
  uniform float uBand;
  float hash(vec2 i) { return fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453); }
  float bayer(vec2 p) {
    float x = mod(p.x, 4.0);
    float y = mod(p.y, 4.0);
    float a = mod(x, 2.0) < 1.0 ? (mod(y, 2.0) < 1.0 ? 0.0 : 3.0) : (mod(y, 2.0) < 1.0 ? 2.0 : 1.0);
    float b = x < 2.0 ? (y < 2.0 ? 0.0 : 3.0) : (y < 2.0 ? 2.0 : 1.0);
    return (a * 4.0 + b) / 16.0;
  }
  void main() {
    vec2 q = vec2(floor(gl_FragCoord.x), floor(uRes.y - gl_FragCoord.y)); // whole pixels, from the top left
    // light worked out at the corners of big triangles and blended across them
    vec2 g = q / 46.0;
    vec2 i = floor(g);
    vec2 f = fract(g);
    float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), e = hash(i + vec2(1.0, 1.0));
    float s = mod(i.x + i.y, 2.0) > 0.5
      ? (f.x + f.y < 1.0 ? a + (b - a) * f.x + (c - a) * f.y : e + (c - e) * (1.0 - f.x) + (b - e) * (1.0 - f.y))
      : (f.x > f.y ? a + (b - a) * f.x + (e - b) * f.y : a + (e - c) * f.x + (c - a) * f.y);
    vec2 d = (q / uRes - 0.5) * 2.0;
    float shade = ((s - 0.5) * 13.0 - (d.x * d.x * d.x * d.x + d.y * d.y * d.y * d.y) * 7.0 + 2.0) / 255.0;
    vec3 col = ${vec(PAPER)} + shade * vec3(1.0, 1.0, 1.25);
    // the rays: every other wedge is a shade sunnier
    vec2 r = q - uCentre;
    float wedge = step(0.5, fract((atan(r.y, r.x) + uTurn) / 0.5235988));
    col *= mix(vec3(1.0), vec3(1.0, 0.973, 0.89), wedge * smoothstep(8.0, 60.0, length(r)));
    col = floor(col * 31.0 + bayer(q)) / 31.0;
    // the border
    float dx = min(q.x, uRes.x - 1.0 - q.x) - uInset;
    float dy = min(q.y, uRes.y - 1.0 - q.y) - uInset;
    float m = min(dx, dy);
    float corner = uBand + 4.0;
    if (dx >= 0.0 && dy >= 0.0) {
      if (dx < corner && dy < corner) col = (dx >= 2.0 && dy >= 2.0 && dx < corner - 2.0 && dy < corner - 2.0) ? ${vec(YELLOW)} : ${vec(RED)};
      else if (m < uBand) col = ${vec(RED)};
      else if (m == uBand + 1.0) col = mod(floor((dx < dy ? q.y : q.x) / 3.0), 2.0) < 1.0 ? ${vec(RED)} : ${vec(YELLOW)};
    }
    gl_FragColor = vec4(col, 1.0);
  }`

export function createPaper(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'low-power' })
  const uniforms = { uRes: { value: new THREE.Vector2(2, 2) }, uCentre: { value: new THREE.Vector2(1, 1) }, uTurn: { value: 0 }, uInset: { value: 3 }, uBand: { value: 2 } }
  const scene = new THREE.Scene()
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms, fragmentShader, vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }', depthTest: false }))
  sheet.frustumCulled = false
  scene.add(sheet)
  const camera = new THREE.Camera()
  let pixel = 2
  return {
    // frame: the border's inset in CSS pixels; band: its solid band's thickness in picture pixels
    resize({ W, H, pixel: px, frame, band }) {
      pixel = px
      const bw = Math.ceil(W / pixel)
      const bh = Math.ceil(H / pixel)
      renderer.setPixelRatio(1)
      renderer.setSize(bw, bh, false)
      canvas.style.width = bw * pixel + 'px'
      canvas.style.height = bh * pixel + 'px'
      uniforms.uRes.value.set(Math.round(W / pixel), Math.round(H / pixel))
      uniforms.uInset.value = Math.max(1, Math.round(frame / pixel))
      uniforms.uBand.value = band
    },
    // x, y: where the rays come from, in CSS pixels; turn: their angle, in radians
    render(x, y, turn) {
      uniforms.uCentre.value.set(Math.round(x / pixel), Math.round(y / pixel))
      uniforms.uTurn.value = turn
      renderer.render(scene, camera)
    },
  }
}

// Ink for the largest type: a strip of the same dithered shading, to be clipped to the letters. Their
// edges stay as sharp as type; what fills them is drawn by the console. Returns a CSS background.
const cache = new Map()
export function inkTexture(rows, from, to) {
  const key = rows + from.join() + to.join()
  if (!cache.has(key)) {
    const c = document.createElement('canvas')
    c.width = 4
    c.height = rows
    const ctx = c.getContext('2d')
    const img = ctx.createImageData(4, rows)
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < 4; x++) {
        const t = rows > 1 ? y / (rows - 1) : 0
        for (let k = 0; k < 3; k++) img.data[(y * 4 + x) * 4 + k] = quantise(from[k] + (to[k] - from[k]) * t, x, y)
        img.data[(y * 4 + x) * 4 + 3] = 255
      }
    ctx.putImageData(img, 0, 0)
    cache.set(key, `url(${c.toDataURL()})`)
  }
  return cache.get(key)
}
