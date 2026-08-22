# Design

Recorded from the built surface, not from intention. `index.html` + `assets/styles.css` + `assets/scene.js` + `assets/main.js` are the ground truth.

## World

**Text left, climbing wall right.** A panelled gym wall holds the right of the frame for the whole page; the record reads down the left. A figure moves up the wall as the page is scrolled, hand over hand.

**Why this one works where the others did not.** The scene arrived here after five discards: an articulated walking climber rebuilt three times, a cut-out of a manga panel, a rolling snowball, a night landscape with a star field, a full sumi-e build with a washi shader and procedural brush strokes, and a scroll-scrubbed video.

The walking figure was the instructive failure. A walk cycle has to be *animated* — every frame is a judgement about weight, contact and overlap, and no amount of rigging substitutes for an animator. **Climbing is different: at any moment three limbs are anchored on holds and one is travelling.** The pose is not authored, it is *solved* — the limbs are pinned to known points and the body follows. That is why a stick figure reads here and did not read walking.

## Tokens

| Token | Value |
|---|---|
| `--void` | `#08080a` |
| `--ink` | `#f2f2f0` |
| `--ink-soft` | `rgba(242,242,240,.76)` |
| `--ink-dim` | `rgba(242,242,240,.50)` |
| `--hair` | `rgba(242,242,240,.16)` |
| `--wall` | `46vw` desktop · `40vw` under 1100px · `100vw` under 900px |

`--wall` is the layout's spine: the reading column's right padding is `--wall + 3vw`, so type can never run under the wall.

## Type

- **Archivo** (variable) carries everything visible, `font-stretch` 104–108% on display sizes.
- **JetBrains Mono** is restricted to measurements: dates, spans, counts, URLs, rail marks.
- Hero `clamp(2.4rem, 1rem + 4.6vw, 5.4rem)` / 800. Display `clamp(1.9rem, 1rem + 2.6vw, 3.4rem)` / 700. Tracking never below `-.04em`.

## The wall

`assets/scene.js`, one Canvas 2D layer. Everything is in units of canvas height, so the figure keeps its proportions at any panel aspect.

**The panel.** A T-nut grid on a half-offset lattice, panel seams every four rows, and nothing else. The T-nuts are what make a flat dark rectangle read as a climbing wall rather than a background.

**Holds.** Blobs, not circles — moulded shapes with a highlight lit from above left, the way a gym's ceiling lights sit. Holds on the route render bright; the scatter of off-route holds renders at a third of that, and is what stops the wall reading as a ladder.

**The route.** Two columns of holds either side of centre, one rung every `STEP = 0.098` of canvas height, with deterministic jitter so it never reshuffles between frames. Hands work three rungs above the feet.

**The sequence.** `RH → LF → LH → RF`, the order a climber actually uses. Each limb advances one rung every fourth move, so three limbs are always loaded:

```js
rungAt(limb, m) = floor((m - limb.order + 3) / 4) + limb.lift
```

`MOVES = 44` reaches across the page, driven straight off scroll position. Within a move the travelling limb follows an arc — out from the wall, up, and back in onto the hold — on a smoothstep, so it accelerates away and settles onto the hold rather than sliding there.

**The body is solved, not posed.** Shoulders are placed below the hand centroid, hips above the foot centroid, and the torso is laid between those two targets at its fixed length. Arms and legs are then two-bone IK onto their holds, elbows and knees splayed outward. This is the whole trick: the holds decide the pose.

The geometry has to be right or the figure starfishes. Columns at `COL = 0.072` off centre, not `0.112`: at the wider spacing the hands sat further apart than the arms are long, and the figure spread out flat against the wall. Hands three rungs up, not two, or they end up at shoulder height instead of overhead.

**Camera.** The hips stay at the middle of the panel; the wall scrolls past them.

**Chalk.** A puff off the hold as each hand lands, and a build-up that stays: every hold below him carries chalk smears, so the route reads as a record of the way he came.

**Detail on the wall.** Holds come in three kinds picked from a hash — jugs, crimps, pinches — because a wall of one shape reads as a pegboard. Each carries the bolt that holds it on. Route tape beside each hold was tried and removed: at this scale it read as stray translucent rectangles rather than as marking. Every sixth rung gets a **volume**: a big bolt-on triangular feature behind the holds, with one lit facet so it reads as a solid rather than an outline. A vertical gradient puts the gym's lights on the middle of the panel.

**Detail on the climber.** The feet are **climbing shoes** — a stiff wedge standing on the toe, aimed along the shin; a round dot for a foot is the one thing that gives a rig away. The head turns toward whatever the travelling limb is reaching for. A chalk bag on the harness was tried and removed: near the hip joint it read as a joint that had slipped onto the torso, not as a bag.

**The anchor.** Two bolts, chains and a ring wait at rung 15, which is where the page ends: the finish arrives with the contact links.

**Mobile.** Below 900px the two columns stop fitting, so the wall goes full-bleed behind the text at 42% opacity under a scrim heavy enough to read through.

## Components

No cards. Every group is separated by the single hairline.

- `.facts` — a four-cell strip with count-ups.
- `.ledger` — two-column rows for the FelenaSoft record.
- `.pitches` — a 2×2 grid for Metadesk, a different rhythm from the ledger.
- `.kit` / `.record` — label-left, content-right on the ledger's grid.
- `.links` — the two destinations, each filling solid ink on hover and inverting its own text.
- `.rail` — the progress rail, over the wall on the right. It was in the left margin and collided with the type the moment the viewport narrowed; `mix-blend-mode: difference` keeps it readable over both a lit hold and the dark panel with no state to manage.

## Layout

Panels are sticky only above 901px, where chapters carry a `min-height` of 145–235vh to buy scroll room. Below that they flow, because a phone cannot hold a chapter inside one sticky viewport.

## Motion

One grammar: mask up from the baseline on an exponential ease-out, from an already-visible default. `html.js` is what switches the hidden state on; with JS off everything is visible.

`prefers-reduced-motion` removes the reveals and stops the render loop between scrolls; the climber still tracks the scroll, because that is navigation rather than decoration.

## Rules

1. No colour anywhere.
2. One hairline weight, 1px, at 16% ink.
3. Type never crosses `--wall`.
4. Mono is for measurements only.
5. The figure's pose is never keyframed. If a posture looks wrong, fix the route geometry — column spacing, rung height, hand lift — not the drawing.
