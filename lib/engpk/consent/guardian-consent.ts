/**
 * engpk · 监护人同意管理（决策 #9）
 *
 * 功能：
 *   - hasConsent(feature): 检查是否有有效同意（24h TTL）
 *   - setConsent(feature): 记录同意
 *   - revokeConsent(feature): 撤销
 *
 * MVP 实现：localStorage（PR-17 接 DB 后可切到 ConsentRecord 表）。
 * 服务端不可用时（SSR）所有方法返回 false / no-op。
 */

const STORAGE_PREFIX = 'engpk:consent:';
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

export type ConsentFeature = 'camera-performance' | 'microphone';

export function hasConsent(feature: ConsentFeature): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + feature);
    if (!raw) return false;
    const expiresAt = Number(raw);
    if (!Number.isFinite(expiresAt)) return false;
    return Date.now() < expiresAt;
  } catch {
    return false;
  }
}

export function setConsent(feature: ConsentFeature): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      STORAGE_PREFIX + feature,
      String(Date.now() + TTL_MS),
    );
  } catch {
    // storage full or blocked
  }
}

export function revokeConsent(feature: ConsentFeature): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_PREFIX + feature);
  } catch {
    // ignore
  }
}

/** 检查浏览器是否支持 getUserMedia */
export function isCameraSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}
