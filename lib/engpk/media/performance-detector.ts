/**
 * engpk · 表演检测前端调度器
 *
 * 职责：
 *   - 每 N 秒从 video 元素截一帧（canvas.toBlob）
 *   - POST 到 /api/engpk/performance-check
 *   - 返回 { isPerforming: boolean }
 *   - 命中 → scoreBus 加分；未命中 → 不扣分（决策 #9 温和策略）
 *
 * 生命周期由 usePerformanceDetector hook 管理。
 */

export interface PerformanceCheckResult {
  isPerforming: boolean;
  confidence?: number;
}

/**
 * 从 video 元素截一帧为 base64 JPEG。
 */
export function captureFrame(video: HTMLVideoElement): string | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 320; // 低分辨率足够判定
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, 320, 240);
    return canvas.toDataURL('image/jpeg', 0.6);
  } catch {
    return null;
  }
}

/**
 * 调用服务端表演检测 API。
 */
export async function checkPerformance(
  frameBase64: string,
  sceneId: string,
  videoTimestampMs: number,
  signal?: AbortSignal,
): Promise<PerformanceCheckResult> {
  const res = await fetch('/api/engpk/performance-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frameBase64, sceneId, videoTimestampMs }),
    signal,
  });
  if (!res.ok) {
    return { isPerforming: false };
  }
  return res.json();
}
