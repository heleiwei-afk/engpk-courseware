# engpk · PR 拆分清单

每个 PR 都遵循"可独立审查、可独立回滚、能看到视觉或行为变化"原则。

## 状态符号

- 🟥 未开始
- 🟨 进行中
- 🟩 已完成
- ⬜ 已合并到主干

---

## W1 — 基础契约

### PR-01 🟨 设计文档 + PR 清单 + 黄金样本初稿
**范围**：
- `docs/engpk/DESIGN.md`（20 个决策、架构、目录、Action 扩展、PlaybackEngine 扩展、游戏协议、沙箱、鼓励语护栏等）
- `docs/engpk/PR-PLAN.md`（本文）
- `docs/engpk/GOLDEN-SAMPLES.md`（初始骨架）
**不含**：任何运行时代码变更
**验收**：文档通读无歧义，PR 清单与设计一致

### PR-02 🟥 核心类型定义
**范围**：
- `lib/engpk/types/scene-v2.ts` — SceneType 枚举 + payload 类型
- `lib/engpk/types/action-ext.ts` — 3 个新 action（bullet_send / await_user_interaction / score_reward）
- `lib/engpk/types/teammate.ts` — AITeammate、Archetype
- `lib/engpk/instruction/types.ts` — PageInstruction、SceneMode
**不改**：任何运行时文件，仅新增类型
**验收**：`pnpm tsc --noEmit` 通过

### PR-03 🟥 Prisma schema
**范围**：
- `prisma/schema.prisma`
- `prisma/migrations/0001_init/*`
- `.env.example` 增加 `DATABASE_URL`
- `package.json` 增加 prisma / @prisma/client 依赖
**不含**：任何业务代码接入
**验收**：`pnpm prisma migrate dev` 能跑通（需本地 postgres）

---

## W2 — 基础设施

### PR-04 🟥 三总线 + classroom-session store
**范围**：
- `lib/engpk/score/bus.ts`
- `lib/engpk/bullet/bus.ts`
- `lib/engpk/metric/bus.ts`
- `lib/engpk/store/classroom-session.ts`（Zustand）
- 单元测试覆盖总线派发逻辑
**不含**：UI 接入、后端落库
**验收**：单测通过；store 可在任意组件中订阅

### PR-05 🟥 SceneShell 6 区块骨架
**范围**：
- `components/scene-shell/SceneShell.tsx`
- `UserPanel` / `TeammatePanel` / `BulletChat` / `DiscussionInput` / `LessonToc` / `ProgressBar`
- 每个组件提供 Storybook-like demo 路由 `/dev/scene-shell`
**验收**：`/dev/scene-shell` 可视化所有区块；数据来自 store mock

### PR-06 🟥 指令解析器 + LLM 兜底归一化
**范围**：
- `lib/engpk/instruction/parser.ts`（正则）
- `lib/engpk/instruction/normalizer.ts`（LLM）
- 单测覆盖正常 / 全角半角 / 空格缩进 / 失败降级
**不含**：UI 接入
**验收**：10+ 条正常样本 + 5+ 条异常样本都能拿到正确结果

---

## W3 — 首页与生成入口

### PR-07 🟥 首页 CTA 重定向 + /new 骨架
**范围**：
- `app/page.tsx` 修改所有 CTA 的 href
- `app/new/page.tsx` 新建（左文本域 + 右实时预览，不调后端）
- 底部加"生成课件"按钮（暂不触发）
**验收**：访问 `/`、点击 CTA 跳 `/new`；在 `/new` 输入指令能看到解析预览

### PR-08 🟥 SSE 生成接口骨架
**范围**：
- `app/api/generate-lesson-from-instructions/route.ts`（返回 mock 场景序列）
- 前端接入 SSE，"生成课件"按钮触发
- 生成页面 `/classroom/[id]` 空壳（仅展示 mock 数据）
**验收**：点生成 → 页面流式填充假场景；SSE 心跳、中断正常

### PR-09 🟥 Action 扩展 + Playback awaiting_user
**范围**：
- `lib/action/engine.ts` 新增 3 个 handler
- `lib/playback/engine.ts` 新增 `awaiting_user` 模式 + `notifySceneComplete`
- 单测 + 手测 demo 页
**验收**：demo 页能触发 bullet_send / score_reward / await_user_interaction

---

## W4-5 — 简单场景 MVP

### PR-10 🟥 封面类端到端
**范围**：
- `lib/engpk/generation/prompts/cover.ts`
- `lib/engpk/generation/scenes/generate-cover-scene.ts`
- `components/scene-cover/*`
- 接入 `/api/generate-lesson-from-instructions`
**验收**：指令里第一页为封面 → 生成真正的封面标题 + 风格 + 图

