import React from 'react';

import { Label } from '@/shared/components/ui/label';
import { NumericDragInput } from '@/shared/components/NumericDragInput';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Node } from '@/shared/types/pageV2';
import { BuilderState } from '@/features/webeditor/state/BuilderState';

type PositionControlsProps = {
  node: Node;
  onUpdateNode: (updater: (node: Node) => Node) => void;
  gridSize?: number;
};

const REM_STEP = 0.1;

export const PositionControls: React.FC<PositionControlsProps> = ({ node, onUpdateNode, gridSize }) => {
  const grid = gridSize ?? 16;
  const xu = node.layout?.units?.xu ?? 0;
  const yu = node.layout?.units?.yu ?? 0;

  const prevUnitsRef = React.useRef<null | { xu?: number; yu?: number; wu?: number; hu?: number }>(null);

  const [xUnit, setXUnit] = React.useState<'units' | 'px' | 'rem'>('px');
  const [yUnit, setYUnit] = React.useState<'units' | 'px' | 'rem'>('px');
  const [xVal, setXVal] = React.useState<number>(xu * grid);
  const [yVal, setYVal] = React.useState<number>(yu * grid);

  React.useEffect(() => {
    const pxX = xu * grid;
    const pxY = yu * grid;
    const formatUnits = (val: number) => Number(val.toFixed(2));
    const formatPx = (val: number) => Math.round(val);
    const formatRem = (px: number) => Number((px / 16).toFixed(2));
    setXVal(xUnit === 'units' ? formatUnits(xu) : xUnit === 'px' ? formatPx(pxX) : formatRem(pxX));
    setYVal(yUnit === 'units' ? formatUnits(yu) : yUnit === 'px' ? formatPx(pxY) : formatRem(pxY));
  }, [xu, yu, grid, xUnit, yUnit]);

  const commitX = (val: number) => {
    if (!prevUnitsRef.current) {
      prevUnitsRef.current = { ...(node.layout?.units || {}) };
    }
    const px = xUnit === 'units' ? val * grid : xUnit === 'px' ? val : val * 16;
    const nextXu = Math.max(0, Math.round(px / grid));
    onUpdateNode((n) => ({
      ...n,
      layout: {
        ...n.layout,
        units: {
          xu: nextXu,
          yu: n.layout?.units?.yu ?? 0,
          wu: n.layout?.units?.wu ?? 12,
          hu: n.layout?.units?.hu ?? 8,
        },
      },
    } as Node));
  };

  const commitY = (val: number) => {
    if (!prevUnitsRef.current) {
      prevUnitsRef.current = { ...(node.layout?.units || {}) };
    }
    const px = yUnit === 'units' ? val * grid : yUnit === 'px' ? val : val * 16;
    const nextYu = Math.max(0, Math.round(px / grid));
    onUpdateNode((n) => ({
      ...n,
      layout: {
        ...n.layout,
        units: {
          xu: n.layout?.units?.xu ?? 0,
          yu: nextYu,
          wu: n.layout?.units?.wu ?? 12,
          hu: n.layout?.units?.hu ?? 8,
        },
      },
    } as Node));
  };

  const getStep = (unit: 'units' | 'px' | 'rem') => (unit === 'rem' ? REM_STEP : 1);

  return (
    <div className="rounded-lg border p-3 bg-muted/40">
      <div className="text-sm font-semibold mb-2">Position</div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>X</Label>
          <div className="flex items-center gap-2">
            <NumericDragInput
              min={0}
              step={getStep(xUnit)}
              value={Number.isFinite(xVal) ? xVal : 0}
              onChange={(val) => {
                setXVal(val);
                commitX(val);
              }}
            onChangeEnd={() => {
              const sectionId = BuilderState.selection?.sectionId;
              const nodeId = BuilderState.selection?.nodeId;
              if (sectionId && nodeId && prevUnitsRef.current) {
                const prevUnits = { ...prevUnitsRef.current };
                const px = xUnit === 'units' ? xVal * grid : xUnit === 'px' ? xVal : xVal * 16;
                const nextXu = Math.max(0, Math.round(px / grid));
                const nextUnits = {
                  xu: nextXu,
                  yu: node.layout?.units?.yu ?? 0,
                  wu: node.layout?.units?.wu ?? 12,
                  hu: node.layout?.units?.hu ?? 8,
                };
                BuilderState.pushLayout(sectionId, nodeId, prevUnits, nextUnits);
                prevUnitsRef.current = null;
              }
            }}
            onBlur={() => {
              const sectionId = BuilderState.selection?.sectionId;
              const nodeId = BuilderState.selection?.nodeId;
              if (sectionId && nodeId && prevUnitsRef.current) {
                const prevUnits = { ...prevUnitsRef.current };
                const px = xUnit === 'units' ? xVal * grid : xUnit === 'px' ? xVal : xVal * 16;
                const nextXu = Math.max(0, Math.round(px / grid));
                const nextUnits = {
                  xu: nextXu,
                  yu: node.layout?.units?.yu ?? 0,
                  wu: node.layout?.units?.wu ?? 12,
                  hu: node.layout?.units?.hu ?? 8,
                };
                BuilderState.pushLayout(sectionId, nodeId, prevUnits, nextUnits);
                prevUnitsRef.current = null;
              }
            }}
            />
            <Select value={xUnit} onValueChange={(v) => setXUnit(v as any)}>
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
          <Label>Y</Label>
          <div className="flex items-center gap-2">
            <NumericDragInput
              min={0}
              step={getStep(yUnit)}
              value={Number.isFinite(yVal) ? yVal : 0}
              onChange={(val) => {
                setYVal(val);
                commitY(val);
              }}
            onChangeEnd={() => {
              const sectionId = BuilderState.selection?.sectionId;
              const nodeId = BuilderState.selection?.nodeId;
              if (sectionId && nodeId && prevUnitsRef.current) {
                const prevUnits = { ...prevUnitsRef.current };
                const px = yUnit === 'units' ? yVal * grid : yUnit === 'px' ? yVal : yVal * 16;
                const nextYu = Math.max(0, Math.round(px / grid));
                const nextUnits = {
                  xu: node.layout?.units?.xu ?? 0,
                  yu: nextYu,
                  wu: node.layout?.units?.wu ?? 12,
                  hu: node.layout?.units?.hu ?? 8,
                };
                BuilderState.pushLayout(sectionId, nodeId, prevUnits, nextUnits);
                prevUnitsRef.current = null;
              }
            }}
            onBlur={() => {
              const sectionId = BuilderState.selection?.sectionId;
              const nodeId = BuilderState.selection?.nodeId;
              if (sectionId && nodeId && prevUnitsRef.current) {
                const prevUnits = { ...prevUnitsRef.current };
                const px = yUnit === 'units' ? yVal * grid : yUnit === 'px' ? yVal : yVal * 16;
                const nextYu = Math.max(0, Math.round(px / grid));
                const nextUnits = {
                  xu: node.layout?.units?.xu ?? 0,
                  yu: nextYu,
                  wu: node.layout?.units?.wu ?? 12,
                  hu: node.layout?.units?.hu ?? 8,
                };
                BuilderState.pushLayout(sectionId, nodeId, prevUnits, nextUnits);
                prevUnitsRef.current = null;
              }
            }}
            />
            <Select value={yUnit} onValueChange={(v) => setYUnit(v as any)}>
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
      <div className="text-xs text-muted-foreground mt-1">Grid size: {grid}px per unit</div>
    </div>
  );
};


