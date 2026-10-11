# Builds the Pebble and its sixteen accessories as low-poly meshes and writes public/models/pebble.glb.
#
#   /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
#       --python blender/build_pebble.py -- public/models/pebble.glb
#
# The look is an old 3D adventure game: few polygons, small pixel textures, lighting baked into the
# vertices. Every accessory is its own object with its own pivot, so the page can lift it off the
# Pebble, enlarge it and put it back. Run `node scripts/textures.mjs` first: it draws the textures.
import bpy
import bmesh
import json
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from kit import *  # noqa: E402,F403
from mathutils import Vector, Matrix  # noqa: E402
from mathutils.bvhtree import BVHTree  # noqa: E402

TEX = os.path.join(HERE, 'tex')
ATLAS = json.load(open(os.path.join(TEX, 'atlas.json')))
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else os.path.join(HERE, '..', 'public', 'models', 'pebble.glb'))

SKIN = 0x5d92e6
NAVY = 0x1c2a4f
INK = 0x10162b
GOLD = 0xd9a441
CREAM = 0xf3eadb
WHITE = 0xe6e1d6
TERRACOTTA = 0xc9583a
TRIM = 0x8f3a24
LEATHER = 0x7b4a27
LEATHER_DARK = 0x54301a
TEAL = 0x3faea6
RUBBER = 0x1a1d26
STEEL = 0xc9ced6
SHELL = 0xd8d3c9
GLASS = (0.80, 0.92, 1.0)


def L(name, **kw):
    return label_uv(ATLAS, name, **kw)


OBJECTS = []  # (name, Geo, pivot, parent, extras, occluders)


def obj(name, geo, pivot=None, parent=None, occluders=(), **extras):
    OBJECTS.append({'name': name, 'geo': geo, 'pivot': Vector(pivot) if pivot is not None else geo.centre(), 'parent': parent, 'extras': extras, 'occluders': occluders})


def basis(x, y, z):
    return Matrix(((x.x, y.x, z.x, 0), (x.y, y.y, z.y, 0), (x.z, y.z, z.z, 0), (0, 0, 0, 1)))


# ════════════════════════════════════════════════════════════════════════════
# The Pebble
# ════════════════════════════════════════════════════════════════════════════
SEG = 16
RINGS = 12


def egg(segs=SEG, rings=RINGS):
    prof = [(body_r(math.pi * j / rings), body_y(math.pi * j / rings)) for j in range(rings + 1)]
    prof[0] = (0, body_y(0))
    prof[-1] = (0, body_y(math.pi))
    return lathe(prof, segs)


def limb(sides=7):
    """An arm hanging from its shoulder at the origin: upper arm, then a round hand."""
    g = Geo()
    g.add(lathe([(0, -0.38), (0.085, -0.36), (0.112, -0.3), (0.112, 0.0), (0.085, 0.08), (0, 0.12)], sides), 'skin', SKIN)
    g.add(ellipsoid(0.128, 0.138, 0.128, sides, 5), 'skin', SKIN, m=T(0, -0.42, 0))
    return g


def limb_shape(sides):
    g = limb(sides)
    return g.v, g.f


body = Geo()
body.add(egg(), 'skin', SKIN)
for side in (-1, 1):
    # the little feet Pebbles really have; the sneakers go over them
    body.add(ellipsoid(0.072, 0.1, 0.105, 7, 4), 'skin', 0x24345e, m=T(side * 0.3, 0, 0.25) @ RY(side * 0.24) @ T(0, 0.11, -0.09))
obj('body', body, pivot=(0, 0, 0))

for side, name in ((-1, 'eye_r'), (1, 'eye_l')):
    g = Geo()
    m = surf_frame(side * 0.4, 1.56, 0.016)
    g.add(disc(0.047, 8, rz=0.076), 'plastic', INK, smooth=False, m=m, ao=False)
    g.add(disc(0.012, 4), 'plastic', 0xffffff, smooth=False, m=m @ T(-0.014, 0.032, 0.004), ao=False)
    obj(name, g, pivot=surf(side * 0.4, 1.56, 0.016), parent='body', kind='eye')

SHOULDER = {s: Vector((s * (radius_at(1.04) - 0.07), 1.04, 0.02)) for s in (-1, 1)}
POSE = {-1: euler(-1.32, 0, -0.34), 1: euler(-1.12, 0, 0.56)}  # right holds the glass up, left shows the watch
ARM = {s: T(*SHOULDER[s]) @ POSE[s] for s in (-1, 1)}
for side, name in ((-1, 'arm_r'), (1, 'arm_l')):
    g = Geo().merge(limb(), ARM[side])
    obj(name, g, pivot=SHOULDER[side], parent='body', occluders=('body',), kind='arm')


