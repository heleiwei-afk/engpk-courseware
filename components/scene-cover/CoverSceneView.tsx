'use client';

/**
 * CoverSceneView — 封面类场景渲染器
 *
 * 渲染：
 *   - 大标题（按 styleToken 上色 / 字体）
 *   - 副标题
 *   - 渐变背景（primary + accent）
 *   - 老师开场白（暂为静态文字；TTS 在后续 PR 接入）
 *   - 小提示：等待用户点击"开始上课"进入下一页
 */

import { useMemo } from 'react';
import type { CoverScene, StyleToken } from '@/lib/engpk/types/scene-v2';

const FONT_FAMILY_CSS: Record<StyleToken['fontFamily'], string> = {
  rounded:
    "'Nunito Variable', 'Noto Sans SC', system-ui, ui-rounded, -apple-system, sans-serif",
  serif: "'Source Serif Pro', 'Noto Serif SC', Georgia, serif",
  mono: "'JetBrains Mono', 'Source Han Mono', ui-monospace, monospace",
  sans:
    "'Inter Variable', 'Noto Sans SC', system-ui, -apple-system, sans-serif",
};

const MOTIF_DECOR: Record<StyleToken['motif'], string> = {
  fantasy: '✨',
  tech: '🔷',
  nature: '🌿',
  ocean: '🌊',
  space: '🪐',
  classroom: '📚',
  storybook: '📖',
};

interface CoverSceneViewProps {
  scene: CoverScene;
  onContinue?: () => void;
}

export function CoverSceneView({ scene, onContinue }: CoverSceneViewProps) {
  const { title, subtitle, styleToken, coverImageUrl } = scene.payload;

  const speeches = useMemo(
    () =>
      scene.actions
        .filter(
          (a): a is Extract<typeof a, { type: 'speech' }> => a.type === 'speech',
        )
        .map((a) => a.text),
    [scene.actions],
  );

  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden p-8"
      style={{
        background: `linear-gradient(135deg, ${styleToken.primaryColor}26 0%, ${styleToken.accentColor}26 100%)`,
        fontFamily: FONT_FAMILY_CSS[styleToken.fontFamily],
      }}
      data-testid="cover-scene"
    >
      {/* 装饰：左上 + 右下 */}
      <div
        className="pointer-events-none absolute -left-10 -top-10 h-48 w-48 rounded-full blur-3xl opacity-30"
        style={{ background: styleToken.primaryColor }}
      />
      <div
        className="pointer-events-none absolute -bottom-10 -right-10 h-48 w-48 rounded-full blur-3xl opacity-30"
        style={{ background: styleToken.accentColor }}
      />

      {/* 封面图（如有） */}
      {coverImageUrl ? (
        <img
          src={coverImageUrl}
          alt={title}
          className="mb-6 h-40 w-40 rounded-2xl object-cover shadow-lg"
        />
      ) : (
        <div
          className="mb-6 flex h-32 w-32 items-center justify-center rounded-2xl text-5xl shadow-lg"
          style={{ background: `${styleToken.primaryColor}1a` }}
          aria-hidden
        >
          {MOTIF_DECOR[styleToken.motif]}
        </div>
      )}

      <h1
        className="z-10 mb-3 max-w-3xl text-balance text-center text-4xl font-bold leading-tight md:text-5xl"
        style={{ color: styleToken.primaryColor }}
      >
        {title}
      </h1>

      {subtitle ? (
        <p
          className="z-10 mb-8 max-w-2xl text-balance text-center text-lg text-muted-foreground"
          style={{ color: `${styleToken.primaryColor}99` }}
        >
          {subtitle}
        </p>
      ) : null}

      {/* 老师开场白 */}
      {speeches.length > 0 ? (
        <div
          className="z-10 mb-8 max-w-xl rounded-xl border bg-card/80 px-5 py-3 text-sm shadow-sm backdrop-blur-sm"
          style={{ borderColor: `${styleToken.accentColor}40` }}
        >
          {speeches.map((s, i) => (
            <p key={i} className="leading-relaxed">
              <span
                className="mr-2 inline-flex h-5 items-center rounded-full px-2 text-[10px] font-medium text-white"
                style={{ background: styleToken.accentColor }}
              >
                老师
              </span>
              {s}
            </p>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={onContinue}
        className="z-10 rounded-full px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-transform hover:scale-105 active:scale-95"
        style={{ background: styleToken.primaryColor }}
      >
        开始上课 →
      </button>

      <div className="z-10 mt-6 text-[11px] text-muted-foreground/60">
        风格：{styleToken.motif} · 字体：{styleToken.fontFamily}
      </div>
    </div>
  );
}
