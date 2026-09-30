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
