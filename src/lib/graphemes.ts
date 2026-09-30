const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** Split into user-perceived characters so Vietnamese diacritics stay on their letter. */
export const graphemes = (text: string): string[] => Array.from(segmenter.segment(text), s => s.segment);
