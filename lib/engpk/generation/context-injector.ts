/**
 * engpk - Cross-page context injector
 *
 * Builds context about the full lesson structure so each scene generator
 * knows where it sits in the lesson flow.
 */

import type { PageInstruction } from '../instruction/types';
import type { AITeammate } from '../types/teammate';
import { SCENE_MODE_LABELS } from '../instruction/types';

export interface CourseContext {
  currentIndex: number;
  totalPages: number;
  lessonTitle: string;
  pagesSummary: string;
  teammatesSummary: string;
  positionHint: string;
}

export function buildCourseContext(
  instructions: PageInstruction[],
  currentIndex: number,
  lessonTitle: string,
  teammates?: AITeammate[],
): CourseContext {
  const totalPages = instructions.length;
  const current = instructions[currentIndex];
  const prev = currentIndex > 0 ? instructions[currentIndex - 1] : null;
  const next = currentIndex < totalPages - 1 ? instructions[currentIndex + 1] : null;

  const pagesSummary = instructions
    .map((inst, i) => {
      const label = SCENE_MODE_LABELS[inst.mode] || inst.mode;
      const marker = i === currentIndex ? '[*]' : '';
      return 'P' + (i + 1) + ':' + label + marker;
    })
    .join(' ');

  const teammatesSummary = teammates && teammates.length > 0
    ? teammates.map((t) => t.nickname + '(' + t.archetype + ') - ' + t.bio).join('; ')
    : '';

  const parts: string[] = [];
  parts.push('You are generating page ' + (currentIndex + 1) + ' of ' + totalPages + '.');

  if (currentIndex === 0) {
    parts.push('This is the FIRST page. Greet the student.');
  } else if (currentIndex === totalPages - 1) {
    parts.push('This is the LAST page. Wrap up and summarize.');
  } else {
    parts.push('This is a MIDDLE page. Connect to previous content.');
  }

  if (prev) {
    const prevLabel = SCENE_MODE_LABELS[prev.mode] || prev.mode;
    parts.push('Previous page: ' + prevLabel + ' - ' + prev.description);
  }
  if (next) {
    const nextLabel = SCENE_MODE_LABELS[next.mode] || next.mode;
    parts.push('Next page: ' + nextLabel + ' - ' + next.description);
  }

  const positionHint = parts.join(' ');

  return {
    currentIndex,
    totalPages,
    lessonTitle,
    pagesSummary,
    teammatesSummary,
    positionHint,
  };
}

export function formatContextForPrompt(ctx: CourseContext): string {
  const lines: string[] = [
    '--- Course Context ---',
    'Lesson: ' + ctx.lessonTitle,
    'Structure: ' + ctx.pagesSummary,
    ctx.positionHint,
  ];
  if (ctx.teammatesSummary) {
    lines.push('Teammates: ' + ctx.teammatesSummary);
  }
  lines.push('--- End Context ---');
  return lines.join('\n');
}
