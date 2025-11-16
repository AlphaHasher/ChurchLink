import React from 'react';

import { BuilderState } from '@/features/webeditor/state/BuilderState';
import { NumericDragInput } from '@/shared/components/NumericDragInput';
import { Node } from '@/shared/types/pageV2';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';

type PaddingControlsProps = {
  node: Node;
  onUpdate: (updater: (node: Node) => Node) => void;
};

type PaddingUnit = 'spacing';

const SPACING_STEP = 0.5;
const SPACING_MAX = 40;

export const PaddingControls: React.FC<PaddingControlsProps> = ({ node, onUpdate }) => {
  const sectionId = BuilderState.selection?.sectionId ?? null;

  React.useEffect(() => {
    if (!sectionId) return;
    return () => {
      BuilderState.hidePaddingOverlay(sectionId, node.id);
    };
  }, [sectionId, node.id]);

  const padding = React.useMemo(() => {
    const style = { ...(node.style || {}) } as any;
    const y = style.paddingY ?? 0;
    const x = style.paddingX ?? y;
    return {
      top: style.paddingTop ?? y,
      right: style.paddingRight ?? x,
      bottom: style.paddingBottom ?? y,
      left: style.paddingLeft ?? x,
    };
  }, [node.style]);

  const [split, setSplit] = React.useState(() => {
    const { top, right, bottom, left } = padding;
    return !(top === bottom && right === left && top === right);
  });

  const unit: PaddingUnit = 'spacing';

  React.useEffect(() => {
    if (!sectionId) return;
    BuilderState.showPaddingOverlay(sectionId, node.id, [padding.top, padding.right, padding.bottom, padding.left]);
    return () => {
      BuilderState.hidePaddingOverlay(sectionId, node.id);
    };
  }, [sectionId, node.id, padding.top, padding.right, padding.bottom, padding.left, unit]);

  const toDisplay = React.useCallback((value: number) => {
    return Number(value.toFixed(3));
  }, []);

  const toSpacing = React.useCallback((value: number) => {
    if (!Number.isFinite(value)) return 0;
    return value;
  }, []);

  const getStep = React.useCallback(() => {
    return SPACING_STEP;
  }, []);

  const getMax = React.useCallback(() => {
    return SPACING_MAX;
  }, []);

  const unitLabel = 'grid units';

  const publishOverlay = React.useCallback((values: [number, number, number, number]) => {
    if (!sectionId) return;
    BuilderState.showPaddingOverlay(sectionId, node.id, values);
  }, [sectionId, node.id]);

  const updateStyle = React.useCallback((mutator: (current: any) => any) => {
    onUpdate((n) => {
      if (n.type !== 'text') return n;
      const style = { ...(n.style || {}) } as any;
      const next = mutator(style);
      return { ...n, style: next } as Node;
    });
  }, [onUpdate]);

  const applyGlobal = React.useCallback((val: number) => {
    updateStyle((style) => {
      style.paddingY = val;
      style.paddingX = val;
      delete style.paddingTop;
      delete style.paddingRight;
      delete style.paddingBottom;
      delete style.paddingLeft;
      return style;
    });
    publishOverlay([val, val, val, val]);
  }, [updateStyle, publishOverlay]);

  const applySplit = React.useCallback((side: 'top' | 'right' | 'bottom' | 'left', val: number) => {
    updateStyle((style) => {
      style[`padding${side[0].toUpperCase()}${side.slice(1)}`] = val;
      return style;
    });
    publishOverlay([
      side === 'top' ? val : padding.top,
      side === 'right' ? val : padding.right,
      side === 'bottom' ? val : padding.bottom,
      side === 'left' ? val : padding.left,
    ]);
  }, [updateStyle, publishOverlay, padding.top, padding.right, padding.bottom, padding.left]);

  const handleGlobal = React.useCallback(
    (displayVal: number) => {
      const spacingVal = Math.max(0, toSpacing(displayVal));
      applyGlobal(spacingVal);
    },
    [toSpacing, applyGlobal]
  );

  const handleSplit = React.useCallback(
    (side: 'top' | 'right' | 'bottom' | 'left', displayVal: number) => {
      const spacingVal = Math.max(0, toSpacing(displayVal));
      applySplit(side, spacingVal);
    },
    [toSpacing, applySplit]
  );

  const toggleSplit = React.useCallback(
    (checked: boolean) => {
      setSplit(checked);
      if (checked) {
        updateStyle((style) => {
          const y = style.paddingY ?? 0;
          const x = style.paddingX ?? y;
          style.paddingTop = style.paddingTop ?? y;
          style.paddingBottom = style.paddingBottom ?? y;
          style.paddingLeft = style.paddingLeft ?? x;
          style.paddingRight = style.paddingRight ?? x;
          delete style.paddingY;
          delete style.paddingX;
          return style;
        });
        publishOverlay([padding.top, padding.right, padding.bottom, padding.left]);
      } else {
        const vertical = Math.max(padding.top, padding.bottom);
        const horizontal = Math.max(padding.left, padding.right);
        updateStyle((style) => {
          style.paddingY = vertical;
          style.paddingX = horizontal;
          delete style.paddingTop;
          delete style.paddingRight;
          delete style.paddingBottom;
          delete style.paddingLeft;
          return style;
        });
        publishOverlay([vertical, horizontal, vertical, horizontal]);
      }
    },
    [updateStyle, publishOverlay, padding.top, padding.right, padding.bottom, padding.left]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm">Padding</Label>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Split sides</span>
            <Switch checked={split} onCheckedChange={toggleSplit} />
          </div>
        </div>
      </div>
      {!split ? (
        <div className="space-y-2">
          <Label>All sides ({unitLabel})</Label>
          <NumericDragInput
            min={0}
            max={getMax()}
            step={getStep()}
            transformValue={(v) => Number((v).toFixed(3))}
            value={toDisplay(Math.max(padding.top, padding.right, padding.bottom, padding.left))}
            onChange={handleGlobal}
            onChangeEnd={() => {
              const sectionId = BuilderState.selection?.sectionId;
              const nodeId = BuilderState.selection?.nodeId;
              if (!sectionId || !nodeId) return;
              const prev = { ...(node.style || {}) };
              const val = Math.max(padding.top, padding.right, padding.bottom, padding.left);
              const next = { ...prev } as any;
              next.paddingY = val;
              next.paddingX = val;
              delete next.paddingTop;
              delete next.paddingRight;
              delete next.paddingBottom;
              delete next.paddingLeft;
              BuilderState.pushNode(sectionId, node.id, { ...node, style: prev }, { ...node, style: next });
            }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Top ({unitLabel})</div>
            <NumericDragInput
              min={0}
              max={getMax()}
              step={getStep()}
            transformValue={(v) => Number((v).toFixed(3))}
              value={toDisplay(padding.top)}
              onChange={(val) => handleSplit('top', val)}
              onChangeEnd={() => {
                const sectionId = BuilderState.selection?.sectionId;
                const nodeId = BuilderState.selection?.nodeId;
                if (!sectionId || !nodeId) return;
                const prevNode = { ...node };
                const nextNode = {
                  ...node,
                  style: { ...(node.style || {}), paddingTop: padding.top },
                } as Node;
                BuilderState.pushNode(sectionId, node.id, prevNode, nextNode);
              }}
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Right ({unitLabel})</div>
            <NumericDragInput
              min={0}
              max={getMax()}
              step={getStep()}
            transformValue={(v) => Number((v).toFixed(3))}
              value={toDisplay(padding.right)}
              onChange={(val) => handleSplit('right', val)}
              onChangeEnd={() => {
                const sectionId = BuilderState.selection?.sectionId;
                const nodeId = BuilderState.selection?.nodeId;
                if (!sectionId || !nodeId) return;
                const prevNode = { ...node };
                const nextNode = {
                  ...node,
                  style: { ...(node.style || {}), paddingRight: padding.right },
                } as Node;
                BuilderState.pushNode(sectionId, node.id, prevNode, nextNode);
              }}
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Bottom ({unitLabel})</div>
            <NumericDragInput
              min={0}
              max={getMax()}
              step={getStep()}
            transformValue={(v) => Number((v).toFixed(3))}
              value={toDisplay(padding.bottom)}
              onChange={(val) => handleSplit('bottom', val)}
              onChangeEnd={() => {
                const sectionId = BuilderState.selection?.sectionId;
                const nodeId = BuilderState.selection?.nodeId;
                if (!sectionId || !nodeId) return;
                const prevNode = { ...node };
                const nextNode = {
                  ...node,
                  style: { ...(node.style || {}), paddingBottom: padding.bottom },
                } as Node;
                BuilderState.pushNode(sectionId, node.id, prevNode, nextNode);
              }}
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Left ({unitLabel})</div>
            <NumericDragInput
              min={0}
              max={getMax()}
              step={getStep()}
            transformValue={(v) => Number((v).toFixed(3))}
              value={toDisplay(padding.left)}
              onChange={(val) => handleSplit('left', val)}
              onChangeEnd={() => {
                const sectionId = BuilderState.selection?.sectionId;
                const nodeId = BuilderState.selection?.nodeId;
                if (!sectionId || !nodeId) return;
                const prevNode = { ...node };
                const nextNode = {
                  ...node,
                  style: { ...(node.style || {}), paddingLeft: padding.left },
                } as Node;
                BuilderState.pushNode(sectionId, node.id, prevNode, nextNode);
              }}
            />
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Displaying values and storing as grid units.</p>
    </div>
  );
};