# ════════════════════════════════════════════════════════════════════════════
# 16  Sneakers
# ════════════════════════════════════════════════════════════════════════════
def shoe(side):
    g = Geo()
    half = [(0.09, -0.235), (0.14, -0.16), (0.155, -0.02), (0.15, 0.16), (0.125, 0.3), (0.07, 0.375)]
    outline = half + [(0, 0.39)] + [(-x, z) for x, z in reversed(half)] + [(0, -0.25)]
    g.add(prism(outline, 0, 0.032), 'rubber', 0xc48a4f, smooth=False)
    g.add(loft(outline, [(0.032, 1.02, 1.01), (0.085, 1.02, 1.01)]), 'rubber', 0xefeadf, smooth=False)
    g.add(loft(outline, [(0.05, 1.028, 1.016), (0.06, 1.028, 1.016)], cap_bottom=False, cap_top=False), 'rubber', NAVY, smooth=False)
    # the upper: arches across the foot, heel to toe
    zs = [-0.235, -0.14, -0.03, 0.09, 0.2, 0.3, 0.365]
    ws = [0.085, 0.135, 0.148, 0.145, 0.13, 0.1, 0.05]
    hs = [0.115, 0.135, 0.125, 0.085, 0.06, 0.045, 0.025]
    y0 = 0.085
    K = 5
    grid = [[(ws[j] * math.cos(math.pi * k / (K - 1)), y0 + hs[j] * math.sin(math.pi * k / (K - 1)), zs[j]) for k in range(K)] for j in range(len(zs))]
    verts = [p for row in grid for p in row]
    upper, toe, stripe = [], [], []
    for j in range(len(zs) - 1):
        for k in range(K - 1):
            if j < 2 and k in (1, 2):
                continue  # the opening the foot goes into
            face = (j * K + k, j * K + k + 1, (j + 1) * K + k + 1, (j + 1) * K + k)
            outer = (k == 0) if side > 0 else (k == K - 2)
            (toe if j >= 4 else stripe if (outer and j in (1, 2)) else upper).append(face)
    for faces, mat, col in ((upper, 'leather', WHITE), (toe, 'rubber', 0xd4cfc4), (stripe, 'leather', SKIN)):
        if faces:
            g.add((verts, faces), mat, col)
    g.add((verts, [tuple(reversed(range(K)))]), 'leather', NAVY, smooth=False)  # heel
    g.add((verts, [tuple((len(zs) - 1) * K + k for k in range(K))]), 'rubber', 0xd4cfc4, smooth=False)  # toe tip
    # padded collar round the opening
    rim = [grid[0][1], grid[0][2], grid[0][3], grid[1][3], grid[2][3], grid[2][2], grid[2][1], grid[1][1]]
    g.add(tube([(x * 0.98, y + 0.004, z) for x, y, z in rim], 0.017, 4, closed=True), 'fabric', NAVY)
    # laces
    for i, z in enumerate((0.0, 0.05, 0.1, 0.15)):
        h = y0 + hs[2] + (hs[3] - hs[2]) * min(1, max(0, (z + 0.03) / 0.12)) if z < 0.09 else y0 + hs[3] + (hs[4] - hs[3]) * (z - 0.09) / 0.11
        for d in (-1, 1):
            g.add(box(0.105, 0.011, 0.014), 'fabric', NAVY, smooth=False, m=T(0, h + 0.004, z) @ RX(0.33) @ RY(d * 0.42))
    return g


sneakers = Geo()
for side in (-1, 1):
    sneakers.merge(shoe(side), T(side * 0.3, 0, 0.25) @ RY(side * 0.24))
obj('acc_sneakers', sneakers, pivot=(0, 0.12, 0.3), id='sneakers')

# ════════════════════════════════════════════════════════════════════════════
# 2  Cap, with 3 tickets and 6 pencil tucked into it
# ════════════════════════════════════════════════════════════════════════════
CAP = T(0, 1.69, 0) @ euler(-0.11, 0, 0.025)
cap = Geo()
dome = [(math.cos(e) * 0.535, math.sin(e) * 0.535 * 0.8) for e in (0, 0.4, 0.78, 1.12, 1.4)] + [(0, 0.535 * 0.8)]
cap.add(lathe(dome, 12), 'fabric', NAVY, m=CAP @ S(1, 1, 1.03))
cap.add(lathe([(0.55, -0.004), (0.548, 0.05)], 12), 'fabric', 0x2a3a66, m=CAP @ S(1, 1, 1.03), smooth=True)
cap.add(lathe([(0, 0.0), (0.55, -0.004)], 12), 'fabric', 0x121a33, m=CAP @ S(1, 1, 1.03) @ T(0, 0.0, 0), smooth=False)  # closed underneath
cap.add(ellipsoid(0.032, 0.016, 0.032, 6, 3), 'fabric', 0x2a3a66, m=CAP @ T(0, 0.43, 0))
# brim
A0 = math.radians(58)
COLS, ROWS = 6, 2
top, bot = [], []
for i in range(COLS + 1):
    a = -A0 + 2 * A0 * i / COLS
    reach = 0.42 * max(0.0, math.cos(a * 1.3)) ** 1.2
    rt, rb = [], []
    for j in range(ROWS + 1):
        r = 0.5 + reach * j / ROWS
        x, z = math.sin(a) * r, math.cos(a) * r * 1.03
        y = 0.05 - 0.11 * x * x - 0.04 * max(z - 0.3, 0) ** 2
        rt.append((x, y, z))
        rb.append((x, y - 0.028, z))
    top.append(rt)
    bot.append(rb)
bv = [p for col in top for p in col] + [p for col in bot for p in col]
N = (COLS + 1) * (ROWS + 1)
tix = lambda i, j: i * (ROWS + 1) + j  # noqa: E731
bf = []
for i in range(COLS):
    for j in range(ROWS):
        bf.append((tix(i, j), tix(i, j + 1), tix(i + 1, j + 1), tix(i + 1, j)))
        bf.append((N + tix(i + 1, j), N + tix(i + 1, j + 1), N + tix(i, j + 1), N + tix(i, j)))
    bf.append((tix(i, ROWS), N + tix(i, ROWS), N + tix(i + 1, ROWS), tix(i + 1, ROWS)))  # front edge
for j in range(ROWS):
    bf.append((tix(0, j), N + tix(0, j), N + tix(0, j + 1), tix(0, j + 1)))
    bf.append((tix(COLS, j + 1), N + tix(COLS, j + 1), N + tix(COLS, j), tix(COLS, j)))
