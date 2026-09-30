# noerr-throwback — Design Spec

2026-09-30 · Minh Luu · Source PRD: "NOERR Throwback — PRD" (Sep 30, 2026)

## 1. Intent

Single-page, team-only keepsake for the ~14-person NOERR team (mgm Vietnam). One link, opened mostly from phones via chat: tap to enter → song plays → hero stickers → live shuffling photo wall → credits. Loud 60s psychedelic sticker-sheet look.

**Success:** every team member opens it, hears the song, sees all memories in week one; zero project-confidential content.

**Out of scope:** multiple pages, comments/likes/uploads, CMS/admin, SEO, analytics, anything about client/product/architecture/status.

## 2. Design source of truth

`docs/design/mockup.html` (copied from `~/Downloads/NOERR Throwback.html`) is the visual source of truth. It is a self-unpacking bundle; open it in a browser. Four boards:

| Board | Size | Shows |
|---|---|---|
| Phone · Splash gate | 390×844 | Splash layout |
| Phone · Full page (live wall) | 390×3520 | Hero, wall (4 cols), lightbox, credits, footer |
| Desktop · Full page (live wall) | 1440×3120 | Hero two-column, wall (8 cols) |
| Tile kit | 1440×2580 | Sizes, packing rule, tile types, colourway, contrast, photo treatment, type |

Where the mockup and PRD disagree, **mockup wins on visuals, PRD wins on behaviour**. One exception: the mockup shows the same photo number on two tiles at once; that is a mockup artefact, PRD rule T3 (never the same photo on two tiles) holds.

Match mockup spacing, sizes, radii, shadows by reading its markup; values below are the ones that define the system.

## 3. Decisions log

| Topic | Decision |
|---|---|
| Repo | `noerr-throwback/` (own git). `package.json` name, `<title>`: `noerr-throwback` |
| Song | `~/Downloads/lan-cuoi.mp3` (4.8 MB, ~181 kbps, 3:42) copied as-is to `public/audio/lan-cuoi.mp3`, committed |
| Photos in repo | **Processed outputs only** (EXIF stripped). Originals stay at `PHOTOS_SRC` (default `/Users/mnluu/pic/noerr`, 36 files: jpg/jpeg/png + 1 HEIC; 3 contain GPS) |
| Scope | Full PRD incl. all fun extras, one plan; extras are last tasks |
| Shuffle | Fresh Fisher-Yates shuffle of all memories on every page load; one `order` feeds hero stickers, wall queue, lightbox sequence |
| Lettering | CSS lettering per mockup (Baloo 2 ExtraBold, orange `-webkit-text-stroke`, stacked green `text-shadow`, per-letter tilt + bob). Replaces the earlier SVG-turbulence plan |
| Fonts | Baloo 2 (600, 800) + JetBrains Mono (700), self-hosted via `@fontsource`, latin + vietnamese subsets only |
| Access | Cloudflare Access (email OTP), configured in dashboard, documented in README |

## 4. Architecture

Static Vite + React + TypeScript SPA. No router, no state library, no animation library.

- **Runtime deps:** `react`, `react-dom`, `@fontsource/baloo-2`, `@fontsource/jetbrains-mono`.
- **Dev deps:** `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`, `sharp`, `vitest`.

```
noerr-throwback/
  docs/design/mockup.html
  scripts/build-images.mjs      # sharp pipeline
  content/captions.json         # optional, keyed by original filename
  public/
    audio/lan-cuoi.mp3
    memories/<id>-<w>.avif|webp # pipeline output, committed
    _headers
  src/
    memories.json               # pipeline output, bundled
    content.ts                  # subtitle, song title, thank-you line, team list, colour-block words
    main.tsx  App.tsx  styles.css
    audio/AudioProvider.tsx
    wall/
      queue.ts   queue.test.ts
      layout.ts  layout.test.ts
      useScheduler.ts
      flip.ts
      TileWall.tsx  Tile.tsx
    sections/  Splash.tsx  Hero.tsx  Outro.tsx  MusicSticker.tsx  Lightbox.tsx  TopBar.tsx
    fx/        Lettering.tsx  Stickers.tsx  CursorTrail.tsx  FaceRain.tsx  useReducedMotion.ts
  scripts/build-images.test.mjs + scripts/fixtures/
```

