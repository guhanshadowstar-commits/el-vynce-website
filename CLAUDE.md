# EL VYNCE — project notes for Claude

Two codebases exist for this brand. Know which one you're in before editing.

| | `el-vynce-website` (this repo) | `El Vynce - Node.js-Vercel` |
|---|---|---|
| What | Static HTML/CSS/JS site | Next.js (App Router) rewrite |
| Deploy | GitHub Pages, plain files | Vercel, Node.js |
| Payments | None client-side yet | Razorpay checkout wired in (`app/api/create-order`, `verify-payment`, `razorpay-webhook`) |
| CRM | None | Notion (`lib/notion.js`) — writes every verified order |
| Git remote | `origin` → GitHub, pushes work | **No remote configured** — commits are local only |

**The Next.js project is the real target architecture** (single entry point, component files, Node.js/Vercel-native, Razorpay + Notion already built). This static site is the older/parallel codebase. When a fix belongs conceptually to "the hero scene" or "the product catalogue," it usually needs to land in **both** — see "Keeping the two in sync" below.

## Running this site
No build step for HTML/JS. The one thing that *does* need a build: Tailwind is precompiled into `css/tailwind.css` (not loaded from a CDN, for perf) — run `npm run build:css` after adding new Tailwind utility classes. See `BUILD.md`.

`python3 build.py` regenerates every page's shared `<nav>`, `<footer>`, cart drawer, and the page-loader overlay from `partials/*.html` — edit the partial, not each page, then rerun it.

## Cache-busting — do this on every edit to a shared asset
Every `<script>`/`<link>` for `css/style.css`, `js/interactions.js`, `js/hero-silhouette.js`, and `js/products.js` carries a `?v=YYYYMMDDx` query string across all HTML pages. **Bump it whenever you edit that file.** `js/products.js` didn't have one for a long time and it caused real confusion — catalogue edits were pushed and live on GitHub but browsers/CDN kept serving a stale cached copy indefinitely. Don't reintroduce an unversioned asset reference.

## Current product catalogue (`js/products.js`, mirrored in the Next.js project's `lib/products.js`)

| Drop | Products | Price |
|---|---|---|
| Emotional Drops (was "Drop 01") | Rebel Soul, Frequency, Inner Noise | ₹899 each |
| Warrior Drop | Style Pays Off, Just Be Resilient, Dare to Be Different, Built Different | ₹599 each |
| Crop Tops | I'm Just a Girl, She., Pretty Girls Don't Do Drama, Spicy | ₹399 each |
| Knit-wear Drops | Cream, Black, Brown, Grey Waffle Knit | ₹799 each |

15 products total. "Drop 03" and the 3 AI-generated-stock-photo placeholder items that lived there/in Emotional Drops (Void Architect Bandhgala, Sculptural Wool Overcoat, Observer Leather Carry-All) were removed entirely (2026-07-23) — every remaining product now has real photography.

Warrior Drop pricing is now real (₹599, set 2026-07-23); sizes are still placeholders awaiting real measurements from the client — don't treat those as final.

## Product photos — verify before trusting a filename
When the user pastes product photos and points to matching files in `~/Downloads`, **don't assume filename similarity means correct content.** Downloads has accumulated multiple unrelated files with confusingly similar names (e.g. `marron_front.png` vs `23.png` — one was the real waffle-knit product photo, the other was an unrelated blank mockup with the same apparent subject). Always `Read` the actual candidate file and visually compare against what the user showed before wiring it into the catalogue. This bit us once (Cream/Brown Waffle Knit shipped with the wrong images, caught only when the user screenshotted the live listing).

