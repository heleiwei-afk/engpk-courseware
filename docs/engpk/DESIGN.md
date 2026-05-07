# engpk — 互动式学习课件生成工具 · 设计文档

> 基于 OpenMAIC 核心技术（Action DSL + 双轨执行器 + LangGraph 讨论图 + 多厂商 LLM 抽象 + SSE 流式协议）改造的互动式学习课件生成工具。
>
> 本文档是后续所有 PR 的契约。任何实现偏离本文档的决策需要先更新本文档再编码。

---

## 一、产品目标

把"一段逐页指令"变成一节可以**边播边生成、边玩边学**的互动课堂。

输入示例：

```
第1页：【封面】+奇幻英语冒险+内容：Level 1 启程
第2页：【暖场】+节奏热身+内容：rhythm_warmup.mp4
第3页：【视频赏析】+角色口型模仿+内容:https://.../scene.mp4
第10页：【游戏】+单词闯关+内容：is, you, here, this
第12页：【讨论】+我们应该如何使用 this？+内容：this 的四种用法
第15页：【图文】+语法拆解+内容：this 作主语 / 宾语 / 定语
第16页：【结尾】+闯关庆功+内容：本课共掌握 4 个词
```

输出：一节 16 页的互动课堂，每页按指令生成对应场景，AI 老师讲解、AI 队友陪同、积分贯穿全程。

---

## 二、决策矩阵（Round 1-5 汇总）

| # | 主题 | 决策 | 约束/说明 |
|---|---|---|---|
| 1 | DSL 语法 | 保留原语法 + LLM 兜底归一化 | 正则解析失败时，调便宜模型规范化为标准格式再重试解析 |
| 2 | 场景类型 | 保持 7 个独立实现 | 共享 prompt 片段抽到 `prompts/_shared/` |
| 3 | 讲解量 | 软约束 + 监控指标 | 不硬截断，通过 `metrics` 表统计平均字数 |
| 4 | 学生 profile | 不做 | 所有"结合学生兴趣"话术从 prompt 中删除 |
| 4.1 | AI 队友 | 保留，persona 由课程主题随机生成 | 预设 archetype 池：学霸/活跃/创意 等 |
| 5 | 讨论调度 | 完全 LangGraph LLM 决策 | 头像排列仅视觉提示，不做顺序担保 |
| 6 | 游戏事件通道 | 统一 game-event 协议（iframe → 外壳） | Zod schema 校验 + gameId/origin 双重校验 |
| 7 | 队友加分逻辑 | 与用户表现共振联动 | archetype 决定敏感度；不刻意保送 |
| 8 | Playback 非线性 | 扩展四态机，新增 `awaiting_user` 状态 | 新增 `await_user_interaction` action type |
| 9 | 摄像头合规 | 显式监护人同意 + 24h 确认 | 首次进入 video-review 弹 `GuardianConsentDialog` |
| 10 | iframe 沙箱 | 严格沙箱 + CSP 白名单 + 协议校验 | `sandbox="allow-scripts"` + `srcDoc` + CSP meta 注入 |
| 11 | 鼓励语金额护栏 | 模板池 + 占位符替换 | LLM 不参与金额生成；金额白名单 `[0,1,2,3,5]` |
| 12 | 积分防作弊 | MVP 不做 | 保留扩展点；ScoreEvent 记录双时间戳便于事后审计 |
| 13 | 生成等待 | 边播边生成（流式优先） | 第 1 页 ready 立即跳转课堂；后续页占位 + SSE 推送 |
| 14 | 旧数据 | 完全不兼容 | 新项目不支持 OpenMAIC 旧 classroom 播放 |
| 15 | 数据库 | 只用 Postgres + Prisma | 并发扩展留给后期 |
| 16 | 时间线 | 宽松 6-8 周 | P0→P5 渐进推进 |
| 17 | 测试策略 | 黄金样本 + E2E | Vitest snapshot + Playwright |
| 18 | i18n | 只保留中文 | TTS 选中文声线；UI 去多语言切换器 |
| 19 | 可观测性 | 埋点 + 业务指标仪表板 | `metric_events` 表；自建只读面板 `/admin/metrics` |
| 20 | AGPL-3.0 授权 | 后续再考虑 | README 顶部加显眼的许可证提醒作为阻塞项 |

