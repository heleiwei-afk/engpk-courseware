# engpk · Prisma 设置说明

## 模型概览

见 `schema.prisma`。

| 表 | 用途 |
|---|---|
| `User` | 学生用户 |
| `Lesson` | 一节课程（指令快照、风格 token、状态） |
| `Scene` | 课程内单页场景（type + payload + actions JSON） |
| `Teammate` | AI 队友（3 位/课） |
| `ScoreEvent` | 积分流水（决策 #12：保留 clientReportedAt / serverReceivedAt 双时间戳防作弊扩展点） |
| `MetricEvent` | 业务指标埋点（生成耗时、讲解量等） |
| `ConsentRecord` | 监护人同意记录（24h TTL） |

## 本地开发

### 1. 启动 Postgres

```bash
docker run -d --name engpk-pg \
  -e POSTGRES_PASSWORD=dev \
  -e POSTGRES_DB=engpk \
  -p 5432:5432 \
  postgres:16
```

### 2. 配置 .env.local

```env
DATABASE_URL="postgresql://postgres:dev@localhost:5432/engpk?schema=public"
```

### 3. 生成 Prisma client + 首次迁移

```bash
pnpm prisma generate
pnpm prisma migrate dev --name init
```

### 4. 查看/编辑数据

```bash
pnpm prisma studio
```

## 生产环境

- 迁移用 `pnpm prisma migrate deploy`
- 禁止在生产执行 `migrate dev` / `db push`
- 必要时做数据库备份再迁移

## 命名约定

- 表名：PascalCase 单数（Prisma 默认）
- 字段：camelCase
- 时间字段：`createdAt` / `updatedAt` / `{action}At`
- JSON 字段：`instructions` / `payload` / `tags` 等

## 注意事项

- `User`/`Lesson`/`Scene` 有级联删除；测试时不要误删 User 级数据
- `Scene.agentIds` 是 Postgres 字符串数组，只在 Postgres 可用
- `MetricEvent.tags` 与 `payload` 都是 JSON；聚合查询请考虑索引成本
- `ConsentRecord` 的 `expiresAt` 建议加定期清理 cron，避免表膨胀
