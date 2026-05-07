'use client';

/**
 * VideoReviewSceneView — 视频赏析类场景渲染器
 *
 * 布局：
 *   - 顶部：老师引导语
 *   - 中间左：视频播放区
 *   - 中间右：摄像头窗口（如已同意）
 *   - 底部：状态提示 + "下一页"按钮
 *
 * 流程：
 *   1. 检查 consent → 无则弹 GuardianConsentDialog
 *   2. 同意后请求摄像头权限
 *   3. 每 10s 截一帧 → POST /api/engpk/performance-check
 *   4. isPerforming=true → scoreBus 加分 + 弹幕
 *   5. 视频播放结束 → 解锁"下一页"
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { VideoReviewScene } from '@/lib/engpk/types/scene-v2';
import {
  hasConsent,
  isCameraSupported,
} from '@/lib/engpk/consent/guardian-consent';
import {
  captureFrame,
  checkPerformance,
} from '@/lib/engpk/media/performance-detector';
import { scoreBus, makeScoreEvent } from '@/lib/engpk/score/bus';
import { bulletBus, makeBulletEvent } from '@/lib/engpk/bullet/bus';
import { metricBus, makeMetricEvent } from '@/lib/engpk/metric/bus';
import { GuardianConsentDialog } from './GuardianConsentDialog';

interface VideoReviewSceneViewProps {
  scene: VideoReviewScene;
  onContinue?: () => void;
}

export function VideoReviewSceneView({
  scene,
  onContinue,
}: VideoReviewSceneViewProps) {
  const { videoUrl, performanceCheckIntervalSec, cameraRequired } =
    scene.payload;

  const [consentGranted, setConsentGranted] = useState(() =>
    hasConsent('camera-performance'),
  );
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [videoEnded, setVideoEnded] = useState(false);
  const [performCount, setPerformCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 首次进入：检查 consent
  useEffect(() => {
    if (cameraRequired && !consentGranted && isCameraSupported()) {
      setShowConsentDialog(true);
    }
  }, [cameraRequired, consentGranted]);

  // consent 同意后：请求摄像头
  useEffect(() => {
    if (!consentGranted || !cameraRequired) return;
    if (!isCameraSupported()) {
      setCameraError('浏览器不支持摄像头');
      metricBus.dispatch(
        makeMetricEvent({ name: 'camera.unavailable', value: 1 }),
      );
      return;
    }

    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { width: 320, height: 240 } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        setCameraStream(stream);
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCameraError(
            err instanceof Error ? err.message : '无法获取摄像头',
          );
          metricBus.dispatch(
            makeMetricEvent({ name: 'camera.unavailable', value: 1 }),
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [consentGranted, cameraRequired]);

  // 定时截图检测
  useEffect(() => {
    if (!cameraStream || !cameraVideoRef.current || videoEnded) return;

    intervalRef.current = setInterval(async () => {
      const video = cameraVideoRef.current;
      if (!video) return;
      const frame = captureFrame(video);
      if (!frame) return;

      const result = await checkPerformance(
        frame,
        scene.id,
        videoRef.current?.currentTime
          ? videoRef.current.currentTime * 1000
          : 0,
      );

      if (result.isPerforming) {
        setPerformCount((c) => c + 1);
        scoreBus.dispatch(
          makeScoreEvent({
            target: 'user',
            delta: 5,
            reason: '表演加分',
            source: 'video-performance',
            sceneId: scene.id,
          }),
        );
        bulletBus.dispatch(
          makeBulletEvent({
            text: '检测到表演 +5',
            emoji: '🌟',
            from: 'system',
            style: 'highlight',
          }),
        );
      }
    }, performanceCheckIntervalSec * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [
    cameraStream,
    videoEnded,
    performanceCheckIntervalSec,
    scene.id,
  ]);

  // 清理摄像头
  useEffect(() => {
    return () => {
      cameraStream?.getTracks().forEach((t) => t.stop());
    };
  }, [cameraStream]);

  const speeches = scene.actions
    .filter(
      (a): a is Extract<typeof a, { type: 'speech' }> => a.type === 'speech',
    )
    .map((a) => a.text);

  function handleConsentAccept() {
    setConsentGranted(true);
    setShowConsentDialog(false);
    metricBus.dispatch(makeMetricEvent({ name: 'consent.granted', value: 1 }));
  }

  function handleConsentDecline() {
    setShowConsentDialog(false);
    setCameraError('未开启摄像头，无法获得表演加分');
    metricBus.dispatch(makeMetricEvent({ name: 'consent.denied', value: 1 }));
  }

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      data-testid="video-review-scene"
    >
      {showConsentDialog ? (
        <GuardianConsentDialog
          feature="camera-performance"
          onAccept={handleConsentAccept}
          onDecline={handleConsentDecline}
        />
      ) : null}

      {/* 顶部：老师引导语 */}
      {speeches.length > 0 ? (
        <div className="shrink-0 border-b border-border bg-indigo-50/50 px-6 py-3 dark:bg-indigo-950/20">
          <span className="mr-2 rounded-full bg-indigo-500 px-2 py-0.5 text-[10px] text-white">
            老师
          </span>
          <span className="text-sm">{speeches[0]}</span>
        </div>
      ) : null}

      {/* 摄像头错误横幅 */}
      {cameraError ? (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          ⚠ {cameraError}
        </div>
      ) : null}

      {/* 中间：视频 + 摄像头 */}
      <div className="flex flex-1 gap-4 overflow-hidden p-4">
        {/* 视频播放区 */}
        <div className="flex flex-1 items-center justify-center rounded-xl border border-border bg-black">
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            autoPlay
            onEnded={() => setVideoEnded(true)}
            className="max-h-full max-w-full rounded-lg"
          />
        </div>

        {/* 摄像头窗口 */}
        {consentGranted && cameraStream ? (
          <div className="flex w-48 flex-col items-center gap-2">
            <div className="overflow-hidden rounded-xl border-2 border-emerald-400 shadow-lg">
              <video
                ref={cameraVideoRef}
                autoPlay
                muted
                playsInline
                className="h-36 w-48 object-cover"
              />
            </div>
            <div className="text-center text-xs text-muted-foreground">
              表演次数：{performCount}
            </div>
          </div>
        ) : null}
      </div>

      {/* 底部 */}
      <div className="shrink-0 flex items-center justify-between border-t border-border px-6 py-3">
        <span className="text-xs text-muted-foreground">
          {videoEnded ? '视频播放完毕' : '正在播放…'}
          {consentGranted && cameraStream
            ? ` · 每 ${performanceCheckIntervalSec}s 检测一次`
            : ''}
        </span>
        <button
          type="button"
          onClick={onContinue}
          disabled={!videoEnded}
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm disabled:opacity-40"
        >
          {videoEnded ? '下一页 →' : '看完视频后继续…'}
        </button>
      </div>
    </div>
  );
}
