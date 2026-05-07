import { describe, it, expect } from 'vitest';
import { parseSSEFrame } from '@/lib/engpk/client/use-generation-sse';

describe('parseSSEFrame', () => {
  it('parses a normal data: frame', () => {
    const frame = 'data: {"type":"teammates-ready","data":{"lessonId":"L","teammates":[]}}';
    const event = parseSSEFrame(frame);
    expect(event?.type).toBe('teammates-ready');
  });

  it('returns null for heartbeat', () => {
    expect(parseSSEFrame(':heartbeat')).toBeNull();
  });

  it('returns null for empty frames', () => {
    expect(parseSSEFrame('')).toBeNull();
    expect(parseSSEFrame('   \n   ')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(parseSSEFrame('data: {bad json')).toBeNull();
  });

  it('handles multi-line data: (each data line joined by newline)', () => {
    // SSE 规范：相邻多个 data: 行拼接时用 \n 作为分隔
    const frame =
      'data: {"type":"error","data":\ndata: {"code":"INTERNAL","message":"x"}}';
    const event = parseSSEFrame(frame);
    expect(event?.type).toBe('error');
    if (event?.type === 'error') {
      expect(event.data.code).toBe('INTERNAL');
      expect(event.data.message).toBe('x');
    }
  });

  it('ignores comment-only lines mixed with data', () => {
    const frame = ':keep-alive\ndata: {"type":"done","data":{"lessonId":"L","succeeded":1,"failed":0,"total":1,"lesson":{"id":"L","title":"x","status":"ready","createdAt":"2026-01-01T00:00:00Z"}}}';
    const event = parseSSEFrame(frame);
    expect(event?.type).toBe('done');
  });
});
