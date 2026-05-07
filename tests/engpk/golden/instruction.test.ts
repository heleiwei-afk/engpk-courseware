import { describe, it, expect } from 'vitest';
import { parseInstructionLine } from '@/lib/engpk/instruction/parser';
import normalSamples from '@/tests/golden/instruction/normal.json';
import invalidSamples from '@/tests/golden/instruction/invalid.json';

interface NormalSample {
  name: string;
  input: string;
  expected: {
    index: number;
    mode: string;
    description: string;
    content: string;
  };
}

interface InvalidSample {
  name: string;
  input: string;
  expectedErrorCode: string;
}

describe('黄金样本回归 · normal', () => {
  const samples = normalSamples as NormalSample[];
  it.each(samples)('$name', (sample) => {
    const result = parseInstructionLine(sample.input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.instruction.index).toBe(sample.expected.index);
      expect(result.instruction.mode).toBe(sample.expected.mode);
      expect(result.instruction.description).toBe(sample.expected.description);
      expect(result.instruction.content).toBe(sample.expected.content);
    }
  });
});

describe('黄金样本回归 · invalid', () => {
  const samples = invalidSamples as InvalidSample[];
  it.each(samples)('$name', (sample) => {
    const result = parseInstructionLine(sample.input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(sample.expectedErrorCode);
    }
  });
});
