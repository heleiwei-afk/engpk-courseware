# engpk · 黄金样本集（初稿）

用于回归测试。每类场景 ≥ 10 条样本输入 + 期望输出片段。

> 当前为初稿，随着各 PR 实现并行补齐。CI 中 Vitest 用 snapshot 比对；prompt 改动会触发回归。

---

## 指令解析（PR-06）

### 正常样本

| # | 输入 | 期望 |
|---|---|---|
| 1 | `第1页：【封面】+奇幻英语冒险+内容：Level 1 启程` | `{ index:1, mode:'cover', description:'奇幻英语冒险', content:'Level 1 启程' }` |
| 2 | `第10页：【游戏】+单词闯关+内容：is, you, here, this` | `{ index:10, mode:'game', description:'单词闯关', content:'is, you, here, this' }` |
| 3 | `第3页：【视频赏析】+角色口型模仿+内容：https://example.com/a.mp4` | content 保留完整 URL |
| 4 | `第 5 页 ： 【 讨论 】 + 主题 + 内容 ： XXX` | 容忍空格 |
| 5 | `第2页：【暖场】+节奏热身+内容：rhythm.mp4` | 正常 |
| 6 | `第15页：【图文】+语法拆解+内容：this 作主语 / 宾语 / 定语` | content 保留斜杠 |
| 7 | `第16页：【结尾】+闯关庆功+内容：本课共掌握 4 个词` | 正常 |
| 8 | `第7页：【讨论】+ 1+1 等于几 +内容：基础数学` | description 内含 + 号 |
| 9 | `第4页：【图文】+ Hello world! + 内容：first program` | 多空格容错 |
| 10 | `第8页：【游戏】+combo 训练+内容：a, b, c` | 半角逗号 |

### 需归一化样本（正则失败 → LLM 兜底）

| # | 输入 | 期望（归一化后） |
|---|---|---|
| 11 | `第10页 游戏 单词闯关 内容 is you here this` | 标准格式 |
| 12 | `Page 10: [Game] Word Adventure Content: is, you, here, this` | 标准格式 + 中文 |
| 13 | `第10页【游戏】单词闯关：is、you、here、this` | 标准格式 |
| 14 | `第10页 - 游戏 - 单词闯关 - is, you, here, this` | 标准格式 |
| 15 | `游戏 第10页 单词闯关 内容是 is, you, here, this` | 标准格式 |

### 应报错样本

| # | 输入 | 期望 |
|---|---|---|
| 16 | `第0页：【封面】+x+内容：y` | 错：页码必须 ≥ 1 |
| 17 | `第1页：【未知模式】+x+内容：y` | 错：未识别的模式 |
| 18 | `（空字符串）` | 错：空指令 |

---

## 封面类（PR-10）

### 输入：`第1页：【封面】+奇幻英语冒险+内容：Level 1 启程`

期望生成 payload：

```ts
{
  title: string,           // 长度 ≤ 16，从 description+content 提炼，不能完全照抄
  subtitle?: string,       // 可选
  styleToken: {            // 必返回，作为后续页风格基线
    primaryColor: string,  // hex
    accentColor: string,
    fontFamily: 'rounded'|'serif'|'mono',
    motif: string          // 'fantasy'|'tech'|'nature'...
  },
  coverImagePrompt: string // 用于图像生成器的 prompt
}
```

### Snapshot 校验项

- title 长度 ≤ 16 且非空
- styleToken 必填字段都在合法枚举内
- coverImagePrompt 不含人名 / 商业 IP（避免侵权）
- actions ≤ 1 条 speech，speech 长度 ≤ 60 字

---

## 暖场类（PR-15）

### 输入：`第2页：【暖场】+节奏热身+内容：rhythm.mp4`

期望生成 payload：

```ts
{
  warmupVideoUrl: string,
  rhythmGame: {
    durationMs: number,        // 与视频时长匹配，误差 ≤ 5%
    laneCount: 4 | 5 | 6,
    difficulty: 'easy'|'normal'|'hard',
    beatmap: Array<{
      timeMs: number,           // 单调递增
      lane: number,             // 0..laneCount-1
      type: 'tap' | 'hold',
      holdMs?: number
    }>
  }
}
```

