/**
 * engpk - Image resolver
 *
 * After a scene is generated, scans its payload for image blocks
 * that have a prompt but no url, and calls /api/generate/image
 * to produce actual images.
 *
 * Uses the configured IMAGE_SEEDREAM provider (already in .env.local).
 */

import type { Scene, ArticleBlock } from '../types/scene-v2';
import { metricBus, makeMetricEvent } from '../metric/bus';
import { createLogger } from '@/lib/logger';

const log = createLogger('engpk:image-resolver');

/**
 * Resolve all image blocks in a scene by calling the image generation API.
 * Mutates the scene payload in place (fills block.url).
 * Returns the number of images resolved.
 */
export async function resolveSceneImages(
  scene: Scene,
  lessonId: string,
): Promise<number> {
  // Only article scenes have image blocks currently
  if (scene.type !== 'article') return 0;

  const blocks = scene.payload.blocks as ArticleBlock[];
  const imageBlocks = blocks.filter(
    (b): b is Extract<ArticleBlock, { type: 'image' }> =>
      b.type === 'image' && !!b.prompt && !b.url,
  );

  if (imageBlocks.length === 0) return 0;

  let resolved = 0;
  for (const block of imageBlocks) {
    try {
      const url = await generateImageFromPrompt(block.prompt);
      if (url) {
        block.url = url;
        resolved++;
      }
    } catch (err) {
      log.warn('image generation failed for prompt: ' + block.prompt.slice(0, 40), err);
      metricBus.dispatch(
        makeMetricEvent({
          name: 'generation.failure',
          value: 1,
          tags: { stage: 'image', sceneType: scene.type },
          payload: { prompt: block.prompt.slice(0, 80) },
          lessonId,
        }),
      );
    }
  }

  return resolved;
}

async function generateImageFromPrompt(prompt: string): Promise<string | null> {
  // Call the MAIC image generation API (server-side, same process)
  const baseUrl = getInternalApiBase();
  const res = await fetch(baseUrl + '/api/generate/image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-image-provider': 'seedream',
    },
    body: JSON.stringify({
      prompt,
      aspectRatio: '16:9',
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message || 'HTTP ' + res.status);
  }

  const data = await res.json();
  const result = data?.data?.result;

  if (result?.url) return result.url;
  if (result?.base64) {
    // Convert base64 to data URL
    return 'data:image/png;base64,' + result.base64;
  }
  return null;
}

/**
 * Get the internal API base URL for server-to-server calls.
 * In Next.js server context, we can call our own API routes.
 */
function getInternalApiBase(): string {
  // In server context, use localhost with the current port
  const port = process.env.PORT || '3000';
  return 'http://localhost:' + port;
}