cap.add((bv, bf), 'fabric', NAVY, m=CAP)
# the patch
el = 0.62
n = Vector((0, math.sin(el) / 0.8, math.cos(el) / 1.03)).normalized()
x = Vector((1, 0, 0))
PATCH = CAP @ T(0, math.sin(el) * 0.535 * 0.8, math.cos(el) * 0.535 * 1.03) @ basis(x, n.cross(x), n) @ T(0, 0, 0.014)
cap.add(quad(0.25, 0.172, L('cap_patch')), 'labels', 0xffffff, smooth=False, m=PATCH, ao=False)
obj('acc_cap', cap, pivot=CAP @ Vector((0, 0.2, 0.12)), id='cap')

tickets = Geo()
a = 0.92
FAN = CAP @ T(math.sin(a) * 0.585, 0.0, math.cos(a) * 0.585 * 1.03) @ RY(a) @ RX(-0.34)
for i in range(3):
    uv = L(f'ticket_{i + 1}')
    tickets.add(slab(0.15, 0.3, 0.006, front=uv, back=uv), 'labels', 0xffffff, smooth=False, m=FAN @ T((i - 1) * 0.012, 0, i * 0.008) @ RZ((i - 1) * -0.26) @ T(0, 0.12, 0))
obj('acc_tickets', tickets, parent='acc_cap', id='tickets')

pencil = Geo()
PEN = T(-0.584, 1.752, 0.12) @ euler(math.pi / 2 - 0.2, 0, 0.07)
pencil.add(cyl(0.022, 0.022, 0.44, 6), 'plastic', 0xf2b824, smooth=False, m=PEN)
pencil.add(cyl(0.0245, 0.0245, 0.046, 6), 'metal', 0xb9c0c8, smooth=False, m=PEN @ T(0, -0.243, 0))
pencil.add(cyl(0.02, 0.022, 0.05, 6), 'rubber', 0xe98b93, smooth=False, m=PEN @ T(0, -0.291, 0))
pencil.add(cone(0.022, 0.078, 6), 'wood', 0xe2bf8e, smooth=False, m=PEN @ T(0, 0.22, 0))
pencil.add(cone(0.009, 0.032, 5), 'plastic', 0x1c1c1f, smooth=False, m=PEN @ T(0, 0.268, 0))
obj('acc_pencil', pencil, parent='acc_cap', id='pencil')

# ════════════════════════════════════════════════════════════════════════════
# 1  Round glasses
# ════════════════════════════════════════════════════════════════════════════
glasses = Geo()
for side in (-1, 1):
    m = surf_frame(side * 0.4, 1.56, 0.05)
    glasses.add(ring(0.108, 10, 0.011, 4, plane='xy'), 'metal', GOLD, m=m)
    glasses.add(disc(0.1, 10), 'glass', GLASS, smooth=False, m=m, ao=False)
    glasses.add(disc(0.1, 10), 'glass', GLASS, smooth=False, m=m @ RY(math.pi), ao=False)
    glasses.add(box(0.022, 0.02, 0.02), 'metal', GOLD, smooth=False, m=m @ T(side * 0.12, 0.012, -0.004))
    glasses.add(tube([surf(side * p, y, o) for p, y, o in ((0.61, 1.575, 0.052), (0.8, 1.578, 0.04), (0.95, 1.576, 0.034), (1.1, 1.57, 0.03))], 0.007, 4), 'metal', GOLD)
glasses.add(tube([surf(p, y, o) for p, y, o in ((-0.215, 1.588, 0.056), (-0.1, 1.607, 0.07), (0, 1.612, 0.074), (0.1, 1.607, 0.07), (0.215, 1.588, 0.056))], 0.008, 4), 'metal', GOLD)
obj('acc_glasses', glasses, pivot=(0, 1.56, radius_at(1.56) + 0.06), id='glasses')

# ════════════════════════════════════════════════════════════════════════════
# 4  Headset
# ════════════════════════════════════════════════════════════════════════════
headset = Geo()
band = [(math.cos(t) * 0.672, 1.5 + math.sin(t) * 0.695, 0) for t in (0.19 + (math.pi - 0.38) * i / 14 for i in range(15))]
headset.add(tube(band, 0.02, 4, up=(0, 0, 1), scale=(2.6, 1)), 'plastic', SHELL)
pad = [(x * 0.975, 1.5 + (y - 1.5) * 0.985 + 0.02, 0) for x, y, _ in band[4:11]]
headset.add(tube(pad, 0.03, 4, up=(0, 0, 1), scale=(2.1, 1)), 'rubber', RUBBER)
for side in (-1, 1):
    m = T(side * 0.662, 1.5, 0) @ RZ(side * -math.pi / 2)  # local +Y points away from the head
    headset.add(cyl(0.145, 0.145, 0.045, 8), 'rubber', RUBBER, m=m @ T(0, -0.01, 0))
    headset.add(cyl(0.14, 0.128, 0.06, 8), 'plastic', SHELL, m=m @ T(0, 0.042, 0))
    headset.add(cyl(0.128, 0.1, 0.024, 8), 'plastic', SHELL, m=m @ T(0, 0.084, 0))
    headset.add(cyl(0.104, 0.104, 0.006, 8), 'metal', GOLD, smooth=False, m=m @ T(0, 0.098, 0))
    headset.add(cyl(0.052, 0.052, 0.008, 6), 'plastic', SKIN, smooth=False, m=m @ T(0, 0.104, 0))
    headset.add(box(0.03, 0.2, 0.05), 'plastic', SHELL, smooth=False, m=T(side * 0.692, 1.61, 0) @ RZ(side * 0.17))
