/**
 * engpk · 指令类型
 *
 * 用户通过多行文本输入指令，每行一条，对应一页场景。
 * 格式：`第{N}页：【{模式}】+{描述}+内容：{内容}`
 *
 * 解析流程：
 *   1. 正则解析（快路径）
 *   2. 失败 → LLM 兜底归一化 → 再解析
 *   3. 仍失败 → 报错
 */

/** 七类场景模式（与 README 对应） */
export type SceneMode =
  | 'cover' // 封面
  | 'warmup' // 暖场
  | 'video-review' // 视频赏析
  | 'game' // 游戏
  | 'discussion' // 讨论
  | 'article' // 图文
  | 'ending'; // 结尾

/** 中文模式名 → SceneMode 的映射 */
export const MODE_ALIASES: Record<string, SceneMode> = {
  封面: 'cover',
  封面类: 'cover',
  cover: 'cover',
  Cover: 'cover',

  暖场: 'warmup',
  暖场类: 'warmup',
  warmup: 'warmup',
  Warmup: 'warmup',

  视频赏析: 'video-review',
  视频赏析类: 'video-review',
  'video-review': 'video-review',
  video: 'video-review',

  游戏: 'game',
  游戏类: 'game',
  game: 'game',
  Game: 'game',

  讨论: 'discussion',
  讨论类: 'discussion',
  discussion: 'discussion',
  Discussion: 'discussion',

  图文: 'article',
  图文类: 'article',
  article: 'article',
  Article: 'article',

  结尾: 'ending',
  结尾类: 'ending',
  ending: 'ending',
  Ending: 'ending',
};

/** 所有合法模式的标准名称（用于 UI 展示） */
export const SCENE_MODE_LABELS: Record<SceneMode, string> = {
  cover: '封面',
  warmup: '暖场',
  'video-review': '视频赏析',
  game: '游戏',
  discussion: '讨论',
  article: '图文',
  ending: '结尾',
};

/**
 * 解析后的单页指令。
 *
 * 原始输入：`第10页：【游戏】+单词闯关+内容：is, you, here, this`
 * 解析为：  `{ index: 10, mode: 'game', description: '单词闯关', content: 'is, you, here, this' }`
 */
export interface PageInstruction {
  /** 页码（≥1，解析时从"第N页"提取） */
  index: number;

  /** 场景模式 */
  mode: SceneMode;

  /** 描述（+ 与 + 之间的部分） */
  description: string;

  /**
   * 内容（冒号后面的完整内容，保留原始字符串）
   * - 游戏类：学习词列表 "is, you, here, this"
   * - 视频赏析：视频 URL
   * - 暖场：暖场视频资源引用
   * - 其它：主题描述
   */
  content: string;

  /** 原始输入行（便于错误溯源与 UI 高亮） */
  rawLine: string;
}

/** 解析错误分类 */
export type InstructionParseErrorCode =
  | 'EMPTY_INPUT' // 空输入
  | 'MISSING_INDEX' // 缺少页码
  | 'INVALID_INDEX' // 页码非正整数
  | 'MISSING_MODE' // 缺少【模式】
  | 'UNKNOWN_MODE' // 模式不在白名单
  | 'MISSING_DESCRIPTION' // 缺少描述
  | 'MISSING_CONTENT' // 缺少内容
  | 'UNPARSEABLE'; // 整体无法识别，需走 LLM 兜底

export interface InstructionParseError {
  code: InstructionParseErrorCode;
  message: string;
  rawLine: string;
  lineNumber?: number; // 在多行输入中的行号（1-based）
}

/**
 * 单行解析结果（ok 或 err）。
 * 多行场景下，外层收集一个数组：ParsedLineResult[]。
 */
export type ParsedLineResult =
  | { ok: true; instruction: PageInstruction; normalized?: boolean }
  | { ok: false; error: InstructionParseError };

/**
 * 整体解析结果：汇总所有行的解析结果 + 交叉校验（页码唯一、序号排序等）。
 */
export interface InstructionBatchResult {
  /** 每行的解析结果，与输入行一一对应 */
  lines: ParsedLineResult[];

  /** 通过校验的合法指令（按 index 排序，仅 ok 行） */
  validInstructions: PageInstruction[];

  /** 全局错误（如页码重复、页码不连续等跨行校验） */
  batchErrors: InstructionParseError[];
}
