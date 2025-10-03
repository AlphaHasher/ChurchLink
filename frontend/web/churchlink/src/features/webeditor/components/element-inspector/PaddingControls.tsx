import React from 'react';

import { BuilderState } from '@/features/webeditor/state/BuilderState';
import { NumericDragInput } from '@/shared/components/NumericDragInput';
import { Node } from '@/shared/types/pageV2';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

type PaddingControlsProps = {
  node: Node;
  onUpdate: (updater: (node: Node) => Node) => void;
  gridSize?: number;
};

type PaddingUnit = 'spacing' | 'px' | 'rem';

const REM_STEP = 0.1;
const REM_MAX = 10; // 40 * 0.25
const PX_MAX = 160; // 40 * 4

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

  const [unit, setUnit] = React.useState<PaddingUnit>('rem');

  React.useEffect(() => {
    if (!sectionId) return;
    BuilderState.showPaddingOverlay(sectionId, node.id, [padding.top, padding.right, padding.bottom, padding.left]);
    return () => {
      BuilderState.hidePaddingOverlay(sectionId, node.id);
    };
  }, [sectionId, node.id, padding.top, padding.right, padding.bottom, padding.left, unit]);

  const toDisplay = React.useCallback((value: number) => {
    const rounded = (val: number) => Number(val.toFixed(2));
    switch (unit) {
      case 'px':
        return rounded(value * 4);
      case 'rem':
        return rounded(value * 0.25);
      default:
        return rounded(value);
    }
  }, [unit]);

  const toSpacing = React.useCallback((value: number) => {
    if (!Number.isFinite(value)) return 0;
    switch (unit) {
      case 'px':
        return value / 4;
      case 'rem':
        return value / 0.25;
      default:
        return value;
    }
  }, [unit]);

  const getStep = React.useCallback(() => {
    switch (unit) {
      case 'px':
        return 1;
      case 'rem':
        return REM_STEP;
      default:
        return 0.5;
    }
  }, [unit]);

  const getMax = React.useCallback(() => {
    switch (unit) {
      case 'px':
        return PX_MAX;
      case 'rem':
        return REM_MAX;
      default:
        return 40;
    }
  }, [unit]);

  const unitLabel = unit === 'spacing' ? 'Tailwind spacing units' : unit === 'px' ? 'pixels' : 'rem';

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
            <span>Units</span>
            <Select value={unit} onValueChange={(val) => setUnit(val as PaddingUnit)}>
              <SelectTrigger className="h-7 w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="spacing">Tailwind (spacing)</SelectItem>
                <SelectItem value="rem">rem</SelectItem>
                <SelectItem value="px">px</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
            value={toDisplay(Math.max(padding.top, padding.right, padding.bottom, padding.left))}
            onChange={handleGlobal}
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
              value={toDisplay(padding.top)}
              onChange={(val) => handleSplit('top', val)}
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Right ({unitLabel})</div>
            <NumericDragInput
              min={0}
              max={getMax()}
              step={getStep()}
              value={toDisplay(padding.right)}
              onChange={(val) => handleSplit('right', val)}
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Bottom ({unitLabel})</div>
            <NumericDragInput
              min={0}
              max={getMax()}
              step={getStep()}
              value={toDisplay(padding.bottom)}
              onChange={(val) => handleSplit('bottom', val)}
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Left ({unitLabel})</div>
            <NumericDragInput
              min={0}
              max={getMax()}
              step={getStep()}
              value={toDisplay(padding.left)}
              onChange={(val) => handleSplit('left', val)}
            />
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Displaying values in {unitLabel}. Stored as Tailwind spacing units (1 = 0.25rem).
      </p>
    </div>
  );
};