**Data flow:** `memories.json` → `shuffle()` once in `App` → `order: Memory[]`. `order` → Hero (first 5), TileWall (queue + layout), Lightbox (index navigation). `AudioProvider` wraps App; Splash calls `start()`; MusicSticker and Music tile read the same context. `lightboxIndex: number | null` lives in App; scheduler receives `paused = lightboxIndex !== null`.

`memories.json` bundled (~36 × blur ≈ 10–15 kB). Image files served from `public/` for stable `srcset` URLs.

## 5. Visual system

### Tokens (`:root` in `styles.css`)

| Token | Hex | Use |
|---|---|---|
| `--violet` | #5539EB | Lettering fill, sticker bodies, active states, counter tile |
| `--violet-hover` | #6A50FF | Play button hover |
| `--orange` | #FF6B1A | Outlines, captions/labels on black, dashed dividers |
| `--pink` | #FF3FB4 | Secondary stickers, primary buttons (SHUFFLE, THROWBACK pill), hover glow |
| `--green` | #1E8A3E | Accent stickers, 3D letter shadows |
| `--ink` | #0A0A0A | Page background, button text on pink/orange |
| `--cream` | #FFF1DC | Body text on black, text on violet, sticker borders, focus ring |
| `--muted` | #BFB3A3 | Secondary helper lines |
| `--tile-bg` | ~#2A2522 | Empty tile body with dot halftone (read exact from mockup) |

**Contrast rules (from kit):** cream on violet 6.0:1 body OK; orange on black 6.9:1 captions; pink on black 6.2:1; black on orange/pink buttons; green on black large only; violet on black and orange on violet **never** as text (outlined lettering / outlines only).

### Type

- `.disp`: `'Baloo 2'` 800, fallback `'Arial Rounded MT Bold','Trebuchet MS',sans-serif`.
- Body/labels: `'JetBrains Mono'` 700, uppercase, letter-spacing ~0.1–0.12em, small (11–12 px).
- `.letter`: violet fill, orange `-webkit-text-stroke` (3 px phone, 6 px large desktop), `paint-order: stroke fill`, stacked `text-shadow` 1…N px green (6 phone, 10 desktop).
- Vietnamese diacritics must render (e.g. "CẢM ƠN!", "ĐÀ NẴNG", "KỶ NIỆM").

### Components (per mockup)

- **Lettering** (`Lettering.tsx`): splits text into letters; each letter wrapped with a fixed random-looking tilt (−6…7°) + vertical offset and inner `.bob` span (3.2 s, staggered −0.6 s). Used for NOERR, THE WALL, CẢM ƠN!. Title also scales with `--pulse` (see Audio).
- **Pill label**: pink pill, ink text, 3 px ink border, 5 px orange offset shadow, rotated −4° ("THROWBACK").
- **Photo sticker** (hero): cream border (~6 px), rounded, coloured hard offset shadow (green/violet/orange/pink), rotated ±12°, overlapping, "PHOTO" + big number label, always duotone. Hover: `wobble` 0.6 s + lift.
- **Deco stickers**: SVG star (10-point polygon) and flower (6 circles + centre) in palette colours with ink stroke, absolutely placed, some `.spin-slow` (14 s).
- **Tile**: `<button class="tile">`, 3 px solid palette border, 14 px radius, ink bg, overflow hidden, `perspective: 900px`. Label bottom-left: "PHOTO" small mono + large Baloo number (zero-padded pool index). "DUO" ink pill badge top-right when duotone. Empty/loading tile shows dot halftone on `--tile-bg`.
- **Dividers**: dashed orange line between sections.
- **Focus**: `:focus-visible` 3 px cream outline, 3 px offset (play button 4 px / 6 px).

### Page structure