---

## 三、整体架构

```
┌────────────────────────────────── 用户层 ───────────────────────────────────┐
│  /            首页（保留 MAIC 视觉，CTA 指向 /new）                         │
│  /new         指令编辑器（纯文本 + 实时预览）                               │
│  /classroom/[id]   课堂播放页（SceneShell + 7 类场景渲染器）                │
│  /admin/metrics    业务指标仪表板（只读）                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                  │ SSE                   │ SSE / REST
                  ▼                       ▼
┌─────────────────────────────── 生成管线 ────────────────────────────────────┐
│  /api/generate-lesson-from-instructions                                    │
│    ├─ instruction-parser（正则） → 失败 → LLM 兜底归一化 → 再解析         │
│    ├─ teammate-generator（根据主题生成 3 位 AI 队友）                     │
│    ├─ style-token 生成（由封面页 LLM 回传）                                │
│    └─ 并行 7 类场景生成器（边生成边 SSE 推送）                             │
│         ├─ generate-cover-scene                                            │
│         ├─ generate-warmup-scene（含 beatmap-generator）                  │
│         ├─ generate-video-review-scene                                    │
│         ├─ generate-game-scene（含 game-validator）                       │
│         ├─ generate-discussion-scene                                      │
│         ├─ generate-article-scene（复用原 slide-renderer）                │
│         └─ generate-ending-scene（含 encouragement-picker 模板池）         │
└─────────────────────────────────────────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────── 复用 OpenMAIC 内核 ─────────────────────────────┐
│  lib/ai/*            多厂商 LLM 抽象（15+ 厂商）                            │
│  lib/action/*        Action DSL + ActionEngine（28+ 动作）                  │
│  lib/playback/*      PlaybackEngine 四态机（扩展 awaiting_user）            │
│  lib/orchestration/* LangGraph 讨论导演图（讨论场景直接用）                 │
│  lib/audio/*         TTS / ASR                                              │
│  lib/media/*         图像生成（封面图）                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────── engpk 新增层 ─────────────────────────────────┐
│  lib/engpk/instruction/*   指令解析器、归一化、类型                         │
│  lib/engpk/score/*         scoreBus、teammate-engine（共振）                │
│  lib/engpk/bullet/*        bulletBus                                        │
│  lib/engpk/metric/*        metricBus、埋点                                  │
│  lib/engpk/game/*          game-event 协议、iframe 适配器、CSP 注入         │
│  lib/engpk/consent/*       监护人同意 24h TTL                               │
│  lib/engpk/encouragement/* 鼓励语模板池 + 占位符替换                        │
│  lib/engpk/store/*         Zustand classroom-session store                  │
│  lib/engpk/types/*         PageInstruction、SceneV2、Action 扩展            │
│  components/scene-shell/*  6 区块骨架（User/Teammate/Bullet/Input/Toc/...）│
│  components/scene-{七类}/* 各场景渲染器                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                  │
                  ▼
┌───────────────────────────────── 存储层 ───────────────────────────────────┐
│  PostgreSQL + Prisma                                                        │
│    User / Lesson / Scene / ScoreEvent / MetricEvent / ConsentRecord         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 四、Action DSL 扩展

在原 OpenMAIC Action 集合基础上新增 **3 种 action**：

| action type | payload | 说明 |
|---|---|---|
| `bullet_send` | `{ text, emoji?, from: 'ai-teacher'/'ai-teammate'/'user'/'system', style? }` | 弹幕发送，被 ActionEngine 派发给 bulletBus |
| `await_user_interaction` | `{ waitFor: 'scene_complete', timeoutMs?, fallback: 'skip'/'repeat' }` | 阻塞播放直到收到 `scene_complete` 事件或超时 |
| `score_reward` | `{ delta, reason, target: 'user'/agentId }` | 对指定目标加分，通过 scoreBus 派发 |

新增的 handler 都挂在 `lib/action/engine.ts` 的 switch 中，保持与其它 action 一致的 await 语义。

## 五、PlaybackEngine 扩展

```
原四态：   idle ─start→ playing ─pause→ paused
                           ↓ discussion / userInterrupt
                           live ─end→ idle

