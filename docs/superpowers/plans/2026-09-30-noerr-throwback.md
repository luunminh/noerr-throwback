# noerr-throwback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the team-only NOERR throwback page: splash → song → hero stickers → live shuffling tile wall → lightbox → credits, as a static Vite + React + TS site.

**Architecture:** Static SPA, no router/state/animation libraries. Pure logic (photo queue, wall packer, tile-face state) lives in small tested TS modules under `src/wall/`; React components render them and one global scheduler drives animation. Images are pre-processed by a Node + `sharp` script into `public/memories/` + `src/memories.json`; audio goes through a Web Audio graph for fade/volume on iOS.

**Tech Stack:** Vite, React 19, TypeScript, Vitest, sharp, `@fontsource/baloo-2`, `@fontsource/jetbrains-mono`.

**Spec:** `docs/superpowers/specs/2026-09-30-noerr-throwback-design.md`. Visual source of truth: `docs/design/mockup.html` (open in a browser; four boards: phone splash, phone full page, desktop full page, tile kit).

All paths below are relative to the repo root `/Users/mnluu/work/mgm/noerr/noerr-throwback/` (already `git init`ed on `main`, holds the spec and mockup).

## Global Constraints

- Package name and `<title>`: `noerr-throwback`.
- Runtime dependencies are exactly `react`, `react-dom`, `@fontsource/baloo-2`, `@fontsource/jetbrains-mono`. No router, state, animation, or UI libraries.
- First-load JS + CSS under **150 kB gzip** (excluding images, audio, fonts).
- No analytics, no trackers, no third-party network requests (fonts self-hosted, no Google Fonts CDN).
- Original photos are never committed. Only `public/memories/*` and `src/memories.json` (EXIF stripped) enter git.
- Palette, exact: violet `#5539EB`, violet-hover `#6A50FF`, orange `#FF6B1A`, pink `#FF3FB4`, green `#1E8A3E`, ink `#0A0A0A`, cream `#FFF1DC`, muted `#BFB3A3`.
- Never use violet-on-black or orange-on-violet for text.
- Fonts: Baloo 2 (600, 800) + JetBrains Mono (700), latin + vietnamese subsets only.
- `prefers-reduced-motion: reduce`: no CSS animations; flips become 0.9 s crossfades; no peek, no FLIP fly, no cursor trail, no face rain, no title pulse.
- Browsers: latest Chrome, Safari iOS 16+, Firefox, Edge.
- Page content: team photos, names, team-written captions, the codename "NOERR", event dates, and inside jokes only. Nothing about the client, product, architecture, or project status.
- Copy strings exactly as in the mockup: `NOERR / TEAM ONLY`, `SIDE A`, `THROWBACK`, `PRESS PLAY`, `TAP TO ENTER · SOUND ON`, `MUTE ANY TIME FROM THE DISC`, `↓ SCROLL FOR THE WALL`, `SIDE A · LIVE`, `THE WALL`, `TAP A PHOTO TO OPEN IT`, `SHUFFLE`, `MEMORIES`, `TAP = SHUFFLE`, `DUO`, `PHOTO`, `NO. `, `{n} MEMORIES · NO REPEATS TILL ALL ARE SHOWN`, `PHOTO · ORIGINAL`, `PREV`, `NEXT`, `SWIPE · ARROWS · ESC`, `SIDE B · CREDITS`, `CẢM ƠN!`, `NOERR · TEAM ONLY`, `BACK TO TOP`.
- Commit after every task. End each commit message with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

**Plan-level refinements to the spec** (the executor follows these):
- The packer places tiles on a 2×2-cell **block** grid. Each block is one medium, four smalls, half a wide, or a quarter of the large. A simulation of the spec's cell-by-cell scan gave ~65% smalls and ~5% wides; blocks give ~47/33/15 with a full rectangle every time.
- Tile ids are slot indices. Ids 0–3 are always large / Counter / Mosaic / Music, so these fly to their new spots on shuffle. The number of tiles can differ between packs: new ids fade in, dropped ids disappear.
- The Music tile is 1×1, too small for text. Its song title goes in the `aria-label`.

## Review Focus

These are the conditions most likely to hurt a real visitor that no single feature's happy path covers. Each has its test in the owning task.

1. **Pool smaller than the wall, or empty.** Expect: no crash, no infinite loop, duplicates only when unavoidable. The page shows a clear message when there are 0 memories. → Task 3 (queue tests), Task 7 (empty message).
2. **Shuffle or breakpoint change (phone rotation, window resize across 768 px) while tiles are mid-flip.** Expect: no tile ever flips to a blank face, no photo duplicated. → Task 5 (`revealHidden` + re-sync tests).
3. **Vietnamese text in decomposed (NFD) form**, as some editors and phones paste it. Expect: lettering keeps diacritics on their letter (`Ả` stays one glyph). → Task 6 (`graphemes` tests).
4. **Messy source folder:** uppercase `.JPG`, missing `captions.json`, the same photo saved twice under different names. Expect: all processed, no crash, duplicate dropped. → Task 2 (pipeline tests).
5. **iPhone in silent mode.** Web Audio is muted by the ringer switch unless `navigator.audioSession.type = 'playback'`. Expect: the song is audible after PRESS PLAY. → Task 7 (code + manual device check; this cannot be unit-tested).

---

### Task 1: Scaffold, tokens, content, and the empty memory list

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`
- Create: `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `src/content.ts`, `src/memories.json`
- Create: `src/lib/random.ts`, `src/lib/random.test.ts`, `src/lib/memory.ts`
- Create: `public/_headers`, `public/audio/lan-cuoi.mp3` (copied)

**Interfaces:**
- Produces:
  - `type Rand = () => number`
  - `mulberry32(seed: number): Rand`
  - `shuffle<T>(items: readonly T[], rand?: Rand): T[]`
  - `interface Memory { id: string; file: string; width: number; height: number; caption?: string; blurDataUrl: string }`
  - `type Duo = 'a' | 'b' | null`
  - `memories: Memory[]`
  - `WIDTHS = [240, 480, 960, 1600]`
  - `type Ext = 'avif' | 'webp'`
  - `imageUrl(id: string, w: number, ext: Ext): string`
  - `srcSet(id: string, ext: Ext): string`
  - `numberOf(m: Memory): string` (zero-padded 1-based index in `memories`)
  - `content` object (see code)

- [ ] **Step 1: Create `package.json` and install**

```json
{
  "name": "noerr-throwback",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "build:images": "node scripts/build-images.mjs"
  }
}
```

Run:
```bash
npm i react react-dom @fontsource/baloo-2 @fontsource/jetbrains-mono
npm i -D vite @vitejs/plugin-react typescript @types/react @types/react-dom vitest sharp
ls node_modules/@fontsource/baloo-2 | grep -E '^(latin|vietnamese)-(600|800)\.css$'
ls node_modules/@fontsource/jetbrains-mono | grep -E '^(latin|vietnamese)-700\.css$'
```
Expected: the two `ls` commands print 4 and 2 file names. If any file is missing, stop and report it. The font imports in Step 5 depend on them.

- [ ] **Step 2: Config files**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({ plugins: [react()] });
```

`.gitignore`:
```
node_modules
dist
.DS_Store
```

`index.html`:
```html
<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="theme-color" content="#0A0A0A" />
    <title>noerr-throwback</title>
  </head>
  <body style="background:#0A0A0A">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`public/_headers`:
```
/*
  X-Robots-Tag: noindex, nofollow
/assets/*
  Cache-Control: public, max-age=31536000, immutable
/memories/*
  Cache-Control: public, max-age=31536000, immutable
/audio/*
  Cache-Control: public, max-age=86400
```

Run:
```bash
mkdir -p public/audio && cp ~/Downloads/lan-cuoi.mp3 public/audio/lan-cuoi.mp3 && ls -la public/audio
```
Expected: `lan-cuoi.mp3` about 4.8 MB.

- [ ] **Step 3: Write the failing test for `random.ts`**

`src/lib/random.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { mulberry32, shuffle } from './random';

describe('shuffle', () => {
  it('returns a new permutation and leaves the input untouched', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(input, mulberry32(1));
    expect(out).not.toBe(input);
    expect([...out].sort((a, b) => a - b)).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('is deterministic for a seed', () => {
    expect(shuffle([1, 2, 3, 4, 5], mulberry32(7))).toEqual(shuffle([1, 2, 3, 4, 5], mulberry32(7)));
  });

  it('actually reorders', () => {
    const orders = Array.from({ length: 20 }, (_, s) => shuffle([1, 2, 3, 4, 5, 6], mulberry32(s + 1)).join());
    expect(orders.filter(o => o !== '1,2,3,4,5,6').length).toBeGreaterThan(15);
  });
});
```

- [ ] **Step 4: Run it, verify it fails**

Run: `npx vitest run src/lib/random.test.ts`
Expected: FAIL, cannot resolve `./random`.

- [ ] **Step 5: Implement `random.ts`, `memory.ts`, content, styles, entry**

`src/lib/random.ts`:
```ts
export type Rand = () => number;

/** Small seeded PRNG so tests are deterministic; the app uses Math.random. */
export function mulberry32(seed: number): Rand {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates; returns a new array. */
export function shuffle<T>(items: readonly T[], rand: Rand = Math.random): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
```

`src/memories.json`:
```json
[]
```

`src/lib/memory.ts`:
```ts
import data from '../memories.json';

export interface Memory {
  id: string;
  file: string;
  width: number;
  height: number;
  caption?: string;
  blurDataUrl: string;
}

export type Duo = 'a' | 'b' | null;

export const memories: Memory[] = data;

export const WIDTHS = [240, 480, 960, 1600] as const;
export type Ext = 'avif' | 'webp';

export const imageUrl = (id: string, w: number, ext: Ext) => `/memories/${id}-${w}.${ext}`;
export const srcSet = (id: string, ext: Ext) => WIDTHS.map(w => `${imageUrl(id, w, ext)} ${w}w`).join(', ');

const index = new Map(memories.map((m, i) => [m.id, i + 1]));
/** Stable display number ("07"), independent of the per-visit shuffle. */
export const numberOf = (m: Memory) => String(index.get(m.id) ?? 0).padStart(2, '0');
```

`src/content.ts`:
```ts
// Team-written copy. Replace the [bracketed] placeholders before launch.
// Never add anything about the client, the product, or the work itself.
export const content = {
  subtitle: '[Date range] · [Inside joke]',
  songTitle: '[SONG TITLE]',
  thanks: '[Thank-you line from the team]',
  colourWords: ['NOERR', 'YAY', 'WOW'],
  team: Array.from({ length: 14 }, () => ({ name: '[Team member]', role: '[ROLE]' })),
};
```

`src/styles.css`:
```css
:root {
  --violet: #5539eb;
  --violet-hover: #6a50ff;
  --orange: #ff6b1a;
  --pink: #ff3fb4;
  --green: #1e8a3e;
  --ink: #0a0a0a;
  --cream: #fff1dc;
  --muted: #bfb3a3;
  --tile-bg: #2a2522;
  --gutter: 20px;
  --gap: 10px;
  --maxw: 1320px;
  --pulse: 0;
  color-scheme: dark;
}
@media (min-width: 768px) {
  :root { --gutter: 60px; --gap: 16px; }
}
@media (prefers-reduced-motion: no-preference) {
  html { scroll-behavior: smooth; }
}

* { box-sizing: border-box; }
html, body { background: var(--ink); }
body {
  margin: 0;
  color: var(--cream);
  font: 700 14px/1.4 'JetBrains Mono', ui-monospace, Menlo, monospace;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}
a { color: var(--orange); }
a:hover { color: var(--pink); }
button { font: inherit; color: inherit; }
:focus-visible { outline: 3px solid var(--cream); outline-offset: 3px; }

.disp { font-family: 'Baloo 2', 'Arial Rounded MT Bold', 'Trebuchet MS', sans-serif; font-weight: 800; }
.label { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--orange); }
.label--cream { color: var(--cream); }
.label--muted { color: var(--muted); }

.letter {
  margin: 0;
  line-height: 1;
  color: var(--violet);
  -webkit-text-stroke: 3px var(--orange);
  paint-order: stroke fill;
  text-shadow: 1px 1px 0 var(--green), 2px 2px 0 var(--green), 3px 3px 0 var(--green), 4px 4px 0 var(--green),
    5px 5px 0 var(--green), 6px 6px 0 var(--green);
}
@media (min-width: 768px) {
  .letter {
    -webkit-text-stroke-width: 6px;
    text-shadow: 1px 1px 0 var(--green), 2px 2px 0 var(--green), 3px 3px 0 var(--green), 4px 4px 0 var(--green),
      5px 5px 0 var(--green), 6px 6px 0 var(--green), 7px 7px 0 var(--green), 8px 8px 0 var(--green),
      9px 9px 0 var(--green), 10px 10px 0 var(--green);
  }
}

.divider { border: 0; border-top: 3px dashed var(--orange); margin: 0; }
.chip {
  display: inline-block; padding: 3px 8px; border-radius: 999px;
  background: var(--ink); color: var(--orange);
  font-size: 11px; font-weight: 700; letter-spacing: 0.1em; line-height: 1.2;
}
.pill {
  display: inline-flex; align-items: center; height: 50px; padding: 0 16px;
  border-radius: 999px; border: 3px solid var(--ink); background: var(--pink); color: var(--ink);
  box-shadow: 5px 5px 0 var(--orange); font-size: 32px; line-height: 1; transform: rotate(-4deg);
}
.btn-pink {
  display: inline-flex; align-items: center; gap: 10px; height: 48px; padding: 0 22px;
  border-radius: 999px; border: 3px solid var(--ink); background: var(--pink); color: var(--ink);
  box-shadow: 5px 5px 0 var(--orange); font-weight: 700; letter-spacing: 0.12em; cursor: pointer;
}
.btn-ghost {
  height: 44px; padding: 0 18px; border-radius: 999px; border: 3px solid var(--orange);
  background: none; color: var(--orange); font-weight: 700; letter-spacing: 0.12em; cursor: pointer;
}
.topbar {
  position: absolute; inset: 0 0 auto; z-index: 2;
  display: flex; justify-content: space-between; padding: 24px var(--gutter);
}
.empty { padding: 40px var(--gutter); }

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes bob { 0%, 100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(-7px) rotate(4deg); } }
@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
@keyframes wobble {
  0% { transform: rotate(0) scale(1); }
  25% { transform: rotate(-4deg) scale(1.05); }
  50% { transform: rotate(3deg) scale(1.07); }
  75% { transform: rotate(-2deg) scale(1.05); }
  100% { transform: rotate(0) scale(1.05); }
}
.spin { animation: spin 4s linear infinite; }
.spin-slow { animation: spin 14s linear infinite; }
.bob { display: inline-block; animation: bob 3.2s ease-in-out infinite; }
.pulse { animation: pulse 1.6s ease-in-out infinite; }
.is-paused { animation-play-state: paused; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; }
}
```