### Snapshot 校验项

- beatmap 数量 ≥ 视频秒数 × 1（每秒至少 1 拍）
- beatmap timeMs 严格单调递增
- beatmap lane 在合法范围
- speech 总数 ≤ 2 条；总字符 ≤ 80

---

## 视频赏析类（PR-16）

### 输入：`第3页：【视频赏析】+角色口型模仿+内容：https://example.com/a.mp4`

期望生成 payload：

```ts
{
  videoUrl: string,
  performanceCheckIntervalSec: 10,
  cameraRequired: true,
  performancePrompt: string  // 给视觉模型的判定 prompt
}
```

### Snapshot 校验项

- speech 总数 ≤ 2 条；总字符 ≤ 80
- performancePrompt 必含"是否在表演"或等价问句

---

## 游戏类（PR-14）

### 输入：`第10页：【游戏】+单词闯关+内容：is, you, here, this`

期望生成 payload：

```ts
{
  learningGoals: ['is', 'you', 'here', 'this'],
  gameDesign: {
    title: string,
    mechanics: string,
    winCondition: string
  },
  gameHtml: string  // 完整可运行 HTML，含 CSP，含 postMessage 调用
}
```

### Validator 必通过项（硬性）

- HTML 中至少出现 4 个学习词各 1 次
- 含 `parent.postMessage({source:'openmaic-game'` 调用
- 不含禁用 API（fetch / XMLHttpRequest / WebSocket / importScripts / document.write）
- HTML 文件大小 ≤ 200KB
- DOMParser 能解析无错

### Snapshot 校验项

- speech 总数 ≤ 2 条；总字符 ≤ 80

---

## 讨论类（PR-13）

### 输入：`第12页：【讨论】+我们应该如何使用 this？+内容：this 的四种用法`

期望生成 payload：

```ts
{
  topic: string,
  task: string,            // 学生需完成的任务
  rule: string,            // 讨论规则
  expectedRounds: number   // 建议 3-5 轮
}
```

### Snapshot 校验项

- topic / task / rule 都非空
- 不预生成具体 agent 发言（这一步由实时 LangGraph 完成）
- speech 总数 ≤ 2 条；总字符 ≤ 80（仅老师开场白）

---

## 图文类（PR-11）

### 输入：`第15页：【图文】+语法拆解+内容：this 作主语 / 宾语 / 定语`

期望生成 payload（沿用 OpenMAIC slide 结构）：

```ts
{
  blocks: ArticleBlock[],   // 类似原 slide 的 elements
  narration: SpeechAction[] // 此场景不限制讲解量
}
```

### Snapshot 校验项

- blocks 至少 1 个非空
- narration 不限字数（此场景例外）
- 引用的图片 ID 必须解析为合法 URL

---

## 结尾类（PR-12）

### 输入：`第16页：【结尾】+闯关庆功+内容：本课共掌握 4 个词`

期望生成 payload：

```ts
{
  endingGameTemplate: 'redpacket' | 'blindbox' | 'duck' | 'balloon',
  endingGameHtml: string,           // 同游戏类校验
  encouragements: Array<{
    templateId: string,
    text: string                    // 已替换 {amount} 占位符
  }>
}
```

### Encouragement 必通过项（硬性）

- 每条 encouragement 中 `/\d+\s*元/` 匹配的金额 ≤ 5
- templateId 必须在白名单内
- 不含金额时也合法（部分模板就是非金钱类）

---

## 通用 Snapshot 维护规则

- snapshot 用 JSON 序列化输出，便于 git diff
- 时间戳 / 随机 ID 用占位符 `<TIMESTAMP>` / `<UUID>`
- LLM 输出的非确定性字段（具体文案）只校验长度 / 格式，不校验文案文本
- prompt 改动若导致 snapshot 变化，必须在 PR 描述中说明原因

## 黄金样本数据集索引

实际数据放在 `tests/golden/` 目录：

```
tests/golden/
├── instruction/
│   ├── normal.json
│   ├── needs-normalization.json
│   └── invalid.json
├── cover/
├── warmup/
├── video-review/
├── game/
├── discussion/
├── article/
└── ending/
```

每个 JSON 文件都是 `{ name, input, expected }[]` 结构。
