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