`src/App.tsx` (temporary; replaced in Task 7):
```tsx
import { memories } from './lib/memory';

export function App() {
  return <p className="label empty">{memories.length} MEMORIES</p>;
}
```

`src/main.tsx`:
```tsx
import { createRoot } from 'react-dom/client';
import '@fontsource/baloo-2/latin-600.css';
import '@fontsource/baloo-2/latin-800.css';
import '@fontsource/baloo-2/vietnamese-600.css';
import '@fontsource/baloo-2/vietnamese-800.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import '@fontsource/jetbrains-mono/vietnamese-700.css';
import './styles.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<App />);
```
(No `StrictMode`: the wall's queue has side effects in state initializers. Running them twice would skip photos in round one during dev.)

- [ ] **Step 6: Verify**

Run: `npx vitest run && npm run build`
Expected: 3 tests pass; build succeeds and writes `dist/`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold noerr-throwback (vite, react, tokens, song)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Image pipeline

**Files:**
- Create: `scripts/build-images.mjs`, `scripts/build-images.test.mjs`, `content/captions.json`
- Modify (generated): `src/memories.json`, `public/memories/*`

**Interfaces:**
- Produces:
  - `buildImages({ src, outDir, jsonPath, captionsPath, log? }): Promise<Memory[]>`
  - CLI `npm run build:images` (env `PHOTOS_SRC`, default `/Users/mnluu/pic/noerr`)
- Output file naming: `public/memories/<id>-<w>.<avif|webp>`, where `id` = first 8 hex chars of the SHA-1 of the source bytes.

- [ ] **Step 1: Write the failing test**

`scripts/build-images.test.mjs`:
```js
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildImages, WIDTHS } from './build-images.mjs';

let dir, src, outDir, jsonPath, captionsPath;
const run = () => buildImages({ src, outDir, jsonPath, captionsPath, log: () => {} });

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'noerr-images-'));
  src = path.join(dir, 'src');
  outDir = path.join(dir, 'out');
  jsonPath = path.join(dir, 'memories.json');
  captionsPath = path.join(dir, 'captions.json'); // deliberately not created yet
  await fs.mkdir(src);
  // 400x200 landscape stored with EXIF orientation 6 (displays as 200x400 portrait).
  await sharp({ create: { width: 400, height: 200, channels: 3, background: '#ff0000' } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toFile(path.join(src, 'rotated.JPG'));
  await sharp({ create: { width: 300, height: 300, channels: 3, background: '#0000ff' } })
    .png()
    .toFile(path.join(src, 'blue.png'));
  await fs.copyFile(path.join(src, 'blue.png'), path.join(src, 'zz-blue-again.png'));
  await fs.writeFile(path.join(src, 'notes.txt'), 'ignore me');
});

describe('buildImages', () => {
  it('works without captions.json, handles uppercase ext, drops byte-identical duplicates', async () => {
    const out = await run();
    expect(out.map(m => m.file).sort()).toEqual(['blue.png', 'rotated.JPG']);
    expect(await fs.readFile(jsonPath, 'utf8').then(JSON.parse)).toEqual(out);
    expect([...out].map(m => m.id)).toEqual([...out].map(m => m.id).sort());
  });

  it('applies orientation, strips all EXIF, writes every width and format', async () => {
    const [rotated] = (await run()).filter(m => m.file === 'rotated.JPG');
    expect(rotated.width).toBe(200);
    expect(rotated.height).toBe(400);
    expect((await sharp(path.join(src, 'rotated.JPG')).metadata()).exif).toBeDefined(); // precondition
    for (const w of WIDTHS) {
      for (const ext of ['avif', 'webp']) {
        const meta = await sharp(path.join(outDir, `${rotated.id}-${w}.${ext}`)).metadata();
        expect(meta.exif).toBeUndefined();
        expect(meta.orientation).toBeUndefined();
        expect(meta.height).toBeGreaterThan(meta.width);
      }
    }
    expect(rotated.blurDataUrl).toMatch(/^data:image\/webp;base64,/);
  });

  it('adds captions keyed by original filename', async () => {
    await fs.writeFile(captionsPath, JSON.stringify({ 'blue.png': 'Ngày xanh' }));
    const out = await run();
    expect(out.find(m => m.file === 'blue.png').caption).toBe('Ngày xanh');
    expect('caption' in out.find(m => m.file === 'rotated.JPG')).toBe(false);
  });

  it('skips existing outputs and prunes removed sources', async () => {
    const [blue] = (await run()).filter(m => m.file === 'blue.png');
    const probe = path.join(outDir, `${blue.id}-240.webp`);
    const before = (await fs.stat(probe)).mtimeMs;
    await run();
    expect((await fs.stat(probe)).mtimeMs).toBe(before);

    await fs.rm(path.join(src, 'blue.png'));
    await fs.rm(path.join(src, 'zz-blue-again.png'));
    const out = await run();
    expect(out.map(m => m.file)).toEqual(['rotated.JPG']);
    expect((await fs.readdir(outDir)).some(f => f.startsWith(blue.id))).toBe(false);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run scripts/build-images.test.mjs`
Expected: FAIL, cannot resolve `./build-images.mjs`.

- [ ] **Step 3: Implement**

`scripts/build-images.mjs`:
```js
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

export const WIDTHS = [240, 480, 960, 1600];
const FORMATS = ['avif', 'webp'];
const SOURCE = /\.(jpe?g|png|heic)$/i;
const OUTPUT = /^([0-9a-f]{8})-\d+\.(avif|webp)$/;

const exists = p => fs.access(p).then(() => true, () => false);

async function readCaptions(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw new Error(`${file}: ${err.message}`); // malformed JSON should fail loudly
  }
}

/** sharp's prebuilt binaries cannot decode HEIC; convert with macOS `sips`. */
async function heicToJpeg(file) {
  if (process.platform !== 'darwin') return null;
  const tmp = path.join(os.tmpdir(), `noerr-${process.pid}-${Date.now()}.jpg`);
  execFileSync('sips', ['-s', 'format', 'jpeg', file, '--out', tmp], { stdio: 'ignore' });
  try {
    return await fs.readFile(tmp);
  } finally {
    await fs.rm(tmp, { force: true });
  }
}

export async function buildImages({ src, outDir, jsonPath, captionsPath, log = console.log }) {
  const captions = await readCaptions(captionsPath);
  await fs.mkdir(outDir, { recursive: true });
  const names = (await fs.readdir(src)).filter(n => SOURCE.test(n)).sort();
  const seen = new Map();
  const out = [];

  for (const name of names) {
    const full = path.join(src, name);
    const raw = await fs.readFile(full);
    const id = createHash('sha1').update(raw).digest('hex').slice(0, 8);
    if (seen.has(id)) {
      log(`skip duplicate: ${name} (same bytes as ${seen.get(id)})`);
      continue;
    }
    const input = /\.heic$/i.test(name) ? await heicToJpeg(full) : raw;
    if (!input) {
      log(`skip HEIC (needs macOS sips): ${name}`);
      continue;
    }
    seen.set(id, name);

    const meta = await sharp(input).metadata();
    const swap = (meta.orientation ?? 1) >= 5; // orientations 5-8 rotate by 90°
    const width = swap ? meta.height : meta.width;
    const height = swap ? meta.width : meta.height;

    const targets = WIDTHS.flatMap(w => FORMATS.map(ext => path.join(outDir, `${id}-${w}.${ext}`)));
    if (!(await Promise.all(targets.map(exists))).every(Boolean)) {
      for (const w of WIDTHS) {
        // No withMetadata(): sharp drops EXIF (GPS, device) and ICC by default.
        const resized = sharp(input).rotate().resize({ width: w, withoutEnlargement: true });
        await resized.clone().avif({ quality: 50, effort: 4 }).toFile(path.join(outDir, `${id}-${w}.avif`));
        await resized.clone().webp({ quality: 75 }).toFile(path.join(outDir, `${id}-${w}.webp`));
      }
      log(`processed ${name} -> ${id}`);
    }
    const blur = await sharp(input).rotate().resize({ width: 24 }).webp({ quality: 40 }).toBuffer();
    out.push({
      id,
      file: name,
      width,
      height,
      ...(captions[name] ? { caption: captions[name] } : {}),
      blurDataUrl: `data:image/webp;base64,${blur.toString('base64')}`,
    });
  }

  const keep = new Set(out.map(m => m.id));
  for (const f of await fs.readdir(outDir)) {
    const match = OUTPUT.exec(f);
    if (match && !keep.has(match[1])) {
      await fs.rm(path.join(outDir, f));
      log(`pruned ${f}`);
    }
  }

  out.sort((a, b) => a.id.localeCompare(b.id));
  await fs.writeFile(jsonPath, `${JSON.stringify(out, null, 2)}\n`);
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const out = await buildImages({
    src: process.env.PHOTOS_SRC ?? '/Users/mnluu/pic/noerr',
    outDir: path.join(root, 'public/memories'),
    jsonPath: path.join(root, 'src/memories.json'),
    captionsPath: path.join(root, 'content/captions.json'),
  });
  console.log(`${out.length} memories`);
}
```

`content/captions.json`:
```json
{}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run scripts/build-images.test.mjs`
Expected: 4 tests PASS.

- [ ] **Step 5: HUMAN GATE — curation before real output**

Stop and ask your human partner to confirm that `/Users/mnluu/pic/noerr` is curated:
- no screens, whiteboards, laptops, or documents visible in any photo;
- people in the photos are OK with being shown;
- no duplicates they want removed.

Do not continue until they say yes.

- [ ] **Step 6: Run on real photos and verify no metadata leaked**

Run:
```bash
npm run build:images
node -e "import('sharp').then(async ({default:s})=>{const fs=await import('node:fs');const fsP=fs.promises;const d='public/memories';let bad=0;for(const f of await fsP.readdir(d)){const m=await s(d+'/'+f).metadata();if(m.exif)bad++}console.log('files with EXIF:',bad)})"
du -sh public/memories && node -e "console.log(require('./src/memories.json').length+' memories')"
```
Expected: `N memories` for N ≤ 36 (the HEIC is included on macOS), `files with EXIF: 0`, and a folder size of roughly 10–30 MB.

- [ ] **Step 7: Commit**

```bash
git add scripts content src/memories.json public/memories
git commit -m "feat: image pipeline (EXIF strip, AVIF/WebP variants, blur placeholders)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Photo queue

**Files:**
- Create: `src/wall/queue.ts`, `src/wall/queue.test.ts`

**Interfaces:**
- Consumes: `Memory` (from `src/lib/memory.ts`); `Rand`, `shuffle` (from `src/lib/random.ts`)
- Produces:
  - `interface Queue { next(onScreen: ReadonlySet<string>): Memory }`
  - `createQueue(order: readonly Memory[], rand?: Rand): Queue` (throws on an empty pool)

- [ ] **Step 1: Write the failing test**

`src/wall/queue.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Memory } from '../lib/memory';
import { mulberry32 } from '../lib/random';
import { createQueue } from './queue';

const mem = (i: number): Memory => ({ id: `m${i}`, file: `${i}.jpg`, width: 1, height: 1, blurDataUrl: '' });
const pool = (n: number) => Array.from({ length: n }, (_, i) => mem(i));
const none = new Set<string>();

