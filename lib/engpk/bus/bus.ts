/**
 * engpk · 通用事件总线
 *
 * 三总线（scoreBus / bulletBus / metricBus）共享的最小发布/订阅实现。
 *
 * 设计要点：
 *   - 纯内存、无外部依赖；SSR/CSR 都可用（服务端仅作为占位，实际订阅在客户端）
 *   - 泛型事件，调用方自定义 payload
 *   - 支持同步派发（监听器立即执行），错误隔离（单个 handler throw 不影响其它）
 *   - 提供 once / clear / size 等基础方法，便于测试
 */

export type BusHandler<T> = (event: T) => void;

export interface Bus<T> {
  dispatch(event: T): void;
  subscribe(handler: BusHandler<T>): () => void;
  once(handler: BusHandler<T>): () => void;
  clear(): void;
  size(): number;
}

export function createBus<T>(name?: string): Bus<T> {
  const handlers = new Set<BusHandler<T>>();

  return {
    dispatch(event) {
      // 先拷贝一份，避免 handler 内部再 subscribe/unsubscribe 引起迭代器失效
      const snapshot = Array.from(handlers);
      for (const handler of snapshot) {
        try {
          handler(event);
        } catch (err) {
          // 单个 handler 异常不影响其它订阅者
          // eslint-disable-next-line no-console
          console.error(`[engpk bus${name ? `:${name}` : ''}] handler error`, err);
        }
      }
    },

    subscribe(handler) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },

    once(handler) {
      const wrapped: BusHandler<T> = (event) => {
        handlers.delete(wrapped);
        handler(event);
      };
      handlers.add(wrapped);
      return () => {
        handlers.delete(wrapped);
      };
    },

    clear() {
      handlers.clear();
    },

    size() {
      return handlers.size;
    },
  };
}
