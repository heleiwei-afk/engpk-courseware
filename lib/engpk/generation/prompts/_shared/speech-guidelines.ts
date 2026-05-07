/**
 * engpk · 共享 prompt 片段：Speech 内容规则
 *
 * 什么放在 speech（AI 老师口播）里，什么放在视觉（block / 白板 / iframe）里。
 * 这是 engpk 之前质量最差的一环：LLM 把"要展示的文字"和"老师要说的话"混在一起。
 *
 * 借鉴 OpenMAIC slide-content/system.md 中的 "Slide Content Philosophy"。
 */

export const SPEECH_GUIDELINES = `【Speech 内容规则 · 核心原则】

什么应该放在 speech（语音旁白）里：
- 所有完整句子的讲解、说明、展开
- 所有过渡语（"接下来""说到这里""那有的小朋友可能会想⋯"）
- 鼓励、互动、反问（"你有没有遇到过⋯""我们一起来猜猜看"）
- 对 block / 白板内容的放大与补充（而不是重复 block 里的短语）

什么不应该放在 speech 里：
- ❌ 照搬 block 文字（"这一页写的是⋯⋯"——别这样，孩子自己能看）
- ❌ 直接说"来看下面这段话"然后读出来
- ❌ 元信息（"本页的 heading 是⋯""这个 highlight 块很重要"）
- ❌ 页面功能性描述（"点击下一页继续""按钮在下方"）

Speech 与视觉分工原则：
| 信息类型 | 放哪里 |
|---|---|
| 一个词 / 一句口号 | block 的 highlight 或 heading |
| 关键名词列表 | block 的 bullet-list |
| 长解释、讲故事、引导思考 | speech |
| 数据 / 图表 | block 的 chart / image + speech 里指向重点 |
| 算法 / 步骤推导 | block 的 latex / code-block，speech 逐步讲解 |

每条 speech 自身的结构建议：
- 开头给一个钩子（"你猜怎么着""注意看这里")
- 中段展开解释或提问
- 结尾可以给一个小停顿或过渡（"我们继续""接下来更有意思")
- 单条 speech 控制在 40-90 字之间；过长就拆两条

避免老师抢戏：
- 孩子是主角。speech 要留空间让孩子思考、回答、做动作。
- 不要每一个视觉元素都配一句 speech；有的 block 本身就一目了然。
- 重复强调等于没强调——一个要点讲一次就够。`;

/**
 * 轻量版（给场景 prompt 行数有限时用）。
 */
export const SPEECH_GUIDELINES_LITE = `【Speech 规则要点】
- speech 放展开 / 过渡 / 互动；block 里的文字不要照搬到 speech。
- 每条 speech 40-90 字，开头给钩子，结尾给过渡。
- 孩子是主角，老师留空间让孩子思考，不要抢戏。`;
