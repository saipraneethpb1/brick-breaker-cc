# Brick Breaker

A minimalist brick breaker game built with vanilla HTML, CSS, and JavaScript.

## Play

Open `index.html` in any modern browser — no build step, no dependencies.

## Controls

| | Action |
|---|---|
| `← →` / Mouse | Move paddle |
| `Space` / Click | Launch ball |

## Rules

- Break all bricks to win
- Top 3 rows take **2 hits** — a crack appears after the first
- Ball speeds up every 5 bricks destroyed
- 3 lives — shown as dots in the top right

## Scoring

| Event | Points |
|---|---|
| 1-hit brick | 10 |
| 2-hit brick (first hit) | 5 |
| 2-hit brick (destroyed) | 15 |
| Every 5th brick bonus | +50 |
