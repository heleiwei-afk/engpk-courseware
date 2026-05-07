import { describe, it, expect } from 'vitest';
import { validateGameHtml } from '@/lib/engpk/game/validator';
import { validateGameEvent } from '@/lib/engpk/game/event-protocol';
import { injectCSP, CSP_META } from '@/lib/engpk/game/inject-csp';

describe('validateGameHtml', () => {
  const validHtml = `<!doctype html><html><head></head><body>
    <script>
      // contains learning goals: apple banana cherry
      parent.postMessage({source:'openmaic-game',gameId:'g',event:'complete',payload:{},timestamp:Date.now()},'*');
    </script></body></html>`;

  it('passes valid HTML with all goals present', () => {
    const result = validateGameHtml(validHtml, ['apple', 'banana', 'cherry']);
    expect(result.valid).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('fails when learning goal is missing', () => {
    const result = validateGameHtml(validHtml, ['apple', 'banana', 'mango']);
    expect(result.valid).toBe(false);
    expect(result.reasons.some((r) => r.includes('mango'))).toBe(true);
  });

  it('fails when forbidden API is present', () => {
    const bad = validHtml.replace('parent.postMessage', 'fetch("/x"); parent.postMessage');
    const result = validateGameHtml(bad, ['apple', 'banana', 'cherry']);
    expect(result.valid).toBe(false);
    expect(result.reasons.some((r) => r.includes('禁用 API'))).toBe(true);
  });

  it('fails when postMessage is missing', () => {
    const noPost = '<!doctype html><html><body>apple banana cherry</body></html>';
    const result = validateGameHtml(noPost, ['apple', 'banana', 'cherry']);
    expect(result.valid).toBe(false);
    expect(result.reasons.some((r) => r.includes('postMessage'))).toBe(true);
  });

  it('fails when HTML exceeds 200KB', () => {
    const huge = validHtml + 'x'.repeat(200_001);
    const result = validateGameHtml(huge, ['apple']);
    expect(result.valid).toBe(false);
    expect(result.reasons.some((r) => r.includes('200KB'))).toBe(true);
  });
});

describe('validateGameEvent', () => {
  it('validates a correct event', () => {
    const data = {
      source: 'openmaic-game',
      gameId: 'g1',
      event: 'score',
      payload: { delta: 10 },
      timestamp: Date.now(),
    };
    const result = validateGameEvent(data, 'g1');
    expect(result).not.toBeNull();
    expect(result!.event).toBe('score');
  });

  it('rejects wrong source', () => {
    const data = {
      source: 'other',
      gameId: 'g1',
      event: 'score',
      payload: {},
      timestamp: 1,
    };
    expect(validateGameEvent(data, 'g1')).toBeNull();
  });

  it('rejects wrong gameId', () => {
    const data = {
      source: 'openmaic-game',
      gameId: 'wrong',
      event: 'score',
      payload: {},
      timestamp: 1,
    };
    expect(validateGameEvent(data, 'g1')).toBeNull();
  });

  it('rejects invalid event type', () => {
    const data = {
      source: 'openmaic-game',
      gameId: 'g1',
      event: 'hack',
      payload: {},
      timestamp: 1,
    };
    expect(validateGameEvent(data, 'g1')).toBeNull();
  });

  it('rejects non-object', () => {
    expect(validateGameEvent(null, 'g1')).toBeNull();
    expect(validateGameEvent('string', 'g1')).toBeNull();
    expect(validateGameEvent(42, 'g1')).toBeNull();
  });
});

describe('injectCSP', () => {
  it('injects into <head>', () => {
    const html = '<!doctype html><html><head><title>x</title></head><body></body></html>';
    const result = injectCSP(html);
    expect(result).toContain(CSP_META);
    expect(result.indexOf(CSP_META)).toBeGreaterThan(html.indexOf('<head>'));
  });

  it('does not double-inject', () => {
    const html = `<html><head>${CSP_META}</head><body></body></html>`;
    const result = injectCSP(html);
    expect(result).toBe(html);
  });

  it('creates <head> if missing', () => {
    const html = '<html><body>hi</body></html>';
    const result = injectCSP(html);
    expect(result).toContain('<head>');
    expect(result).toContain(CSP_META);
  });
});
