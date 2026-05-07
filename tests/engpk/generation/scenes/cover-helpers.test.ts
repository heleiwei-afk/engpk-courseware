import { describe, it, expect } from 'vitest';
import { __test__ } from '@/lib/engpk/generation/scenes/generate-cover-scene';

const { normalizeStyleToken, clampString, DEFAULT_STYLE } = __test__;

describe('cover-scene helpers', () => {
  describe('normalizeStyleToken', () => {
    it('returns defaults for invalid input', () => {
      expect(normalizeStyleToken(null)).toEqual(DEFAULT_STYLE);
      expect(normalizeStyleToken(undefined)).toEqual(DEFAULT_STYLE);
      expect(normalizeStyleToken('not-an-object')).toEqual(DEFAULT_STYLE);
      expect(normalizeStyleToken(42)).toEqual(DEFAULT_STYLE);
    });

    it('falls back per-field when fields are invalid', () => {
      const result = normalizeStyleToken({
        primaryColor: 'not-a-hex',
        accentColor: '#22d3ee',
        fontFamily: 'comic',
        motif: 'fantasy',
      });
      expect(result.primaryColor).toBe(DEFAULT_STYLE.primaryColor);
      expect(result.accentColor).toBe('#22d3ee');
      expect(result.fontFamily).toBe(DEFAULT_STYLE.fontFamily);
      expect(result.motif).toBe('fantasy');
    });

    it('accepts both 3-digit and 6-digit hex', () => {
      const result = normalizeStyleToken({
        primaryColor: '#abc',
        accentColor: '#aabbcc',
        fontFamily: 'sans',
        motif: 'tech',
      });
      expect(result.primaryColor).toBe('#abc');
      expect(result.accentColor).toBe('#aabbcc');
    });

    it('accepts all enum values', () => {
      for (const motif of [
        'fantasy',
        'tech',
        'nature',
        'ocean',
        'space',
        'classroom',
        'storybook',
      ] as const) {
        const out = normalizeStyleToken({
          primaryColor: '#000000',
          accentColor: '#ffffff',
          fontFamily: 'rounded',
          motif,
        });
        expect(out.motif).toBe(motif);
      }
    });
  });

  describe('clampString', () => {
    it('returns fallback for non-strings', () => {
      expect(clampString(null, 10, 'fb')).toBe('fb');
      expect(clampString(123, 10, 'fb')).toBe('fb');
      expect(clampString(undefined, 10, 'fb')).toBe('fb');
    });

    it('returns fallback for empty / whitespace', () => {
      expect(clampString('', 10, 'fb')).toBe('fb');
      expect(clampString('   ', 10, 'fb')).toBe('fb');
    });

    it('truncates long strings to maxLen', () => {
      expect(clampString('一二三四五六七八九十', 5, 'fb')).toBe('一二三四五');
    });

    it('keeps short strings unchanged', () => {
      expect(clampString('短', 10, 'fb')).toBe('短');
    });

    it('trims surrounding whitespace', () => {
      expect(clampString('  hi  ', 10, 'fb')).toBe('hi');
    });
  });
});