describe('createQueue', () => {
  it('serves the given order first, each memory once', () => {
    const q = createQueue(pool(10), mulberry32(1));
    expect(Array.from({ length: 10 }, () => q.next(none).id)).toEqual(pool(10).map(m => m.id));
  });

  it('serves everything once per round in later rounds too', () => {
    const q = createQueue(pool(10), mulberry32(1));
    for (let i = 0; i < 10; i++) q.next(none);
    expect(new Set(Array.from({ length: 10 }, () => q.next(none).id)).size).toBe(10);
  });

  it('never returns an on-screen memory while an off-screen one exists', () => {
    const q = createQueue(pool(12), mulberry32(2));
    const rand = mulberry32(3);
    for (let k = 0; k < 500; k++) {
      const onScreen = new Set(pool(12).filter(() => rand() < 0.6).map(m => m.id));
      if (onScreen.size === 12) continue;
      expect(onScreen.has(q.next(onScreen).id)).toBe(false);
    }
  });

  it('does not repeat back-to-back across rounds', () => {
    const q = createQueue(pool(3), mulberry32(4));
    let prev = '';
    for (let k = 0; k < 300; k++) {
      const id = q.next(none).id;
      expect(id).not.toBe(prev);
      prev = id;
    }
  });

  it('allows a duplicate instead of failing when every memory is on screen', () => {
    const q = createQueue(pool(3), mulberry32(5));
    const all = new Set(pool(3).map(m => m.id));
    for (let k = 0; k < 10; k++) expect(all.has(q.next(all).id)).toBe(true);
  });

  it('works with a single memory', () => {
    const q = createQueue(pool(1));
    expect(q.next(none).id).toBe('m0');
    expect(q.next(none).id).toBe('m0');
  });

  it('rejects an empty pool', () => {
    expect(() => createQueue([])).toThrow(/empty/);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/wall/queue.test.ts`
Expected: FAIL, cannot resolve `./queue`.

- [ ] **Step 3: Implement**

`src/wall/queue.ts`:
```ts
import type { Memory } from '../lib/memory';
import { shuffle, type Rand } from '../lib/random';

export interface Queue {
  next(onScreen: ReadonlySet<string>): Memory;
}

/**
 * Shared photo pool for the wall: no memory repeats until all were shown,
 * and a memory already on screen is skipped while any other is available.
 */
export function createQueue(order: readonly Memory[], rand: Rand = Math.random): Queue {
  if (order.length === 0) throw new Error('createQueue: empty pool');
  let round = order.slice();
  let pos = 0;
  let last: string | undefined;

  const newRound = () => {
    round = shuffle(order, rand);
    if (round.length > 1 && round[0].id === last) [round[0], round[1]] = [round[1], round[0]];
    pos = 0;
  };
  const serve = (i: number) => {
    [round[pos], round[i]] = [round[i], round[pos]];
    last = round[pos].id;
    return round[pos++];
  };

  return {
    next(onScreen) {
      for (let attempt = 0; attempt < 2; attempt++) {
        if (pos >= round.length) newRound();
        const i = round.findIndex((m, k) => k >= pos && !onScreen.has(m.id));
        if (i !== -1) return serve(i);
        pos = round.length; // everything left in this round is on screen already: counts as shown
      }
      newRound();
      return serve(0); // pool smaller than the wall: a duplicate beats a blank tile
    },
  };
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run src/wall/queue.test.ts`
Expected: 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/wall/queue.ts src/wall/queue.test.ts
git commit -m "feat: shuffled photo queue with no-repeat and no-duplicate rules

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Wall packer and tile type assignment

**Files:**
- Create: `src/wall/layout.ts`, `src/wall/layout.test.ts`

**Interfaces:**
- Consumes: `Rand`, `shuffle`
- Produces:
  - `type Size = 'small' | 'medium' | 'wide' | 'large'`
  - `type TileKind = 'flip' | 'peek' | 'mosaic' | 'colour' | 'counter' | 'music'`
  - `type Colour = 'violet' | 'orange' | 'pink' | 'green'`
  - `const COLOURS: readonly Colour[]`
  - `interface Placement { col: number; row: number; w: number; h: number; size: Size }` (0-based cells)
  - `interface TileSpec extends Placement { id: number; kind: TileKind; colour: Colour }`
  - `const GRID = { phone: { cols: 4, rows: 16 }, desktop: { cols: 8, rows: 12 } }`
  - `pack(cols: number, rows: number, rand: Rand): Placement[]`: index 0 large, 1 and 2 medium, 3 small
  - `assign(placements: Placement[], rand: Rand, reducedMotion: boolean): TileSpec[]`: id = index; ids 0/1/2/3 = large flip / counter / mosaic / music

- [ ] **Step 1: Write the failing test**

`src/wall/layout.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../lib/random';
import { assign, GRID, pack, type Placement } from './layout';

function coverage(tiles: Placement[], cols: number, rows: number) {
  const cells = new Array<number>(cols * rows).fill(0);
  for (const t of tiles) {
    for (let y = t.row; y < t.row + t.h; y++)
      for (let x = t.col; x < t.col + t.w; x++) {
        if (x >= cols || y >= rows) throw new Error(`out of bounds at ${x},${y}`);
        cells[y * cols + x]++;
      }
  }
  return cells;
}

for (const { cols, rows } of [GRID.phone, GRID.desktop]) {
  describe(`${cols}×${rows}`, () => {
    it('covers the rectangle exactly once (no gaps, no overlap)', () => {
      for (let s = 1; s <= 200; s++) {
        expect(coverage(pack(cols, rows, mulberry32(s)), cols, rows).every(c => c === 1)).toBe(true);
      }
    });

    it('has exactly one large, one counter/mosaic (medium), one music (small), two colour blocks', () => {
      for (let s = 1; s <= 100; s++) {
        const tiles = assign(pack(cols, rows, mulberry32(s)), mulberry32(s + 1000), false);
        const of = (k: string) => tiles.filter(t => t.kind === k);
        expect(tiles.filter(t => t.size === 'large')).toHaveLength(1);
        expect(tiles[0].size).toBe('large');
        expect(of('counter').map(t => [t.id, t.size])).toEqual([[1, 'medium']]);
        expect(of('mosaic').map(t => [t.id, t.size])).toEqual([[2, 'medium']]);
        expect(of('music').map(t => [t.id, t.size])).toEqual([[3, 'small']]);
        expect(of('colour')).toHaveLength(2);
        expect(of('colour').every(t => t.size === 'small' || t.size === 'medium')).toBe(true);
      }
    });

    it('keeps size shares near 40/35/20', () => {
      const total = { small: 0, medium: 0, wide: 0, large: 0 };
      let n = 0;
      for (let s = 1; s <= 300; s++) {
        for (const t of pack(cols, rows, mulberry32(s))) { total[t.size]++; n++; }
      }
      expect(total.small / n).toBeGreaterThan(0.35);
      expect(total.small / n).toBeLessThan(0.55);
      expect(total.medium / n).toBeGreaterThan(0.25);
      expect(total.medium / n).toBeLessThan(0.45);
      expect(total.wide / n).toBeGreaterThan(0.08);
      expect(total.wide / n).toBeLessThan(0.3);
    });

    it('puts peek only on medium/wide, never under reduced motion', () => {
      for (let s = 1; s <= 100; s++) {
        const placements = pack(cols, rows, mulberry32(s));
        const peeks = assign(placements, mulberry32(s), false).filter(t => t.kind === 'peek');
        expect(peeks.every(t => t.size === 'medium' || t.size === 'wide')).toBe(true);
        expect(assign(placements, mulberry32(s), true).some(t => t.kind === 'peek')).toBe(false);
      }
    });

    it('numbers ids 0..n-1', () => {
      const tiles = assign(pack(cols, rows, mulberry32(9)), mulberry32(9), false);
      expect(tiles.map(t => t.id)).toEqual(tiles.map((_, i) => i));
    });

    it('never has more photo slots than a 36-photo pool can fill', () => {
      for (let s = 1; s <= 200; s++) {
        const tiles = assign(pack(cols, rows, mulberry32(s)), mulberry32(s), false);
        const slots = tiles.filter(t => t.kind === 'flip' || t.kind === 'peek').length + 4; // + mosaic minis
        expect(slots).toBeLessThan(36);
      }
    });
  });
}
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/wall/layout.test.ts`
Expected: FAIL, cannot resolve `./layout`.

- [ ] **Step 3: Implement**

`src/wall/layout.ts`:
```ts
import { shuffle, type Rand } from '../lib/random';

export type Size = 'small' | 'medium' | 'wide' | 'large';
export type TileKind = 'flip' | 'peek' | 'mosaic' | 'colour' | 'counter' | 'music';
export type Colour = 'violet' | 'orange' | 'pink' | 'green';
export const COLOURS: readonly Colour[] = ['violet', 'orange', 'pink', 'green'];

export interface Placement { col: number; row: number; w: number; h: number; size: Size }
export interface TileSpec extends Placement { id: number; kind: TileKind; colour: Colour }

export const GRID = { phone: { cols: 4, rows: 16 }, desktop: { cols: 8, rows: 12 } } as const;

// The wall is packed in 2×2-cell blocks: a block is one medium, four smalls,
// half a wide (4×2) or a quarter of the large (4×4). Packing by blocks leaves
// no odd holes, so the rectangle is always full and wides stay possible.
type BlockKind = 'large' | 'wide' | 'medium' | 'smalls';
const SPAN: Record<BlockKind, [number, number]> = { large: [2, 2], wide: [2, 1], medium: [1, 1], smalls: [1, 1] };
const TARGET = { small: 0.4, medium: 0.35, wide: 0.2 };

function pickIndex(weights: number[], rand: Rand) {
  let x = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length - 1; i++) {
    if (x < weights[i]) return i;
    x -= weights[i];
  }
  return weights.length - 1;
}

export function pack(cols: number, rows: number, rand: Rand): Placement[] {
  const bc = cols / 2;
  const br = rows / 2;
  const used = new Array<boolean>(bc * br).fill(false);
  const out: Placement[] = [];
  const count = { small: 0, medium: 0, wide: 0 };

  const free = (c: number, r: number, [w, h]: [number, number]) => {
    if (c + w > bc || r + h > br) return false;
    for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) if (used[y * bc + x]) return false;
    return true;
  };
  const put = (c: number, r: number, kind: BlockKind) => {
    const [w, h] = SPAN[kind];
    for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) used[y * bc + x] = true;
    if (kind === 'smalls') {
      for (let k = 0; k < 4; k++) out.push({ col: c * 2 + (k % 2), row: r * 2 + (k >> 1), w: 1, h: 1, size: 'small' });
      count.small += 4;
      return;
    }
    out.push({ col: c * 2, row: r * 2, w: w * 2, h: h * 2, size: kind });
    if (kind !== 'large') count[kind]++;
  };
  const putRandom = (kind: BlockKind) => {
    const spots: [number, number][] = [];
    for (let r = 0; r < br; r++) for (let c = 0; c < bc; c++) if (free(c, r, SPAN[kind])) spots.push([c, r]);
    const [c, r] = spots[Math.floor(rand() * spots.length)];
    put(c, r, kind);
  };

  // Fixed order so assign() can rely on indices: 0 large, 1 counter, 2 mosaic, 3 music.
  putRandom('large');
  putRandom('medium');
  putRandom('medium');
  putRandom('smalls');

  for (let r = 0; r < br; r++) {
    for (let c = 0; c < bc; c++) {
      if (used[r * bc + c]) continue;
      const options = (['wide', 'medium', 'smalls'] as const).filter(k => free(c, r, SPAN[k]));
      const placed = count.small + count.medium + count.wide;
      // Favour whichever size is furthest below its target share.
      const weights = options.map(k => {
        const s = k === 'smalls' ? 'small' : k;
        return Math.max(0.02, TARGET[s] * (placed + 1) - count[s]) ** 2;
      });
      put(c, r, options[pickIndex(weights, rand)]);
    }
  }
  return out;
}

export function assign(placements: Placement[], rand: Rand, reducedMotion: boolean): TileSpec[] {
  const kinds: TileKind[] = placements.map((_, i) =>
    i === 1 ? 'counter' : i === 2 ? 'mosaic' : i === 3 ? 'music' : 'flip',
  );
  const colourable = placements
    .map((p, i) => ({ p, i }))
    .filter(({ p, i }) => i >= 4 && (p.size === 'small' || p.size === 'medium'))
    .map(({ i }) => i);
  for (const i of shuffle(colourable, rand).slice(0, 2)) kinds[i] = 'colour';

  return placements.map((p, i) => {
    let kind = kinds[i];
    if (kind === 'flip' && !reducedMotion && (p.size === 'medium' || p.size === 'wide') && rand() < 0.5) kind = 'peek';
    return { ...p, id: i, kind, colour: COLOURS[Math.floor(rand() * COLOURS.length)] };
  });
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run src/wall/layout.test.ts`
Expected: 12 tests PASS (6 per grid). If the share test fails, you may tune only the exponent in `weights` (2 → 1.5 or 3). Do not loosen the test bounds.

- [ ] **Step 5: Commit**

```bash
git add src/wall/layout.ts src/wall/layout.test.ts
git commit -m "feat: block-based wall packer and tile type assignment

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Tile face state

**Files:**
- Create: `src/wall/pairs.ts`, `src/wall/pairs.test.ts`

**Interfaces:**
- Consumes: `Memory`, `Duo`, `Rand`, `Queue`, `TileSpec`
- Produces:
  - `interface Pair { faces: [Memory | null, Memory | null]; duo: [Duo, Duo]; back: boolean }` (visible face = `faces[back ? 1 : 0]`)
  - `interface TileState { main: Pair; minis: Pair[]; miniTurn: number; peeking: boolean }`
  - `type States = Record<number, TileState>`
  - `type SlotKey = 'main' | number`
  - `emptyPair()`, `hiddenIndex(p)`, `visible(p)`, `loadHidden(p, m, duo)`, `turnPair(p)`, `revealHidden(p)`, `clearHidden(p)`
  - `patchSlot(s, slot, fn)`, `rollDuo(rand)`, `onScreenIds(states): Set<string>`
  - `syncStates(layout, prev, queue, rand?): States`

Semantics: a flip loads the next photo into the hidden face, turns, then clears the old face, so a face holds a photo only while it is visible or about to be. `onScreenIds` counts every non-null face.

- [ ] **Step 1: Write the failing test**

`src/wall/pairs.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Memory } from '../lib/memory';
import { mulberry32 } from '../lib/random';
import { assign, GRID, pack } from './layout';
import {
  clearHidden, emptyPair, loadHidden, onScreenIds, patchSlot, revealHidden, rollDuo, syncStates, turnPair, visible,
  type States,
} from './pairs';
import { createQueue } from './queue';

const mem = (i: number): Memory => ({ id: `m${i}`, file: `${i}.jpg`, width: 1, height: 1, blurDataUrl: '' });
const pool = Array.from({ length: 36 }, (_, i) => mem(i));

function allFaceIds(states: States) {
  return Object.values(states).flatMap(s => [s.main, ...s.minis].flatMap(p => p.faces.filter(Boolean).map(m => m!.id)));
}

describe('pair lifecycle', () => {
  it('load → turn → clear shows the new photo and forgets the old one', () => {
    let p = loadHidden(emptyPair(), mem(1), null);
    p = revealHidden(p);
    p = clearHidden(p);
    expect(visible(p)?.id).toBe('m1');
    p = loadHidden(p, mem(2), 'a');
    expect(visible(p)?.id).toBe('m1');
    p = clearHidden(revealHidden(p));
    expect(visible(p)?.id).toBe('m2');
    expect(p.faces.filter(Boolean)).toHaveLength(1);
  });

  it('revealHidden refuses to turn onto an empty face', () => {
    const p = clearHidden(revealHidden(loadHidden(emptyPair(), mem(1), null)));
    expect(revealHidden(p)).toBe(p);
    expect(visible(turnPair(p))).toBeNull(); // plain turn is allowed (colour tile back to its word)
  });

  it('patchSlot ignores a mosaic mini that no longer exists', () => {
    const s = { main: emptyPair(), minis: [], miniTurn: 0, peeking: false };
    expect(patchSlot(s, 2, turnPair)).toBe(s);
  });

  it('rollDuo makes about a third duotone', () => {
    const rand = mulberry32(1);
    const hits = Array.from({ length: 3000 }, () => rollDuo(rand)).filter(Boolean).length / 3000;
    expect(hits).toBeGreaterThan(0.28);
    expect(hits).toBeLessThan(0.39);
  });
});

describe('syncStates', () => {
  const layoutFor = (cols: number, rows: number, seed: number) => assign(pack(cols, rows, mulberry32(seed)), mulberry32(seed), false);

  it('fills every photo tile and 4 mosaic minis with no duplicates', () => {
    for (let s = 1; s <= 50; s++) {
      const layout = layoutFor(GRID.desktop.cols, GRID.desktop.rows, s);
      const states = syncStates(layout, {}, createQueue(pool, mulberry32(s)), mulberry32(s));
      const ids = allFaceIds(states);
      expect(new Set(ids).size).toBe(ids.length);
      for (const t of layout) {
        const st = states[t.id];
        if (t.kind === 'flip' || t.kind === 'peek') expect(visible(st.main)).not.toBeNull();
        if (t.kind === 'mosaic') expect(st.minis.map(visible).every(Boolean)).toBe(true);
        if (t.kind === 'mosaic') expect(st.minis).toHaveLength(4);
        if (t.kind === 'counter' || t.kind === 'music' || t.kind === 'colour') expect(visible(st.main)).toBeNull();
      }
    }
  });

  it('re-sync to a new layout (shuffle or breakpoint change) keeps photos where possible, never duplicates', () => {
    const queue = createQueue(pool, mulberry32(3));
    const a = layoutFor(GRID.desktop.cols, GRID.desktop.rows, 3);
    const first = syncStates(a, {}, queue, mulberry32(3));
    // simulate a tile mid-flip: hidden face loaded, not yet turned
    first[0] = { ...first[0], main: loadHidden(first[0].main, queue.next(onScreenIds(first)), null) };
    const b = layoutFor(GRID.phone.cols, GRID.phone.rows, 4);
    const second = syncStates(b, first, queue, mulberry32(4));
    const ids = allFaceIds(second);
    expect(new Set(ids).size).toBe(ids.length);
    expect(visible(second[0].main)?.id).toBe(visible(first[0].main)?.id); // large tile keeps its photo
    expect(second[0].main.faces.filter(Boolean)).toHaveLength(1); // mid-flip face dropped
    for (const t of b) if (t.kind === 'flip' || t.kind === 'peek') expect(visible(second[t.id].main)).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/wall/pairs.test.ts`
Expected: FAIL, cannot resolve `./pairs`.

- [ ] **Step 3: Implement**

`src/wall/pairs.ts`:
```ts
import type { Duo, Memory } from '../lib/memory';
import type { Rand } from '../lib/random';
import type { TileSpec } from './layout';
import type { Queue } from './queue';

/** Two faces of a flipper. Visible face = faces[back ? 1 : 0]; the other is empty or holds the next photo. */
export interface Pair { faces: [Memory | null, Memory | null]; duo: [Duo, Duo]; back: boolean }
export interface TileState { main: Pair; minis: Pair[]; miniTurn: number; peeking: boolean }
export type States = Record<number, TileState>;
export type SlotKey = 'main' | number;

export const emptyPair = (): Pair => ({ faces: [null, null], duo: [null, null], back: false });
export const hiddenIndex = (p: Pair): 0 | 1 => (p.back ? 0 : 1);
export const visible = (p: Pair): Memory | null => p.faces[p.back ? 1 : 0];

export function loadHidden(p: Pair, m: Memory | null, duo: Duo): Pair {
  const h = hiddenIndex(p);
  const faces: Pair['faces'] = [...p.faces];
  const d: Pair['duo'] = [...p.duo];
  faces[h] = m;
  d[h] = duo;
  return { ...p, faces, duo: d };
}
export const turnPair = (p: Pair): Pair => ({ ...p, back: !p.back });
/** Turn only onto a loaded face: a re-pack may have emptied it mid-flip. */
export const revealHidden = (p: Pair): Pair => (p.faces[hiddenIndex(p)] ? turnPair(p) : p);
export const clearHidden = (p: Pair): Pair => loadHidden(p, null, null);

export function patchSlot(s: TileState, slot: SlotKey, fn: (p: Pair) => Pair): TileState {
  if (slot === 'main') return { ...s, main: fn(s.main) };
  if (!s.minis[slot]) return s;
  return { ...s, minis: s.minis.map((p, i) => (i === slot ? fn(p) : p)) };
}

/** ~1 in 3 photos duotone, split between the two colourways. */
export const rollDuo = (rand: Rand): Duo => (rand() < 1 / 3 ? (rand() < 0.5 ? 'a' : 'b') : null);

export function onScreenIds(states: States): Set<string> {
  const ids = new Set<string>();
  for (const s of Object.values(states))
    for (const p of [s.main, ...s.minis]) for (const m of p.faces) if (m) ids.add(m.id);
  return ids;
}

const showsPhoto = (t: TileSpec) => t.kind === 'flip' || t.kind === 'peek';

/** Build tile states for a (new) layout, keeping photos of tiles that still show photos. */
export function syncStates(layout: readonly TileSpec[], prev: States, queue: Queue, rand: Rand = Math.random): States {
  const out: States = {};
  for (const t of layout) {
    const old = prev[t.id];
    out[t.id] = {
      main: old && showsPhoto(t) && visible(old.main) ? clearHidden(old.main) : emptyPair(),
      minis: t.kind === 'mosaic' && old ? old.minis.map(clearHidden) : [],
      miniTurn: old?.miniTurn ?? 0,
      peeking: false,
    };
  }
  const fresh = (): Pair => ({ faces: [queue.next(onScreenIds(out)), null], duo: [rollDuo(rand), null], back: false });
  for (const t of layout) {
    const s = out[t.id];
    if (showsPhoto(t) && !visible(s.main)) s.main = fresh();
    if (t.kind === 'mosaic') while (s.minis.length < 4) s.minis.push(fresh());
  }
  return out;
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run src/wall/pairs.test.ts`
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/wall/pairs.ts src/wall/pairs.test.ts
git commit -m "feat: tile face state (load/turn/clear) and layout sync

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: UI primitives — media hooks, graphemes, Lettering, Picture, stickers, disc

**Files:**
- Create: `src/lib/media.ts`, `src/lib/graphemes.ts`, `src/lib/graphemes.test.ts`, `src/lib/Picture.tsx`
- Create: `src/fx/Lettering.tsx`, `src/fx/Stickers.tsx`, `src/fx/stickers.css`, `src/sections/MusicDisc.tsx`
- Modify: `src/styles.css` (append Lettering + disc rules)

**Interfaces:**
- Consumes: `Memory`, `Duo`, `imageUrl`, `srcSet`, `numberOf`, `Colour`
- Produces:
  - `useMediaQuery(q: string): boolean`
  - `useReducedMotion(): boolean`
  - `graphemes(text: string): string[]`
  - `<Picture m sizes duo? className? loading? />`
  - `<DuotoneDefs />` (SVG filters `#duo-a`, `#duo-b`)
  - `<Lettering text as? className? ...htmlProps />`
  - `HEX: Record<Colour, string>`
  - `<Star colour? size className? style? />`
  - `<Flower size className? style? />`
  - `<PhotoSticker m duo shadow rot style? />`
  - `<MusicDisc playing size />`

- [ ] **Step 1: Write the failing test**

`src/lib/graphemes.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { graphemes } from './graphemes';

describe('graphemes', () => {
  it('keeps precomposed Vietnamese letters whole', () => {
    expect(graphemes('CẢM ƠN!')).toEqual(['C', 'Ả', 'M', ' ', 'Ơ', 'N', '!']);
  });

  it('keeps decomposed (NFD) diacritics attached to their letter', () => {
    const nfd = 'CẢM ƠN!'.normalize('NFD');
    const parts = graphemes(nfd);
    expect(parts).toHaveLength(7);
    expect(parts[1].normalize('NFC')).toBe('Ả');
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/lib/graphemes.test.ts`
Expected: FAIL, cannot resolve `./graphemes`.

- [ ] **Step 3: Implement `graphemes.ts` and `media.ts`**

`src/lib/graphemes.ts`:
```ts
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** Split into user-perceived characters so Vietnamese diacritics stay on their letter. */
export const graphemes = (text: string): string[] => Array.from(segmenter.segment(text), s => s.segment);
```

`src/lib/media.ts`:
```ts
import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const mq = matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export const useReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');
```

Run: `npx vitest run src/lib/graphemes.test.ts`
Expected: 2 tests PASS.

- [ ] **Step 4: Implement `Picture.tsx`**

`src/lib/Picture.tsx`:
```tsx
import type { CSSProperties } from 'react';
import { imageUrl, srcSet, type Duo, type Memory } from './memory';

interface Props {
  m: Memory;
  sizes: string;
  duo?: Duo;
  className?: string;
  loading?: 'lazy' | 'eager';
}

/** AVIF + WebP srcset, intrinsic size (no layout shift), blur placeholder, optional duotone filter. */
export function Picture({ m, sizes, duo = null, className, loading = 'lazy' }: Props) {
  const style: CSSProperties = {
    backgroundImage: `url(${m.blurDataUrl})`,
    backgroundSize: 'cover',
    filter: duo ? `url(#duo-${duo})` : undefined,
  };
  return (
    <picture className={className}>
      <source type="image/avif" srcSet={srcSet(m.id, 'avif')} sizes={sizes} />
      <img
        src={imageUrl(m.id, 480, 'webp')}
        srcSet={srcSet(m.id, 'webp')}
        sizes={sizes}
        width={m.width}
        height={m.height}
        alt={m.caption ?? 'NOERR memory'}
        loading={loading}
        decoding="async"
        style={style}
      />
    </picture>
  );
}

/** Greyscale, then map shadows→first colour and highlights→second. Originals stay untouched. */
export function DuotoneDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <filter id="duo-a" colorInterpolationFilters="sRGB">
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncR type="table" tableValues="0.333 1" />
          <feFuncG type="table" tableValues="0.224 0.42" />
          <feFuncB type="table" tableValues="0.922 0.102" />
        </feComponentTransfer>
      </filter>
      <filter id="duo-b" colorInterpolationFilters="sRGB">
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncR type="table" tableValues="0.118 1" />
          <feFuncG type="table" tableValues="0.541 0.247" />
          <feFuncB type="table" tableValues="0.243 0.706" />
        </feComponentTransfer>
      </filter>
    </svg>
  );
}
```
(`duo-a` = violet `#5539EB` shadows → orange `#FF6B1A` highlights. `duo-b` = green `#1E8A3E` → pink `#FF3FB4`.)

