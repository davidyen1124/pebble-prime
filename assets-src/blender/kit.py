# Low-poly modelling kit for build_pebble.py. Everything here works in the page's own coordinates
# (Y up, +Z towards the viewer, metres); conversion to Blender's Z-up happens once, when a mesh is made.
import math
from mathutils import Vector, Matrix

TAU = math.pi * 2

# ── the Pebble's body profile (same egg as the page has always used) ─────────
BASE = 0.16
H = 1.9
R = 0.66


def body_r(a):
    return R * max(math.sin(a), 0.0) ** 0.62 * (1 + 0.14 * math.cos(a))


def body_y(a):
    return BASE + H * (1 - math.cos(a)) / 2


def radius_at(y):
    c = max(-1.0, min(1.0, 1 - 2 * (y - BASE) / H))
    return body_r(math.acos(c))


def surf(phi, y, off=0.0):
    r = radius_at(y) + off
    return Vector((math.sin(phi) * r, y, math.cos(phi) * r))


def surf_normal(phi, y):
    dy = 0.01
    slope = (radius_at(y + dy) - radius_at(y - dy)) / (2 * dy)
    return Vector((math.sin(phi), -slope, math.cos(phi))).normalized()


def surf_frame(phi, y, off=0.0):
    """4x4 placing local +Z along the outward normal and local +Y as upright as the slope allows."""
    n = surf_normal(phi, y)
    x = Vector((0, 1, 0)).cross(n).normalized()
    up = n.cross(x)
    m = Matrix((
        (x.x, up.x, n.x, 0),
        (x.y, up.y, n.y, 0),
        (x.z, up.z, n.z, 0),
        (0, 0, 0, 1),
    ))
    return Matrix.Translation(surf(phi, y, off)) @ m


# ── transforms ──────────────────────────────────────────────────────────────
def T(x=0, y=0, z=0):
    return Matrix.Translation(Vector((x, y, z)))


def RX(a):
    return Matrix.Rotation(a, 4, 'X')


def RY(a):
    return Matrix.Rotation(a, 4, 'Y')


def RZ(a):
    return Matrix.Rotation(a, 4, 'Z')


def S(x, y=None, z=None):
    y = x if y is None else y
    z = x if z is None else z
    return Matrix.Diagonal(Vector((x, y, z, 1)))


def euler(x, y, z):
    """three.js Euler order XYZ."""
    return RX(x) @ RY(y) @ RZ(z)


