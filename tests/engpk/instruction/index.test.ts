import { describe, it, expect } from 'vitest';
import {
  parseLocally,
  parseWithFallback,
} from '@/lib/engpk/instruction/server';

describe('parseLocally — 多行解析', () => {
  it('混合多行：合法 + 异常', () => {
    const text = [
      '第1页：【封面】+奇幻英语冒险+内容：Level 1 启程',
      '',
      '第2页：【暖场】+节奏热身+内容：rhythm.mp4',
      '第3页 游戏 单词闯关', // 异常行
      '第4页：【讨论】+主题+内容：内容',
    ].join('\n');

    const result = parseLocally(text);

    // 合法的 3 行
    expect(result.validInstructions).toHaveLength(3);
    expect(result.validInstructions.map((i) => i.index)).toEqual([1, 2, 4]);

    // 异常 1 行：UNPARSEABLE
    const errors = result.lines.filter((l) => !l.ok);
    expect(errors).toHaveLength(1);
    if (!errors[0].ok) {
      expect(errors[0].error.code).toBe('UNPARSEABLE');
    }
  });

  it('页码重复时第二次起进入 batchErrors', () => {
    const text = [
      '第1页：【封面】+a+内容：x',
      '第1页：【游戏】+b+内容：y',
    ].join('\n');

    const result = parseLocally(text);
    expect(result.validInstructions).toHaveLength(1);
    expect(result.batchErrors.length).toBeGreaterThan(0);
    expect(result.batchErrors.some((e) => e.message.includes('1'))).toBe(true);
  });

  it('空输入返回空结果', () => {
    const result = parseLocally('');
    expect(result.validInstructions).toHaveLength(0);
    expect(result.lines).toHaveLength(0);
  });
});

describe('parseWithFallback — LLM 归一化兜底', () => {
  it('禁用 fallback 时直接返回正则结果', async () => {
    const text = '第10页 游戏 单词闯关';
    const result = await parseWithFallback(text, {
      enableLLMFallback: false,
    });
    expect(result.validInstructions).toHaveLength(0);
  });

  it('启用 fallback 时调用注入的 normalizer', async () => {
    const text = '第10页 游戏 单词闯关 内容 is you here this';
    const normalizer = async (input: string) => {
      // 验证收到了原始输入
      expect(input).toBe(text);
      return '第10页：【游戏】+单词闯关+内容：is, you, here, this';
    };

    const result = await parseWithFallback(text, {
      enableLLMFallback: true,
      normalizer,
    });

    expect(result.validInstructions).toHaveLength(1);
    expect(result.validInstructions[0].mode).toBe('game');
    expect(result.validInstructions[0].content).toBe(
      'is, you, here, this',
    );
    // 标记为 normalized
    const okLine = result.lines.find((l) => l.ok);
    expect(okLine?.ok && okLine.normalized).toBe(true);
  });

  it('normalizer 抛错时回落到正则结果（不阻断）', async () => {
    const text = '第10页 游戏 单词闯关';
    const result = await parseWithFallback(text, {
      enableLLMFallback: true,
      normalizer: async () => {
        throw new Error('LLM unreachable');
      },
    });
    // 没有合法指令，但调用没抛
    expect(result.validInstructions).toHaveLength(0);
    expect(result.lines.length).toBeGreaterThan(0);
  });

  it('normalizer 返回空字符串时也回落到正则结果', async () => {
    const text = '第10页 游戏 单词闯关';
    const result = await parseWithFallback(text, {
      enableLLMFallback: true,
      normalizer: async () => '',
    });
    expect(result.validInstructions).toHaveLength(0);
  });

  it('混合可解析+不可解析时，仅对不可解析部分走 LLM', async () => {
    const text = [
      '第1页：【封面】+奇幻+内容：x',
      '第二页 暖场 热身 节奏', // 异常
    ].join('\n');

    const normalizer = async () =>
      [
        '第1页：【封面】+奇幻+内容：x',
        '第2页：【暖场】+热身+内容：节奏',
      ].join('\n');

    const result = await parseWithFallback(text, {
      enableLLMFallback: true,
      normalizer,
    });

    expect(result.validInstructions).toHaveLength(2);
    expect(result.validInstructions.map((i) => i.index)).toEqual([1, 2]);
  });
});
