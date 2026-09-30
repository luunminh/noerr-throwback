import { describe, expect, it } from 'vitest';
import { canUseWebAudio, stateAfterPlayError } from './policy';

describe('canUseWebAudio', () => {
  it('routes through Web Audio only where the silent switch can be overridden (iOS 17+ audioSession, or no iOS)', () => {
    expect(canUseWebAudio({ audioSession: { type: 'auto' } }, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
    expect(canUseWebAudio({}, 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X)')).toBe(false);
    expect(canUseWebAudio({}, 'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X)')).toBe(false);
    expect(canUseWebAudio({}, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Chrome/130')).toBe(true);
    expect(canUseWebAudio({}, 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile')).toBe(true);
  });
});

describe('stateAfterPlayError', () => {
  it('ignores AbortError (a pause interrupted a pending play) and marks anything else blocked', () => {
    expect(stateAfterPlayError(new DOMException('interrupted', 'AbortError'))).toBeNull();
    expect(stateAfterPlayError(new DOMException('no gesture', 'NotAllowedError'))).toBe('blocked');
    expect(stateAfterPlayError(new DOMException('bad src', 'NotSupportedError'))).toBe('blocked');
    expect(stateAfterPlayError(new Error('boom'))).toBe('blocked');
  });
});