- [ ] **Step 5: Implement `Lettering.tsx`**

`src/fx/Lettering.tsx`:
```tsx
import type { HTMLAttributes } from 'react';
import { graphemes } from '../lib/graphemes';

// Hand-set tilt/drop per letter position, like the mockup's NOERR.
const TILT = [-6, 4, -3, 7, -5, 3, -4, 6];
const DROP = [0, 8, 0, -4, 6, -2, 4, -6];

interface Props extends HTMLAttributes<HTMLElement> {
  text: string;
  as?: 'h1' | 'h2' | 'span';
}

export function Lettering({ text, as: Tag = 'h1', className = '', ...rest }: Props) {
  return (
    <Tag className={`disp letter lettering ${className}`} aria-label={text} {...rest}>
      {graphemes(text).map((ch, i) =>
        ch === ' ' ? (
          <span key={i} className="lettering__gap" aria-hidden="true" />
        ) : (
          <span
            key={i}
            aria-hidden="true"
            className="lettering__char"
            style={{ transform: `rotate(${TILT[i % TILT.length]}deg) translateY(${DROP[i % DROP.length]}px)` }}
          >
            <span className="bob" style={{ animationDelay: `${-0.6 * i}s` }}>{ch}</span>
          </span>
        ),
      )}
    </Tag>
  );
}
```

Append to `src/styles.css`:
```css
.lettering { display: flex; flex-wrap: wrap; letter-spacing: -2px; }
.lettering__char { display: inline-block; }
.lettering__gap { width: 0.3em; }
.disc__spin { transform-box: fill-box; transform-origin: center; }
```

- [ ] **Step 6: Implement `Stickers.tsx` + CSS**

`src/fx/Stickers.tsx`:
```tsx
import type { CSSProperties } from 'react';
import { numberOf, type Duo, type Memory } from '../lib/memory';
import { Picture } from '../lib/Picture';
import type { Colour } from '../wall/layout';
import './stickers.css';

// SVG presentation attributes don't take CSS vars reliably, so stickers use hex.
export const HEX: Record<Colour, string> = { violet: '#5539EB', orange: '#FF6B1A', pink: '#FF3FB4', green: '#1E8A3E' };

interface DecoProps { size: number; className?: string; style?: CSSProperties }

export function Star({ colour = 'pink', size, className, style }: DecoProps & { colour?: Colour }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} style={style} aria-hidden="true">
      <polygon
        points="50,4 62.9,32.2 93.7,35.8 70.9,56.8 77,87.2 50,72 23,87.2 29.1,56.8 6.3,35.8 37.1,32.2"
        fill={HEX[colour]} stroke="#0A0A0A" strokeWidth="5" strokeLinejoin="round"
      />
    </svg>
  );
}

const PETALS = [[74, 50], [62, 70.8], [38, 70.8], [26, 50], [38, 29.2], [62, 29.2]];

export function Flower({ size, className, style }: DecoProps) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} style={style} aria-hidden="true">
      <g fill={HEX.green} stroke="#0A0A0A" strokeWidth="4">
        {PETALS.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="16" />)}
      </g>
      <circle cx="50" cy="50" r="13" fill={HEX.orange} stroke="#0A0A0A" strokeWidth="4" />
    </svg>
  );
}

interface StickerProps { m: Memory; duo: Duo; shadow: Colour; rot: number; style?: CSSProperties }

export function PhotoSticker({ m, duo, shadow, rot, style }: StickerProps) {
  return (
    <div className="stk" style={{ ...style, '--rot': `${rot}deg`, '--shadow': HEX[shadow] } as CSSProperties}>
      <div className="stk-in">
        <Picture m={m} sizes="(min-width: 768px) 18vw, 40vw" duo={duo} className="stk__img" loading="eager" />
        <span className="stk__label">
          <span className="label label--cream">PHOTO</span>
          <span className="disp stk__num">{numberOf(m)}</span>
        </span>
      </div>
    </div>
  );
}
```

`src/fx/stickers.css`:
```css
.stk { position: absolute; transform: rotate(var(--rot)); }
.stk-in {
  position: relative; width: 100%; height: 100%; overflow: hidden; container-type: size;
  border: 6px solid var(--cream); border-radius: 18px; background: var(--tile-bg);
  box-shadow: 10px 10px 0 var(--shadow);
}
.stk:hover .stk-in, .stk:active .stk-in { animation: wobble 0.6s ease-in-out forwards; }
.stk.is-peel .stk-in { animation: peel 0.6s ease-in-out; }
.stk__img, .stk__img img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.stk__label { position: absolute; left: 10px; bottom: 8px; display: flex; flex-direction: column; line-height: 1; }
.stk__num { font-size: 30cqmin; color: var(--cream); text-shadow: 0 2px 0 rgb(0 0 0 / 0.35); }
@keyframes peel {
  50% { transform: translateY(-6px) rotate(-3deg); clip-path: polygon(0 0, 100% 0, 100% 80%, 80% 100%, 0 100%); }
}
```

- [ ] **Step 7: Implement `MusicDisc.tsx`**

`src/sections/MusicDisc.tsx`:
```tsx
export function MusicDisc({ playing, size }: { playing: boolean; size: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="disc" aria-hidden="true">
      <g className={`disc__spin spin${playing ? '' : ' is-paused'}`}>
        <circle cx="50" cy="50" r="46" fill="#141414" stroke="#FF3FB4" strokeWidth="5" />
        {[38, 31, 24].map(r => <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="#333" strokeWidth="1.5" />)}
        <circle cx="50" cy="82" r="3.5" fill="#FF6B1A" />
      </g>
      <circle cx="50" cy="50" r="15" fill="#5539EB" />
      {playing ? (
        <g fill="#FFF1DC">
          <rect x="43.5" y="43" width="4.5" height="14" rx="1" />
          <rect x="52" y="43" width="4.5" height="14" rx="1" />
        </g>
      ) : (
        <path d="M46 42 L59 50 L46 58 Z" fill="#FFF1DC" />
      )}
    </svg>
  );
}
```

- [ ] **Step 8: Verify**

