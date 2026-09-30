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
