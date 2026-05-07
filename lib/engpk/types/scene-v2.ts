/**
 * engpk · Scene v2 类型
 *
 * 替换 OpenMAIC 原有的 slide/quiz/interactive/pbl 四类，
 * 新增七类场景 + 各自的 payload。
 *
 * 设计原则：
 *   - 每类场景独立 payload（决策 #2：保持 7 个独立实现）
 *   - 共用 SceneBase（id / order / instruction / agents / actions / status）
 *   - actions 仍是 OpenMAIC Action（已扩展 engpk 的 3 个新 type）
 *   - 不与旧 SceneType 兼容（决策 #14）
 */

import type { Action } from '@/lib/types/action';
import type { PageInstruction } from '@/lib/engpk/instruction/types';
import type { EngpkAction } from './action-ext';

/** Scene 内可以承载的动作：MAIC 原 Action 联合 + engpk 三个新动作 */
export type SceneAction = Action | EngpkAction;

// ==================== 通用类型 ====================

/** 课程风格 token（由封面页生成，作为后续页面的视觉基线） */
export interface StyleToken {
  /** 主色 hex */
  primaryColor: string;
  /** 辅助色 hex */
  accentColor: string;
  /** 字体族 */
  fontFamily: 'rounded' | 'serif' | 'mono' | 'sans';
  /** 视觉主题 */
  motif: 'fantasy' | 'tech' | 'nature' | 'ocean' | 'space' | 'classroom' | 'storybook';
}

/** 场景生成状态（边播边生成时使用） */
export type SceneStatus =
  | 'pending' // 等待生成
  | 'generating' // 生成中（SSE 中）
  | 'ready' // 已就绪可播放
  | 'failed'; // 生成失败（前端可重试）

// ==================== 各类场景 payload ====================

/** 封面类 payload */
export interface CoverScenePayload {
  title: string;
  subtitle?: string;
  styleToken: StyleToken;
  /** 封面图（生成完成后填充 URL；生成中是 prompt） */
  coverImagePrompt: string;
  coverImageUrl?: string;
}

/** 暖场类 payload */
export interface WarmupScenePayload {
  /** 用户上传的暖场视频 URL */
  warmupVideoUrl: string;
  rhythmGame: {
    /** 与视频时长匹配 */
    durationMs: number;
    /** 下落 lane 数量 */
    laneCount: 4 | 5 | 6;
    /** 难度 */
    difficulty: 'easy' | 'normal' | 'hard';
    /** 节拍谱（LLM 根据视频时长 + 课程主题生成） */
    beatmap: BeatmapNote[];
  };
}

/** 节拍音符 */
export interface BeatmapNote {
  /** 出现时间（毫秒，单调递增） */
  timeMs: number;
  /** 哪条 lane（0..laneCount-1） */
  lane: number;
  /** 音符类型 */
  type: 'tap' | 'hold';
  /** type='hold' 时的持续毫秒 */
  holdMs?: number;
}

/** 视频赏析类 payload */
export interface VideoReviewScenePayload {
  /** 主视频 URL */
  videoUrl: string;
  /** 截图判定间隔（秒） */
  performanceCheckIntervalSec: number;
  /** 是否需要摄像头 */
  cameraRequired: boolean;
  /**
   * 给视觉模型的判定 prompt
   * 例："这张图中的人是否在做表演动作（如唱歌、跳舞、模仿口型）？只回答 yes 或 no。"
   */
  performancePrompt: string;
}

/** 游戏类 payload */
export interface GameScenePayload {
  /** 学习目标关键词列表（必须全部出现在 gameHtml 中） */
  learningGoals: string[];
  /** 游戏设计文档（先于 HTML 生成） */
  gameDesign: {
    title: string;
    /** 游戏机制描述 */
    mechanics: string;
    /** 通关条件 */
    winCondition: string;
  };
  /**
   * 完整可运行的游戏 HTML（含 CSP meta、postMessage 调用）
   * 通过 game-validator 校验后才会写入。
   */
  gameHtml: string;
}

/** 讨论类 payload */
export interface DiscussionScenePayload {
  /** 讨论话题 */
  topic: string;
  /** 学生需完成的任务 */
  task: string;
  /** 讨论规则 */
  rule: string;
  /** 建议轮数（3-5） */
  expectedRounds: number;
  /**
   * 不预生成具体 agent 发言；运行时由 LangGraph 实时生成。
   * 此处仅放老师开场白等静态内容。
   */
}

