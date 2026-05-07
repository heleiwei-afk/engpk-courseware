'use client';

/**
 * GuardianConsentDialog — 监护人同意弹窗（决策 #9）
 *
 * 首次进入 video-review 场景时弹出。
 * 同意后 24h 内不再弹。
 */

import { setConsent, type ConsentFeature } from '@/lib/engpk/consent/guardian-consent';

interface GuardianConsentDialogProps {
  feature: ConsentFeature;
  onAccept: () => void;
  onDecline: () => void;
}

export function GuardianConsentDialog({
  feature,
  onAccept,
  onDecline,
}: GuardianConsentDialogProps) {
  function handleAccept() {
    setConsent(feature);
    onAccept();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        <h2 className="mb-3 text-lg font-bold">需要监护人确认</h2>

        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">用途：</span>
            每 10 秒截取一帧摄像头画面，用于判断学生是否在跟随视频表演。
            表演的同学会获得积分奖励。
          </p>
          <p>
            <span className="font-medium text-foreground">数据流向：</span>
            截图上传至服务端视觉模型进行判定，判定完成后
            <span className="font-semibold text-foreground">立即丢弃</span>
            ，不保存、不留日志。
          </p>
          <p>
            <span className="font-medium text-foreground">有效期：</span>
            本次同意 24 小时内有效，之后需重新确认。
          </p>
        </div>

        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          请确认您是该学生的监护人，并同意上述摄像头使用方式。
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={handleAccept}
            className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
          >
            我是监护人，同意
          </button>
          <button
            type="button"
            onClick={onDecline}
            className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            暂不开启
          </button>
        </div>
      </div>
    </div>
  );
}
