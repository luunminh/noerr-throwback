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