def srgb(h):
    return ((h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255)


# ── a bag of faces ──────────────────────────────────────────────────────────
class Geo:
    """Vertices and faces with per-face material, colour, shading and (optionally) label UVs."""

    def __init__(self):
        self.v = []
        self.f = []
        self.fa = []

    def add(self, shape, mat='plastic', color=0xffffff, smooth=True, m=None, uvs=None, density=200.0, ao=True):
        verts, faces = shape[0], shape[1]
        if uvs is None and len(shape) > 2:
            uvs = shape[2]
        col = srgb(color) if isinstance(color, int) else color
        o = len(self.v)
        for p in verts:
            p = Vector(p)
            self.v.append(m @ p if m is not None else p)
        flip = m is not None and m.to_3x3().determinant() < 0
        for i, face in enumerate(faces):
            idx = [o + k for k in face]
            uv = uvs[i] if uvs else None
            if flip:
                idx = idx[::-1]
                uv = uv[::-1] if uv else None
            self.f.append(tuple(idx))
            self.fa.append({'mat': mat, 'color': col, 'smooth': smooth, 'uv': uv, 'density': density, 'ao': ao})
        return self

    def merge(self, other, m=None):
        o = len(self.v)
        for p in other.v:
            self.v.append(m @ p if m is not None else p.copy())
        for face, fa in zip(other.f, other.fa):
            self.f.append(tuple(o + k for k in face))
            self.fa.append(dict(fa))
        return self

    def bounds(self):
        xs = [p.x for p in self.v]
        ys = [p.y for p in self.v]
        zs = [p.z for p in self.v]
        return Vector((min(xs), min(ys), min(zs))), Vector((max(xs), max(ys), max(zs)))

    def centre(self):
        a, b = self.bounds()
        return (a + b) / 2


# ── shapes: each returns (verts, faces) or (verts, faces, uvs) ──────────────
def lathe(profile, segs, phi0=0.0, phi_len=TAU):
    """Spin (r, y) points round the Y axis. r == 0 at either end becomes a single pole vertex."""
    closed = abs(phi_len - TAU) < 1e-6
    cols = segs if closed else segs + 1
    verts, faces, rows = [], [], []
    for r, y in profile:
        if r < 1e-6:
            rows.append([len(verts)])
            verts.append((0, y, 0))
        else:
            row = []
            for i in range(cols):
                phi = phi0 + phi_len * i / segs
                row.append(len(verts))
                verts.append((math.sin(phi) * r, y, math.cos(phi) * r))
            rows.append(row)
    for j in range(len(rows) - 1):
        lo, hi = rows[j], rows[j + 1]
        for i in range(segs):
            i2 = (i + 1) % cols if closed else i + 1
            if len(lo) == 1 and len(hi) == 1:
                continue
            if len(lo) == 1:
                faces.append((lo[0], hi[i2], hi[i]))
            elif len(hi) == 1:
                faces.append((lo[i], lo[i2], hi[0]))
            else:
                faces.append((lo[i], lo[i2], hi[i2], hi[i]))
    return verts, faces


def ellipsoid(rx, ry, rz, segs=8, rings=5):
    prof = [(math.sin(math.pi * j / rings), -math.cos(math.pi * j / rings)) for j in range(rings + 1)]
    prof[0] = (0, -1)
    prof[-1] = (0, 1)
    v, f = lathe(prof, segs)
    return [(x * rx, y * ry, z * rz) for x, y, z in v], f


def box(w, h, d):
    x, y, z = w / 2, h / 2, d / 2
    v = [(-x, -y, -z), (x, -y, -z), (x, y, -z), (-x, y, -z), (-x, -y, z), (x, -y, z), (x, y, z), (-x, y, z)]
    f = [(4, 5, 6, 7), (1, 0, 3, 2), (5, 1, 2, 6), (0, 4, 7, 3), (7, 6, 2, 3), (0, 1, 5, 4)]
    return v, f


def rounded_rect(w, d, c, n=1):
    """Outline in XZ, counter-clockwise seen from above, corners cut by c (n extra points per corner)."""
    x, z = w / 2, d / 2
    c = min(c, x, z)
    pts = []
    for cx, cz, a0 in ((x - c, z - c, 0), (-(x - c), z - c, 1), (-(x - c), -(z - c), 2), (x - c, -(z - c), 3)):
        for k in range(n + 1):
            a = (a0 + k / n) * math.pi / 2 if n else a0 * math.pi / 2
            pts.append((cx + c * math.cos(a), cz + c * math.sin(a)))
    return pts


def circle(r, n, rz=None):
    rz = r if rz is None else rz
    return [(r * math.cos(TAU * i / n), rz * math.sin(TAU * i / n)) for i in range(n)]


def loft(outline, levels, cap_bottom=True, cap_top=True):
    """Stack an XZ outline at several heights: levels = [(y, scale_x, scale_z[, dx, dz]), ...]."""
    n = len(outline)
    verts, faces = [], []
    # outlines here run counter-clockwise seen from above (+Y); side quads must face outwards
    for lv in levels:
        y, sx, sz = lv[0], lv[1], lv[2]
        dx, dz = (lv[3], lv[4]) if len(lv) > 3 else (0, 0)
        for px, pz in outline:
            verts.append((px * sx + dx, y, pz * sz + dz))
    for j in range(len(levels) - 1):
        for i in range(n):
            a = j * n + i
            b = j * n + (i + 1) % n
            faces.append((b, a, a + n, b + n))
    if cap_bottom:
        faces.append(tuple(range(n)))
    if cap_top:
        o = (len(levels) - 1) * n
        faces.append(tuple(o + i for i in reversed(range(n))))
    return verts, faces


def prism(outline, y0, y1, **kw):
    return loft(outline, [(y0, 1, 1), (y1, 1, 1)], **kw)


def cyl(r0, r1, h, segs=8, caps=True):
    """Along Y, centred. r0 at the bottom."""
    o = circle(1.0, segs)
    return loft(o, [(-h / 2, r0, r0), (h / 2, r1, r1)], cap_bottom=caps, cap_top=caps)


def cone(r, h, segs=6):
    v = [(r * math.cos(TAU * i / segs), 0, r * math.sin(TAU * i / segs)) for i in range(segs)] + [(0, h, 0)]
    f = [((i + 1) % segs, i, segs) for i in range(segs)] + [tuple(range(segs))]
    return v, f


def tube(points, radius, sides=4, closed=False, caps=True, up=(0, 1, 0), scale=(1, 1), twist=0.0):
    """Sweep a polygon along a polyline. `scale` stretches the section along (up, side)."""
    pts = [Vector(p) for p in points]
    n = len(pts)
    up = Vector(up).normalized()
    verts, faces = [], []
    for i, p in enumerate(pts):
        if closed:
            t = (pts[(i + 1) % n] - pts[i - 1]).normalized()
        elif i == 0:
            t = (pts[1] - pts[0]).normalized()
        elif i == n - 1:
            t = (pts[-1] - pts[-2]).normalized()
        else:
            t = (pts[i + 1] - pts[i - 1]).normalized()
        a = up - t * up.dot(t)
        if a.length < 1e-5:
            a = Vector((1, 0, 0)) - t * t.x
        a.normalize()
        b = t.cross(a).normalized()
        r = radius(i / max(1, n - 1)) if callable(radius) else radius
        for k in range(sides):
            ang = twist + TAU * (k + 0.5) / sides
            verts.append(tuple(p + a * (math.cos(ang) * r * scale[0]) + b * (math.sin(ang) * r * scale[1])))
    rings = n if closed else n - 1
    for i in range(rings):
        i2 = (i + 1) % n
        for k in range(sides):
            k2 = (k + 1) % sides
            faces.append((i * sides + k, i * sides + k2, i2 * sides + k2, i2 * sides + k))
    if caps and not closed:
        faces.append(tuple(reversed(range(sides))))
        faces.append(tuple((n - 1) * sides + k for k in range(sides)))
    return verts, faces


def arc_points(r, n, a0=0.0, a1=TAU, plane='xz', rz=None):
    rz = r if rz is None else rz
    out = []
    for i in range(n + 1):
        a = a0 + (a1 - a0) * i / n
        c, s = math.cos(a), math.sin(a)
        out.append({'xz': (r * c, 0, rz * s), 'xy': (r * c, rz * s, 0), 'yz': (0, rz * s, r * c)}[plane])
    return out


def ring(r, n=10, radius=0.01, sides=4, plane='xz', rz=None, scale=(1, 1)):
    pts = arc_points(r, n, plane=plane, rz=rz)[:-1]
    up = {'xz': (0, 1, 0), 'xy': (0, 0, 1), 'yz': (1, 0, 0)}[plane]
    return tube(pts, radius, sides, closed=True, up=up, scale=scale)


def label_uv(atlas, name, flip_x=False, rot=0):
    """Corner UVs (bottom-left, bottom-right, top-right, top-left) of a label on the sheet."""
    a = atlas['labels'][name]
    s = atlas['size']
    e = 0.04
    x0, x1 = (a['x'] + e) / s, (a['x'] + a['w'] - e) / s
    y0, y1 = 1 - (a['y'] + a['h'] - e) / s, 1 - (a['y'] + e) / s
    uv = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    if flip_x:
        uv = [uv[1], uv[0], uv[3], uv[2]]
    for _ in range(rot):
        uv = uv[1:] + uv[:1]
    return uv


def slab(w, h, t, front=None, back=None):
    """A thin card in the XY plane facing +Z. `front` / `back` are label corner UVs; edges get none."""
    v, f = box(w, h, t)
    uvs = [None] * 6
    uvs[0] = front
    uvs[1] = back
    return v, f, uvs


def quad(w, h, uv):
    x, y = w / 2, h / 2
    return [(-x, -y, 0), (x, -y, 0), (x, y, 0), (-x, y, 0)], [(0, 1, 2, 3)], [uv]


def disc(r, n=10, rz=None, uv_rect=None):
    """Flat n-gon in the XY plane facing +Z; with uv_rect the label is mapped across its bounding square."""
    rz = r if rz is None else rz
    v = [(r * math.cos(TAU * i / n), rz * math.sin(TAU * i / n), 0) for i in range(n)]
    uv = None
    if uv_rect:
        (u0, v0), (u1, _), (_, v1), _ = uv_rect
        uv = [[(u0 + (u1 - u0) * (0.5 + 0.5 * math.cos(TAU * i / n)), v0 + (v1 - v0) * (0.5 + 0.5 * math.sin(TAU * i / n))) for i in range(n)]]
    return v, [tuple(range(n))], uv


def surf_ribbon(path, width, off=0.02, thick=0.014, segs=10, cols=1):
    """A strap laid on the body along (phi, y) points. Returns outer face UVs running 0..1 across and along."""
    def at(t):
        f = t * (len(path) - 1)
        i = min(int(f), len(path) - 2)
        k = f - i
        return (path[i][0] + (path[i + 1][0] - path[i][0]) * k, path[i][1] + (path[i + 1][1] - path[i][1]) * k)

    verts, faces, uvs = [], [], []
    rows = []
    for j in range(segs + 1):
        t = j / segs
        phi, y = at(t)
        p = surf(phi, y, off)
        phi2, y2 = at(min(1, t + 0.01))
        phi0, y0 = at(max(0, t - 0.01))
        tan = (surf(phi2, y2, off) - surf(phi0, y0, off)).normalized()
        n = surf_normal(phi, y)
        b = n.cross(tan).normalized()
        w = (width(t) if callable(width) else width) / 2
        outer, inner = [], []
        for c in range(cols + 1):
            s = -w + 2 * w * c / cols
            outer.append(len(verts))
            verts.append(tuple(p + b * s + n * thick))
        for c in range(cols + 1):
            s = -w + 2 * w * c / cols
            inner.append(len(verts))
            verts.append(tuple(p + b * s))
        rows.append((outer, inner, t))
    for j in range(segs):
        (o0, i0, t0), (o1, i1, t1) = rows[j], rows[j + 1]
        for c in range(cols):
            faces.append((o0[c + 1], o0[c], o1[c], o1[c + 1]))
            uvs.append([((c + 1) / cols, t0), (c / cols, t0), (c / cols, t1), ((c + 1) / cols, t1)])
            faces.append((i0[c], i0[c + 1], i1[c + 1], i1[c]))
            uvs.append(None)
        faces.append((o0[0], i0[0], i1[0], o1[0]))
        uvs.append(None)
        faces.append((i0[cols], o0[cols], o1[cols], i1[cols]))
        uvs.append(None)
    o, i, _ = rows[0]
    faces.append(tuple(o) + tuple(reversed(i)))
    uvs.append(None)
    o, i, _ = rows[-1]
    faces.append(tuple(i) + tuple(reversed(o)))
    uvs.append(None)
    return verts, faces, uvs


def remap_uv(uvs, rect):
    """Squeeze 0..1 ribbon UVs into a label's rectangle on the sheet."""
    (u0, v0), (u1, _), (_, v1), _ = rect
    out = []
    for uv in uvs:
        out.append(None if uv is None else [(u0 + (u1 - u0) * a, v1 + (v0 - v1) * b) for a, b in uv])
    return out
