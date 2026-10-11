// Mesh-against-mesh checks for the bench (dev only, never in the build): does anything pass through
// anything else, worn or on its way out? Exact triangle tests, through three-mesh-bvh.
import * as THREE from 'three'
import { MeshBVH } from 'three-mesh-bvh'

export function createChecker(stage) {
  const meshes = []
  // a mesh belongs to the nearest named object above it that the model knows by name
  // (a Blender object with several materials arrives as a group of meshes called name_1, name_2…: those are not parts)
  const named = new Set(Object.keys(stage.nodes).filter((n) => /^(body|eye_|arm_|acc_|helper_arm|watch_hand_)/.test(n) && !/_\d+$/.test(n)))
  const partOf = (o) => {
    for (let p = o; p; p = p.parent) if (named.has(p.name)) return p.name
    return o.name
  }
  stage.pebble.traverse((o) => {
    if (!o.isMesh) return
    o.geometry.boundsTree = new MeshBVH(o.geometry)
    meshes.push({ mesh: o, part: partOf(o), glass: !!o.material.transparent })
  })
  const under = (node) => {
    const set = new Set()
    node.traverse((o) => o.isMesh && set.add(o))
    return set
  }
  const m = new THREE.Matrix4()
  const touching = (a, b) => {
    m.copy(a.matrixWorld).invert().multiply(b.matrixWorld)
    return a.geometry.boundsTree.intersectsGeometry(b.geometry, m)
  }
  // every pair of parts whose surfaces cross, between two sets of meshes
  function pairs(A, B) {
    const out = new Set()
    for (const a of A)
      for (const b of B) {
        if (a.mesh === b.mesh || a.part === b.part) continue
        const key = a.part + ' × ' + b.part
        if (out.has(key)) continue
        if (touching(a.mesh, b.mesh)) out.add(key)
      }
    return [...out]
  }
  const settle = () => {
    stage.render(0)
    stage.scene.updateMatrixWorld(true)
  }
  // exact rectangle on screen of a set of meshes, every vertex projected
  const v = new THREE.Vector3()
  const mvp = new THREE.Matrix4()
  function rect(list) {
    const { W, H } = stage.size
    const r = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity }
    for (const { mesh } of list) {
      mvp.multiplyMatrices(stage.camera.projectionMatrix, stage.camera.matrixWorldInverse).multiply(mesh.matrixWorld)
      const pos = mesh.geometry.attributes.position
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mvp)
        const x = (v.x * 0.5 + 0.5) * W
        const y = (-v.y * 0.5 + 0.5) * H
        if (x < r.left) r.left = x
        if (x > r.right) r.right = x
        if (y < r.top) r.top = y
        if (y > r.bottom) r.bottom = y
      }
    }
    return r
  }
  const grow = (a, b) => {
    a.left = Math.min(a.left, b.left)
    a.top = Math.min(a.top, b.top)
    a.right = Math.max(a.right, b.right)
    a.bottom = Math.max(a.bottom, b.bottom)
    return a
  }

  return {
    parts: [...new Set(meshes.map((x) => x.part))],
    // everything worn: which parts cross which
    rest() {
      stage.home()
      settle()
      const out = new Set()
      for (let i = 0; i < meshes.length; i++)
        for (let k = i + 1; k < meshes.length; k++) {
          const a = meshes[i]
          const b = meshes[k]
          if (a.part === b.part) continue
          const key = [a.part, b.part].sort().join(' × ')
          if (!out.has(key) && touching(a.mesh, b.mesh)) out.add(key)
        }
      return [...out].sort()
    },
    // one item on its way out to `target`: for every other part, the stretch of the move (0..1) it is crossed for
    path(id, target, steps = 60) {
      stage.home()
      stage.show(id, target)
      const it = stage.items[id]
      const mine = under(it.node)
      const A = meshes.filter((x) => mine.has(x.mesh))
      const B = meshes.filter((x) => !mine.has(x.mesh))
      const spans = {}
      const reach = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity } // everything, over the whole move
      for (let k = 0; k <= steps; k++) {
        it.t = k / steps
        settle()
        grow(reach, rect(meshes))
        for (const key of pairs(A, B)) {
          const s = (spans[key] ||= { from: it.t, to: it.t, n: 0 })
          s.to = it.t
          s.n++
        }
      }
      // out and floating: where it is on screen through a whole turn (or rock), and where the Pebble is
      it.t = 1
      const yaw = it.target.yaw
      const out = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity }
      const full = it.cfg.spin === 'full'
      for (let k = 0; k < (full ? 24 : 5); k++) {
        if (full) it.spin = (k / 24) * Math.PI * 2
        else it.target.yaw = yaw + (k / 2 - 1) * 0.42
        settle()
        grow(out, rect(A))
      }
      it.target.yaw = yaw
      it.spin = 0
      const rest = rect(B)
      stage.home()
      settle()
      return { spans, reach, out, rest }
    },
    // hold one item part of the way out (for a photograph)
    hold(id, target, t) {
      stage.home()
      stage.show(id, target)
      stage.items[id].t = t
      settle()
    },
  }
}
