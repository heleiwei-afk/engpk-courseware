/**
 * engpk - Format SceneOutline into a prompt-ready string block
 *
 * Injected into each scene generator's user prompt so the LLM
 * knows exactly what key points, concepts, and examples to cover.
 */

import type { SceneOutline } from '../types/course-outline';

export function formatSceneOutlineForPrompt(outline: SceneOutline): string {
  const lines: string[] = [
    '--- Teaching Plan for This Page ---',
    'Title: ' + outline.title,
  ];

  if (outline.objectives.length > 0) {
    lines.push('Learning objectives: ' + outline.objectives.join('; '));
  }

  if (outline.keyPoints.length > 0) {
    lines.push('Key points to cover:');
    outline.keyPoints.forEach((kp, i) => {
      lines.push('  ' + (i + 1) + '. ' + kp);
    });
  }

  if (outline.concepts.length > 0) {
    lines.push('Concepts to explain: ' + outline.concepts.join(', '));
  }

  if (outline.examples.length > 0) {
    lines.push('Suggested examples: ' + outline.examples.join('; '));
  }

  if (outline.transitionIn) {
    lines.push('Connect from previous: ' + outline.transitionIn);
  }

  if (outline.transitionOut) {
    lines.push('Lead into next: ' + outline.transitionOut);
  }

  lines.push('--- End Teaching Plan ---');
  return lines.join('\n');
}