Run: `npx vitest run && npx tsc`
Expected: all tests pass; `tsc` reports no errors.

- [ ] **Step 9: Commit**

```bash
git add src
git commit -m "feat: UI primitives (lettering, picture + duotone, stickers, disc)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Audio, splash gate, floating player, app shell

**Files:**
- Create: `src/audio/AudioProvider.tsx`, `src/sections/TopBar.tsx`, `src/sections/Splash.tsx`, `src/sections/splash.css`, `src/sections/MusicSticker.tsx`, `src/sections/player.css`
- Modify: `src/main.tsx`, `src/App.tsx` (full replacement)

**Interfaces:**
- Consumes: `Lettering`, `Star`, `Flower`, `MusicDisc`, `DuotoneDefs`, `useReducedMotion`, `memories`, `shuffle`
- Produces:
  - `type AudioState = 'idle' | 'playing' | 'paused' | 'blocked'`
  - `useAudio(): { state: AudioState; muted: boolean; start(): void; toggle(): void; toggleMute(): void }`
  - `<AudioProvider src>`
  - `<TopBar />`
  - `<Splash onEnter />`
  - `<MusicSticker />`
  - In `App`: `order` (shuffled once per load) and `entered` flag

- [ ] **Step 1: Implement `AudioProvider.tsx`**

`src/audio/AudioProvider.tsx`:
```tsx
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useReducedMotion } from '../lib/media';

export type AudioState = 'idle' | 'playing' | 'paused' | 'blocked';
interface AudioApi {
  state: AudioState;
  muted: boolean;
  start(): void;
  toggle(): void;
  toggleMute(): void;
}

const Ctx = createContext<AudioApi | null>(null);

export function useAudio(): AudioApi {
  const api = useContext(Ctx);
  if (!api) throw new Error('useAudio must be used inside <AudioProvider>');
  return api;
}

const VOLUME = 0.6;
interface Graph { ctx: AudioContext; gain: GainNode; analyser: AnalyserNode }

export function AudioProvider({ src, children }: { src: string; children: ReactNode }) {
  const el = useRef<HTMLAudioElement>(null);
  const graph = useRef<Graph | null>(null);
  const mutedRef = useRef(false);
  const [state, setState] = useState<AudioState>('idle');
  const [muted, setMuted] = useState(false);
  const reduced = useReducedMotion();

  // iOS ignores audio.volume, so volume/fade/mute go through a GainNode.
  const ensureGraph = (): Graph | null => {
    if (graph.current || !el.current) return graph.current;
    try {
      // iOS 17+: let Web Audio play even with the ringer switch on silent.
      const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
      if (session) session.type = 'playback';
      const ctx = new AudioContext();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaElementSource(el.current).connect(gain).connect(analyser).connect(ctx.destination);
      graph.current = { ctx, gain, analyser };
    } catch {
      graph.current = null; // fall back to the bare element
    }
    return graph.current;
  };

  const rampTo = (value: number, secs: number) => {
    const g = graph.current;
    if (!g) return;
    const p = g.gain.gain;
    const t = g.ctx.currentTime;
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
    p.linearRampToValueAtTime(value, t + secs);
  };

  const play = useCallback((fadeSecs: number) => {
    const audio = el.current;
    if (!audio) return;
    const g = ensureGraph();
    if (!g) audio.muted = mutedRef.current;
    // resume() and play() must both start synchronously inside the tap handler.
    const resumed = g ? g.ctx.resume() : Promise.resolve();
    const played = audio.play();
    Promise.all([resumed, played]).then(
      () => {
        setState('playing');
        rampTo(mutedRef.current ? 0 : VOLUME, fadeSecs);
      },
      () => setState('blocked'),
    );
  }, []);

  const pause = useCallback(() => {
    el.current?.pause();
    rampTo(0, 0);
    setState('paused');
  }, []);

  const start = useCallback(() => play(1.5), [play]);
  const toggle = useCallback(() => {
    if (el.current && !el.current.paused) pause();
    else play(0.5);
  }, [pause, play]);
  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    if (graph.current) {
      if (el.current && !el.current.paused) rampTo(next ? 0 : VOLUME, 0.05);
    } else if (el.current) {
      el.current.muted = next;
    }
  }, []);

  // M3: pause while hidden, resume on return only if it was playing.
  useEffect(() => {
    let resume = false;
    const onVisibility = () => {
      const audio = el.current;
      if (!audio) return;
      if (document.hidden) {
        resume = !audio.paused;
        if (resume) {
          audio.pause();
          rampTo(0, 0);
        }
      } else if (resume) {
        resume = false;
        play(0.5);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [play]);

  // Title pulse: RMS loudness → --pulse (0..1) on <html>; no React re-render per frame.
  useEffect(() => {
    const root = document.documentElement;
    const g = graph.current;
    if (state !== 'playing' || reduced || !g) {
      root.style.setProperty('--pulse', '0');
      return;
    }
    const buf = new Uint8Array(g.analyser.fftSize);
    let raf = 0;
    const loop = () => {
      g.analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += (v - 128) ** 2;
      root.style.setProperty('--pulse', Math.min(1, (Math.sqrt(sum / buf.length) / 128) * 3).toFixed(3));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      root.style.setProperty('--pulse', '0');
    };
  }, [state, reduced]);

  return (
    <Ctx.Provider value={{ state, muted, start, toggle, toggleMute }}>
      <audio ref={el} src={src} loop preload="auto" onError={() => setState('blocked')} />
      {children}
    </Ctx.Provider>
  );
}
```

- [ ] **Step 2: TopBar, Splash, MusicSticker**

`src/sections/TopBar.tsx`:
```tsx
export function TopBar() {
  return (
    <div className="topbar">
      <span className="label label--cream">NOERR / TEAM ONLY</span>
      <span className="label">SIDE A</span>
    </div>
  );
}
```

`src/sections/Splash.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useAudio } from '../audio/AudioProvider';
import { Lettering } from '../fx/Lettering';
import { Flower, Star } from '../fx/Stickers';
import { TopBar } from './TopBar';
import './splash.css';

export function Splash({ onEnter }: { onEnter(): void }) {
  const { start } = useAudio();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const enter = () => {
    if (leaving) return;
    start();
    setLeaving(true);
    setTimeout(onEnter, 400);
  };

  return (
    <div className={`splash${leaving ? ' is-leaving' : ''}`}>
      <TopBar />
      <Star colour="pink" size={72} className="splash__deco splash__deco--star spin-slow" />
      <Flower size={64} className="splash__deco splash__deco--flower" />
      <Star colour="orange" size={34} className="splash__deco splash__deco--dot" />
      <div className="splash__brand">
        <Lettering as="span" text="NOERR" className="splash__title" />
        <span className="pill disp">THROWBACK</span>
      </div>
      <button type="button" className="play" onClick={enter} autoFocus aria-label="Press play: enter the site and start the song">
        <span className="pulse">
          <span className="play-in">
            <svg viewBox="0 0 24 24" width="54" height="54" aria-hidden="true">
              <path d="M8 5v14l11-7z" fill="#FFF1DC" stroke="#0A0A0A" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <span className="disp play__text">PRESS<br />PLAY</span>
          </span>
        </span>
      </button>
      <div className="splash__foot">
        <span className="label">TAP TO ENTER · SOUND ON</span>
        <span className="label label--muted">MUTE ANY TIME FROM THE DISC</span>
      </div>
    </div>
  );
}
```

`src/sections/splash.css`:
```css
.splash {
  position: fixed; inset: 0; z-index: 100; overflow: hidden;
  display: flex; flex-direction: column; align-items: center;
  padding: 72px var(--gutter) max(32px, env(safe-area-inset-bottom));
  background: var(--ink); transition: opacity 0.4s ease;
}
.splash.is-leaving { opacity: 0; pointer-events: none; }
.splash__brand { margin-top: 8vh; display: flex; flex-direction: column; align-items: center; gap: 18px; }
.splash__title { font-size: clamp(96px, 28vw, 220px); }
.splash__deco { position: absolute; }
.splash__deco--star { right: 11%; top: 15%; }
.splash__deco--flower { left: 5%; top: 72%; transform: rotate(-14deg); }
.splash__deco--dot { right: 11%; top: 79%; transform: rotate(18deg); }
.play {
  margin-top: 56px; width: 232px; height: 232px; padding: 0; border: 0; border-radius: 50%;
  background: none; cursor: pointer; transform: rotate(-6deg);
}
.play:focus-visible { outline: 4px solid var(--cream); outline-offset: 6px; }
.play .pulse { display: block; width: 100%; height: 100%; }
.play-in {
  width: 100%; height: 100%; border-radius: 50%;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  background: var(--violet); color: var(--cream); border: 5px solid var(--orange);
  box-shadow: 0 0 0 4px var(--ink), 9px 10px 0 4px var(--green);
}
.play:hover .play-in { background: var(--violet-hover); }
.play__text { font-size: 42px; line-height: 0.85; text-align: center; }
.splash__foot { margin-top: auto; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
```

`src/sections/MusicSticker.tsx`:
```tsx
import { useAudio } from '../audio/AudioProvider';
import { MusicDisc } from './MusicDisc';
import './player.css';

function Speaker({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4z" />
      {muted ? <path d="M16 9l5 6M21 9l-5 6" /> : <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />}
    </svg>
  );
}

export function MusicSticker() {
  const { state, muted, toggle, toggleMute } = useAudio();
  const playing = state === 'playing';
  return (
    <div className="player">
      <button type="button" className="player__mute" onClick={toggleMute} aria-pressed={muted} aria-label={muted ? 'Unmute' : 'Mute'}>
        <Speaker muted={muted} />
      </button>
      <button type="button" className="player__disc" onClick={toggle} aria-pressed={playing} aria-label={playing ? 'Pause song' : 'Play song'}>
        <MusicDisc playing={playing} size={80} />
      </button>
    </div>
  );
}
```

`src/sections/player.css`:
```css
.player {
  position: fixed; right: 16px; bottom: max(16px, env(safe-area-inset-bottom)); z-index: 40;
  display: flex; align-items: center; gap: 12px;
}
.player__mute {
  width: 48px; height: 48px; display: grid; place-items: center; cursor: pointer;
  border-radius: 50%; border: 3px solid var(--orange); background: var(--ink); color: var(--orange);
}
.player__disc {
  width: 80px; height: 80px; padding: 0; border: 0; border-radius: 50%; background: none; cursor: pointer;
  filter: drop-shadow(5px 6px 0 var(--green));
}
```

- [ ] **Step 3: Wire up `main.tsx` and `App.tsx`**

In `src/main.tsx`, replace the last two lines with:
```tsx
import { App } from './App';
import { AudioProvider } from './audio/AudioProvider';

createRoot(document.getElementById('root')!).render(
  <AudioProvider src="/audio/lan-cuoi.mp3">
    <App />
  </AudioProvider>,
);
```

`src/App.tsx` (full replacement):
```tsx
import { useMemo, useState } from 'react';
import { memories } from './lib/memory';
import { DuotoneDefs } from './lib/Picture';
import { shuffle } from './lib/random';
import { MusicSticker } from './sections/MusicSticker';
import { Splash } from './sections/Splash';

export function App() {
  const order = useMemo(() => shuffle(memories), []); // fresh order every visit
  const [entered, setEntered] = useState(false);

  if (order.length === 0) return <p className="label empty">NO MEMORIES YET · RUN npm run build:images</p>;

  return (
    <>
      <DuotoneDefs />
      {!entered && <Splash onEnter={() => setEntered(true)} />}
      <main inert={!entered}>
        <p className="label empty">{order.length} MEMORIES</p>
      </main>
      {entered && <MusicSticker />}
    </>
  );
}
```

- [ ] **Step 4: Verify in the browser**

Run: `npm run build && npm run dev`, open `http://localhost:5173` at 390×844 (DevTools device mode). Check each:
1. The splash matches the "Phone · Splash gate" mockup board (layout, colours, lettering bob, pulsing button).
2. Clicking PRESS PLAY fades the splash out; the song fades in over ~1.5 s at moderate volume.
3. The disc spins; pausing stops it. Mute silences the song without pausing it.
4. Switch to another tab and back: the song pauses and then resumes. Pause it first, then switch tabs and back: it stays paused.
5. Temporarily rename `public/audio/lan-cuoi.mp3` and reload. PRESS PLAY still enters, and the disc shows the play glyph (blocked state). Rename it back.
6. Keyboard only: Tab reaches PRESS PLAY (focused on load), Enter enters, and focus rings are visible on the player buttons.
7. **Review Focus 5 (manual, real iPhone):** run `npm run dev -- --host`, open the LAN URL on an iPhone with the ringer switch on silent, and tap PRESS PLAY. The song must be audible. Record the result in the task report. If it is silent, report it; do not work around it.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat: audio provider, splash gate, floating music sticker

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Hero

**Files:**
- Create: `src/sections/Hero.tsx`, `src/sections/hero.css`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `Lettering`, `PhotoSticker`, `Star`, `Flower`, `TopBar`, `content`, `useReducedMotion`, `Colour`
- Produces: `<Hero order />` with `id="top"` (target of "BACK TO TOP") and a `.hero__title` element (Task 13 adds a click handler to it)

- [ ] **Step 1: Implement**

`src/sections/Hero.tsx`:
```tsx
import { useEffect, useRef } from 'react';
import { content } from '../content';
import { Lettering } from '../fx/Lettering';
import { Flower, PhotoSticker, Star } from '../fx/Stickers';
import { useReducedMotion } from '../lib/media';
import type { Memory } from '../lib/memory';
import type { Colour } from '../wall/layout';
import { TopBar } from './TopBar';
import './hero.css';

// Sticker spots inside the cluster, in % of its width/top, matching the mockup's overlap.
const SPOTS: { l: number; t: number; w: number; ratio: number; rot: number; shadow: Colour }[] = [
  { l: 2, t: 4, w: 40, ratio: 0.8, rot: -6, shadow: 'green' },
  { l: 52, t: 0, w: 38, ratio: 1.1, rot: 4, shadow: 'violet' },
  { l: 58, t: 46, w: 36, ratio: 0.9, rot: -3, shadow: 'orange' },
  { l: 6, t: 62, w: 38, ratio: 1.2, rot: 5, shadow: 'green' },
  { l: 36, t: 40, w: 28, ratio: 1.1, rot: 8, shadow: 'pink' },
];

export function Hero({ order }: { order: readonly Memory[] }) {
  const cluster = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  // A random sticker peels a little on scroll, at most every 2 s.
  useEffect(() => {
    if (reduced) return;
    let last = 0;
    const onScroll = () => {
      const now = Date.now();
      if (now - last < 2000) return;
      last = now;
      const all = cluster.current?.querySelectorAll('.stk');
      if (!all?.length) return;
      const el = all[Math.floor(Math.random() * all.length)];
      el.classList.add('is-peel');
      setTimeout(() => el.classList.remove('is-peel'), 600);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [reduced]);

  return (
    <header className="hero" id="top">
      <TopBar />
      <div className="hero__words">
        <Lettering text="NOERR" className="hero__title" />
        <span className="pill disp">THROWBACK</span>
        <p className="label hero__sub">{content.subtitle}</p>
      </div>
      <div className="hero__cluster" ref={cluster}>
        {order.slice(0, SPOTS.length).map((m, i) => (
          <PhotoSticker
            key={m.id}
            m={m}
            duo={i % 2 ? 'b' : 'a'}
            shadow={SPOTS[i].shadow}
            rot={SPOTS[i].rot}
            style={{ left: `${SPOTS[i].l}%`, top: `${SPOTS[i].t}%`, width: `${SPOTS[i].w}%`, aspectRatio: SPOTS[i].ratio, zIndex: i + 1 }}
          />
        ))}
        <Star colour="pink" size={64} className="hero__star spin-slow" />
        <Flower size={56} className="hero__flower" />
      </div>
      <a href="#wall" className="label label--cream hero__scroll">↓ SCROLL FOR THE WALL</a>
    </header>
  );
}
```

`src/sections/hero.css`:
```css
.hero {
  position: relative; max-width: var(--maxw); margin: 0 auto;
  padding: 88px var(--gutter) 32px; display: grid; gap: 28px;
}
.hero__words { display: flex; flex-direction: column; align-items: flex-start; gap: 20px; }
.hero__title {
  font-size: clamp(96px, 25vw, 300px); user-select: none;
  transform: scale(calc(1 + var(--pulse) * 0.06)); transform-origin: left center;
}
.hero__cluster { position: relative; width: 100%; aspect-ratio: 1 / 1.05; }
.hero__star { position: absolute; right: -2%; top: -6%; z-index: 10; }
.hero__flower { position: absolute; left: 40%; bottom: -4%; z-index: 10; }
.hero__scroll { justify-self: start; text-decoration: none; }
@media (min-width: 768px) {
  .hero { grid-template-columns: 1.15fr 1fr; align-items: center; min-height: 100vh; }
  .hero__scroll { grid-column: 1 / -1; }
}
```

In `src/App.tsx`: add `import { Hero } from './sections/Hero';` and replace `<p className="label empty">{order.length} MEMORIES</p>` inside `<main>` with:
```tsx
        <Hero order={order} />
        <hr className="divider" />
```

- [ ] **Step 2: Verify in the browser**

Run `npm run build && npm run dev`. Compare with the mockup:
- At 390 px the hero matches "Phone · Full page" (title, pill, subtitle, 5 overlapping duotone stickers). At 1440 px it matches "Desktop · Full page" (two columns).
- Hovering a sticker wobbles it; scrolling makes one sticker peel occasionally.
- The NOERR lettering visibly pulses with the music.
- With DevTools → Rendering → "prefers-reduced-motion: reduce": no bob, no wobble, no pulse.
- Vietnamese diacritics render in Baloo 2. To check, temporarily set `content.subtitle` to `ĐÀ NẴNG · KỶ NIỆM`, look, then revert.

- [ ] **Step 3: Commit**

```bash
git add src
git commit -m "feat: hero with duotone photo stickers, peel on scroll, pulse

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Tile wall — render, shuffle (FLIP), press tilt

**Files:**
- Create: `src/wall/flip.ts`, `src/wall/Tile.tsx`, `src/wall/TileWall.tsx`, `src/wall/wall.css`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `pack`, `assign`, `GRID`, `TileSpec`, `Size`, `createQueue`, `syncStates`, `visible`, `Pair`, `SlotKey`, `TileState`, `States`, `Picture`, `Lettering`, `MusicDisc`, `useAudio`, `useMediaQuery`, `useReducedMotion`, `numberOf`, `content`
- Produces:
  - `snapshot(root: HTMLElement): Map<string, DOMRect>`
  - `playFlip(root: HTMLElement, before: Map<string, DOMRect>, ms?: number): void`
  - `<Tile spec state total onOpen onShuffle />` (marks faces with `data-tile`, `data-pair`, `data-face`)
  - `<TileWall order paused onOpen />` (section `id="wall"`)
  - In `App`: `lightbox: number | null` state

- [ ] **Step 1: FLIP helper**

`src/wall/flip.ts`:
```ts
const EASE = 'cubic-bezier(.3,1.2,.5,1)';

export function snapshot(root: HTMLElement): Map<string, DOMRect> {
  const rects = new Map<string, DOMRect>();
  root.querySelectorAll<HTMLElement>('[data-tile]').forEach(el => rects.set(el.dataset.tile!, el.getBoundingClientRect()));
  return rects;
}

/** First-Last-Invert-Play: tiles fly from their old rects; new tiles pop in. */
export function playFlip(root: HTMLElement, before: Map<string, DOMRect>, ms = 500) {
  root.querySelectorAll<HTMLElement>('[data-tile]').forEach(el => {
    const a = before.get(el.dataset.tile!);
    const b = el.getBoundingClientRect();
    if (!a) {
      el.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: ms, easing: EASE });
      return;
    }
    const dx = a.left - b.left;
    const dy = a.top - b.top;
    const sx = a.width / b.width;
    const sy = a.height / b.height;
    if (!dx && !dy && sx === 1 && sy === 1) return;
    el.animate(
      [
        { transformOrigin: 'top left', transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
        { transformOrigin: 'top left', transform: 'none' },
      ],
      { duration: ms, easing: EASE },
    );
  });
}
```

- [ ] **Step 2: Tile component**

`src/wall/Tile.tsx`:
```tsx
import { useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';
import { useAudio } from '../audio/AudioProvider';
import { content } from '../content';
import { numberOf, type Duo, type Memory } from '../lib/memory';
import { Picture } from '../lib/Picture';
import { MusicDisc } from '../sections/MusicDisc';
import type { Size, TileSpec } from './layout';
import { visible, type Pair, type SlotKey, type TileState } from './pairs';

const SIZES: Record<Size, string> = {
  small: '(min-width: 768px) 12vw, 25vw',
  medium: '(min-width: 768px) 25vw, 50vw',
  wide: '(min-width: 768px) 50vw, 100vw',
  large: '(min-width: 768px) 50vw, 100vw',
};
const wordFor = (id: number) => content.colourWords[id % content.colourWords.length];

interface Props {
  spec: TileSpec;
  state: TileState;
  total: number;
  onOpen(m: Memory): void;
  onShuffle(): void;
}

export function Tile({ spec, state, total, onOpen, onShuffle }: Props) {
  const audio = useAudio();
  const [tilt, setTilt] = useState<{ rx: number; ry: number } | null>(null);
  const [wobble, setWobble] = useState(false);
  const playing = audio.state === 'playing';

  // Metro tilt: tip toward the pressed point (±10°), wobble on release.
  const press = (e: PointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ rx: -y * 20, ry: x * 20 });
  };
  const release = () => {
    if (!tilt) return;
    setTilt(null);
    setWobble(true);
  };

  const click = (e: MouseEvent<HTMLButtonElement>) => {
    if (spec.kind === 'counter') return onShuffle();
    if (spec.kind === 'music') return audio.toggle();
    const pair =
      spec.kind === 'mosaic'
        ? state.minis[Number((e.target as HTMLElement).closest<HTMLElement>('[data-mini]')?.dataset.mini ?? 0)]
        : state.main;
    const m = pair && visible(pair);
    if (m) onOpen(m);
  };

  const shown = visible(state.main);
  const label =
    spec.kind === 'counter' ? `${total} memories. Shuffle the wall`
    : spec.kind === 'music' ? `${playing ? 'Pause' : 'Play'} song: ${content.songTitle}`
    : spec.kind === 'mosaic' ? 'Open a photo from the mosaic'
    : shown ? `Open photo ${numberOf(shown)}${shown.caption ? `: ${shown.caption}` : ''}`
    : wordFor(spec.id);

  return (
    <button
      type="button"
      className={`tile${wobble ? ' is-wobble' : ''}`}
      data-tile={spec.id}
      data-kind={spec.kind}
      data-size={spec.size}
      data-colour={spec.colour}
      style={{
        gridColumn: `${spec.col + 1} / span ${spec.w}`,
        gridRow: `${spec.row + 1} / span ${spec.h}`,
        '--c': `var(--${spec.colour})`,
        '--rx': `${tilt?.rx ?? 0}deg`,
        '--ry': `${tilt?.ry ?? 0}deg`,
      } as CSSProperties}
      aria-label={label}
      onClick={click}
      onPointerDown={press}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      onAnimationEnd={() => setWobble(false)}
    >
      <span className="press">
        <Body spec={spec} state={state} total={total} playing={playing} />
      </span>
    </button>
  );
}

