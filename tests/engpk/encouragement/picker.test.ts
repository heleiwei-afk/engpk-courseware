import { describe, it, expect } from 'vitest';
import { pickEncouragements } from '@/lib/engpk/encouragement/picker';
import { MAX_AMOUNT, TEMPLATES } from '@/lib/engpk/encouragement/templates';

describe('pickEncouragements', () => {
  it('returns 3 items by default', () => {
    const result = pickEncouragements({ scoreRate: 0.9 });
    expect(result).toHaveLength(3);
  });

  it('respects count parameter', () => {
    const result = pickEncouragements({ scoreRate: 0.5, count: 2 });
    expect(result).toHaveLength(2);
  });

  it('all monetary amounts are ≤ MAX_AMOUNT', () => {
    // 跑 100 次确保随机不越界
    for (let i = 0; i < 100; i++) {
      const result = pickEncouragements({ scoreRate: 0.9, count: 5 });
      for (const e of result) {
        if (e.amount !== undefined) {
          expect(e.amount).toBeLessThanOrEqual(MAX_AMOUNT);
          expect(e.amount).toBeGreaterThan(0);
        }
      }
    }
  });

  it('monetary templates have {amount} replaced', () => {
    const result = pickEncouragements({ scoreRate: 0.9, count: 10 });
    for (const e of result) {
      expect(e.text).not.toContain('{amount}');
    }
  });

  it('mood=high selects from high pool', () => {
    const result = pickEncouragements({ scoreRate: 0.95, count: 20 });
    // 所有 templateId 应该在 high 模板中
    const highIds = TEMPLATES.filter((t) => t.moodTag === 'high').map((t) => t.id);
    for (const e of result) {
      expect(highIds).toContain(e.templateId);
    }
  });

  it('mood=low selects from low pool', () => {
    const result = pickEncouragements({ scoreRate: 0.2, count: 20 });
    const lowIds = TEMPLATES.filter((t) => t.moodTag === 'low').map((t) => t.id);
    for (const e of result) {
      expect(lowIds).toContain(e.templateId);
    }
  });

  it('explicit mood overrides scoreRate', () => {
    const result = pickEncouragements({ scoreRate: 0.99, mood: 'low', count: 10 });
    const lowIds = TEMPLATES.filter((t) => t.moodTag === 'low').map((t) => t.id);
    for (const e of result) {
      expect(lowIds).toContain(e.templateId);
    }
  });

  it('templateId is always in whitelist', () => {
    const allIds = TEMPLATES.map((t) => t.id);
    for (let i = 0; i < 50; i++) {
      const result = pickEncouragements({ scoreRate: 0.6, count: 5 });
      for (const e of result) {
        expect(allIds).toContain(e.templateId);
      }
    }
  });

  it('no duplicates within a single pick', () => {
    for (let i = 0; i < 50; i++) {
      const result = pickEncouragements({ scoreRate: 0.8, count: 5 });
      const ids = result.map((e) => e.templateId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
