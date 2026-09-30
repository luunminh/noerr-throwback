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
