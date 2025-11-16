import React from 'react';

import { BuilderState } from '@/features/webeditor/state/BuilderState';
import { NumericDragInput } from '@/shared/components/NumericDragInput';
import { Node, SectionV2 } from '@/shared/types/pageV2';
import { Label } from '@/shared/components/ui/label';

type LayoutSizeControlsProps = {
  node: Node;
  onUpdateNode: (updater: (node: Node) => Node) => void;
  section?: SectionV2;
};



export const LayoutSizeControls: React.FC<LayoutSizeControlsProps> = ({ node, onUpdateNode, section }) => {
  const wu = node.layout?.units?.wu ?? 12;
  const hu = node.layout?.units?.hu ?? 8;
  
  // Compute approximate cellPx for px/rem conversion (using typical container width)
  const cols = section?.builderGrid?.cols ?? 64;
  const aspect = section?.builderGrid?.aspect ?? { num: 16, den: 9 };

  const prevUnitsRef = React.useRef<null | { xu?: number; yu?: number; wu?: number; hu?: number }>(null);

  const [widthVal, setWidthVal] = React.useState<number>(wu);
  const [heightVal, setHeightVal] = React.useState<number>(hu);

  const formatUnits = React.useCallback((val: number) => Number(val.toFixed(3)), []);

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
    setWidthVal(formatUnits(wu));
    setHeightVal(formatUnits(hu));
  }, [wu, hu, formatUnits]);

  const commitWidth = (val: number) => {
    if (!prevUnitsRef.current) {
      prevUnitsRef.current = { ...(node.layout?.units || {}) };
    }
    const nextWu = Math.max(1, Math.round(val));
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
    const nextHu = Math.max(1, Math.round(val));
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


  return (
    <div className="rounded-lg border p-3 bg-muted/40">
      <div className="text-sm font-semibold mb-2">Layout Size</div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Width</Label>
          <div className="flex items-center gap-2">
            <NumericDragInput
              min={1}
              step={1}
              transformValue={(v) => Number((v).toFixed(3))}
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
                  const nextWu = Math.max(1, Math.round(widthVal));
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
            <div className="text-xs text-muted-foreground">units</div>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Height</Label>
          <div className="flex items-center gap-2">
            <NumericDragInput
              min={1}
              step={1}
              transformValue={(v) => Number((v).toFixed(3))}
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
                  const nextHu = Math.max(1, Math.round(heightVal));
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
            <div className="text-xs text-muted-foreground">units</div>
          </div>
        </div>
      </div>
      <div className="text-xs text-muted-foreground mt-1">Virtual grid: {cols} cols @ {aspect.num}:{aspect.den}</div>
    </div>
  );
};