boom = [(0.73, 1.43, 0.09), (0.7, 1.375, 0.27), (0.615, 1.35, 0.45), (0.525, 1.345, 0.565)]  # ends by the cheek, clear of the collar
headset.add(tube(boom, 0.01, 4), 'rubber', RUBBER)
headset.add(ellipsoid(0.056, 0.044, 0.044, 6, 4), 'fabric', 0x23262f, m=T(0.48, 1.345, 0.6) @ RY(0.72))
obj('acc_headset', headset, pivot=(0, 1.72, 0), id='headset')

# ════════════════════════════════════════════════════════════════════════════
# 7  Tie
# ════════════════════════════════════════════════════════════════════════════
tie = Geo()
lerp = lambda a, b, t: a + (b - a) * t  # noqa: E731
for side in (-1, 1):
    wing = surf_ribbon([(side * 0.04, 1.27), (side * 0.17, 1.296), (side * 0.33, 1.318), (side * 0.47, 1.33)], lambda t: lerp(0.105, 0.03, t ** 1.1), off=0.028, thick=0.014, segs=5)
    tie.add((wing[0], wing[1]), 'fabric', 0xcfc9bc)
blade = lambda t: lerp(0.075, 0.185, (t / 0.86) ** 0.9) if t < 0.86 else lerp(0.185, 0.006, ((t - 0.86) / 0.14) ** 1.05)  # noqa: E731
bl = surf_ribbon([(0, 1.235), (0, 1.1), (0, 0.95), (0, 0.82), (0, 0.71)], blade, off=0.03, thick=0.016, segs=8, cols=2)
tie.add((bl[0], bl[1]), 'labels', 0xffffff, uvs=remap_uv(bl[2], L('tie')))
tie.add(loft(rounded_rect(0.1, 0.05, 0.012, n=0), [(-0.0425, 0.72, 1), (0.0425, 1.12, 1)]), 'fabric', NAVY, smooth=False, m=surf_frame(0, 1.262, 0.04))
tie.add(box(0.15, 0.017, 0.014), 'metal', GOLD, smooth=False, m=surf_frame(0, 1.0, 0.056))
obj('acc_tie', tie, pivot=surf(0, 1.02, 0.07), id='tie')

# ════════════════════════════════════════════════════════════════════════════
# 8  Wristwatch (on the left arm)
# ════════════════════════════════════════════════════════════════════════════
watch = Geo()
WA = 0.85
d = Vector((math.sin(WA), 0, math.cos(WA)))
FACE = ARM[1] @ T(0, -0.32, 0) @ T(*(d * 0.146)) @ basis(Vector((0, 1, 0)).cross(d), Vector((0, 1, 0)), d)
watch.add(ring(0.134, 8, 0.016, 4, plane='xz', scale=(3.2, 1)), 'leather', LEATHER_DARK, m=ARM[1] @ T(0, -0.32, 0))
watch.add(cyl(0.076, 0.072, 0.03, 10), 'metal', GOLD, m=FACE @ RX(math.pi / 2))
watch.add(disc(0.064, 10, uv_rect=L('watch')), 'labels', 0xffffff, smooth=False, m=FACE @ T(0, 0, 0.0156), ao=False)
watch.add(box(0.016, 0.018, 0.018), 'metal', GOLD, smooth=False, m=FACE @ T(0.084, 0, 0))
obj('acc_watch', watch, pivot=ARM[1] @ Vector((0, -0.32, 0)), parent='arm_l', id='watch')  # pivot on the arm's axis, so the strap can widen evenly
AXIS = (FACE.to_3x3() @ Vector((0, 0, 1))).normalized()
for nm, ln, wd, z, col in (('h', 0.034, 0.008, 0.019, NAVY), ('m', 0.05, 0.006, 0.0232, NAVY), ('s', 0.056, 0.003, 0.0274, TERRACOTTA)):
    g = Geo()
    g.add(box(wd, ln, 0.003), 'plastic', col, smooth=False, m=FACE @ T(0, ln / 2 - ln * 0.12, z), ao=False)
    obj(f'watch_hand_{nm}', g, pivot=FACE @ Vector((0, 0, z)), parent='acc_watch', kind='hand', axis=[AXIS.x, AXIS.y, AXIS.z])

# ════════════════════════════════════════════════════════════════════════════
# 9  Walkie-talkie
# ════════════════════════════════════════════════════════════════════════════
walkie = Geo()
WK = surf_frame(0.635, 1.04, 0.064) @ RZ(-0.08)
walkie.add(loft(rounded_rect(0.108, 0.052, 0.014), [(-0.095, 1, 1), (0.095, 1, 1)]), 'plastic', 0x2a2d35, smooth=False, m=WK)
walkie.add(quad(0.094, 0.165, L('walkie')), 'labels', 0xffffff, smooth=False, m=WK @ T(0, -0.004, 0.0275), ao=False)
walkie.add(cyl(0.012, 0.009, 0.12, 5), 'rubber', RUBBER, m=WK @ T(0.03, 0.155, 0))
walkie.add(cyl(0.016, 0.016, 0.026, 6), 'metal', 0x4a4e58, smooth=False, m=WK @ T(-0.028, 0.108, 0))
walkie.add(box(0.012, 0.06, 0.03), 'plastic', 0xe2632e, smooth=False, m=WK @ T(-0.058, 0.02, 0))
obj('acc_walkie', walkie, pivot=WK @ Vector((0, 0.02, 0)), id='walkie')

