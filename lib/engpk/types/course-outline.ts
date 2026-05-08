/**
 * engpk - Course outline types
 *
 * The outline is generated BEFORE individual scenes.
 * It gives each scene generator rich context about what to cover.
 */

import type { SceneMode } from '../instruction/types';

/** Single page outline (produced by outline-builder, consumed by scene generators) */
export interface SceneOutline {
  /** Page index (matches PageInstruction.index) */
  index: number;
  /** Scene mode */
  mode: SceneMode;
  /** Page title (may differ from user's description - LLM can improve it) */
  title: string;
  /** 3-5 key points this page should cover */
  keyPoints: string[];
  /** Concepts that need explanation on this page */
  concepts: string[];
  /** Suggested examples to use (relatable to 6-12 year olds) */
  examples: string[];
  /** Transition from previous page (how to connect) */
  transitionIn?: string;
  /** Transition to next page (how to lead into it) */
  transitionOut?: string;
  /** Learning objectives for this specific page */
  objectives: string[];
}

/** Full course outline (all pages planned together) */
export interface CourseOutline {
  /** Overall lesson title (refined by LLM) */
  lessonTitle: string;
  /** 3-5 overall learning objectives for the entire lesson */
  learningObjectives: string[];
  /** Theme/subject area */
  subject: string;
  /** Target difficulty level */
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  /** Per-page outlines */
  scenes: SceneOutline[];
}
