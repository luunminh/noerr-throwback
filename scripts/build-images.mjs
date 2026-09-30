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
  try {
    execFileSync('sips', ['-s', 'format', 'jpeg', file, '--out', tmp], { stdio: 'ignore' });
    return await fs.readFile(tmp);
  } catch {
    return null; // unreadable HEIC: skip it rather than fail the whole build
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
      log(`skip HEIC (needs macOS sips, or file unreadable): ${name}`);
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
  // `file` is only for captions/logs here; original filenames never ship to visitors.
  await fs.writeFile(jsonPath, `${JSON.stringify(out.map(({ file, ...rest }) => rest), null, 2)}\n`);
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
