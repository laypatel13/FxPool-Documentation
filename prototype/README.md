# Pack the Pool

A playable, pixel-art, Tetris-style demo of FxPool's core mechanism: small
invoices are individually too small for a bank to hedge, but pooled together
they clear easily. This turns that trade-off into a game.

## How it works

- Invoices fall from the top into one of 6 slots, in three size tiers, flat
  pixel colors, no gradients:
  - **Small** (teal, $400–1,800) — quick to place, barely moves the pool total
  - **Medium** (gold, $1,800–4,500) — bigger step toward threshold, more bin space
  - **Large** (coral, $4,500–8,500) — closes the gap fast, but a single misplaced
    one can overflow a column
- Below the falling bin sits an actual **pool** — a pixel-wave water tank that
  rises as dollars accumulate. It shows live $ pooled / threshold and % filled.
- Hit the threshold → **"BATCH EXECUTED"**: the pool splashes, drains, lifetime
  hedged total goes up, and the next round has a higher threshold and faster
  fall speed.
- If a column fills up before the threshold is hit → game over ("pool overflowed").
- Lifetime-hedged best run persists locally via `localStorage`.

## Visual style

Press Start 2P + VT323 pixel fonts, flat solid tier colors (no CSS gradients
anywhere), thick black pixel borders, and chunky 3D "press-down" buttons —
built to feel like a Scratch/8-bit arcade toy rather than a polished SaaS UI.

## Controls

- **◀ / ▶** or Arrow Left/Right — move the falling invoice
- **DROP** button, `Space`, or `↓` — drop into the current column
- Fully playable with on-screen buttons (touch/click) or keyboard

## Stack

Single static `index.html` — no build step, no dependencies beyond a Google
Fonts CDN link. All game logic is vanilla JS (`requestAnimationFrame` loop,
no libraries).