## The hero animation (`js/hero-silhouette.js`, ~2200 lines; ported to `lib/heroScene.js` in the Next.js project)
Three.js scene: a small (3-4 figure) pedestrian crowd, day/night cycle driven by the visitor's real local clock, a signalled crosswalk, and street traffic. Notable behavior, roughly newest-first:
- Tap/click a car: it honks (WebAudio) and stops; if a car is tailgating behind it, that driver "doesn't notice" and rear-ends it (comedy crash, hazards, recovers after ~5s). 5 car body types re-roll each time a car loops off-frame.
- Touch-drag on mobile steers the camera like the desktop cursor-parallax does.
- The pedestrian crowd is 2 (mobile) or 3 (desktop) walkers + a dancer — the "woman" GLB rig and the bench-sitter role built on it were removed entirely per a "remove girls" request; don't re-add gendered NPCs without checking with the user first.
- Perf: shadow map is 1024×1024 `PCFShadowMap` (was 2048² soft shadows — much more expensive for a barely-visible difference at this camera distance), car wheels don't cast shadows, and the camera lerp reuses scratch `Vector3`s instead of allocating new ones every frame.
- Known long-standing cost that's *not* fixed: ~150-250 draw calls (cars/buildings/rigs are mostly unbatched) and ~27 transparent materials causing overdraw. Real further wins, but riskier — hasn't been attempted.

## The cursor (`js/interactions.js` + `css/style.css`)
Currently a "Prowling Panther": the actual EL VYNCE panther-logo mark (extracted from the client's PDF/SVG export — that file embeds the art as a raster luminance mask, not clean vector paths, so it was re-rendered to a clean white silhouette PNG at `images/cursor/panther-cursor.png`) trails the pointer with lag, tilts toward the direction of travel, perks up on links, grows with a glow over product images, and pounces on click. Went through two prior designs this session (dot+ring → glow orb → viewfinder brackets → this) — the user rejected the first two; ask before redesigning again rather than assuming.

## The page-loader (`partials/page-loader.html`, injected into every page by `build.py`)
Full-screen splash with the panther mark (`images/cursor/panther-loader.png`, a black-fill render of the same logo) shown on every page load/navigation, with a minimum display time so fast loads don't flicker. **Gotcha already hit once:** hiding it via `opacity:0`/`visibility:hidden` does NOT pause its CSS keyframe animations — they'd have looped forever in the background on every page. Fixed with an explicit `animation-play-state: paused` rule; don't remove that when touching this code.

## Keeping `el-vynce-website` and `El Vynce - Node.js-Vercel` in sync
There's no automated sync — every cross-cutting fix this session was ported by hand:
- Hero scene: signal-pole placement, car-lane desync, shadow/perf fixes, camera Vector3 reuse.
- Catalogue: every drop/price/product change.
- NOT ported: the cursor, the page-loader, and the mobile-responsiveness CSS pass — those only exist in one codebase each (cursor/loader are static-site-only features; the mobile pass was Next.js-only). Check before assuming something is mirrored.

When asked to fix "the hero" or "the products," fix `el-vynce-website` first (it's the active/pushed one), then check whether the same code path exists in `lib/heroScene.js` or `lib/products.js` and port it — or ask if unsure whether both should change.

## What's still needed before the Next.js site can go live
Not scaffolding — actual accounts/keys, which only the user can create:
1. Razorpay account + API keys (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`)
2. Notion integration token + a database built via `scripts/setup-notion.mjs`
3. Real size chart for Warrior Drop (price is now confirmed at ₹599; sizes are still placeholders)
4. Vercel project connected to a repo, with the above as environment variables

See `.env.example` in the Next.js project for the exact variable names.

## Known tool quirks (this environment, not the site)
- The Browser-pane preview tool sometimes reports `document.hidden = true` on tabs regardless of focus, which pauses `requestAnimationFrame` — the hero's Three.js render loop won't visibly animate there even though the code is correct. Verify via exposed debug state (`window.__EV_DEBUG`) or direct DOM/computed-style checks instead of trusting a screenshot to show live motion.
- `window.innerWidth` can read `0` in that same tool at odd times.
- Its console reader only captures explicit `console.*` calls — uncaught exceptions and unhandled promise rejections don't show up. Add temporary `window.addEventListener('error'/'unhandledrejection', ...)` handlers that `console.error()` the details if debugging a silent failure, then remove them.
- The tool's `getComputedStyle(...).borderWidth` has been unreliable (returns `1px` regardless of the actual CSS value, even with inline `!important`). Border-width specifically can't be trusted there; other properties (width/height/opacity/filter/transform) read correctly.