1. **TopBar** (on every screen incl. splash): left "NOERR / TEAM ONLY" cream, right "SIDE A" orange.
2. **Splash** (full viewport, fixed over page): Lettering "NOERR" (108 px phone), THROWBACK pill, round 232 px violet PRESS PLAY button (orange 5 px border, ink ring, green offset shadow, play triangle, `.pulse` 1.6 s, rotated −6°), deco star/flower stickers, bottom "TAP TO ENTER · SOUND ON" orange + "MUTE ANY TIME FROM THE DISC" muted. Real `<button>`. Click → `audio.start()`, 400 ms fade, unmount, unlock body scroll.
3. **Hero**: phone = stacked (Lettering, pill, subtitle `[date range] · [inside joke]` orange mono, 5 overlapping stickers). Desktop = two columns (lettering + pill + subtitle left, sticker cluster right). Bottom: "↓ SCROLL FOR THE WALL".
4. **Wall section**: label "SIDE A · LIVE", Lettering "THE WALL", right side "TAP A PHOTO TO OPEN IT" + pink SHUFFLE button (shuffle icon). Grid. Under grid: "`{pool}` MEMORIES · NO REPEATS TILL ALL ARE SHOWN".
5. **Outro**: "SIDE B · CREDITS", Lettering "CẢM ƠN!", thank-you line (cream mono), `<ol>` tracklist rows: orange `01` · cream name · pink `[ROLE]`, thin row dividers.
6. **Footer**: "NOERR · TEAM ONLY" + "BACK TO TOP" link.
7. **MusicSticker** (fixed bottom-right, over everything after splash): round orange-outline mute button + larger disc button (dark vinyl grooves, pink ring, green offset shadow, violet centre with play/pause glyph, orange dot, spins while playing).
8. **Lightbox**: `<dialog>` full screen; top "`07` / `42`" counter + "PHOTO · ORIGINAL"; image; caption; bottom PREV · "SWIPE · ARROWS · ESC" · NEXT. Always shows original (no duotone).

## 6. Tile wall engine

### Sizes & packing (`layout.ts`, pure)

Grid columns: 4 below 768 px, 8 at ≥768 px (read via `matchMedia`, re-pack on change). Square cells (`grid-auto-rows` = column width).

| Size | Cells | Target share |
|---|---|---|
| small | 1×1 | ~40% |
| medium | 2×2 | ~35% |
| wide | 4×2 | ~20% |
| large | 4×4 | exactly 1 |

`pack(cols, rows, rand) → Tile[]` with explicit `{ col, row, w, h }`:

1. Place the 4×4 first (random column offset that fits), then force-place 2 mediums (Counter, Mosaic) and 1 small (Music) at random free spots that fit.
2. Scan cells row-major; at each free cell choose a random size that fits (weighted by target share, biased toward under-represented sizes), place it.
3. Continue until every cell of the `cols × rows` rectangle is filled → **wall is always a full rectangle, height never changes across shuffles**.

Rows: 16 on phone (4×16 = 64 cells), 12 on desktop (8×12 = 96 cells). Tiles render with explicit `grid-column`/`grid-row`, not `auto-flow`.

**Type assignment** after packing: 1 Counter (medium), 1 Music (small), 1 Mosaic (medium), 2 Colour block (small or medium), rest photo tiles. Photo tiles: medium/wide → Flip or Peek (50/50); small/large → Flip. Reduced motion → no Peek. Each tile gets a random border colour from {violet, orange, pink, green} and random duotone flag (p = ⅓).

Tile ids: layout keeps a stable id per slot index so FLIP can match old/new positions; after shuffle, tile *i* keeps id *i* and its photo, gets new size/position/type/colour.

### Photo queue (`queue.ts`, pure)

`createQueue(order)` → `{ next(onScreen: Set<string>): Memory }`:
- Serves ids in shuffled order; no id repeats until all served (T1).
- Skips ids currently on screen (T3); if all remaining are on screen, takes the oldest-served not on screen.
- On exhaustion, reshuffles; first of new round ≠ last of previous.
- If pool ≤ photo slots on screen (tiny pool), duplicates allowed rather than blank tiles. Expected slots: ~14 phone, ~23 desktop vs 36 photos.

Initial fill: every photo slot (and 4 mosaic minis) takes `next()`.

### Scheduler (`useScheduler.ts`)