### PR-11 🟥 图文类 + teammate-generator
**范围**：
- `lib/engpk/generation/prompts/article.ts`（复用原 slide logic）
- `lib/engpk/generation/scenes/generate-article-scene.ts`
- `lib/engpk/generation/teammate-generator.ts`
- `components/scene-article/*`（复用原 slide-renderer）
**验收**：图文页可播放 + 3 位 AI 队友头像出现在 TeammatePanel

### PR-12 🟥 结尾类 + 鼓励语模板池
**范围**：
- `lib/engpk/encouragement/templates.ts`（30-50 条初始模板）
- `lib/engpk/encouragement/picker.ts`
- `lib/engpk/generation/scenes/generate-ending-scene.ts`
- `components/scene-ending/*`
- 1 个抽奖小游戏 HTML 模板（红包版）
**验收**：结尾页生成鼓励语（含金额占位符替换），金额 ≤ 5；抽奖小游戏可玩

---

## W5-6 — 复杂场景

### PR-13 🟥 讨论类
**范围**：
- `lib/engpk/generation/prompts/discussion.ts`
- `lib/engpk/generation/scenes/generate-discussion-scene.ts`
- `components/scene-discussion/*`
- 复用 `lib/orchestration` 的 director-graph
- `TeammatePanel` 监听 `agent_start` 事件高亮
- 举手按钮接 `handleUserInterrupt`
**验收**：讨论页 AI 队友轮流发言 + 用户举手可插话

### PR-14 🟥 游戏类（可能拆 2）
**范围**：
- `lib/engpk/game/event-protocol.ts`
- `lib/engpk/game/inject-csp.ts`
- `lib/engpk/game/validator.ts`
- `lib/engpk/generation/prompts/game.ts`
- `lib/engpk/generation/scenes/generate-game-scene.ts`
- `components/scene-game/{GameScene,SandboxedGameFrame,GameIframeAdapter}.tsx`
**验收**：单词闯关指令生成可玩游戏 HTML，通关触发 scene_complete，加分进 scoreBus

### PR-15 🟥 暖场类
**范围**：
- `lib/engpk/generation/prompts/warmup.ts`
- `lib/engpk/generation/scenes/generate-warmup-scene.ts`
- `lib/engpk/generation/beatmap-generator.ts`
- `components/scene-warmup/{WarmupScene,RhythmGame}.tsx`
**验收**：节奏游戏可玩（4-6 lane 下落），beatmap 由 LLM 根据视频时长生成

---

## W7 — 摄像头与数据

### PR-16 🟥 视频赏析类
**范围**：
- `lib/engpk/consent/guardian-consent.ts`
- `lib/engpk/media/performance-detector.ts`（前端截图调度）
- `app/api/performance-check/route.ts`（服务端视觉模型判定，不留存）
- `components/scene-video-review/{VideoReviewScene,CameraTile,GuardianConsentDialog}.tsx`
- 拒绝权限降级 UI
**验收**：首次进入弹同意 → 同意后 10s 截一帧判定加分 / 拒绝后顶部横幅 + 无加分

### PR-17 🟥 积分落库 + /admin/metrics
**范围**：
- `app/api/score/submit/route.ts`
- `app/api/score/session-summary/route.ts`
- `app/api/metrics/ingest/route.ts`
- `app/admin/metrics/page.tsx`
- 把 scoreBus / metricBus 的 flush 接入
**验收**：整节课走完后 DB 有 ScoreEvent 记录；admin 面板能看到生成耗时与讲解量分布

---

## W8 — 质量与上线准备

### PR-18 🟥 错误态 UI + 黄金样本回归 + E2E 冒烟
**范围**：
- 每个场景的 loading / empty / error-with-retry UI
- `docs/engpk/GOLDEN-SAMPLES.md` 完整填充
- Vitest snapshot 对所有 prompt 输出做基线
- Playwright 冒烟：指令 → 生成 → 播放 → 结尾积分落库
**验收**：CI 绿；snapshot 改动需 PR review

### PR-19 🟥 AGPL 提醒 + README
**范围**：
- README 顶部大红字许可证提醒
- `docs/engpk/LICENSE-NOTICE.md`
- 明确 engpk 子目录也继承 AGPL 并受商业授权约束
**验收**：首次打开 repo 能看到许可证提醒

---

## 风险与缓冲

- 每个 W 周末留半天用于 bug fix / 未预料问题
- LLM 稳定性调试可能占比超预期，PR-10 / PR-14 可能返工
- 若遇法务审核延期，PR-16 可延后到下一轮迭代（video-review 可暂禁用）
