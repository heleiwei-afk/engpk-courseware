/**
 * engpk · 鼓励语模板池
 *
 * 决策 #11：模板池 + 占位符替换（LLM 不参与金额生成）。
 * 金额白名单 [1, 2, 3, 5]，硬上限 5 元。
 *
 * 模板分类：
 *   - physical：肢体互动（拥抱、亲吻脸颊、击掌）
 *   - household：家务互动（洗碗、扫地、整理书桌）
 *   - fun：趣味互动（讲笑话、一起读书、唱歌）
 *   - monetary：金钱奖励（≤ 5 元，{amount} 占位符）
 *
 * 每条模板有 moodTag：high / mid / low，对应学生本课表现水平。
 */

export type EncouragementCategory = 'physical' | 'household' | 'fun' | 'monetary';
export type MoodTag = 'high' | 'mid' | 'low';

export interface EncouragementTemplate {
  id: string;
  category: EncouragementCategory;
  text: string;
  moodTag: MoodTag;
  /** monetary 类模板的金额白名单 */
  vars?: { amount?: number[] };
}

/** 金额硬上限（决策 #11） */
export const MAX_AMOUNT = 5;

/** 金额白名单 */
export const AMOUNT_WHITELIST = [1, 2, 3, 5] as const;

export const TEMPLATES: EncouragementTemplate[] = [
  // ==================== physical ====================
  { id: 'phys-hug-h', category: 'physical', moodTag: 'high', text: '太棒了！回家给妈妈一个大大的拥抱吧！' },
  { id: 'phys-hug-m', category: 'physical', moodTag: 'mid', text: '今天很努力呢，回家抱抱妈妈吧。' },
  { id: 'phys-hug-l', category: 'physical', moodTag: 'low', text: '没关系，回家让妈妈抱抱你，下次会更好。' },
  { id: 'phys-kiss-h', category: 'physical', moodTag: 'high', text: '可以亲一下妈妈的脸颊，告诉她你今天超厉害！' },
  { id: 'phys-kiss-m', category: 'physical', moodTag: 'mid', text: '亲亲妈妈，告诉她你在进步。' },
  { id: 'phys-five-h', category: 'physical', moodTag: 'high', text: '和爸爸妈妈来个 high five！你值得！' },
  { id: 'phys-five-m', category: 'physical', moodTag: 'mid', text: '和家人击个掌，庆祝今天的学习。' },
  { id: 'phys-five-l', category: 'physical', moodTag: 'low', text: '和妈妈击个掌，约定下次一起加油。' },

  // ==================== household ====================
  { id: 'house-wash-h', category: 'household', moodTag: 'high', text: '今天主动帮妈妈洗一次碗吧，她会很惊喜！' },
  { id: 'house-wash-m', category: 'household', moodTag: 'mid', text: '试试帮妈妈洗碗，做个小帮手。' },
  { id: 'house-sweep-h', category: 'household', moodTag: 'high', text: '帮家里扫一次地，让妈妈休息一下。' },
  { id: 'house-sweep-m', category: 'household', moodTag: 'mid', text: '帮忙扫扫地，妈妈会很开心。' },
  { id: 'house-tidy-h', category: 'household', moodTag: 'high', text: '把自己的书桌整理干净，展示你的好习惯！' },
  { id: 'house-tidy-l', category: 'household', moodTag: 'low', text: '整理一下书桌，给自己一个清爽的开始。' },

  // ==================== fun ====================
  { id: 'fun-joke-h', category: 'fun', moodTag: 'high', text: '给爸爸妈妈讲一个今天学到的笑话！' },
  { id: 'fun-joke-m', category: 'fun', moodTag: 'mid', text: '回家和家人分享一件今天有趣的事。' },
  { id: 'fun-read-h', category: 'fun', moodTag: 'high', text: '和妈妈一起读 10 分钟书，享受亲子时光。' },
  { id: 'fun-read-m', category: 'fun', moodTag: 'mid', text: '今晚和家人一起读一小段故事吧。' },
  { id: 'fun-read-l', category: 'fun', moodTag: 'low', text: '找一本喜欢的书，读给妈妈听。' },
  { id: 'fun-sing-h', category: 'fun', moodTag: 'high', text: '唱一首歌给家人听，展示你的才艺！' },
  { id: 'fun-sing-m', category: 'fun', moodTag: 'mid', text: '哼一首今天学到的歌，心情会更好。' },
  { id: 'fun-draw-h', category: 'fun', moodTag: 'high', text: '画一幅画送给妈妈，她一定会珍藏。' },
  { id: 'fun-draw-l', category: 'fun', moodTag: 'low', text: '画一幅画表达今天的心情，明天会更好。' },

  // ==================== monetary ====================
  { id: 'money-ask-h', category: 'monetary', moodTag: 'high', text: '问问妈妈，今天的小奖励能不能是 {amount} 元？', vars: { amount: [1, 2, 3, 5] } },
  { id: 'money-ask-m', category: 'monetary', moodTag: 'mid', text: '可以请爸爸给你 {amount} 元零花钱奖励噢～', vars: { amount: [1, 2, 3] } },
  { id: 'money-save-h', category: 'monetary', moodTag: 'high', text: '把今天的 {amount} 元奖励存进小猪存钱罐！', vars: { amount: [1, 2, 5] } },
  { id: 'money-save-m', category: 'monetary', moodTag: 'mid', text: '攒下 {amount} 元，离你的小目标又近了一步。', vars: { amount: [1, 2, 3] } },
];
