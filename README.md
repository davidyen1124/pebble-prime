# 🪨 PEBBLE: Well-Equipped

> A fashion magazine with one model, and the model is a rock. Special price: ¥0.

[![The cover: a blue Pebble in a cap, round glasses, a headset, a tie and a tool belt, every item labelled in Japanese and English, under the red masthead PEBBLE](docs/screenshot.jpg)](https://davidyen1124.github.io/pebble-prime/)

**Open the issue: <https://davidyen1124.github.io/pebble-prime/>**

Fan-made and unofficial: not affiliated with Turnstone. Product facts in the copy come from
myturnstone.ai and its changelog.

## What is this?

One issue of a magazine that does not exist. In [Turnstone](https://myturnstone.ai), AI agents appear as
small characters called Pebbles. This is a stylebook of the sixteen things one Pebble carries, and each
thing stands for something Turnstone does.

Scroll, and they come off one at a time: the item floats out, enlarged, with its page of type. Scroll on
and it goes back where it was. Sixteen pages later there is a back cover, and the Pebble is fully dressed
again, as if nothing had happened.

| No. 05: the price tag | No. 12: the tool belt, mid-jump |
|---|---|
| ![Page 05, Price Tag: a cardboard tag reading FREE PLAN $0 floats beside the Pebble, which is seen from behind with its backpack on](docs/price-tag.jpg) | ![Page 12, Tool Belt: the Pebble is in mid-air above its own shadow, having jumped out of its tool belt, which is starting to float away to the left](docs/tool-belt.jpg) |

These are screenshots of the site, taken from the same build that gets deployed. Yes, the Pebble is in the
air in the second one. That is [explained below](#how-taking-things-off-works).

<p align="center">
  <img src="docs/mobile-cover.jpg" width="300" alt="The cover on a phone: the Pebble fills the page, with the masthead PEBBLE above it and WELL-EQUIPPED below, and no captions" />
  <img src="docs/mobile-helper.jpg" width="300" alt="Page 07 on a phone: the Pebble at the top, the Helper floating in the middle, the type underneath" />
</p>

On a phone the page stacks: Pebble, item, type. The item here is No. 07, the Helper: a smaller, teal
Pebble in a paper hat that sits on the backpack.

## What is on the page

- **Cover.** Cream paper with rays behind the Pebble, a chunky red-and-yellow border, a red masthead with
  the Pebble standing in front of it, sixteen small bilingual captions joined to their items by pixel
  hairlines (when the window is wide enough to hold them), a heavy headline, small print down the edge.
- **Sixteen pages**, one for each item. The item leaves the Pebble, flies to the middle, turns slowly
  (or rocks, if it has lettering to read); its number, name, a few lines and a link sit beside it. A
  square mark on the Pebble shows where it was.
- **Back cover.** Turnstone's own line, a link out, and a way back to the front.
- **Furniture.** The masthead shrinks into the top left corner and is the way home; dots, centre right,
  one for each page. Nothing else: no menu, no settings, no sound, no progress bar.

| No. | Item | Stands for |
|---|---|---|
| 01 | Round glasses | One Brain, shared by everything you use |
| 02 | Cap | Agents appear as Pebbles, and Pebbles get outfits |
| 03 | Headset | Calls from Granola and Plaud arrive in the Brain |
| 04 | Three tickets | Invite a friend: three links every seven days |
| 05 | Price tag | The Free Plan: $0, 50 Schedule runs a month |
| 06 | Backpack | Knowledge stays on your Mac |
| 07 | Helper | Agents create helpers and delegate |
| 08 | Pencil | Tone: Agents sound like you |
| 09 | Magnifying glass | Ask anything: it searches, then answers |
| 10 | Receipt | See, edit or undo every Brain update |
| 11 | Tie | Each Agent has one job |
| 12 | Tool belt | Connected apps |
| 13 | Walkie-talkie | Other agents can reach yours over MCP |
| 14 | Wristwatch | Schedules |
| 15 | Key ring | Bring the AI you already pay for |
| 16 | Sneakers | Mac, iPhone, iPad and the browser |

Several of them have lettering, drawn pixel by pixel. The price tag says `FREE PLAN $0`. The tickets say
`ADMIT ONE`. The walkie-talkie says `PUSH TO TALK`. The receipt itemises its changes, then says
`4 CHANGES SAVED`, then `THANK YOU`. The wristwatch has no numbers on it. It says `RUNS`.

## FAQ

**Where can I buy a copy?**
Nowhere. It is one issue of a magazine that does not exist. The cover price is 特別定価 0円: special
price, ¥0. It has never been discounted.

**Is this an ad?**
No. It is fan-made and unofficial, and it is not affiliated with Turnstone.

**Why is half of it in Japanese?**
The layout is a homage to the covers of the Japanese magazine BRUTUS, and to its habit of taking one
ordinary subject as the whole story and cataloguing it piece by piece. The subject here is a rock with a
tool belt. The Japanese is real type, like every other word on the page. The copy uses 99 characters that
are not Latin, and the build ships only the 34 slices of the font that hold them.

**Why does it look like a games console printed it?**
On purpose. Everything except the type is drawn the way a mid-90s console would draw it: a picture about
430 lines tall, 15-bit colour, textures 32 pixels across. See [The look](#the-look).

**Why did the Pebble just jump?**
The tool belt goes round the Pebble, and the Pebble stands in its sneakers. Neither can simply leave. So
the Pebble hops, and what is leaving stays where it was until the Pebble is out of it.

**Where is the menu? The sound? The loading bar?**
There is no menu, no settings, no sound and no progress bar. The QA script reports a problem if a
progress bar ever turns up. While the model loads, the page says `NOW PRINTING` and counts to 100.

**Does it really scroll?**
No. Nothing scrolls. See [How the scroll works](#how-the-scroll-works).

**How heavy is it?**
A full visit is 37 requests: one page, one script, one stylesheet, one 465 kB model and 33 slices of font.
Apart from the favicon there are no pictures to download. The textures are inside the model, and the
paper, its rays and its border are a shader.

## What's inside

### The look

**A magazine, printed by a games console.** Everything on the page except the type is drawn the way a
mid-90s console would draw it, in the same coarse pixels:

- the **Pebble**: few polygons, 32-pixel textures with no filtering, lighting worked out per vertex,
  vertices snapped to whole pixels, textures stretched flat across each triangle (so they swim a
  little), 15-bit colour with an ordered dither, a picture about 430 lines tall scaled up with hard edges;
- the **paper** (`src/paper.js`, a small shader on its own canvas under everything): big shaded
  triangles, dithered, with pale rays fanning out from behind whatever the page is about (集中線, the
  speed lines of manga and of every 90s games magazine); they follow an item as it flies out, and turn
  very slowly;
- the **border**, part of the paper: a solid red band, a dashed red-and-yellow line inside it and a
  block in each corner;
- the **hairlines**, dots and the mark that shows where an item was worn: one-pixel lines with
  stair-steps, drawn by the 3D stage in two layers, one behind the Pebble and one in front, and faded
  by dither rather than transparency;
- **buttons** with square corners and a hard shadow; square dots; a blinking arrow.

**The type is type.** Every word is real text in the page, set in
[Jost](https://indestructibletype.com/Jost.html) and
[Zen Kaku Gothic New](https://fonts.google.com/specimen/Zen+Kaku+Gothic+New) (both open source), and is
as sharp as the screen. The masthead and the cover headline are filled with the console's dithered red,
clipped to the letters: sharp outlines, pixel ink.

### The model

`public/models/pebble.glb` is built by a script, not by hand:

```sh
npm run model     # draws the textures, then runs Blender with no window
```

`scripts/textures.mjs` draws the pixel textures (with its own bitmap alphabet) into
`assets-src/blender/tex/`. `assets-src/blender/build_pebble.py` then makes every object out of lathes,
lofts and boxes (`assets-src/blender/kit.py`), bakes ambient occlusion into the vertex colours by casting
rays, and exports the GLB. It comes to 25 objects, 5,146 triangles and nine textures. Every accessory is
its own object with its own pivot, which is what lets the page take it off. Needs Blender 4 or later at
`/Applications/Blender.app`. The built model is committed, so you do not need Blender to run the site.

### How taking things off works

Each item has a first move that takes it straight clear of the Pebble (`exit` in `src/config.js`), then
a curved flight to its place on screen: towards the camera first, across second, so it never passes
through the Pebble. Coming back is the same in reverse. Three items cannot simply leave, so something
makes room for them:

- the **cap** is under the headset's band, so the headset widens and lifts, the cap comes out, and the
  headset sits back down;
- the **tool belt** goes round the Pebble, and the Pebble stands in its **sneakers**, so for those the
  Pebble hops, and what is leaving stays where it was until the Pebble is out of it.

![Four rows of three frames from the 3D bench: the headset lifting to let the cap out, the headset coming off by itself, the Pebble hopping out of its tool belt, and the Pebble hopping out of its sneakers](docs/qa/taking-things-off.jpg)

(These frames are from the 3D bench, `dev.html`, which has no paper and no type.)

How large an item floats is measured, not guessed: every vertex is projected at every angle the item
will be seen from, and the item is scaled until the outermost one touches its box.

### How the scroll works

Nothing really scrolls. A virtual scrollbar eases towards wherever the wheel or finger asked for, and
its offset, as a number from 0 to 1, drives everything: the camera, which item is out, which page of
type is up. Input is capped, so the camera cannot be flung past an item, and when the scroll enters an
item's stretch it glides to the middle of it and rests there. The page is as long as the window is tall,
so the pace is the same on a laptop and a tall monitor.

One function, `layoutFor()` in `src/webgl/path.js`, decides where everything goes for a given window:
side by side on a wide one, stacked on a tall one. The 3D and the type both read it.

### Where things live

```
index.html              static shell; the first paint is paper, the frame and a counter
dev.html                a bench for the 3D alone (?section=3, ?p=0.42, ?orbit). Dev server only: not built or deployed
vite.config.js          a relative base, so the build works under any path
src/main.js             boot, the frame loop, going from page to page
src/config.js           all the copy, the sixteen items and how each comes off, scroll lengths
src/ui.js               cover, captions and hairlines, item pages, back cover, dots
src/styles.css          type and layers
src/paper.js            the dithered paper, its rays and its border; the dithered ink for the largest type
src/fonts.css           the slices of the Japanese face the copy uses (written by scripts/fonts.mjs)
src/scroll.js           the virtual scrollbar and its two plugins
src/anim.js             GSAP set-up
src/webgl/stage.js      renderer, shader, camera, taking items off and putting them back
src/webgl/path.js       layout for a window; scroll sections; camera pose for any scroll progress
src/dev.js              the bench's own script
src/qa3d.js             exact mesh-against-mesh tests for the bench
public/                 served as it is: the model, the icons, the social card
assets-src/blender/     the model's source: the Blender scripts and the pixel textures they use
scripts/                textures, fonts, icons, QA
docs/                   the pictures in this README; docs/qa/ has contact sheets of earlier versions
.github/workflows/      the deploy to GitHub Pages
```

## Run it locally

```sh
npm install
npm run dev          # http://localhost:5173
npm run build        # static site in dist/
npm run fonts        # after changing any Japanese copy
npm run meta         # favicon, app icons, og.jpg (needs the dev server on :5183, or set BASE)
```

URL flags: `?p=0.42` opens the page at any scroll progress, and `?still` stops the Pebble swaying, for
photographs.

## QA

Two kinds, both with Playwright. A page about a rock's accessories has two kinds of QA.

```sh
npm run dev -- --port 5183 &
npm run qa:3d        # in the 3D bench: exact triangle tests
npm run build && npm run preview -- --port 5184 &
npm run qa           # on the built page, eleven window sizes, every page
npm run qa:sweep     # the whole scroll by wheel, photographed
```

`qa:3d` checks, for a wide and a tall window: that nothing worn cuts into anything it is not attached
to; that each item, at 73 points along its way out, touches nothing but its own seat, and lets go of
that early; that nothing leaves the frame during the move; and that the floating item, through its whole
turn, stays clear of the Pebble and of the type.

`qa` measures every page at every size: the ink of every line of type (inside the frame, not clipped by
its box, not on other type, not on the Pebble or the item), the Pebble and the item (inside the frame,
apart from each other), every control (on top where it is drawn), and the order of the layers.
The one overlap the page means is the masthead behind the Pebble on the cover; the report says how much.

Both read `BASE`, so they can check any address, including one under a path (no trailing slash):
`BASE=https://davidyen1124.github.io/pebble-prime npm run qa`. The photographs land in `qa/`, which git
ignores.

## Deploying

Pushing to `main` runs [a GitHub Actions workflow](.github/workflows/pages.yml) that builds with Vite and
publishes `dist/` to GitHub Pages. The build uses relative paths (`base: './'`), so it works under
`/pebble-prime/` or anywhere else.

## Earlier covers

The cover did not start out like this. `docs/qa/` keeps the contact sheets from the two looks before it.

![Before and after, first pass. Left: the cover in flat red ink, with a thin frame, round dots and a circular scroll badge. Right: the same cover with dithered red type, pixel hairlines and a square button](docs/qa/before-after-cover.jpg)

First it was flat ink on plain paper. Then the console got hold of the type, the lines and the buttons.

![Before and after, second pass. Left: the console cover on plain paper. Right: the same cover with pale rays behind the Pebble and a dashed red-and-yellow border](docs/qa/gamemag-before-after.jpg)

Then the paper got its rays and its border, and that is the cover that shipped.

More sheets from each stage: flat ([desktop](docs/qa/live-desktop-pages.jpg),
[phone](docs/qa/live-mobile-pages.jpg)), console ([desktop](docs/qa/console-desktop-pages.jpg),
[phone](docs/qa/console-mobile-pages.jpg)), rays and border ([desktop](docs/qa/gamemag-desktop.jpg),
[phone](docs/qa/gamemag-mobile.jpg)).

## Credits

- Type: [Jost](https://indestructibletype.com/Jost.html) and
  [Zen Kaku Gothic New](https://fonts.google.com/specimen/Zen+Kaku+Gothic+New), both open source.
- The layout is a homage to the covers of the Japanese magazine BRUTUS.
- The artwork, the model and the copy are original to this project.
- Turnstone and its Pebbles belong to Turnstone. This page is fan-made and unofficial, and is not
  affiliated with them.
