/**
 * engpk · game-event 协议（决策 #6）
 *
 * 所有来自游戏 iframe 的 postMessage 必须符合此协议。
 * 外壳侧 GameIframeAdapter 做双重校验后路由到 scoreBus / bulletBus / playback。
 */

/** iframe → 外壳的事件类型 */
export type GameEventType =
  | 'score'
  | 'combo'
  | 'milestone'
  | 'complete'
  | 'fail'
  | 'request-hint';

/** iframe 发出的消息结构 */
export interface GameEventMessage {
  source: 'openmaic-game';
  gameId: string;
  event: GameEventType;
  payload: Record<string, unknown>;
  timestamp: number;
}

/**
 * 校验一个 MessageEvent.data 是否符合 game-event 协议。
 * 返回 null 表示不合法（应忽略）。
 */
export function validateGameEvent(
  data: unknown,
  expectedGameId: string,
): GameEventMessage | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;

  if (d.source !== 'openmaic-game') return null;
  if (typeof d.gameId !== 'string' || d.gameId !== expectedGameId) return null;
  if (typeof d.event !== 'string') return null;
  if (!VALID_EVENTS.has(d.event as GameEventType)) return null;
  if (typeof d.timestamp !== 'number') return null;

  return {
    source: 'openmaic-game',
    gameId: d.gameId,
    event: d.event as GameEventType,
    payload:
      d.payload && typeof d.payload === 'object'
        ? (d.payload as Record<string, unknown>)
        : {},
    timestamp: d.timestamp,
  };
}

const VALID_EVENTS = new Set<GameEventType>([
  'score',
  'combo',
  'milestone',
  'complete',
  'fail',
  'request-hint',
]);
