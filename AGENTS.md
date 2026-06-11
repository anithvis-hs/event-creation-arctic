# Arctic AI Starter Kit — agent notes

## What this is

- A **static front-end prototype**: plain `index.html`, `styles.css`, and small vanilla scripts (`chat.js`, `panel-resize.js`).
- A **visual and layout starter** for an “Arctic AI” style UI: glassy panels, chat chrome, sidebar, resizable panel, page switcher, search overlay, and related affordances.
- **Self-contained assets**: SVGs under `assets/`, Inter font files under `fonts/Inter/`.
- **Design intent** is documented in `design.md` (tokens, typography, spacing, and what to avoid). Use it when adding screens or components so new work stays visually aligned.

## What this is not

- **Not a production app** — no auth, no real API, no data layer, and no deployment pipeline in this repo.
- **Not a design system or component library** — `design.md` explicitly targets cohesive prototypes, not a full tokenized system for shipping products.
- **Not a framework project** — no `package.json`, bundler, or TypeScript; no tailwind or outside framework use. changes are direct edits to HTML/CSS/JS.
- **Not a backend or AI runtime** — anything that looks like “chat” or “AI” here is UI shell and demo behavior only.
## Working in this repo

- Prefer **minimal, local changes** that match existing patterns in `styles.css` and `index.html`.
- For new UI, read **`design.md` first** for colors, type scale, glass surfaces, and anti-patterns.
- After structural HTML changes, spot-check **layout and panel resize** behavior in the browser.