One `setInterval(1200)` for the whole wall (T2). Each tick:
- Skip if `document.hidden` or `paused` (lightbox open).
- Candidates = visible tiles (IntersectionObserver, set kept in a ref; T9), excluding Counter and Music and tiles mid-animation.
- Pick 1–2 at random; run type action:

| Type | Action |
|---|---|
| Flip | Hidden face gets `next()`; `await img.decode()` (T4); toggle flip class → `rotateX(180deg)`, 0.7 s `cubic-bezier(.3,1.35,.5,1)`. Re-roll duotone. |
| Peek | Photo translates up revealing coloured panel ("NO. 12" + caption from captions.json, or no caption line), holds ~2.4 s, slides back (0.55 s overshoot). |
| Mosaic | Next mini (in order 0→3) gets `next()`, decoded, crossfades. |
| Colour block | Only acts with p = ⅓ when picked: flips to a photo; next action flips back to word/doodle. |

### Shuffle (T5)

Counter tap or SHUFFLE button → `pack()` new layout → FLIP (`flip.ts`): record `getBoundingClientRect` per tile id, commit new layout, in `useLayoutEffect` measure again, `el.animate([{transform: invert}, {transform: 'none'}], {duration: 500, easing: 'cubic-bezier(.3,1.2,.5,1)'})`. Reduced motion → no animation.

### Press tilt (T7)

`pointerdown` on tile → offset from centre → CSS vars `--rx`/`--ry` (±10°) on `.press` layer (0.14 s ease-out); `pointerup/leave` → reset + small wobble.

### Lightbox (T8)

Tap photo tile → `lightboxIndex = order.indexOf(photo)`. `dialog.showModal()`; ←/→ keys, PREV/NEXT buttons, pointer swipe (|dx| > 50 px); Esc native; close → focus returns to tile. Uses 1600 w variant. Scheduler paused while open.

### Reduced motion (T10)

`useReducedMotion()` (matchMedia) + CSS `@media (prefers-reduced-motion: reduce)`: flip → 0.9 s opacity crossfade between faces; no Peek; no FLIP; no bob/spin/pulse/wobble/trail/peel/rain.

## 7. Audio (`AudioProvider.tsx`)

`<audio src="/audio/lan-cuoi.mp3" loop preload="auto">` mounted at app start (downloads while splash shows).

iOS Safari ignores `audio.volume`, so gain goes through Web Audio: `MediaElementSource → GainNode → AnalyserNode → destination`. `AudioContext` created and `resume()`d inside the splash click handler.

- `start()`: build graph, gain 0, `play()`, ramp gain to 0.6 over 1.5 s (M1).
- `toggle()`: pause / play (play re-ramps 0.5 s).
- `toggleMute()`: gain 0 ↔ 0.6; independent of play state (M2).
- Visibility (M3): hidden → store `wasPlaying`, pause; visible → resume only if `wasPlaying`.
- Failure (M4): `play()` rejection or `error` event → `state = 'blocked'`; sticker shows paused look; tap retries; page unaffected.
- Context: `{ state: 'idle'|'playing'|'paused'|'blocked', muted, start, toggle, toggleMute }`.
- Pulse: rAF loop only while playing and motion allowed; RMS of `getByteTimeDomainData` (fftSize 256) → `--pulse` (0–1) on `<html>`; hero Lettering `scale(calc(1 + var(--pulse) * .06))`. No React re-render per frame.

## 8. Image pipeline (`scripts/build-images.mjs`, `npm run build:images`)

