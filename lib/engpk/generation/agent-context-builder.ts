/**
 * engpk - Agent context builder
 *
 * Formats teammate persona info into a prompt-ready block
 * so scene generators can reference AI teammates consistently.
 */

import type { AITeammate } from '../types/teammate';

export interface AgentContextBlock {
  header: string;
  personas: string[];
  footer: string;
}

export function buildAgentContext(teammates: AITeammate[]): AgentContextBlock {
  if (!teammates || teammates.length === 0) {
    return { header: '', personas: [], footer: '' };
  }

  const header = '--- AI Teammates in This Lesson ---';
  const personas = teammates.map((t, i) => {
    return (
      (i + 1) + '. ' + t.nickname +
      ' | archetype: ' + t.archetype +
      ' | bio: ' + t.bio +
      ' | voice: ' + (t.voice || 'default')
    );
  });
  const footer = '--- End Teammates ---';

  return { header, personas, footer };
}

export function formatAgentContextForPrompt(teammates: AITeammate[]): string {
  const block = buildAgentContext(teammates);
  if (!block.header) return '';
  const lines = [block.header, ...block.personas, block.footer];
  return lines.join('\n');
}
