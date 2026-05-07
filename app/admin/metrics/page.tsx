'use client';

/**
 * /admin/metrics — engpk 业务指标仪表板（只读）
 *
 * 决策 #19：埋点 + 业务指标仪表板。
 *
 * 展示：
 *   - 生成耗时分布（按 sceneType）
 *   - 讲解量统计（narration.length / narration.count）
 *   - 场景跳出率
 *   - 游戏 validator 失败率
 *   - LLM 调用次数
 *
 * MVP 实现：直接查 MetricEvent 表做简单聚合。
 * 后续可接 Metabase / Grafana。
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface MetricSummary {
  name: string;
  count: number;
  avgValue: number | null;
  maxValue: number | null;
}

export default function MetricsPage() {
  const [data, setData] = useState<MetricSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/engpk/metrics/summary')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json.metrics ?? []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← 首页
          </Link>
          <h1 className="text-2xl font-bold">engpk · 业务指标</h1>
        </div>

        {loading ? (
          <p className="text-muted-foreground">加载中…</p>
        ) : error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : data.length === 0 ? (
          <p className="text-muted-foreground">
            暂无数据。生成一节课后这里会出现指标。
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">指标名</th>
                  <th className="px-4 py-3 text-right font-medium">次数</th>
                  <th className="px-4 py-3 text-right font-medium">平均值</th>
                  <th className="px-4 py-3 text-right font-medium">最大值</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((row) => (
                  <tr key={row.name} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {row.name}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {row.count}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {row.avgValue !== null ? row.avgValue.toFixed(1) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {row.maxValue !== null ? row.maxValue.toFixed(1) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-6 text-xs text-muted-foreground">
          数据来源：MetricEvent 表。刷新页面获取最新数据。
          后续可接 Metabase / Grafana 做更丰富的可视化。
        </p>
      </div>
    </div>
  );
}
