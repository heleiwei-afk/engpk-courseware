/**
 * engpk · AI 队友类型
 *
 * AI 队友是 engpk 的核心游戏化元素。每节课随机生成 3 位队友，
 * persona 从 archetype 池中抽取并结合课程主题微调。
 *
 * 队友不依赖学生 profile（已在决策 #4 中移除），
 * 只根据课程主题随机（已在决策 #4.1 中确认）。
 */

/** 队友的 archetype（性格原型） */
export type TeammateArchetype =
  | 'scholar' // 学霸：稳定高分、偶尔主动讲解
  | 'energetic' // 活跃：强烈跟随用户情绪、高频发弹幕
  | 'creative' // 创意：偶尔反向操作、出其不意
  | 'rookie' // 新手：与用户水平相近、陪伴感强
  | 'veteran'; // 老将：节奏稳定、关键时刻爆发

/** 每个 archetype 的行为参数（teammate-engine 共振逻辑使用） */
export interface ArchetypeBehavior {
  /** 用户 combo ≥ 3 时队友跟随得分的概率（0-1） */
  followComboProbability: number;
  /** 用户 miss 时队友也 miss 的概率（0-1） */
  followMissProbability: number;
  /** 用户持续低分时队友发鼓励弹幕的概率（0-1） */
  encourageProbability: number;
  /** 队友独立发挥时的单次得分期望值 */
  baseScoreMean: number;
  /** 队友得分标准差 */
  baseScoreStdDev: number;
  /** 是否允许偶尔爆发（远超 mean + 2*stdDev） */
  allowBurst: boolean;
}

/** 每个 archetype 的默认行为参数 */
export const ARCHETYPE_BEHAVIORS: Record<TeammateArchetype, ArchetypeBehavior> = {
  scholar: {
    followComboProbability: 0.3,
    followMissProbability: 0.05,
    encourageProbability: 0.8,
    baseScoreMean: 85,
    baseScoreStdDev: 8,
    allowBurst: false,
  },
  energetic: {
    followComboProbability: 0.7,
    followMissProbability: 0.2,
    encourageProbability: 0.9,
    baseScoreMean: 70,
    baseScoreStdDev: 15,
    allowBurst: true,
  },
  creative: {
    followComboProbability: 0.5,
    followMissProbability: 0.1,
    encourageProbability: 0.5,
    baseScoreMean: 75,
    baseScoreStdDev: 20,
    allowBurst: true,
  },
  rookie: {
    followComboProbability: 0.4,
    followMissProbability: 0.3,
    encourageProbability: 0.6,
    baseScoreMean: 55,
    baseScoreStdDev: 12,
    allowBurst: false,
  },
  veteran: {
    followComboProbability: 0.35,
    followMissProbability: 0.05,
    encourageProbability: 0.7,
    baseScoreMean: 80,
    baseScoreStdDev: 10,
    allowBurst: true,
  },
};

/**
 * 队友完整信息（会被持久化到 lesson.teammates）。
 */
export interface AITeammate {
  /** 稳定 id（UUID），用作 agentId */
  id: string;
  /** 昵称（LLM 生成，2-6 字中文） */
  nickname: string;
  /** 头像 URL（优先从预设头像库选，避免生图成本） */
  avatar: string;
  /** 性格原型 */
  archetype: TeammateArchetype;
  /** 自我介绍一句话（LLM 生成，≤ 30 字） */
  bio: string;
  /** TTS 声线标识（复用 OpenMAIC 声线） */
  voice?: string;
  /** 当前积分（运行时由 scoreBus 维护） */
  score: number;
  /** 当前排名（派生，由 store 计算） */
  rank?: number;
  /** 是否正在发言（UI 高亮用，监听 LangGraph agent_start 事件） */
  isSpeaking?: boolean;
}

/** 生成队友时的参数 */
export interface TeammateGenerationParams {
  /** 课程主题（聚合所有页指令的 description） */
  lessonTopic: string;
  /** 课程风格 token（由封面页决定） */
  styleToken?: {
    motif: string;
    primaryColor: string;
  };
  /** 固定生成数量（默认 3） */
  count?: number;
  /** 可选：显式指定 archetype 组合 */
  archetypes?: TeammateArchetype[];
}

/** 用户本人（非 AI，但结构对齐便于 UI 展示） */
export interface User {
  id: string;
  nickname: string;
  avatar: string;
  score: number;
  rank?: number;
}