- Input: `PHOTOS_SRC` env, default `/Users/mnluu/pic/noerr`. Extensions jpg/jpeg/png/heic (case-insensitive). HEIC → `sips -s format jpeg` to temp file (macOS); elsewhere warn + skip.
- `id` = first 8 hex of SHA-1 of file bytes. Duplicate bytes → skip + warn.
- `sharp(input).rotate()` (apply EXIF orientation); no `withMetadata()` → all EXIF/GPS dropped.
- Widths 240 / 480 / 960 / 1600, `withoutEnlargement`; AVIF q50 + WebP q75 → `public/memories/<id>-<w>.<ext>`.
- Blur: 24 px wide WebP → base64 data URL.
- Incremental: skip ids whose 8 outputs exist. Prune: delete outputs for ids no longer in source.
- Writes `src/memories.json`: `[{ id, file, width, height, caption?, blurDataUrl }]`, sorted by id. `caption` from `content/captions.json` keyed by original filename.
- Rendering: `<picture>` with AVIF + WebP `srcset` and per-size `sizes`; `width`/`height` attrs; blur as background until load → CLS ≈ 0. `alt` = caption ?? `"NOERR memory"`.
- Duotone: two SVG filters defined once in `App` (`#duo-a` violet+orange, `#duo-b` pink+green) via `feColorMatrix` (greyscale) + `feComponentTransfer` (table to two colours); applied by `filter: url(#duo-a)`.

## 9. Fun extras

- **Sticker peel:** passive scroll listener, at most once per 2 s, random hero sticker gets `.peel` for 600 ms (corner fold via pseudo-element).
- **Cursor trail:** only `(pointer: fine)` and motion allowed; pool of 12 small palette-coloured divs moved via `transform`, fading.
- **Face rain:** typing `noerr` anywhere, or tapping the hero NOERR lettering 5× within 3 s → 24 random memories (240 w) fall for 3 s (CSS keyframes, random x/delay/spin), `pointer-events: none`. "Faces" = random memories, no face cropping. Skipped under reduced motion.

## 10. Content (`src/content.ts`)

Placeholders until the team fills them: `subtitle` ("[Date range] · [Inside joke]"), `songTitle` ("[SONG TITLE]"), `thanks`, `team: { name, role }[]` (14 placeholder rows), `colourWords` (e.g. "NOERR"). No client/product/architecture content anywhere.

## 11. Non-functional

| Area | Target |
|---|---|
| JS + CSS first load | < 150 kB gzip (excl. images, audio, fonts) |
| Splash visible | < 1.5 s on 4G mid-range Android |
| CLS | < 0.05 |
| Browsers | latest Chrome, Safari iOS 16+, Firefox, Edge |
| A11y | all controls real buttons; keyboard-operable wall, lightbox, player; `aria-label` + `aria-pressed` on player; visible focus; mute one tap away |
| Privacy | no analytics/trackers/CDN fonts; EXIF stripped; `noindex` header + meta |
| Maintenance | add photos = drop in `PHOTOS_SRC`, `npm run build:images`, commit, push |

## 12. Testing

Vitest, only where logic branches:

- `queue.test.ts`: all ids served once before any repeat; never returns an id in `onScreen`; no immediate repeat across reshuffle.
- `layout.test.ts`: for cols 4 and 8 and many seeds: every cell covered exactly once (full rectangle, no overlap); exactly 1 large; 1 Counter, 1 Music, 1 Mosaic; share of small/medium/wide within tolerance; no Peek when reduced motion; Peek only on medium/wide.
- `build-images.test.mjs`: two fixture images (one with GPS EXIF, one with orientation 6) → outputs have no EXIF (`sharp().metadata()`), correct orientation, `memories.json` shape, duplicate dropped.

Manual checklist in README: splash tap → song fades in; hidden tab pauses/resumes; missing mp3 → blocked state, page works; lightbox keys/swipe/Esc; reduced-motion emulation; phone + desktop compared side by side against mockup boards. One Lighthouse mobile pass + `vite build` size report.

## 13. Deploy

- Cloudflare Pages: build `npm run build`, output `dist`. Images already processed and committed → CI never needs originals.
- `public/_headers`: `X-Robots-Tag: noindex` on `/*`; `Cache-Control: public, max-age=31536000, immutable` on `/memories/*` (content-hashed ids); `/audio/*` 1 day.
- `index.html`: `<meta name="robots" content="noindex">`.
- Cloudflare Access (README step list): self-hosted app covering the production domain **and** `*.<project>.pages.dev` (preview deployments get their own public URLs; without the wildcard every photo is public on preview links); email OTP; allowlist in the policy only; session 30 days.

## 14. Open items (content, not code)

Team names/roles, subtitle, thank-you line, captions, final song title text, domain choice, Access allowlist emails, photo curation + consent.