# ════════════════════════════════════════════════════════════════════════════
# 10  Backpack, with 11 the helper sitting on it and 5 the price tag hanging off it
# ════════════════════════════════════════════════════════════════════════════
PACK = T(0, 0.99, -(radius_at(1.0) + 0.16)) @ RY(math.pi)  # local +Z points away from the Pebble
pack = Geo()
shell = rounded_rect(0.68, 0.3, 0.07)
pack.add(loft(shell, [(-0.36, 0.88, 0.88), (-0.3, 1, 1), (0.26, 1, 1), (0.34, 0.95, 0.93)]), 'fabric', TERRACOTTA, m=PACK)
pack.add(loft(shell, [(0.341, 0.86, 0.8), (0.343, 0.86, 0.8)], cap_bottom=False), 'fabric', 0x1b0f0b, smooth=False, m=PACK, ao=False)
pack.add(loft(rounded_rect(0.48, 0.1, 0.035), [(-0.15, 0.94, 0.9), (-0.12, 1, 1), (0.11, 1, 1), (0.15, 0.95, 0.9)]), 'fabric', TRIM, m=PACK @ T(0, -0.15, 0.17))
pack.add(quad(0.3, 0.068, L('pack_label')), 'labels', 0xffffff, smooth=False, m=PACK @ T(0, -0.16, 0.2225), ao=False)
pack.add(box(0.36, 0.012, 0.008), 'rubber', 0x2a1712, smooth=False, m=PACK @ T(0, 0.06, 0.153))
pack.add(box(0.016, 0.05, 0.01), 'metal', GOLD, smooth=False, m=PACK @ T(0.17, 0.04, 0.156) @ RZ(0.2))
for sx in (-1, 1):
    pack.add(loft(rounded_rect(0.1, 0.2, 0.03), [(-0.14, 0.9, 0.9), (-0.11, 1, 1), (0.1, 1, 1), (0.13, 0.95, 0.95)]), 'fabric', TRIM, m=PACK @ T(sx * 0.37, -0.18, 0))
pack.add(tube([(-0.1, 0.34, -0.12), (-0.07, 0.42, -0.12), (0.07, 0.42, -0.12), (0.1, 0.34, -0.12)], 0.012, 4), 'leather', LEATHER_DARK, m=PACK)
# what is inside: four folders
for i, (col, tabw, tx) in enumerate(((0xe9c46a, 0.13, -0.12), (0x8fb7e8, 0.15, 0.0), (0xe8a08f, 0.16, 0.1), (0xa8cfa0, 0.15, -0.09))):
    f = PACK @ T(-0.07 + (i - 1.5) * 0.01, 0.27, 0.07 - i * 0.045) @ RX(-0.06 + i * 0.015)
    pack.add(box(0.4, 0.26, 0.012), 'paper', col, smooth=False, m=f @ T(0, 0.05, 0))
    uv = L(f'tab_{i}')
    pack.add(slab(tabw, 0.05, 0.012, front=uv, back=uv), 'labels', 0xffffff, smooth=False, m=f @ T(tx, 0.203, 0), ao=False)
obj('acc_backpack', pack, pivot=PACK @ Vector((0, 0.03, 0.02)), id='backpack')

HELP = PACK @ T(0.265, 0.345, 0.03) @ RY(0.35) @ S(0.19) @ T(0, -BASE, 0)
helper = Geo()
helper.add(egg(10, 8), 'skin', TEAL, m=HELP)
for side in (-1, 1):
    m = HELP @ surf_frame(side * 0.42, 1.5, 0.02)
    helper.add(disc(0.055, 6, rz=0.09), 'plastic', INK, smooth=False, m=m, ao=False)
helper.add(limb_shape(5), 'skin', TEAL, m=HELP @ T(-(radius_at(1.04) - 0.07), 1.04, 0.02) @ euler(0.1, 0, -0.5))
helper.add(cone(0.27, 0.52, 6), 'paper', 0xf2b824, smooth=False, m=HELP @ T(0.04, 1.98, 0) @ RZ(-0.12))
helper.add(ellipsoid(0.075, 0.075, 0.075, 5, 3), 'fabric', 0xfaf7f1, m=HELP @ T(0.1, 2.5, 0))
obj('acc_helper', helper, pivot=HELP @ Vector((0, 1.15, 0)), parent='acc_backpack', id='helper')
wave = Geo()
WAVE_PIVOT = HELP @ Vector((radius_at(1.04) - 0.07, 1.04, 0.02))
wave.add(limb_shape(5), 'skin', TEAL, m=HELP @ T(radius_at(1.04) - 0.07, 1.04, 0.02) @ euler(0, 0, 2.5))
obj('helper_arm', wave, pivot=WAVE_PIVOT, parent='acc_helper', kind='wave')

price = Geo()
uv = L('price')
TAG = PACK @ T(-0.44, -0.13, 0.0) @ RY(-math.pi / 2 - 0.2)
price.add(slab(0.2, 0.28, 0.008, front=uv, back=uv), 'labels', 0xffffff, smooth=False, m=TAG)
price.add(tube([PACK @ Vector(p) for p in ((-0.33, 0.3, 0.0), (-0.4, 0.2, 0.0), (-0.436, 0.06, 0.0), (-0.44, -0.02, 0.0))], 0.004, 3), 'paper', 0xf3ead9)
obj('acc_price', price, pivot=PACK @ Vector((-0.44, 0.0, 0.0)), parent='acc_backpack', id='price-tag')