新增：    playing ─await_user_interaction action→ awaiting_user
                                                      ├─ notifySceneComplete(sceneId) → playing
                                                      └─ timeout → playing（按 fallback）
```

新增方法：

- `notifySceneComplete(sceneId: string)` — 由 iframe postMessage / 用户点击"继续"按钮触发
- 在 `processNext` 中处理 `await_user_interaction` action，switch 到 `awaiting_user` 模式等待

## 六、game-event 协议

所有来自游戏 iframe 的 postMessage 必须符合：

```ts
{
  source: 'openmaic-game',
  gameId: string,           // 场景 id 绑定，防串消息
  event: 'score' | 'combo' | 'milestone' | 'complete' | 'fail' | 'request-hint',
  payload: unknown,         // event-specific，经 Zod 校验
  timestamp: number
}
```

外壳侧 `GameIframeAdapter` 双重校验：

1. `event.source === iframeRef.current.contentWindow`
2. `event.origin === 'null'`（sandbox 无 same-origin 时 origin 为 'null'）
3. `data.source === 'openmaic-game'`
4. `data.gameId === currentSceneId`
5. Zod schema 通过

路由规则：

- `score` → `scoreBus.dispatch({source, delta, reason})`
- `combo` → `bulletBus.push(highlight)`
- `milestone` → `bulletBus.push(milestone)`
- `complete` → `playbackEngine.notifySceneComplete(sceneId)`
- `fail` → 保留场景，触发重试 UI
- `request-hint` → 预留 `/api/game-hint` 端点

## 七、game-validator 规则

LLM 生成游戏 HTML 后必须通过以下静态扫描：

- **禁用 API**：`/\bfetch\b|XMLHttpRequest|new\s+WebSocket|importScripts|document\.write/` 命中任一即回炉
- **必需 API**：必须出现 `parent.postMessage({source:'openmaic-game',...}` 的调用
- **学习目标覆盖**：game prompt 声明的每个 `learningGoal` 词必须在 HTML 中至少出现一次
- **大小**：HTML 单文件 ≤ 200KB（避免 LLM 复制外部素材）
- **完整性**：能被浏览器 parse 成功（`new DOMParser().parseFromString` 无错）

校验失败最多重试 2 次，仍失败则降级为"空游戏壳 + 老师直接讲解学习词"。

## 八、iframe 沙箱 & CSP

```tsx
<iframe
  sandbox="allow-scripts"           // 不开 same-origin，不开 allow-top-navigation
  srcDoc={injectedHtml}             // 严禁走 src=URL
  referrerPolicy="no-referrer"
/>
```

`lib/engpk/game/inject-csp.ts` 在 LLM 输出的 HTML `<head>` 注入：

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none';
               script-src 'unsafe-inline';
               style-src 'unsafe-inline';
               img-src data: blob:;
               font-src data:;
               media-src data: blob:;
               connect-src 'none';
               frame-src 'none';">
```

## 九、摄像头监护人同意流程

- 首次进入 video-review 场景前，`GuardianConsentDialog` 强制弹出
- 文案：用途 / 频率（10s/次）/ 数据流向（立即丢弃）/ 监护人勾选
- 同意后写入 `ConsentRecord` 表（或 localStorage 作为 MVP 简版），24h 有效
- 拒绝则场景降级：视频仍可看，不加摄像头检测，顶部横幅提示
- `lib/engpk/consent/guardian-consent.ts` 提供 `hasConsent / setConsent / revokeConsent`，未来扩展麦克风等其它敏感能力共用

## 十、鼓励语模板池

`lib/engpk/encouragement/templates.ts`：

```ts
interface Template {
  id: string
  category: 'physical' | 'household' | 'fun' | 'monetary'
  text: string                  // 含 {amount} 等占位符
  moodTag: 'high' | 'mid' | 'low'
  vars?: { amount?: number[] }  // 允许金额白名单
}
```

**生成逻辑**：

1. 根据本课成绩计算 mood（high ≥ 80%, mid ≥ 50%, low < 50%）
2. 从对应 moodTag 的模板中随机挑 2-3 条不重复
3. `{amount}` 占位符从 `vars.amount` 中随机抽数（白名单 `[1,2,3,5]`）
4. **不调用 LLM**，纯模板替换

金额硬上限 5 元通过数据校验保证；任何 vars.amount 定义 > 5 都会被单元测试拦截。

## 十一、AI 队友共振联动

`lib/engpk/score/teammate-engine.ts`：

订阅 `scoreBus` 上的用户事件，按 archetype 规则反应：

| archetype | 用户 combo ≥ 3 | 用户 miss | 用户持续低分 |
|---|---|---|---|
| 学霸 | 跟随得分（30%）| 正常发挥 | 发鼓励弹幕 |
| 活跃 | 跟随得分（70%）| 跟随 miss（20%）| 发鼓励弹幕（高频）|
| 创意 | 跟随得分（50%）+ 偶尔爆发 | 正常 | 偶尔爆发 |

**下限保护**：连续 3 次集体 miss 不允许，至少 1 位队友正常发挥，避免"全队摆烂"的负反馈。

最终排名不刻意保送用户；用户表现好则赢，表现差则输，但过程中有情绪共振。

## 十二、LLM 讲解量软约束

Prompt 中统一建议：

```
【叙述量约束】
- 建议每条 speech ≤ 60 字；如确有必要可适当延展。
- 建议每个场景的 narration action ≤ 2 条；信息可通过画面/交互承载。
- 图文场景（article）可例外，保留原 MAIC 详细讲解逻辑。
```

`metric_events` 表记录：

- `sceneType` / `sceneId` / `lessonId`
- `narrationCount` / `avgChars` / `maxChars` / `totalChars`
- `generationDurationMs`

`/admin/metrics` 面板按场景类型分组展示均值/p95，供后期 prompt 调优使用。

## 十三、边播边生成

`/api/generate-lesson-from-instructions` SSE 事件序列：

```
event: parsed          data: { instructions: [...] }
event: teammates-ready data: { teammates: [...] }
event: style-ready     data: { styleToken }
event: scene-ready     data: { index, scene }   // 多次，每完成一页推一次
event: scene-error     data: { index, error, retryable }  // 失败可重试
event: done            data: { lessonId }
```

前端接入策略：

- 收到第一个 `scene-ready` 立即跳转 `/classroom/[lessonId]`
- 未就绪的页在目录中显示"生成中 ⏳"占位
- 单页失败用户可手动点击"重试"触发 `/api/scene-retry`
- SSE 断开后前端轮询 `/api/lessons/[id]/status` 恢复

## 十四、指令解析策略

```
层 1：正则解析（快路径）
       失败↓
层 2：LLM 归一化（便宜模型，如 gemini-flash-preview / qwen-turbo）
       system prompt: "把用户输入规范化为标准格式 第N页：【模式】+描述+内容：XXX"
       ↓ 再走层 1
       失败↓
层 3：报错 + 前端高亮行
```

**正则示例**（容错多种分隔符）：

```regex
^第\s*(?<index>\d+)\s*页\s*[：:]\s*【\s*(?<mode>[^】]+)\s*】\s*[+＋]\s*(?<desc>.+?)\s*[+＋]\s*内容\s*[：:]\s*(?<content>.+)$
```

## 十五、目录结构（新增）

```
OpenMAIC/
├── app/
│   ├── new/                              # 新增：指令编辑器页面
│   │   └── page.tsx
│   ├── api/
│   │   ├── generate-lesson-from-instructions/route.ts   # 新增
│   │   ├── lessons/[id]/route.ts                         # 新增
│   │   ├── score/
│   │   │   ├── submit/route.ts                           # 新增
│   │   │   └── session-summary/route.ts                  # 新增
│   │   ├── performance-check/route.ts                    # 新增
│   │   └── metrics/ingest/route.ts                       # 新增
│   └── admin/
│       └── metrics/page.tsx                               # 新增
│
├── lib/
│   ├── engpk/                            # 新增：整个 engpk 业务层
│   │   ├── instruction/
│   │   │   ├── parser.ts
│   │   │   ├── normalizer.ts
│   │   │   └── types.ts
│   │   ├── types/
│   │   │   ├── scene-v2.ts
│   │   │   ├── action-ext.ts
│   │   │   └── teammate.ts
│   │   ├── score/
│   │   │   ├── bus.ts
│   │   │   ├── teammate-engine.ts
│   │   │   └── storage.ts
│   │   ├── bullet/
│   │   │   └── bus.ts
│   │   ├── metric/
│   │   │   └── bus.ts
│   │   ├── game/
│   │   │   ├── event-protocol.ts
│   │   │   ├── inject-csp.ts
│   │   │   └── validator.ts
│   │   ├── consent/
│   │   │   └── guardian-consent.ts
│   │   ├── encouragement/
│   │   │   ├── templates.ts
│   │   │   └── picker.ts
│   │   ├── store/
│   │   │   └── classroom-session.ts
│   │   └── generation/
│   │       ├── pipeline.ts
│   │       ├── teammate-generator.ts
│   │       ├── prompts/
│   │       │   ├── _shared/
│   │       │   ├── cover.ts
│   │       │   ├── warmup.ts
│   │       │   ├── video-review.ts
│   │       │   ├── game.ts
│   │       │   ├── discussion.ts
│   │       │   ├── article.ts
│   │       │   └── ending.ts
│   │       └── scenes/
│   │           ├── generate-cover-scene.ts
│   │           ├── generate-warmup-scene.ts
│   │           ├── generate-video-review-scene.ts
│   │           ├── generate-game-scene.ts
│   │           ├── generate-discussion-scene.ts
│   │           ├── generate-article-scene.ts
│   │           └── generate-ending-scene.ts
│   ├── action/engine.ts                  # 改造：新增 3 个 action handler
│   └── playback/engine.ts                # 改造：新增 awaiting_user 状态
│
├── components/
│   ├── scene-shell/                      # 新增：6 区块骨架
│   │   ├── SceneShell.tsx
│   │   ├── UserPanel.tsx
│   │   ├── TeammatePanel.tsx
│   │   ├── BulletChat.tsx
│   │   ├── DiscussionInput.tsx
│   │   ├── LessonToc.tsx
│   │   └── ProgressBar.tsx
│   ├── scene-cover/
│   ├── scene-warmup/
│   │   ├── WarmupScene.tsx
│   │   └── RhythmGame.tsx
│   ├── scene-video-review/
│   │   ├── VideoReviewScene.tsx
│   │   ├── CameraTile.tsx
│   │   └── GuardianConsentDialog.tsx
│   ├── scene-game/
│   │   ├── GameScene.tsx
│   │   └── SandboxedGameFrame.tsx
│   ├── scene-discussion/
│   ├── scene-article/
│   └── scene-ending/
│
├── prisma/                               # 新增
│   ├── schema.prisma
│   └── migrations/
│
└── docs/engpk/
    ├── DESIGN.md                         # 本文
    ├── PR-PLAN.md                        # PR 拆分清单
    └── GOLDEN-SAMPLES.md                 # 黄金样本集
```

## 十六、PR 拆分（6-8 周）

| PR | 内容 | 大小 | 周次 |
|---|---|---|---|
| PR-01 | 本设计文档 + PR 清单 + 黄金样本初稿 | 小 | W1 |
| PR-02 | Action 扩展类型定义 + scene-v2 类型 + instruction 类型 | 小 | W1 |
| PR-03 | Prisma schema + 初始 migration + 数据模型文档 | 小 | W1 |
| PR-04 | 三总线骨架（scoreBus/bulletBus/metricBus）+ classroom-session store | 中 | W2 |
| PR-05 | SceneShell 6 区块骨架（占位 UI + props 定义）| 中 | W2 |
| PR-06 | 指令解析器（正则）+ LLM 归一化兜底 + 单测 | 中 | W2 |
| PR-07 | 首页 CTA 重定向 + `/new` 页面骨架（编辑器 + 实时预览，不触发生成）| 中 | W3 |
| PR-08 | `/api/generate-lesson-from-instructions` SSE 骨架（返回 mock 场景）| 小 | W3 |
| PR-09 | Action 扩展 handler（bullet_send / await_user_interaction / score_reward）+ Playback awaiting_user | 中 | W3 |
| PR-10 | 封面类 prompt + generator + 渲染端到端 | 中 | W4 |
| PR-11 | 图文类（复用原 slide-renderer）+ teammate-generator | 中 | W4 |
| PR-12 | 结尾类 + 鼓励语模板池 + 1 个抽奖小游戏模板 | 中 | W4-5 |
| PR-13 | 讨论类（沿用 LangGraph 讨论图 + TeammatePanel 高亮）| 中 | W5 |
| PR-14 | 游戏类：event-protocol + GameIframeAdapter + inject-csp + validator | 大（可能拆 2）| W5-6 |
| PR-15 | 暖场类：RhythmGame 引擎 + beatmap-generator | 大 | W6 |
| PR-16 | 视频赏析类：监护人同意 + 表演检测 API + 降级 UI | 中 | W7 |
| PR-17 | 积分落库 + `/admin/metrics` 仪表板 | 中 | W7 |
| PR-18 | 错误态 UI + 黄金样本回归 + E2E 冒烟 | 中 | W8 |
| PR-19 | AGPL-3.0 许可证提醒 + README 更新 | 小 | W8 |

## 十七、阻塞项（上线前必须解决）

1. **AGPL-3.0 商业授权** — 若要商业部署需联系 thu_maic@tsinghua.edu.cn。README 顶部会加显眼红字提醒。
2. **未成年人摄像头合规** — 摄像头表演检测涉及儿童图像采集。需要在正式上线前：
   - 完成隐私政策与未成年人保护声明
   - 监护人同意流程通过法务审核
   - 确认所用视觉 LLM 厂商的 API 政策（不留日志）
3. **鼓励语模板人工评审** — 全部模板需人工逐条过审；发布前冻结模板池。

## 十八、开放问题（后期再决策）

- **P4 之后**：真多人实时（WebSocket 房间）是否推进？
- **结尾小游戏模板库**：打鸭子 / 射气球 / 抽盲盒 目前只做 1 个做示例；后续按需扩充
- **课件导出**：OpenMAIC 原 pptx 导出在新场景类型下是否可用（可能只有 article 类支持）
- **防作弊上线时机**：生产环境流量到一定规模前补上服务端复算

---

## 附录 A · 黄金样本举例

`docs/engpk/GOLDEN-SAMPLES.md` 存放每类场景至少 10 条样本输入 + 期望输出片段，用于回归测试。具体内容随场景实现并行补齐。

## 附录 B · 变更记录

| 日期 | 变更 | 触发人 |
|---|---|---|
| 2026-05-06 | 初稿 | PR-01 |
| 2026-05-07 | Phase A+B+C 质量升级：prompt 增强 + 模型统一 claude-opus-4-7 + 跨页上下文注入 + 队友 persona 格式化 | Phase 3 |
