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
