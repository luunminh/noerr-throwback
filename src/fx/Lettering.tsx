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
