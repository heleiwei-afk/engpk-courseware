/**
 * engpk · 队友 mock 生成器
 *
 * PR-08：返回固定 3 位队友（不调 LLM）。PR-11 才接入真生成器（teammate-generator.ts）。
 */

import type { AITeammate, TeammateArchetype } from '@/lib/engpk/types/teammate';
import { uuid } from './mock-scene-generator';

const ARCHETYPES: TeammateArchetype[] = ['scholar', 'energetic', 'creative'];
const NICKNAMES = [
  ['阿华', '小风', '点点'],
  ['书源', '阳阳', '麦麦'],
  ['思思', '亮亮', '糖糖'],
];
const BIOS: Record<TeammateArchetype, string[]> = {
  scholar: ['总能稳稳答对', '安静而细致', '笔记一丝不苟'],
  energetic: ['超有活力', '弹幕第一名', '加油加油'],
  creative: ['脑洞超大', '总有奇思妙想', '点子大王'],
  rookie: ['和你一样在努力', '虽然新手但很努力', '一起加油吧'],
  veteran: ['关键时刻顶得上', '老学员了', '稳就完了'],
};

const AVATARS = ['/avatars/default.png'];

export function mockGenerateTeammates(): AITeammate[] {
  const nicknameRow = NICKNAMES[Math.floor(Math.random() * NICKNAMES.length)];
  return ARCHETYPES.map((archetype, i) => ({
    id: uuid(),
    nickname: nicknameRow[i],
    avatar: AVATARS[0],
    archetype,
    bio: pickRandom(BIOS[archetype]),
    score: 0,
  }));
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