function Body({ spec, state, total, playing }: { spec: TileSpec; state: TileState; total: number; playing: boolean }) {
  switch (spec.kind) {
    case 'counter':
      return (
        <span className="tile__counter">
          <span className="disp tile__count">{total}</span>
          <span className="tile__counter-foot">
            <span className="label label--cream">MEMORIES</span>
            <span className="chip">TAP = SHUFFLE</span>
          </span>
        </span>
      );
    case 'music':
      return <span className="tile__music"><MusicDisc playing={playing} size={64} /></span>;
    case 'mosaic':
      return (
        <span className="tile__mosaic">
          {state.minis.map((p, k) => (
            <span key={k} className="mini" data-mini={k}>
              <PairView pair={p} slot={k} sizes={SIZES.small} fade bare />
            </span>
          ))}
        </span>
      );
    case 'colour':
      return <PairView pair={state.main} slot="main" sizes={SIZES[spec.size]} word={wordFor(spec.id)} />;
    default: {
      const m = visible(state.main);
      return (
        <>
          {spec.kind === 'peek' && (
            <span className="peek__panel">
              <span className="label">NO. {m ? numberOf(m) : ''}</span>
              {m?.caption && <span className="peek__cap">{m.caption}</span>}
            </span>
          )}
          <span className={`peek__photo${state.peeking ? ' is-up' : ''}`}>
            <PairView pair={state.main} slot="main" sizes={SIZES[spec.size]} />
          </span>
        </>
      );
    }
  }
}

interface PairProps { pair: Pair; slot: SlotKey; sizes: string; word?: string; fade?: boolean; bare?: boolean }