# ════════════════════════════════════════════════════════════════════════════
# 12  Magnifying glass (in the right hand)
# ════════════════════════════════════════════════════════════════════════════
mag = Geo()
MAG = ARM[-1] @ T(0, -0.44, 0.02) @ euler(-0.42, 0, 0.12)
along = RX(math.pi / 2)  # a cylinder built along Y, laid along the handle (local +Z)
mag.add(cyl(0.024, 0.02, 0.2, 6), 'wood', 0x5a341c, m=MAG @ T(0, 0, 0.1) @ along)
mag.add(ellipsoid(0.027, 0.027, 0.027, 6, 3), 'wood', 0x5a341c, m=MAG @ T(0, 0, -0.005))
mag.add(cyl(0.026, 0.018, 0.05, 6), 'metal', GOLD, m=MAG @ T(0, 0, 0.215) @ along)
mag.add(ring(0.14, 12, 0.016, 4, plane='xz'), 'metal', GOLD, m=MAG @ T(0, 0, 0.375))
for flip in (0, math.pi):
    mag.add(disc(0.128, 12), 'glass', GLASS, smooth=False, m=MAG @ T(0, 0, 0.375) @ RX(-math.pi / 2 + flip), ao=False)
obj('acc_magnifier', mag, pivot=MAG @ Vector((0, 0, 0.3)), parent='arm_r', id='magnifying-glass')

# ════════════════════════════════════════════════════════════════════════════
# 14  Tool belt, with 15 the key ring and 13 the receipt printer hanging off it
# ════════════════════════════════════════════════════════════════════════════
belt = Geo()
ro = lambda y: radius_at(y) + 0.03  # noqa: E731
ri = lambda y: radius_at(y) + 0.008  # noqa: E731
belt.add(lathe([(ro(0.44), 0.44), (ro(0.56), 0.56), (ri(0.56), 0.56), (ri(0.44), 0.44), (ro(0.44), 0.44)], SEG), 'leather', LEATHER, smooth=False)
BK = surf_frame(0, 0.5, 0.042)
for w, h, x, y in ((0.17, 0.022, 0, 0.065), (0.17, 0.022, 0, -0.065), (0.022, 0.15, 0.074, 0), (0.022, 0.15, -0.074, 0)):
    belt.add(box(w, h, 0.02), 'metal', GOLD, smooth=False, m=BK @ T(x, y, 0))
belt.add(box(0.1, 0.014, 0.014), 'metal', GOLD, smooth=False, m=BK @ T(0.025, 0, 0.006))


def pouch(phi, w, h, d, flap=True):
    m = surf_frame(phi, 0.455, 0.03 + d / 2)
    belt.add(loft(rounded_rect(w, d, min(w, d) * 0.25), [(-h / 2, 0.9, 0.9), (-h / 2 + 0.02, 1, 1), (h / 2, 1, 1)]), 'leather', LEATHER, m=m)
    if flap:
        belt.add(loft(rounded_rect(w + 0.012, d + 0.014, min(w, d) * 0.25), [(h * 0.08, 1, 1), (h * 0.5, 1, 1), (h * 0.56, 0.92, 0.9)]), 'leather', LEATHER_DARK, m=m)
        belt.add(box(0.022, 0.022, 0.01), 'metal', GOLD, smooth=False, m=m @ T(0, h * 0.16, d / 2 + 0.01))
    else:
        belt.add(loft(rounded_rect(w * 0.82, d * 0.6, 0.01), [(h / 2 - 0.002, 1, 1), (h / 2 + 0.001, 1, 1)], cap_bottom=False), 'leather', 0x2b160b, smooth=False, m=m, ao=False)
    return m


m = pouch(-0.4, 0.16, 0.15, 0.07, flap=False)  # mail
uv = L('envelope')
belt.add(slab(0.135, 0.095, 0.006, front=uv, back=uv), 'labels', 0xffffff, smooth=False, m=m @ T(-0.012, 0.1, 0.012) @ RZ(-0.12))
belt.add(slab(0.135, 0.095, 0.006, front=uv, back=uv), 'labels', 0xffffff, smooth=False, m=m @ T(0.01, 0.085, -0.008) @ RZ(0.1))
m = pouch(0.4, 0.15, 0.15, 0.07, flap=False)  # notes
uv = L('notebook')
belt.add(slab(0.105, 0.15, 0.022, front=uv, back=uv), 'labels', 0xffffff, smooth=False, m=m @ T(-0.012, 0.075, 0.0) @ RZ(0.07))
belt.add(cyl(0.008, 0.008, 0.15, 5), 'plastic', NAVY, m=m @ T(0.058, 0.085, 0.0))
belt.add(cyl(0.009, 0.009, 0.03, 5), 'metal', GOLD, m=m @ T(0.058, 0.165, 0.0))
m = pouch(1.8, 0.11, 0.16, 0.06)  # call recorder
uv = L('recorder')
belt.add(slab(0.062, 0.12, 0.018, front=uv, back=uv), 'labels', 0xffffff, smooth=False, m=m @ T(0, 0.11, 0.0))
m = pouch(-1.32, 0.16, 0.15, 0.06, flap=False)  # a folder from your Mac
uv = L('folder_front')
belt.add(slab(0.14, 0.16, 0.012, front=uv, back=uv), 'labels', 0xffffff, smooth=False, m=m @ T(0, 0.07, 0.0))
belt.add(box(0.06, 0.03, 0.012), 'paper', 0xe2bd6b, smooth=False, m=m @ T(-0.035, 0.163, 0.0))
obj('acc_belt', belt, pivot=(0, 0.5, 0), id='tool-belt')

