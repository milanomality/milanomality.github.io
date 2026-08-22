# Danil Dragunskiy — personal site

A single-page personal site for a C++ systems engineer. Fully in English, strictly black
and white, built around one scroll-driven scene: a climbing wall on the right of the
frame, with a figure moving up it hold by hold as the page is scrolled.

## Run it

No build step, no dependencies.

```sh
python -m http.server 8000
# then open http://localhost:8000
```

Any static server works. Opening `index.html` straight from disk works too, though the
Google Fonts request needs a network connection.

## Deploy

**GitHub Pages** — push this folder to a repository and enable Pages on the branch root.
`.nojekyll` is already present so the `assets/` folder is served as-is.

**Netlify / Cloudflare Pages / any static host** — publish directory is the repository
root, build command is empty.

## Files

| Path | What it is |
|---|---|
| `index.html` | All content. Every fact comes from the CV; nothing is invented. |
| `assets/styles.css` | Tokens, type scale, layout, reveal grammar. |
| `assets/scene.js` | The wall, the route and the climber. Canvas 2D, no libraries. |
| `assets/main.js` | Scroll orchestration: scene position, rail, reveals. |
| `DESIGN.md` | The visual system as built. Read before changing anything visual. |
| `PRODUCT.md` | Confirmed product truth and the constraints the content must respect. |

There are no image or video assets at all. The whole site is 88 KB.

## Editing the content

Everything a visitor reads is in `index.html`. Two conventions matter:

- Headings are hand-broken into `<span class="line"><span>…</span></span>` pairs. One
  `.line` is one reveal mask, so keep each short enough to fit on a single visual line
  at desktop width, or it will wrap inside its own mask.
- `data-fade`, `data-stagger`, `data-rule` and `data-count` drive the reveals. A block
  with no attribute is simply always visible, which is a safe default.

Chapter names and the year marks in the rail come from `data-chapter` and `data-mark` on
each `<section>`; the rail builds itself from those.

## Tuning the climber

All of it is in `assets/scene.js`. **The pose is never keyframed** — the limbs are pinned
to holds and solved with two-bone IK, and the body is placed from where the hands and
feet are. If a posture looks wrong, change the route geometry, not the drawing.

- `MOVES` — how many reaches the page is worth. Raise it and the climber moves faster
  for the same amount of scroll.
- `STEP` — vertical spacing between rungs, in units of canvas height.
- `COL` — how far each column of holds sits off centre. **This decides the posture.**
  Much above `0.08` puts the hands further apart than the arms are long and the figure
  spreads flat against the wall; that was the first thing that went wrong here.
- `lift` on the two hand entries in `LIMBS` — how many rungs the hands work above the
  feet. Three reads as climbing; two puts the hands at shoulder height.
- `RIG` — limb lengths, torso, neck, head, all in units of canvas height.
- `LIMBS` order — the sequence `RH → LF → LH → RF`. Each limb advances one rung every
  fourth move, which is what keeps three limbs loaded at all times.

`--wall` in `styles.css` sets how much of the frame the wall takes; the reading column's
right padding follows it, so type can never run under the wall.

Page progress maps onto the move sequence in `update()` in `assets/main.js`, which hands
it to `Scene.set(p)`.

## Notes

- Contacts are GitHub and LeetCode only. No phone number and no email address appear
  anywhere on the site, by decision.
- Honours `prefers-reduced-motion`: reveals are off and the render loop stops between
  scrolls. The climber still tracks the scroll, because that is navigation, not decoration.
- Works without JavaScript: all content is in the markup and visible by default; only the
  wall is missing.
