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

  const [xUnit, setXUnit] = React.useState<'units' | 'px' | 'rem'>('px');
  const [yUnit, setYUnit] = React.useState<'units' | 'px' | 'rem'>('px');
  const [xVal, setXVal] = React.useState<number>(xu * grid);
  const [yVal, setYVal] = React.useState<number>(yu * grid);

  React.useEffect(() => {
    const pxX = xu * grid;
    const pxY = yu * grid;
    const format = (val: number) => Number(val.toFixed(2));
    setXVal(
      xUnit === 'units' ? format(xu) : xUnit === 'px' ? format(pxX) : format(pxX / 16)
    );
    setYVal(
      yUnit === 'units' ? format(yu) : yUnit === 'px' ? format(pxY) : format(pxY / 16)
    );
  }, [xu, yu, grid, xUnit, yUnit]);

  const commitX = (val: number) => {
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