/** 图文块类型（engpk 自带，不依赖旧 slide elements） */
export type ArticleBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'bullet-list'; items: string[] }
  | { type: 'highlight'; text: string }
  | { type: 'image'; prompt: string; caption?: string; url?: string };

/** 图文类 payload */
export interface ArticleScenePayload {
  /** 标题 */
  heading: string;
  /** 图文块序列 */
  blocks: ArticleBlock[];
  /** 老师讲解词对应的 block index（与 actions 里 speech 的顺序一一对应） */
  focusBlockIndexes?: number[];
  /** 此场景不限制讲解量（决策 #3 例外） */
}

/** 结尾类 payload */
export interface EndingScenePayload {
  /** 结尾小游戏模板 */
  endingGameTemplate: 'redpacket' | 'blindbox' | 'duck' | 'balloon';
  /** 完整游戏 HTML（同 game 类，需通过 validator） */
  endingGameHtml: string;
  /** 鼓励语（已通过 encouragement-picker 替换占位符；金额硬上限 5 元） */
  encouragements: Encouragement[];
}

/** 单条鼓励语 */
export interface Encouragement {
  /** 模板 id（必须在白名单内） */
  templateId: string;
  /** 已替换占位符的最终文本 */
  text: string;
  /** 分类 */
  category: 'physical' | 'household' | 'fun' | 'monetary';
  /** 若是 monetary，记录实际金额（≤5） */
  amount?: number;
}

// ==================== Scene 联合 ====================

/** 各类场景的判别 union */
export type SceneType =
  | 'cover'
  | 'warmup'
  | 'video-review'
  | 'game'
  | 'discussion'
  | 'article'
  | 'ending';

/** payload 类型映射 */
export interface ScenePayloadMap {
  cover: CoverScenePayload;
  warmup: WarmupScenePayload;
  'video-review': VideoReviewScenePayload;
  game: GameScenePayload;
  discussion: DiscussionScenePayload;
  article: ArticleScenePayload;
  ending: EndingScenePayload;
}

/** 场景基础字段 */
export interface SceneBase {
  /** 稳定 id（UUID） */
  id: string;
  /** 课程内顺序（与 instruction.index 对应） */
  order: number;
  /** 来源指令 */
  instruction: PageInstruction;
  /** 参与的 AI 队友 id 列表（用于 LangGraph 限定 agent） */
  agentIds: string[];
  /** 老师/队友的引导语等动作（含 engpk 扩展 action） */
  actions: SceneAction[];
  /** 生成状态 */
  status: SceneStatus;
  /** 失败时的错误信息 */
  error?: string;
}

/** 类型化的具体场景（按 SceneType 离散联合，便于 TS 做判别式收窄） */
export type Scene =
  | CoverScene
  | WarmupScene
  | VideoReviewScene
  | GameScene
  | DiscussionScene
  | ArticleScene
  | EndingScene;

/** 各具体场景类型别名 */
export interface CoverScene extends SceneBase {
  type: 'cover';
  payload: CoverScenePayload;
}
export interface WarmupScene extends SceneBase {
  type: 'warmup';
  payload: WarmupScenePayload;
}
export interface VideoReviewScene extends SceneBase {
  type: 'video-review';
  payload: VideoReviewScenePayload;
}
export interface GameScene extends SceneBase {
  type: 'game';
  payload: GameScenePayload;
}
export interface DiscussionScene extends SceneBase {
  type: 'discussion';
  payload: DiscussionScenePayload;
}
export interface ArticleScene extends SceneBase {
  type: 'article';
  payload: ArticleScenePayload;
}
export interface EndingScene extends SceneBase {
  type: 'ending';
  payload: EndingScenePayload;
}

// ==================== Lesson ====================

/** 一节完整课程 */
export interface Lesson {
  id: string;
  /** 课程标题（取自封面） */
  title: string;
  /** 风格 token（封面生成后写入，后续页面共用） */
  styleToken?: StyleToken;
  /** 原始指令文本（用户输入） */
  rawInstructions: string;
  /** 解析后的指令列表 */
  instructions: PageInstruction[];
  /** AI 队友（3 位） */
  teammates: import('./teammate').AITeammate[];
  /** 场景列表（按 order 排序） */
  scenes: Scene[];
  /** 创建时间 */
  createdAt: Date;
  /** 课程整体状态 */
  status: 'generating' | 'ready' | 'partial-failure';
}
