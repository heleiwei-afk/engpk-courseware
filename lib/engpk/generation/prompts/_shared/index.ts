/**
 * engpk · 共享 prompt 片段
 *
 * 7 类场景共用的 prompt 片段，集中在这里维护，避免散落。
 *
 * PR-20 重写：引入教学受众、同课连贯性、Speech 规则等专家级片段。
 * 新增片段在同目录下独立文件中，此处 re-export + 保留旧 API 兼容。
 *
 * 决策 #3：软约束 + 监控指标（metricBus 上报实际值）。
 */

// ─── Re-export 新增片段 ───────────────────────────────────────────
export { TARGET_AUDIENCE } from './target-audience';
export { COURSE_CONTINUITY } from './course-continuity';
export { SPEECH_GUIDELINES, SPEECH_GUIDELINES_LITE } from './speech-guidelines';

/** 引导语量约束（除图文类外都用） */
export const NARRATION_BUDGET_HINT = `【叙述量约束】
- 每条 speech 建议 40-60 字；如确有必要可适当延展到 80 字，但绝不超过 90 字。
- 每个场景的 speech 总条数建议 1-2 条；信息优先通过画面/交互承载。
- 学生是这节课的主角，AI 老师只引导，不要喧宾夺主。
- speech 不要复述画面上已经展示的文字；要补充、展开、引导思考。
- 开头给一个钩子（反问/悬念/邀请），结尾给一个过渡或停顿。`;

/** 图文类专用：保留较多讲解词（决策 #3 例外） */
export const NARRATION_BUDGET_ARTICLE = `【叙述量 · 图文讲解类】
- 此场景为知识讲解类，可包含 3-5 条详细讲解词，每条 40-90 字。
- 讲解词要和 blocks 配合：每条 speech 对应一个或一组 block，逐步展开。
- 不要一口气把所有知识点塞进一条 speech；拆开讲，给孩子消化时间。
- 讲解词不是朗读 block 文字！要补充背景、举例子、提问、做类比。
- 最后一条 speech 可以做本页小结或过渡到下一页。`;

/** 共享 JSON 输出约束 */
export const JSON_OUTPUT_RULES = `【输出格式】
- 严格输出 JSON，不要加 \`\`\`json 代码块包裹，不要任何解释文字。
- 字符串中如出现引号，请用转义符 \\".
- 数值字段必须是数字，不能是字符串。`;

/** 学习目标抽取（讲解词内不要出现"妈妈奖励 X 元"等敏感内容） */
export const SAFETY_RULES = `【安全约束】
- 禁止生成任何违法、暴力、色情、歧视、仇恨、医疗建议等内容。
- 禁止涉及金钱奖励、家长惩罚等内容（鼓励语由系统模板池管理）。
- 禁止出现真实人名、商业 IP、品牌名（迪士尼/漫威/任天堂等）。
- 禁止让孩子做超出年龄的事（上网搜索、找家长要钱、独自外出等）。
- 全部内容请使用简体中文。`;