keys = Geo()
KEY = surf_frame(1.25, 0.43, 0.05)
keys.add(ring(0.03, 8, 0.006, 4, plane='yz', rz=0.05), 'metal', STEEL, m=KEY @ T(0, 0.015, 0))
keys.add(ring(0.046, 10, 0.0045, 4, plane='xy'), 'metal', STEEL, m=KEY @ T(0, -0.085, 0))
REACH = (0.132, 0.084, 0.142, 0.084, 0.132)
for i in range(5):
    r = REACH[i]
    m = KEY @ T(0, -0.127, (0.004, 0.018, 0.004, 0.018, 0.004)[i]) @ RZ((i - 2) * 0.43)
    uv = L(f'key_{i}')
    keys.add(box(0.005, r - 0.02, 0.005), 'metal', STEEL, smooth=False, m=m @ T(0, -(r - 0.02) / 2, 0))
    keys.add(slab(0.072, 0.047, 0.012, front=uv, back=uv), 'labels', 0xffffff, smooth=False, m=m @ T(0, -r, 0))
    keys.add(box(0.015, 0.07, 0.0045), 'metal', STEEL, smooth=False, m=m @ T(0, -r - 0.056, 0))
    for j in range(3):
        keys.add(box(0.009 + ((i + j) % 3) * 0.004, 0.011, 0.0045), 'metal', STEEL, smooth=False, m=m @ T(0.0105, -r - 0.042 - j * 0.018, 0))
obj('acc_keys', keys, pivot=KEY @ Vector((0, 0.05, 0)), parent='acc_belt', id='key-ring')

receipt = Geo()
RC = surf_frame(-0.86, 0.47, 0.03 + 0.05)
receipt.add(loft(rounded_rect(0.16, 0.1, 0.02), [(-0.06, 1, 1), (0.06, 1, 1)]), 'plastic', 0xcfcabf, smooth=False, m=RC)
receipt.add(box(0.125, 0.012, 0.03), 'rubber', RUBBER, smooth=False, m=RC @ T(0, 0.058, 0.02))
receipt.add(box(0.012, 0.012, 0.006), 'plastic', 0x4dff7a, smooth=False, m=RC @ T(0.058, 0.02, 0.052), ao=False)
NS = 14
W2 = 0.058
pv, pf, puv = [], [], []
(u0, v0), (u1, _), (_, v1), _ = L('receipt')
for i in range(NS + 1):
    s = i / NS
    y = 0.064 + 0.02 * math.sin(min(s * 9, math.pi)) - 0.46 * s ** 1.25
    z = 0.03 + 0.085 * (1 - math.exp(-9 * s)) + 0.02 * math.sin(s * 6.5) + max(0.0, s - 0.8) ** 2 * 2.2
    sway = math.sin(s * 3) * 0.012 * s
    pv += [(-W2 + sway, y, z), (W2 + sway, y, z)]
for i in range(NS):
    a0, b0, a1, b1 = i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 3
    t0, t1 = v1 + (v0 - v1) * i / NS, v1 + (v0 - v1) * (i + 1) / NS
    pf.append((a0, a1, b1, b0))
    puv.append([(u0, t0), (u0, t1), (u1, t1), (u1, t0)])
# the paper hangs plumb: the Pebble's side slopes in towards its feet, and a strip that followed it would end up in a shoe
out = Vector((math.sin(-0.86), 0, math.cos(-0.86)))
RCV = T(*RC.to_translation()) @ basis(Vector((0, 1, 0)).cross(out), Vector((0, 1, 0)), out)
receipt.add((pv, pf, puv), 'labels', 0xffffff, m=RCV, ao=False)
receipt.add((pv, [tuple(reversed(f)) for f in pf], [list(reversed(u)) for u in puv]), 'labels', 0xdddddd, m=RCV @ T(0, 0, -0.001), ao=False)
obj('acc_receipt', receipt, pivot=RC @ Vector((0, -0.1, 0.1)), parent='acc_belt', id='receipt')


# ════════════════════════════════════════════════════════════════════════════
# From bags of faces to Blender objects
# ════════════════════════════════════════════════════════════════════════════
def P(v):
    """Page coordinates (Y up, +Z to the viewer) to Blender's (Z up, -Y to the viewer)."""
    return (v.x, -v.z, v.y)


bpy.ops.wm.read_factory_settings(use_empty=True)
MATS = {}


