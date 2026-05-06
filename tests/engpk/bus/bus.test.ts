import { describe, it, expect, vi } from 'vitest';
import { createBus } from '@/lib/engpk/bus/bus';

describe('createBus', () => {
  it('dispatches events to subscribers', () => {
    const bus = createBus<{ value: number }>();
    const handler = vi.fn();
    bus.subscribe(handler);

    bus.dispatch({ value: 1 });
    bus.dispatch({ value: 2 });

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenNthCalledWith(1, { value: 1 });
    expect(handler).toHaveBeenNthCalledWith(2, { value: 2 });
  });

  it('returns an unsubscribe function', () => {
    const bus = createBus<number>();
    const handler = vi.fn();
    const unsub = bus.subscribe(handler);

    bus.dispatch(1);
    unsub();
    bus.dispatch(2);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(bus.size()).toBe(0);
  });

  it('isolates handler errors (one bad handler does not break others)', () => {
    const bus = createBus<number>();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bad = vi.fn(() => {
      throw new Error('boom');
    });
    const good = vi.fn();

    bus.subscribe(bad);
    bus.subscribe(good);
    bus.dispatch(42);

    expect(bad).toHaveBeenCalled();
    expect(good).toHaveBeenCalledWith(42);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('supports once() — handler fires exactly once then detaches', () => {
    const bus = createBus<number>();
    const handler = vi.fn();
    bus.once(handler);

    bus.dispatch(1);
    bus.dispatch(2);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(1);
    expect(bus.size()).toBe(0);
  });

  it('snapshotting subscribers prevents mutation-during-dispatch bugs', () => {
    const bus = createBus<number>();
    const calls: number[] = [];

    // handler1 adds handler2 during dispatch
    const handler2 = vi.fn((n: number) => {
      calls.push(n + 100);
    });
    const handler1 = (n: number) => {
      calls.push(n);
      bus.subscribe(handler2);
    };

    bus.subscribe(handler1);
    bus.dispatch(1);

    // handler2 subscribed *during* dispatch 1 should not be called for dispatch 1
    expect(calls).toEqual([1]);

    bus.dispatch(2);
    // now both run
    expect(calls).toEqual([1, 2, 102]);
  });

  it('clear() removes all subscribers', () => {
    const bus = createBus<number>();
    bus.subscribe(() => {});
    bus.subscribe(() => {});
    expect(bus.size()).toBe(2);

    bus.clear();
    expect(bus.size()).toBe(0);
  });
});
