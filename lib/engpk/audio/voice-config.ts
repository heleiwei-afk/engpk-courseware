/**
 * engpk - Voice configuration for TTS
 *
 * Manages teacher voice selection and teammate voice assignment.
 * Uses Doubao TTS 2.0 voices from Volcengine.
 */

export interface VoiceOption {
  id: string;
  name: string;
  gender: 'female' | 'male';
  language: 'zh-CN' | 'en-US';
}

/** All available Doubao TTS 2.0 Chinese voices */
export const DOUBAO_VOICES: VoiceOption[] = [
  { id: 'zh_female_vv_uranus_bigtts', name: 'Vivi 2.0', gender: 'female', language: 'zh-CN' },
  { id: 'zh_female_xiaohe_uranus_bigtts', name: '小何 2.0', gender: 'female', language: 'zh-CN' },
  { id: 'zh_female_qingxinnvsheng_uranus_bigtts', name: '清新女声 2.0', gender: 'female', language: 'zh-CN' },
  { id: 'zh_female_cancan_uranus_bigtts', name: '知性灿灿 2.0', gender: 'female', language: 'zh-CN' },
  { id: 'zh_female_shuangkuaisisi_uranus_bigtts', name: '爽快思思 2.0', gender: 'female', language: 'zh-CN' },
  { id: 'zh_female_tianmeixiaoyuan_uranus_bigtts', name: '甜美小源 2.0', gender: 'female', language: 'zh-CN' },
  { id: 'zh_female_linjianvhai_uranus_bigtts', name: '邻家女孩 2.0', gender: 'female', language: 'zh-CN' },
  { id: 'zh_female_yingyujiaoxue_uranus_bigtts', name: 'Tina老师 2.0', gender: 'female', language: 'zh-CN' },
  { id: 'zh_female_kefunvsheng_uranus_bigtts', name: '客服女声 2.0', gender: 'female', language: 'zh-CN' },
  { id: 'zh_male_m191_uranus_bigtts', name: '云舟 2.0', gender: 'male', language: 'zh-CN' },
  { id: 'zh_male_taocheng_uranus_bigtts', name: '小天 2.0', gender: 'male', language: 'zh-CN' },
  { id: 'zh_male_liufei_uranus_bigtts', name: '刘飞 2.0', gender: 'male', language: 'zh-CN' },
  { id: 'zh_male_shaonianzixin_uranus_bigtts', name: '少年梓辛 2.0', gender: 'male', language: 'zh-CN' },
  { id: 'zh_male_ruyayichen_uranus_bigtts', name: '儒雅逸辰 2.0', gender: 'male', language: 'zh-CN' },
];

const STORAGE_KEY = 'engpk:teacherVoice';
const DEFAULT_VOICE = 'zh_female_vv_uranus_bigtts';

/** Get the user-selected teacher voice ID (from localStorage) */
export function getTeacherVoice(): string {
  if (typeof window === 'undefined') return DEFAULT_VOICE;
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_VOICE;
}

/** Save teacher voice selection */
export function setTeacherVoice(voiceId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, voiceId);
}

/** Get the default teacher voice */
export function getDefaultTeacherVoice(): string {
  return DEFAULT_VOICE;
}

/**
 * Assign different voices to N teammates (mixed gender).
 * Excludes the teacher's voice to ensure variety.
 * Returns an array of voice IDs.
 */
export function assignTeammateVoices(teacherVoiceId: string, count: number): string[] {
  // Filter out teacher's voice and only use Chinese voices
  const pool = DOUBAO_VOICES
    .filter((v) => v.id !== teacherVoiceId && v.language === 'zh-CN');

  // Shuffle
  const shuffled = [...pool].sort(() => Math.random() - 0.5);

  // Take first N
  return shuffled.slice(0, count).map((v) => v.id);
}

/** Find voice info by ID */
export function getVoiceInfo(voiceId: string): VoiceOption | undefined {
  return DOUBAO_VOICES.find((v) => v.id === voiceId);
}