def material(name):
    if name in MATS:
        return MATS[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = 1.0
    if name == 'glass':
        bsdf.inputs['Base Color'].default_value = (GLASS[0], GLASS[1], GLASS[2], 1)
        bsdf.inputs['Alpha'].default_value = 0.3
        for attr, val in (('surface_render_method', 'BLENDED'), ('blend_method', 'BLEND')):
            try:
                setattr(mat, attr, val)
            except Exception:
                pass
    else:
        img = bpy.data.images.load(os.path.join(TEX, 'labels.png' if name == 'labels' else f'tile_{name}.png'))
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = img
        tex.interpolation = 'Closest'
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    MATS[name] = mat
    return mat


def face_normal(geo, face):
    n = Vector((0, 0, 0))
    for i in range(len(face)):
        a, b = geo.v[face[i]], geo.v[face[(i + 1) % len(face)]]
        n += Vector(((a.y - b.y) * (a.z + b.z), (a.z - b.z) * (a.x + b.x), (a.x - b.x) * (a.y + b.y)))
    return n.normalized() if n.length > 1e-12 else Vector((0, 1, 0))


# a fixed spread of directions over the upper hemisphere, cosine-weighted
random.seed(7)
HEMI = []
for _ in range(56):
    u, v = random.random(), random.random()
    r, t = math.sqrt(u), TAU * v
    HEMI.append(Vector((r * math.cos(t), r * math.sin(t), math.sqrt(1 - u))))


def bake_ao(o, by_name):
    """Per-vertex ambient occlusion by ray casting, so creases and undersides go darker."""
    geo = o['geo']
    verts, faces = [], []
    for g in [geo] + [by_name[n]['geo'] for n in o['occluders']]:
        off = len(verts)
        verts += [tuple(p) for p in g.v]
        faces += [tuple(off + k for k in f) for f in g.f]
    tree = BVHTree.FromPolygons(verts, faces, all_triangles=False, epsilon=0.0)
    normal = [Vector((0, 0, 0)) for _ in geo.v]
    for f in geo.f:
        n = face_normal(geo, f)
        for k in f:
            normal[k] += n
    out = []
    for p, n in zip(geo.v, normal):
        if n.length < 1e-9:
            out.append(1.0)
            continue
        n = n.normalized()
        t = n.cross(Vector((0, 1, 0)) if abs(n.y) < 0.9 else Vector((1, 0, 0))).normalized()
        b = n.cross(t)
        origin = p + n * 0.006
        hit = 0
        for h in HEMI:
            d = t * h.x + b * h.y + n * h.z
            if tree.ray_cast(origin, d, 0.34)[0] is not None:
                hit += 1
        out.append(1.0 - hit / len(HEMI))
    return out


def build(o, by_name):
    geo, pivot = o['geo'], o['pivot']
    mesh = bpy.data.meshes.new(o['name'])
    mesh.from_pydata([P(v - pivot) for v in geo.v], [], [tuple(f) for f in geo.f])
    mesh.update()
    assert len(mesh.polygons) == len(geo.f), f"{o['name']}: {len(geo.f) - len(mesh.polygons)} faces were rejected"
    names = sorted({fa['mat'] for fa in geo.fa})
    for n in names:
        mesh.materials.append(material(n))
    for poly, fa in zip(mesh.polygons, geo.fa):
        poly.material_index = names.index(fa['mat'])
        poly.use_smooth = fa['smooth']
    # hard edges wherever two smooth faces meet at more than 38 degrees
    bm = bmesh.new()
    bm.from_mesh(mesh)
    for e in bm.edges:
        if len(e.link_faces) == 2 and e.calc_face_angle(0.0) > math.radians(38):
            e.smooth = False
    bm.to_mesh(mesh)
    bm.free()

    ao = bake_ao(o, by_name)
    uvl = mesh.uv_layers.new(name='UVMap')
    col = mesh.color_attributes.new(name='Col', type='BYTE_COLOR', domain='CORNER')
    tile = ATLAS['tile']
    for poly, fa, face in zip(mesh.polygons, geo.fa, geo.f):
        n = face_normal(geo, face)
        ax = max(range(3), key=lambda k: abs(n[k]))
        ua, va = ((2, 1), (0, 2), (0, 1))[ax]
        for k, li in enumerate(poly.loop_indices):
            vi = face[k]
            if fa['uv'] is not None:
                uvl.data[li].uv = fa['uv'][k]
            else:
                p = geo.v[vi] - pivot
                uvl.data[li].uv = (p[ua] * fa['density'] / tile, p[va] * fa['density'] / tile)
            shade = 0.42 + 0.58 * ao[vi] ** 0.9 if fa['ao'] else 1.0
            c = fa['color']
            col.data[li].color_srgb = (c[0] * shade, c[1] * shade, c[2] * shade, 1.0)
    mesh.color_attributes.active_color = col
    try:
        mesh.color_attributes.render_color_index = 0
    except Exception:
        pass
    ob = bpy.data.objects.new(o['name'], mesh)
    bpy.context.scene.collection.objects.link(ob)
    for k, v in o['extras'].items():
        ob[k] = v
    return ob


by_name = {o['name']: o for o in OBJECTS}
built = {}
tris = 0
for o in OBJECTS:
    built[o['name']] = build(o, by_name)
    tris += sum(len(f) - 2 for f in o['geo'].f)
for o in OBJECTS:
    ob = built[o['name']]
    if o['parent']:
        ob.parent = built[o['parent']]
        ob.location = P(o['pivot'] - by_name[o['parent']]['pivot'])
    else:
        ob.location = P(o['pivot'])

os.makedirs(os.path.dirname(OUT), exist_ok=True)
kw = dict(filepath=OUT, export_format='GLB', export_yup=True, export_apply=False, export_extras=True, export_normals=True, export_texcoords=True, export_materials='EXPORT', export_animations=False, export_cameras=False, export_lights=False)
for extra in (dict(export_vertex_color='ACTIVE', export_all_vertex_colors=False), dict(export_vertex_color='ACTIVE'), dict(export_colors=True), {}):
    try:
        bpy.ops.export_scene.gltf(**kw, **extra)
        break
    except TypeError as e:
        print('export option not accepted, trying the next set:', e)
print(f'\n{len(OBJECTS)} objects, {tris} triangles -> {OUT} ({os.path.getsize(OUT) / 1024:.0f} KB)')
for o in OBJECTS:
    a, b = o['geo'].bounds()
    print(f"  {o['name']:<16} parent={str(o['parent']):<13} tris={sum(len(f) - 2 for f in o['geo'].f):<5} size=({b.x - a.x:.2f}, {b.y - a.y:.2f}, {b.z - a.z:.2f})")
