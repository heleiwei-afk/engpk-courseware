/**
 * engpk · E2E 冒烟测试
 *
 * 验证核心用户路径：
 *   1. 访问 /new
 *   2. 输入指令
 *   3. 点"生成课件"
 *   4. 跳转到 /classroom-engpk/[id]
 *   5. 看到至少一个场景渲染
 *
 * 注意：需要 `pnpm dev` 在后台运行（或用 webServer 配置）。
 * 不需要真 LLM key（mock pipeline 会兜底）。
 */

import { test, expect } from '@playwright/test';

test.describe('engpk smoke', () => {
  // LLM 调用失败时会走 3 次重试后 mock 兜底；两条场景最坏约 20s+，放宽整体超时。
  test.setTimeout(60_000);

  test('指令编辑器 → 生成 → 课堂', async ({ page }) => {
    // 1. 访问 /new
    await page.goto('/new');
    await expect(page.locator('[data-testid="instruction-textarea"]')).toBeVisible();

    // 2. 输入指令（只用 1 条，减少 LLM 调用次数和重试时间）
    const textarea = page.locator('[data-testid="instruction-textarea"]');
    await textarea.fill('第1页：【封面】+测试课+内容：Hello');

    // 3. 等待预览出现
    await expect(page.locator('[data-testid="preview-list"]')).toContainText('封面');

    // 4. 点生成
    const submitBtn = page.locator('[data-testid="submit-button"]');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 5. 等待跳转到课堂页
    await page.waitForURL(/\/classroom-engpk\//, { timeout: 15000 });

    // 6. 等待至少一个场景出现
    //    LLM 调用 (teammates+cover) 各 3 次重试 ≈ 16s + 课堂页 2s 轮询间隔；
    //    给到 50s 容忍 4sapi.com 503 重试场景。
    await expect(page.locator('[data-testid="scene-main"]')).toBeVisible({
      timeout: 30000,
    });

    // 7. 目录应该有内容（pipeline 完成后下次轮询会拿到）
    await expect(page.locator('[data-testid="lesson-toc"]')).toContainText('封面', {
      timeout: 30000,
    });
  });

  test('首页 CTA 跳转到 /new', async ({ page }) => {
    await page.goto('/');
    // 找到 engpk CTA 按钮
    const cta = page.locator('button', { hasText: 'engpk' });
    await expect(cta).toBeVisible();
    await cta.click();
    await page.waitForURL('/new');
    await expect(page.locator('[data-testid="instruction-textarea"]')).toBeVisible();
  });
});
