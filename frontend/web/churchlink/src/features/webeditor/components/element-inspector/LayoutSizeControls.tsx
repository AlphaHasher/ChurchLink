import React from 'react';

import { BuilderState } from '@/features/webeditor/state/BuilderState';
import { NumericDragInput } from '@/shared/components/NumericDragInput';
import { Node, SectionV2 } from '@/shared/types/pageV2';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { makeVirtualTransform } from '@/features/webeditor/grid/virtualGrid';

type LayoutSizeControlsProps = {
  node: Node;
  onUpdateNode: (updater: (node: Node) => Node) => void;
  section?: SectionV2;
};

const REM_STEP = 0.1; // slower adjustments when scrolling in rem mode

export const LayoutSizeControls: React.FC<LayoutSizeControlsProps> = ({ node, onUpdateNode, section }) => {
  const wu = node.layout?.units?.wu ?? 12;
  const hu = node.layout?.units?.hu ?? 8;
  
  // Compute approximate cellPx for px/rem conversion (using typical container width)
  const cols = section?.builderGrid?.cols ?? 64;
  const aspect = section?.builderGrid?.aspect ?? { num: 16, den: 9 };
  const typicalContainerWidth = 1200; // Approximate, for display conversion only
  const typicalContainerHeight = typicalContainerWidth * aspect.den / aspect.num;
  const approximateTransform = makeVirtualTransform(
    { width: typicalContainerWidth, height: typicalContainerHeight },
    cols,
    aspect
  );
  const cellPx = approximateTransform.cellPx;

  const prevUnitsRef = React.useRef<null | { xu?: number; yu?: number; wu?: number; hu?: number }>(null);

  const [widthUnit, setWidthUnit] = React.useState<'units' | 'px' | 'rem'>('units');
  const [heightUnit, setHeightUnit] = React.useState<'units' | 'px' | 'rem'>('units');
  const [widthVal, setWidthVal] = React.useState<number>(wu);
  const [heightVal, setHeightVal] = React.useState<number>(hu);

  const formatUnits = React.useCallback((val: number) => Number(val.toFixed(2)), []);
  const formatPx = React.useCallback((val: number) => Math.round(val), []);
  const formatRem = React.useCallback((px: number) => Number((px / 16).toFixed(2)), []);

  const startGridAdjust = React.useCallback(() => {
    const sectionId = BuilderState.selection?.sectionId;
    if (sectionId) BuilderState.startAdjustingGrid(sectionId);
  }, []);

  const stopGridAdjust = React.useCallback(() => {
    const sectionId = BuilderState.selection?.sectionId;
    if (sectionId) {
      BuilderState.stopAdjustingGrid(sectionId);
    } else {
      BuilderState.stopAdjustingGrid();
    }
  }, []);

  React.useEffect(() => {
    const pxW = wu * cellPx;
    const pxH = hu * cellPx;
    setWidthVal(
      widthUnit === 'units'
        ? formatUnits(wu)
        : widthUnit === 'px'
        ? formatPx(pxW)
        : formatRem(pxW)
    );
    setHeightVal(
      heightUnit === 'units'
        ? formatUnits(hu)
        : heightUnit === 'px'
        ? formatPx(pxH)
        : formatRem(pxH)
    );
  }, [wu, hu, cellPx, widthUnit, heightUnit, formatUnits, formatPx, formatRem]);

  const commitWidth = (val: number) => {
    if (!prevUnitsRef.current) {
      prevUnitsRef.current = { ...(node.layout?.units || {}) };
    }
    const nextWu = widthUnit === 'units'
      ? Math.max(1, Math.round(val))
      : widthUnit === 'px'
      ? Math.max(1, Math.round(val / cellPx))
      : Math.max(1, Math.round((val * 16) / cellPx));
    onUpdateNode((n) => ({
      ...n,
      layout: {
        ...n.layout,
        units: {
          xu: n.layout?.units?.xu ?? 0,
          yu: n.layout?.units?.yu ?? 0,
          wu: nextWu,
          hu: n.layout?.units?.hu ?? 8,
        },
      },
    } as Node));
  };

  const commitHeight = (val: number) => {
    if (!prevUnitsRef.current) {
      prevUnitsRef.current = { ...(node.layout?.units || {}) };
    }
    const nextHu = heightUnit === 'units'
      ? Math.max(1, Math.round(val))
      : heightUnit === 'px'
      ? Math.max(1, Math.round(val / cellPx))
      : Math.max(1, Math.round((val * 16) / cellPx));
    onUpdateNode((n) => ({
      ...n,
      layout: {
        ...n.layout,
        units: {
          xu: n.layout?.units?.xu ?? 0,
          yu: n.layout?.units?.yu ?? 0,
          wu: n.layout?.units?.wu ?? 12,
          hu: nextHu,
        },
      },
    } as Node));
  };

  const getStep = (unit: 'units' | 'px' | 'rem') => (unit === 'rem' ? REM_STEP : 1);

  return (
    <div className="rounded-lg border p-3 bg-muted/40">
      <div className="text-sm font-semibold mb-2">Layout Size</div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Width</Label>
          <div className="flex items-center gap-2">
            <NumericDragInput
              min={1}
              step={getStep(widthUnit)}
              value={Number.isFinite(widthVal) ? widthVal : 0}
              onFocus={startGridAdjust}
              onMouseDown={startGridAdjust}
              onChange={(val) => {
                setWidthVal(val);
                commitWidth(val);
              }}
              onBlur={stopGridAdjust}
              onMouseUp={stopGridAdjust}
              onTouchStart={startGridAdjust}
              onTouchEnd={stopGridAdjust}
              onChangeEnd={() => {
                const sectionId = BuilderState.selection?.sectionId;
                const nodeId = BuilderState.selection?.nodeId;
                if (sectionId && nodeId && prevUnitsRef.current) {
                  const prevUnits = { ...prevUnitsRef.current };
                  const nextWu = widthUnit === 'units'
                    ? Math.max(1, Math.round(widthVal))
                    : widthUnit === 'px'
                    ? Math.max(1, Math.round(widthVal / cellPx))
                    : Math.max(1, Math.round((widthVal * 16) / cellPx));
                  const nextUnits = {
                    xu: node.layout?.units?.xu ?? 0,
                    yu: node.layout?.units?.yu ?? 0,
                    wu: nextWu,
                    hu: node.layout?.units?.hu ?? 8,
                  };
                  BuilderState.pushLayout(sectionId, nodeId, prevUnits, nextUnits);
                  prevUnitsRef.current = null;
                }
              }}
            />
            <Select value={widthUnit} onValueChange={(v) => setWidthUnit(v as any)}>
              <SelectTrigger className="w-[84px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="units">units</SelectItem>
                <SelectItem value="px">px</SelectItem>
                <SelectItem value="rem">rem</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Height</Label>
          <div className="flex items-center gap-2">
            <NumericDragInput
              min={1}
              step={getStep(heightUnit)}
              value={Number.isFinite(heightVal) ? heightVal : 0}
              onFocus={startGridAdjust}
              onMouseDown={startGridAdjust}
              onChange={(val) => {
                setHeightVal(val);
                commitHeight(val);
              }}
              onBlur={stopGridAdjust}
              onMouseUp={stopGridAdjust}
              onTouchStart={startGridAdjust}
              onTouchEnd={stopGridAdjust}
              onChangeEnd={() => {
                const sectionId = BuilderState.selection?.sectionId;
                const nodeId = BuilderState.selection?.nodeId;
                if (sectionId && nodeId && prevUnitsRef.current) {
                  const prevUnits = { ...prevUnitsRef.current };
                  const nextHu = heightUnit === 'units'
                    ? Math.max(1, Math.round(heightVal))
                    : heightUnit === 'px'
                    ? Math.max(1, Math.round(heightVal / cellPx))
                    : Math.max(1, Math.round((heightVal * 16) / cellPx));
                  const nextUnits = {
                    xu: node.layout?.units?.xu ?? 0,
                    yu: node.layout?.units?.yu ?? 0,
                    wu: node.layout?.units?.wu ?? 12,
                    hu: nextHu,
                  };
                  BuilderState.pushLayout(sectionId, nodeId, prevUnits, nextUnits);
                  prevUnitsRef.current = null;
                }
              }}
            />
            <Select value={heightUnit} onValueChange={(v) => setHeightUnit(v as any)}>
              <SelectTrigger className="w-[84px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="units">units</SelectItem>
                <SelectItem value="px">px</SelectItem>
                <SelectItem value="rem">rem</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <div className="text-xs text-muted-foreground mt-1">Virtual grid: {cols} cols @ {aspect.num}:{aspect.den}</div>
    </div>
  );
};


