import { describe, it, expect } from 'vitest';
import { parseInstructionLine } from '@/lib/engpk/instruction/parser';

describe('parseInstructionLine — 正常样本', () => {
  it.each([
    {
      input: '第1页：【封面】+奇幻英语冒险+内容：Level 1 启程',
      expected: {
        index: 1,
        mode: 'cover',
        description: '奇幻英语冒险',
        content: 'Level 1 启程',
      },
    },
    {
      input: '第10页：【游戏】+单词闯关+内容：is, you, here, this',
      expected: {
        index: 10,
        mode: 'game',
        description: '单词闯关',
        content: 'is, you, here, this',
      },
    },
    {
      input: '第3页：【视频赏析】+角色口型模仿+内容：https://example.com/a.mp4',
      expected: {
        index: 3,
        mode: 'video-review',
        description: '角色口型模仿',
        content: 'https://example.com/a.mp4',
      },
    },
    {
      input: '第 5 页 ： 【 讨论 】 + 主题 + 内容 ： XXX',
      expected: {
        index: 5,
        mode: 'discussion',
        description: '主题',
        content: 'XXX',
      },
    },
    {
      input: '第2页：【暖场】+节奏热身+内容：rhythm.mp4',
      expected: {
        index: 2,
        mode: 'warmup',
        description: '节奏热身',
        content: 'rhythm.mp4',
      },
    },
    {
      input: '第15页：【图文】+语法拆解+内容：this 作主语 / 宾语 / 定语',
      expected: {
        index: 15,
        mode: 'article',
        description: '语法拆解',
        content: 'this 作主语 / 宾语 / 定语',
      },
    },
    {
      input: '第16页：【结尾】+闯关庆功+内容：本课共掌握 4 个词',
      expected: {
        index: 16,
        mode: 'ending',
        description: '闯关庆功',
        content: '本课共掌握 4 个词',
      },
    },
    {
      input: '第8页：【游戏】+combo 训练+内容：a, b, c',
      expected: {
        index: 8,
        mode: 'game',
        description: 'combo 训练',
        content: 'a, b, c',
      },
    },
  ])('解析 $input', ({ input, expected }) => {
    const result = parseInstructionLine(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.instruction.index).toBe(expected.index);
      expect(result.instruction.mode).toBe(expected.mode);
      expect(result.instruction.description).toBe(expected.description);
      expect(result.instruction.content).toBe(expected.content);
    }
  });
});

describe('parseInstructionLine — 错误样本', () => {
  it('空字符串报 EMPTY_INPUT', () => {
    const result = parseInstructionLine('');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('EMPTY_INPUT');
  });

  it('页码 0 报 INVALID_INDEX', () => {
    const result = parseInstructionLine('第0页：【封面】+x+内容：y');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_INDEX');
  });

  it('未知模式报 UNKNOWN_MODE', () => {
    const result = parseInstructionLine('第1页：【未知模式】+x+内容：y');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNKNOWN_MODE');
  });

  it.each([
    '第10页 游戏 单词闯关 内容 is you here this',
    'Page 10: [Game] Word Adventure Content: is, you, here, this',
    '第10页【游戏】单词闯关：is、you、here、this',
    '第10页 - 游戏 - 单词闯关 - is, you, here, this',
    '游戏 第10页 单词闯关 内容是 is, you, here, this',
  ])('格式异常的 %s 报 UNPARSEABLE 由 LLM 兜底', (input) => {
    const result = parseInstructionLine(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNPARSEABLE');
  });
});
