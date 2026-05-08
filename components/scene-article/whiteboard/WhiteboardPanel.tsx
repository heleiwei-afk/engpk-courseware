'use client';

/**
 * WhiteboardPanel - Renders whiteboard elements from the engpk stage store
 *
 * Subscribes to useEngpkStageStore and renders text/latex/shape/chart elements.
 * Positioned as an overlay or side panel in the article scene.
 */

import { useEngpkStageStore } from '@/lib/engpk/whiteboard/stage-store';

export function WhiteboardPanel() {
  const stage = useEngpkStageStore((s) => s.stage);
  const whiteboard = stage?.whiteboard;

  if (!whiteboard || whiteboard.length === 0) return null;

  const elements = whiteboard[whiteboard.length - 1]?.elements || [];
  if (elements.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm dark:bg-slate-900">
      <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Board
      </div>
      <div className="relative min-h-[200px] w-full" style={{ aspectRatio: '16/9' }}>
        {elements.map((el) => (
          <WhiteboardElement key={el.id} element={el} />
        ))}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function WhiteboardElement({ element }: { element: any }) {
  const style: React.CSSProperties = {
    position: 'absolute',
    left: (element.left || element.x || 0) / 10 + '%',
    top: (element.top || element.y || 0) / 5.63 + '%',
    maxWidth: '90%',
  };

  switch (element.type) {
    case 'text':
      return (
        <div style={style} className="text-sm leading-relaxed">
          <div dangerouslySetInnerHTML={{ __html: element.content || '' }} />
        </div>
      );
    case 'latex':
      return (
        <div style={style} className="font-mono text-sm">
          {element.latex || ''}
        </div>
      );
    case 'shape':
      return (
        <div
          style={{
            ...style,
            width: (element.width || 100) / 10 + '%',
            height: (element.height || 50) / 5.63 + '%',
            backgroundColor: element.fillColor || '#5b9bd5',
            borderRadius: element.shape === 'circle' ? '50%' : '4px',
            opacity: 0.7,
          }}
        />
      );
    default:
      return (
        <div style={style} className="rounded bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
          [{element.type}]
        </div>
      );
  }
}