function PairView({ pair, slot, sizes, word, fade, bare }: PairProps) {
  return (
    <span className={`flipper${pair.back ? ' is-back' : ''}${fade ? ' flipper--fade' : ''}`} data-pair={slot}>
      {([0, 1] as const).map(i => {
        const m = pair.faces[i];
        return (
          <span key={i} className={`face${i ? ' face--back' : ''}`} data-face={i} data-duo={pair.duo[i] ?? undefined}>
            {m ? (
              <TilePhoto m={m} duo={pair.duo[i]} sizes={sizes} bare={bare} />
            ) : i === 0 && word ? (
              <span className="tile__word disp"><span className="bob">{word}</span></span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}

function TilePhoto({ m, duo, sizes, bare }: { m: Memory; duo: Duo; sizes: string; bare?: boolean }) {
  return (
    <>
      <Picture m={m} sizes={sizes} duo={duo} className="tile__img" />
      <span className="tile__label">
        {!bare && <span className="label label--cream">PHOTO</span>}
        <span className="disp tile__num">{numberOf(m)}</span>
      </span>
      {duo && !bare && <span className="chip tile__duo">DUO</span>}
    </>
  );
}
```

- [ ] **Step 3: TileWall (static wall + shuffle; scheduler comes in Task 10)**

`src/wall/TileWall.tsx`:
```tsx
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Lettering } from '../fx/Lettering';
import { useMediaQuery, useReducedMotion } from '../lib/media';
import type { Memory } from '../lib/memory';
import { playFlip, snapshot } from './flip';
import { assign, GRID, pack } from './layout';
import { syncStates, type States } from './pairs';
import { createQueue } from './queue';
import { Tile } from './Tile';
import './wall.css';

interface Props {
  order: readonly Memory[];
  paused: boolean;
  onOpen(m: Memory): void;
}

export function TileWall({ order, paused, onOpen }: Props) {
  const desktop = useMediaQuery('(min-width: 768px)');
  const reduced = useReducedMotion();
  const { cols, rows } = desktop ? GRID.desktop : GRID.phone;
  const queue = useMemo(() => createQueue(order), [order]);
  const [layout, setLayout] = useState(() => assign(pack(cols, rows, Math.random), Math.random, reduced));
  const [states, setStates] = useState<States>(() => syncStates(layout, {}, queue));

  const root = useRef<HTMLDivElement>(null);
  const before = useRef<Map<string, DOMRect> | null>(null);
  const statesRef = useRef(states);
  statesRef.current = states;

  const relayout = useCallback(
    (animate: boolean) => {
      const next = assign(pack(cols, rows, Math.random), Math.random, reduced);
      if (animate && !reduced && root.current) before.current = snapshot(root.current);
      const nextStates = syncStates(next, statesRef.current, queue);
      setLayout(next);
      setStates(nextStates);
    },
    [cols, rows, reduced, queue],
  );

  // Re-pack when the breakpoint flips (phone rotation, window resize).
  const packedCols = useRef(cols);
  useEffect(() => {
    if (packedCols.current === cols) return;
    packedCols.current = cols;
    relayout(false);
  }, [cols, relayout]);

  useLayoutEffect(() => {
    if (before.current && root.current) playFlip(root.current, before.current);
    before.current = null;
  }, [layout]);

  void paused; // used by the scheduler in Task 10

  return (
    <section className="wall" id="wall" aria-labelledby="wall-title">
      <header className="wall__head">
        <div>
          <p className="label">SIDE A · LIVE</p>
          <Lettering as="h2" id="wall-title" text="THE WALL" className="wall__title" />
        </div>
        <div className="wall__actions">
          <span className="label label--cream">TAP A PHOTO TO OPEN IT</span>
          <button type="button" className="btn-pink" onClick={() => relayout(true)}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
            </svg>
            SHUFFLE
          </button>
        </div>
      </header>
      <div className="wall__frame">
        <div ref={root} className="wall__grid" style={{ '--cols': cols, '--rows': rows } as CSSProperties}>
          {layout.map(t => (
            <Tile key={t.id} spec={t} state={states[t.id]} total={order.length} onOpen={onOpen} onShuffle={() => relayout(true)} />
          ))}
        </div>
      </div>
      <p className="label label--muted wall__foot">{order.length} MEMORIES · NO REPEATS TILL ALL ARE SHOWN</p>
    </section>
  );
}
```

`src/wall/wall.css`:
```css
.wall { max-width: var(--maxw); margin: 0 auto; padding: 48px var(--gutter) 32px; }
.wall__head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 16px; margin-bottom: 20px; }
.wall__title { font-size: clamp(56px, 9vw, 120px); margin-top: 8px; }
.wall__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 20px; }
.wall__foot { margin-top: 20px; }
.wall__frame { container-type: inline-size; }
.wall__grid {
  display: grid; gap: var(--gap);
  grid-template-columns: repeat(var(--cols), 1fr);
  /* square cells: row height = column width */
  grid-template-rows: repeat(var(--rows), calc((100cqw - (var(--cols) - 1) * var(--gap)) / var(--cols)));
}

.tile {
  appearance: none; -webkit-appearance: none; position: relative; display: block; margin: 0; padding: 0;
  border: 3px solid var(--c); border-radius: 14px; overflow: hidden; background: var(--ink);
  color: inherit; font: inherit; text-align: left; cursor: pointer; perspective: 900px; container-type: size;
}
.tile:focus-visible { outline: 3px solid var(--cream); outline-offset: 3px; }
.tile.is-wobble { animation: tile-wobble 0.35s ease-out; }
@keyframes tile-wobble { 30% { transform: rotate(-2deg) scale(0.98); } 65% { transform: rotate(1.5deg); } 100% { transform: none; } }

.press {
  position: absolute; inset: 0; display: block; transform-style: preserve-3d;
  transform: rotateX(var(--rx)) rotateY(var(--ry)); transition: transform 0.14s ease-out;
}
.flipper {
  position: absolute; inset: 0; display: block; transform-style: preserve-3d;
  transition: transform 0.7s cubic-bezier(0.3, 1.35, 0.5, 1);
}
.flipper.is-back { transform: rotateX(180deg); }
.face {
  position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: flex-end; align-items: flex-start;
  backface-visibility: hidden; -webkit-backface-visibility: hidden; transition: opacity 0.9s ease;
  background: radial-gradient(circle, rgb(255 241 220 / 0.12) 1.2px, transparent 1.7px) 0 0 / 12px 12px, var(--tile-bg);
}
.face--back { transform: rotateX(180deg); }

/* Crossfade variant: mosaic minis always, every flipper under reduced motion. */
.flipper--fade, .flipper--fade.is-back, .flipper--fade .face--back { transform: none; }
.flipper--fade .face--back { opacity: 0; }
.flipper--fade.is-back .face--back { opacity: 1; }
.flipper--fade.is-back .face:not(.face--back) { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .press, .peek__photo { transition: none; }
  .flipper, .flipper.is-back, .face--back { transform: none; }
  .face--back { opacity: 0; }
  .flipper.is-back .face--back { opacity: 1; }
  .flipper.is-back .face:not(.face--back) { opacity: 0; }
}

.tile__img, .tile__img img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.tile__label {
  position: relative; z-index: 1; display: flex; flex-direction: column; padding: 8px 10px; line-height: 1;
  text-shadow: 0 1px 3px rgb(0 0 0 / 0.6);
}
.tile__num { font-size: clamp(20px, 30cqmin, 240px); color: var(--cream); }
.face[data-duo='b'] .tile__num { color: var(--ink); text-shadow: none; }
.tile__duo { position: absolute; top: 10px; right: 10px; z-index: 1; }

.peek__panel {
  position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: flex-end; gap: 6px;
  padding: 12px; background: var(--c); color: var(--cream);
}
.tile[data-colour='orange'] .peek__panel, .tile[data-colour='pink'] .peek__panel { color: var(--ink); }
.tile[data-colour='orange'] .peek__panel .label, .tile[data-colour='pink'] .peek__panel .label { color: var(--ink); }
.peek__cap { font-size: 13px; }
.peek__photo {
  position: absolute; inset: 0; display: block; transform-style: preserve-3d;
  transition: transform 0.55s cubic-bezier(0.3, 1.3, 0.5, 1);
}
.peek__photo.is-up { transform: translateY(-62%); }

.tile__mosaic { position: absolute; inset: 0; display: grid; grid-template: 1fr 1fr / 1fr 1fr; gap: 3px; background: var(--ink); }
.mini { position: relative; overflow: hidden; container-type: size; }

.tile[data-kind='counter'] { background: var(--violet); }
.tile__counter { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: space-between; padding: 14px; }
.tile__count { font-size: 34cqmin; line-height: 0.9; color: var(--cream); text-shadow: 3px 3px 0 var(--green); }
.tile__counter-foot { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }

.tile__music { position: absolute; inset: 0; display: grid; place-items: center; }
.tile__music .disc { width: 80%; height: 80%; }

.tile[data-kind='colour'] .face:not(.face--back) { background: var(--c); }
.tile__word { margin: auto; font-size: clamp(16px, 26cqmin, 120px); color: var(--ink); }
```

- [ ] **Step 4: Mount in App**

In `src/App.tsx`: add `import { TileWall } from './wall/TileWall';`. Add the state `const [lightbox, setLightbox] = useState<number | null>(null);` next to `entered`, before the early return. After `<Hero …/>` and its divider, add:
```tsx
        <TileWall order={order} paused={!entered || lightbox !== null} onOpen={m => setLightbox(order.indexOf(m))} />
        <hr className="divider" />
```
Until Task 11 renders the lightbox, `lightbox` is set but not shown. That is expected.

- [ ] **Step 5: Verify in the browser**

Run `npm run build && npm run dev`:
- At 390 px there are 4 columns; at 1440 px there are 8. The wall is a full rectangle with no gaps. Compare against the wall section of both mockup boards (border colours, 14 px radius, halftone empty tiles, "PHOTO NN" labels, DUO chips, violet counter, disc tile, mosaic 2×2).
- No photo appears on two tiles at once (scan the numbers).
- SHUFFLE and the counter tile both re-pack the wall. Tiles fly to their new spots in about 0.5 s, and the wall height stays the same.
- Resize across 768 px: the wall re-packs for the new column count with no blank photo tiles.
- Pressing and holding a tile tips it toward the pointer; releasing it wobbles.
- Reduced motion: shuffle jumps instantly (no fly).

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "feat: live tile wall render, shuffle with FLIP, metro tilt

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Tile wall — the scheduler

**Files:**
- Create: `src/wall/useScheduler.ts`
- Modify: `src/wall/TileWall.tsx`

**Interfaces:**
- Consumes: `hiddenIndex`, `loadHidden`, `revealHidden`, `turnPair`, `clearHidden`, `patchSlot`, `rollDuo`, `onScreenIds`, `SlotKey`, `TileState`, `TileSpec`, `shuffle`
- Produces: `useScheduler(tick: () => void, ms: number, enabled: boolean): void`

- [ ] **Step 1: Scheduler hook**

`src/wall/useScheduler.ts`:
```ts
import { useEffect, useRef } from 'react';

/** One interval for the whole wall; skips ticks while the tab is hidden. */
export function useScheduler(tick: () => void, ms: number, enabled: boolean) {
  const latest = useRef(tick);
  latest.current = tick;
  useEffect(() => {
    if (!enabled) return;
    const handle = setInterval(() => {
      if (!document.hidden) latest.current();
    }, ms);
    return () => clearInterval(handle);
  }, [ms, enabled]);
}
```

- [ ] **Step 2: Add animation actions to `TileWall.tsx`**

Replace the imports at the top of `src/wall/TileWall.tsx` with:
```tsx
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import { Lettering } from '../fx/Lettering';
import { useMediaQuery, useReducedMotion } from '../lib/media';
import type { Memory } from '../lib/memory';
import { shuffle } from '../lib/random';
import { playFlip, snapshot } from './flip';
import { assign, GRID, pack, type TileSpec } from './layout';
import {
  clearHidden, hiddenIndex, loadHidden, onScreenIds, patchSlot, revealHidden, rollDuo, syncStates, turnPair,
  type SlotKey, type States, type TileState,
} from './pairs';
import { createQueue } from './queue';
import { Tile } from './Tile';
import { useScheduler } from './useScheduler';
import './wall.css';

const TICK_MS = 1200;
const TURN_MS = 700;
const PEEK_MS = 550;
const PEEK_HOLD_MS = 2400;
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
```

Next to `statesRef`, add refs for the current layout, the visible tiles, and busy tiles:
```tsx
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const visibleIds = useRef(new Set<number>());
  const busy = useRef(new Set<number>());
```

Replace the line `void paused; // used by the scheduler in Task 10` with:
```tsx
  // T9: only on-screen tiles animate.
  useEffect(() => {
    const grid = root.current;
    if (!grid) return;
    visibleIds.current.clear();
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        const id = Number((e.target as HTMLElement).dataset.tile);
        if (e.isIntersecting) visibleIds.current.add(id);
        else visibleIds.current.delete(id);
      }
    });
    grid.querySelectorAll('[data-tile]').forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [layout]);

  const patch = (id: number, fn: (s: TileState) => TileState) =>
    setStates(all => (all[id] ? { ...all, [id]: fn(all[id]) } : all));

  /** Load next photo into the hidden face, wait for decode (T4), turn, then drop the old face. */
  const turn = async (id: number, slot: SlotKey) => {
    const s = statesRef.current[id];
    const pair = s && (slot === 'main' ? s.main : s.minis[slot]);
    if (!pair) return;
    const hidden = hiddenIndex(pair);
    const m = queue.next(onScreenIds(statesRef.current));
    flushSync(() => patch(id, x => patchSlot(x, slot, p => loadHidden(p, m, rollDuo(Math.random)))));
    const img = root.current?.querySelector<HTMLImageElement>(
      `[data-tile="${id}"] [data-pair="${slot}"] [data-face="${hidden}"] img`,
    );
    await img?.decode().catch(() => {});
    patch(id, x => patchSlot(x, slot, revealHidden));
    await wait(TURN_MS);
    patch(id, x => patchSlot(x, slot, clearHidden));
  };

  const peek = async (id: number) => {
    patch(id, s => ({ ...s, peeking: true }));
    await wait(PEEK_MS + PEEK_HOLD_MS);
    patch(id, s => ({ ...s, peeking: false }));
    await wait(PEEK_MS);
  };

  const act = async (t: TileSpec) => {
    busy.current.add(t.id);
    try {
      const s = statesRef.current[t.id];
      if (!s) return;
      if (t.kind === 'flip') await turn(t.id, 'main');
      else if (t.kind === 'peek') await (Math.random() < 0.5 ? peek(t.id) : turn(t.id, 'main'));
      else if (t.kind === 'mosaic') {
        patch(t.id, x => ({ ...x, miniTurn: x.miniTurn + 1 }));
        await turn(t.id, s.miniTurn % 4); // minis change one at a time, in order
      } else if (t.kind === 'colour') {
        if (s.main.back) {
          patch(t.id, x => patchSlot(x, 'main', turnPair)); // back to the word
          await wait(TURN_MS);
          patch(t.id, x => patchSlot(x, 'main', clearHidden));
        } else if (Math.random() < 1 / 3) {
          await turn(t.id, 'main'); // less often than photo tiles
        }
      }
    } finally {
      busy.current.delete(t.id);
    }
  };

  // T2: one global tick picks 1–2 visible, idle tiles.
  useScheduler(
    () => {
      const candidates = layoutRef.current.filter(
        t => visibleIds.current.has(t.id) && !busy.current.has(t.id) && t.kind !== 'counter' && t.kind !== 'music',
      );
      for (const t of shuffle(candidates).slice(0, Math.random() < 0.5 ? 1 : 2)) void act(t);
    },
    TICK_MS,
    !paused,
  );
```

- [ ] **Step 3: Verify**

Run: `npx tsc && npx vitest run`
Expected: no type errors; all tests pass.

Then run `npm run dev` and watch the wall for 60 s at 390 px and at 1440 px:
- Every ~1.2 s, 1–2 tiles animate. Never all at once.
- Photo tiles flip on the X axis to a new photo with no blank or half-loaded frame (DevTools → Network → throttle "Fast 4G" and watch).
- Peek tiles slide up, reveal `NO. NN` + caption on their colour, hold, and slide back.
- Mosaic minis change one at a time, in order (top-left, top-right, bottom-left, bottom-right).
- Colour blocks occasionally flip to a photo, then back to their word.
- About one in three visible photos shows DUO.
- Across the run, no number is visible on two tiles at once.
- Scroll the wall off-screen: animation stops (check in Performance or by eye when scrolling back). Hide the tab for 10 s: nothing piles up on return.
- Click SHUFFLE rapidly several times while tiles are flipping: no tile ends up blank (Review Focus 2).
- Reduced motion: flips become slow crossfades, and no peek happens.

- [ ] **Step 4: Commit**

```bash
git add src
git commit -m "feat: global scheduler driving flip, peek, mosaic and colour tiles

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Lightbox

**Files:**
- Create: `src/sections/Lightbox.tsx`, `src/sections/lightbox.css`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `Picture`, `Memory`, `lightbox` state from App
- Produces: `<Lightbox order index onIndex onClose />`

- [ ] **Step 1: Implement**

`src/sections/Lightbox.tsx`:
```tsx
import { useEffect, useRef } from 'react';
import type { Memory } from '../lib/memory';
import { Picture } from '../lib/Picture';
import './lightbox.css';

interface Props {
  order: readonly Memory[];
  index: number | null;
  onIndex(i: number): void;
  onClose(): void;
}

export function Lightbox({ order, index, onIndex, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const startX = useRef<number | null>(null);
  const n = order.length;

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (index !== null && !d.open) d.showModal(); // native focus trap + Esc
    if (index === null && d.open) d.close(); // browser restores focus to the tile
  }, [index]);

  const go = (delta: number) => {
    if (index !== null) onIndex((index + delta + n) % n);
  };
  const m = index !== null ? order[index] : null;

  return (
    <dialog
      ref={dialog}
      className="lightbox"
      aria-label="Photo viewer"
      onClose={onClose}
      onKeyDown={e => {
        if (e.key === 'ArrowLeft') go(-1);
        if (e.key === 'ArrowRight') go(1);
      }}
      onPointerDown={e => { startX.current = e.clientX; }}
      onPointerUp={e => {
        if (startX.current === null) return;
        const dx = e.clientX - startX.current;
        startX.current = null;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
    >
      {m && index !== null && (
        <>
          <header className="lightbox__top">
            <span className="label label--cream">
              <span className="disp lightbox__num">{String(index + 1).padStart(2, '0')}</span> / {n}
            </span>
            <span className="label">PHOTO · ORIGINAL</span>
            <button type="button" className="btn-ghost lightbox__close" onClick={onClose} aria-label="Close">✕</button>
          </header>
          <Picture m={m} sizes="100vw" className="lightbox__img" loading="eager" />
          {m.caption && <p className="lightbox__cap">{m.caption}</p>}
          <footer className="lightbox__nav">
            <button type="button" className="btn-ghost" onClick={() => go(-1)}>← PREV</button>
            <span className="label label--muted">SWIPE · ARROWS · ESC</span>
            <button type="button" className="btn-ghost" onClick={() => go(1)}>NEXT →</button>
          </footer>
        </>
      )}
    </dialog>
  );
}
```

`src/sections/lightbox.css`:
```css
.lightbox {
  width: 100vw; height: 100dvh; max-width: none; max-height: none; margin: 0; border: 0;
  padding: 16px var(--gutter) max(16px, env(safe-area-inset-bottom));
  background: rgb(10 10 10 / 0.96); color: var(--cream); touch-action: pan-y;
}
.lightbox[open] { display: flex; flex-direction: column; gap: 14px; }
.lightbox::backdrop { background: rgb(10 10 10 / 0.9); }
.lightbox__top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.lightbox__num { font-size: 28px; color: var(--cream); }
.lightbox__close { width: 44px; padding: 0; }
.lightbox__img { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; }
.lightbox__img img {
  width: auto; height: auto; max-width: 100%; max-height: 68dvh; object-fit: contain;
  border: 4px solid var(--cream); border-radius: 14px;
}
.lightbox__cap { margin: 0; text-align: center; font-size: 15px; }
.lightbox__nav { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
@media (max-width: 480px) { .lightbox__nav .label { display: none; } }
```

In `src/App.tsx`: add `import { Lightbox } from './sections/Lightbox';` and, after `{entered && <MusicSticker />}`, add:
```tsx
      <Lightbox order={order} index={lightbox} onIndex={setLightbox} onClose={() => setLightbox(null)} />
```

- [ ] **Step 2: Verify in the browser**

- Tapping a photo tile opens the lightbox on that photo. It shows the original (never duotone) and `NN / total`.
- ←/→ keys, PREV/NEXT, and a horizontal swipe (DevTools touch emulation) all navigate and wrap around at the ends.
- Esc and ✕ close it; focus returns to the tapped tile.
- While it is open, the wall behind stops animating: open it, wait 10 s, close it, and the tiles look unchanged.
- Tab stays inside the dialog while it is open.

- [ ] **Step 3: Commit**

```bash
git add src
git commit -m "feat: lightbox with keys, swipe, native dialog

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Outro credits and footer

**Files:**
- Create: `src/sections/Outro.tsx`, `src/sections/outro.css`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `Lettering`, `content`
- Produces: `<Outro />`, `<Footer />`

- [ ] **Step 1: Implement**

`src/sections/Outro.tsx`:
```tsx
import { content } from '../content';
import { Lettering } from '../fx/Lettering';
import './outro.css';

export function Outro() {
  return (
    <section className="outro" aria-labelledby="outro-title">
      <p className="label">SIDE B · CREDITS</p>
      <Lettering as="h2" id="outro-title" text="CẢM ƠN!" className="outro__title" />
      <p className="outro__thanks">{content.thanks}</p>
      <ol className="tracklist">
        {content.team.map((p, i) => (
          <li key={i}>
            <span className="tracklist__n">{String(i + 1).padStart(2, '0')}</span>
            <span className="tracklist__name">{p.name}</span>
            <span className="tracklist__role">{p.role}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <span className="label label--cream">NOERR · TEAM ONLY</span>
      <a href="#top" className="label">BACK TO TOP</a>
    </footer>
  );
}
```

`src/sections/outro.css`:
```css
.outro { max-width: var(--maxw); margin: 0 auto; padding: 56px var(--gutter) 40px; }
.outro__title { font-size: clamp(64px, 12vw, 160px); margin: 16px 0 24px; }
.outro__thanks { margin: 0 0 32px; font-size: 15px; }
.tracklist { list-style: none; margin: 0; padding: 0; border-top: 1px solid #2a2a2a; }
.tracklist li {
  display: grid; grid-template-columns: 40px 1fr auto; align-items: baseline; gap: 12px;
  padding: 14px 0; border-bottom: 1px solid #2a2a2a;
}
.tracklist__n { color: var(--orange); font-size: 13px; }
.tracklist__name { font-size: 17px; }
.tracklist__role { color: var(--pink); font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; }
.footer {
  max-width: var(--maxw); margin: 0 auto; display: flex; justify-content: space-between; gap: 16px;
  padding: 32px var(--gutter) 128px; /* room for the floating player */
}
```

In `src/App.tsx`: add `import { Footer, Outro } from './sections/Outro';` and, after the wall's divider inside `<main>`, add:
```tsx
        <Outro />
        <Footer />
```

- [ ] **Step 2: Verify in the browser**

- The credits match the "SIDE B · CREDITS" part of the phone board: `CẢM ƠN!` lettering with the diacritics correct, 14 numbered rows, pink roles.
- BACK TO TOP scrolls to the hero (smoothly unless reduced motion is on).
- The floating player never covers the last row or the footer.

- [ ] **Step 3: Commit**

```bash
git add src
git commit -m "feat: credits tracklist and footer

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Fun extras — face rain easter egg, cursor trail

**Files:**
- Create: `src/fx/FaceRain.tsx`, `src/fx/CursorTrail.tsx`, `src/fx/fx.css`
- Modify: `src/sections/Hero.tsx`, `src/App.tsx`

**Interfaces:**
- Consumes: `imageUrl`, `Memory`, `useMediaQuery`, `useReducedMotion`
- Produces:
  - `<FaceRain order onDone />`
  - `useNoerrKeys(onTrigger: () => void): void`
  - `<CursorTrail />`
  - `Hero` gains prop `onRain(): void`

- [ ] **Step 1: Implement**

`src/fx/FaceRain.tsx`:
```tsx
import { useEffect, useMemo, type CSSProperties } from 'react';
import { useReducedMotion } from '../lib/media';
import { imageUrl, type Memory } from '../lib/memory';
import './fx.css';

/** Typing "noerr" anywhere triggers the rain. */
export function useNoerrKeys(onTrigger: () => void) {
  useEffect(() => {
    let buffer = '';
    const onKey = (e: KeyboardEvent) => {
      if (e.key.length !== 1) return;
      buffer = (buffer + e.key.toLowerCase()).slice(-5);
      if (buffer === 'noerr') {
        buffer = '';
        onTrigger();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onTrigger]);
}

/** 24 random memories fall for 3 s, then onDone(). */
export function FaceRain({ order, onDone }: { order: readonly Memory[]; onDone(): void }) {
  const reduced = useReducedMotion();
  const drops = useMemo(
    () =>
      Array.from({ length: 24 }, () => ({
        m: order[Math.floor(Math.random() * order.length)],
        x: Math.random() * 100,
        delay: Math.random() * 1.2,
        spin: (Math.random() * 2 - 1) * 360,
        size: 56 + Math.random() * 48,
      })),
    [order],
  );
  useEffect(() => {
    const t = setTimeout(onDone, reduced ? 0 : 3000);
    return () => clearTimeout(t);
  }, [onDone, reduced]);
  if (reduced) return null;
  return (
    <div className="rain" aria-hidden="true">
      {drops.map((d, i) => (
        <img
          key={i}
          src={imageUrl(d.m.id, 240, 'webp')}
          alt=""
          className="rain__drop"
          style={{ left: `${d.x}%`, width: d.size, animationDelay: `${d.delay}s`, '--spin': `${d.spin}deg` } as CSSProperties}
        />
      ))}
    </div>
  );
}
```

`src/fx/CursorTrail.tsx`:
```tsx
import { useEffect, useRef } from 'react';
import { useMediaQuery, useReducedMotion } from '../lib/media';
import './fx.css';

const COUNT = 12;
const COLOURS = ['var(--violet)', 'var(--orange)', 'var(--pink)', 'var(--green)'];

/** Desktop only: a short trail of palette blobs behind the pointer. */
export function CursorTrail() {
  const fine = useMediaQuery('(pointer: fine)');
  const reduced = useReducedMotion();
  const dots = useRef<(HTMLSpanElement | null)[]>([]);
  const on = fine && !reduced;

  useEffect(() => {
    if (!on) return;
    let next = 0;
    const onMove = (e: PointerEvent) => {
      const el = dots.current[next++ % COUNT];
      if (!el) return;
      el.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      el.getAnimations().forEach(a => a.cancel());
      el.animate([{ opacity: 0.9, scale: 1 }, { opacity: 0, scale: 0.2 }], { duration: 500, easing: 'ease-out', fill: 'forwards' });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [on]);

  if (!on) return null;
  return (
    <div className="trail" aria-hidden="true">
      {Array.from({ length: COUNT }, (_, k) => (
        <span key={k} ref={el => { dots.current[k] = el; }} className="trail__dot" style={{ background: COLOURS[k % COLOURS.length] }} />
      ))}
    </div>
  );
}
```

`src/fx/fx.css`:
```css
.rain { position: fixed; inset: 0; z-index: 90; overflow: hidden; pointer-events: none; }
.rain__drop {
  position: absolute; top: -140px; aspect-ratio: 1; object-fit: cover;
  border: 3px solid var(--cream); border-radius: 50%; animation: fall 1.8s ease-in forwards;
}
@keyframes fall { to { transform: translateY(calc(100vh + 180px)) rotate(var(--spin)); } }
.trail { position: fixed; inset: 0; z-index: 95; pointer-events: none; }
.trail__dot { position: absolute; left: -5px; top: -5px; width: 10px; height: 10px; border-radius: 50%; opacity: 0; }
```

In `src/sections/Hero.tsx`:
- change the signature to `export function Hero({ order, onRain }: { order: readonly Memory[]; onRain(): void })`;
- add `const taps = useRef<number[]>([]);` next to `cluster`;
- add this handler before `return`:
```tsx
  // Easter egg: 5 taps on the title within 3 s.
  const tapTitle = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter(t => now - t < 3000), now];
    if (taps.current.length >= 5) {
      taps.current = [];
      onRain();
    }
  };
```
- change the title to `<Lettering text="NOERR" className="hero__title" onClick={tapTitle} />`.

In `src/App.tsx`:
- change the React import to `import { useCallback, useMemo, useState } from 'react';`;
- add `import { CursorTrail } from './fx/CursorTrail';` and `import { FaceRain, useNoerrKeys } from './fx/FaceRain';`;
- before the early return, add:
```tsx
  const [rain, setRain] = useState(0);
  const triggerRain = useCallback(() => setRain(n => n + 1), []);
  const endRain = useCallback(() => setRain(0), []);
  useNoerrKeys(triggerRain);
```
- change `<Hero order={order} />` to `<Hero order={order} onRain={triggerRain} />`;
- after `<Lightbox …/>`, add:
```tsx
      {rain > 0 && <FaceRain key={rain} order={order} onDone={endRain} />}
      <CursorTrail />
```

- [ ] **Step 2: Verify in the browser**

- Typing `noerr` (after entering the site) rains 24 photo circles for about 3 s. Tapping the hero NOERR title 5× quickly does the same. The page stays clickable during the rain.
- On desktop, a short coloured blob trail follows the cursor. In touch emulation there is no trail.
- Reduced motion: no rain, no trail.

- [ ] **Step 3: Commit**

```bash
git add src
git commit -m "feat: face rain easter egg and cursor trail

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: README, budgets, and final verification

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

````markdown
# noerr-throwback

Team-only throwback page for the NOERR team. Static Vite + React + TS, hosted on Cloudflare Pages behind Cloudflare Access.

Design: `docs/superpowers/specs/2026-09-30-noerr-throwback-design.md` · Mockup: `docs/design/mockup.html` (open in a browser).

## Develop

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # vitest
npm run build        # type-check + production build to dist/
```

## Add or remove photos

1. Put curated photos in `/Users/mnluu/pic/noerr`, or point `PHOTOS_SRC` at another folder. Check first: no screens, whiteboards or documents, and everyone in the photo is OK with it.
2. Optional captions: `content/captions.json`, keyed by original filename, e.g. `{ "IMG_0042.jpg": "Team lunch" }`.
3. `npm run build:images`. This strips EXIF (including GPS), writes AVIF/WebP to `public/memories/`, updates `src/memories.json`, and prunes removed photos.
4. Commit `public/memories` and `src/memories.json`, then push. Originals never go into git.

## Copy

Edit `src/content.ts` (subtitle, song title, thank-you line, team list). Never add anything about the client, the product, or the work.

## Deploy (Cloudflare Pages + Access)

1. Cloudflare dashboard → Workers & Pages → Create → Pages → connect this repo (or run `npx wrangler pages deploy dist`). Build command: `npm run build`. Output: `dist`.
2. Zero Trust → Access → Applications → Add → Self-hosted:
   - Application domain: `<project>.pages.dev`, **plus a second entry `*.<project>.pages.dev`**. Preview deployments get their own public URLs; without the wildcard, every photo is public on preview links.
   - Session duration: 1 month.
   - Identity: One-time PIN.
   - Policy: Allow → Include → Emails → the team list. The allowlist lives here only, never in the repo.
3. Open the site in a private window with an email not on the list. You should see only the Access login.

## Manual checklist before launch

- [ ] Splash → PRESS PLAY → song fades in (desktop Chrome, Safari, Firefox; iPhone with the ringer switch on silent)
- [ ] Mute / pause on the disc; hiding the tab pauses the song, returning resumes it only if it was playing
- [ ] Missing mp3 → the disc shows paused; the page still works
- [ ] Wall: flips, peeks, mosaic, colour blocks; shuffle flies; no photo on two tiles at once
- [ ] Lightbox: tap, ←/→, swipe, Esc, focus returns to the tile
- [ ] Reduced motion (DevTools → Rendering): crossfades only, nothing bobs or spins
- [ ] Keyboard only: every control reachable, visible focus
- [ ] Phone (390 px) and desktop (1440 px) compared side by side with the mockup boards
- [ ] Content review by a second person: no client, product or work details, no screens in photos
````

- [ ] **Step 2: Budget and quality checks**

Run:
```bash
npm test
npm run build 2>&1 | tail -20
```
Expected: all tests pass. In the build output, the `gzip:` values of `dist/assets/*.js` plus `dist/assets/*.css` add up to less than 150 kB (font `.woff2` files do not count). If they are over, report the numbers and do not trim features on your own.

Then run `npm run preview` and use Chrome DevTools Lighthouse (mobile, Performance + Accessibility + Best Practices) on `http://localhost:4173`. Record in the task report:
- Performance, Accessibility, and CLS scores (CLS target < 0.05);
- whether the splash is visible within 1.5 s under the "Slow 4G" throttling preset.

Check the Network panel for any request to a non-localhost origin. There must be none.

- [ ] **Step 3: Run the README manual checklist**

Go through each item on desktop Chrome at 390 px and 1440 px. Report every item that fails, with what you saw. Leave the iPhone and second-reviewer items to your human partner and say so in the report.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: README with photo workflow, Cloudflare Access setup, launch checklist

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
