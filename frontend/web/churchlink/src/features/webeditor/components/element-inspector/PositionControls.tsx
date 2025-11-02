import React from 'react';

import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { NumericDragInput } from '@/shared/components/NumericDragInput';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Node, SectionV2 } from '@/shared/types/pageV2';
import { BuilderState } from '@/features/webeditor/state/BuilderState';
import { makeVirtualTransform } from '@/features/webeditor/grid/virtualGrid';

type PositionControlsProps = {
  node: Node;
  onUpdateNode: (updater: (node: Node) => Node) => void;
  section?: SectionV2;
  sectionId?: string;
};

const REM_STEP = 0.1;

export const PositionControls: React.FC<PositionControlsProps> = ({ node, onUpdateNode, section, sectionId: explicitSectionId }) => {
  const xu = node.layout?.units?.xu ?? 0;
  const yu = node.layout?.units?.yu ?? 0;
  
  const cols = section?.builderGrid?.cols ?? 64;
  const aspect = section?.builderGrid?.aspect ?? { num: 16, den: 9 };
  const typicalContainerWidth = 1200; 
  const typicalContainerHeight = typicalContainerWidth * aspect.den / aspect.num;
  const approximateTransform = makeVirtualTransform(
    { width: typicalContainerWidth, height: typicalContainerHeight },
    cols,
    aspect
  );
  const cellPx = approximateTransform.cellPx;

  const prevUnitsRef = React.useRef<null | { xu?: number; yu?: number; wu?: number; hu?: number }>(null);

  const [xUnit, setXUnit] = React.useState<'units' | 'px' | 'rem'>('units');
  const [yUnit, setYUnit] = React.useState<'units' | 'px' | 'rem'>('units');
  const [xVal, setXVal] = React.useState<number>(xu);
  const [yVal, setYVal] = React.useState<number>(yu);

  React.useEffect(() => {
    const pxX = xu * cellPx;
    const pxY = yu * cellPx;
    const formatUnits = (val: number) => Number(val.toFixed(2));
    const formatPx = (val: number) => Math.round(val);
    const formatRem = (px: number) => Number((px / 16).toFixed(2));
    setXVal(xUnit === 'units' ? formatUnits(xu) : xUnit === 'px' ? formatPx(pxX) : formatRem(pxX));
    setYVal(yUnit === 'units' ? formatUnits(yu) : yUnit === 'px' ? formatPx(pxY) : formatRem(pxY));
  }, [xu, yu, cellPx, xUnit, yUnit]);

  const commitX = (val: number) => {
    if (!prevUnitsRef.current) {
      prevUnitsRef.current = { ...(node.layout?.units || {}) };
    }
    const nextXu = xUnit === 'units' 
      ? Math.max(0, Math.round(val))
      : xUnit === 'px'
      ? Math.max(0, Math.round(val / cellPx))
      : Math.max(0, Math.round((val * 16) / cellPx));
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
    const nextYu = yUnit === 'units'
      ? Math.max(0, Math.round(val))
      : yUnit === 'px'
      ? Math.max(0, Math.round(val / cellPx))
      : Math.max(0, Math.round((val * 16) / cellPx));
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

  const centerHorizontally = React.useCallback(() => {
    const nodeId = node.id;
    const sectionId = explicitSectionId;
    console.log('[CenterH] start', { nodeId, sectionId });

    const nodeContentEl = document.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement | null;
    if (!nodeContentEl) {
      console.warn('[CenterH] Could not find node element with data-node-id:', nodeId);
      return;
    }
    console.log('[CenterH] nodeContentEl found', nodeContentEl);

    let wrapperEl: HTMLElement | null = nodeContentEl.parentElement;
    while (wrapperEl) {
      const style = window.getComputedStyle(wrapperEl);
      if (style.position === 'absolute') {
        break;
      }
      wrapperEl = wrapperEl.parentElement;
    }

    if (!wrapperEl) {
      console.warn('[CenterH] Could not find absolutely positioned wrapper for node:', nodeId);
      return;
    }
    console.log('[CenterH] wrapperEl', wrapperEl, window.getComputedStyle(wrapperEl).position);


    let parentEl: HTMLElement | null = null;
    let parentWidth: number = 0;

    const containerAncestor = wrapperEl.closest('[data-node-type="container"]') as HTMLElement | null;
    const anyNodeAncestor = wrapperEl.closest('[data-node-id]') as HTMLElement | null;
    const sectionAncestor = wrapperEl.closest('[id^="section-content-"]') as HTMLElement | null;
    console.log('[CenterH] ancestors', { containerAncestor, anyNodeAncestor, sectionAncestor });
    if (containerAncestor) {
      parentEl = containerAncestor;
    } else if (anyNodeAncestor && anyNodeAncestor.getAttribute('data-node-id') !== nodeId) {
      parentEl = anyNodeAncestor;
    } else if (sectionAncestor) {
      parentEl = sectionAncestor;
    }

    if (parentEl) {
      const rect = parentEl.getBoundingClientRect();
      parentWidth = rect.width;
    }

    if (!parentEl || parentWidth === 0) {
      console.warn('[CenterH] Could not find parent container or section content', { parentEl, parentWidth });
      return;
    }
    console.log('[CenterH] parentEl', parentEl, 'parentWidth', parentWidth);

    const contentEl = document.getElementById(`section-content-${explicitSectionId}`) as HTMLElement | null;
    if (!contentEl) {
      console.warn('[CenterH] Could not find section content element');
      return;
    }
    const contentRect = contentEl.getBoundingClientRect();
    const parentRect = parentEl.getBoundingClientRect();
    const parentPx = {
      x: parentRect.left - contentRect.left,
      y: parentRect.top - contentRect.top,
      w: parentRect.width,
      h: parentRect.height,
    };
    const actualTransform = makeVirtualTransform(
      { width: contentRect.width, height: contentRect.height },
      cols,
      aspect
    );
    const parentUnits = actualTransform.toUnits({ ...parentPx, w: parentPx.w, h: parentPx.h });
    
    const elementWu = node.layout?.units?.wu;
    let wu: number;
    if (elementWu) {
      wu = elementWu;
    } else {
      const wrapperRect = wrapperEl.getBoundingClientRect();
      const wrapperPx = {
        x: wrapperRect.left - contentRect.left,
        y: wrapperRect.top - contentRect.top,
        w: wrapperRect.width,
        h: wrapperRect.height,
      };
      const wrapperUnits = actualTransform.toUnits({ ...wrapperPx, w: wrapperPx.w, h: wrapperPx.h });
      wu = wrapperUnits.wu;
    }
    console.log('[CenterH] parentUnitsW', parentUnits.wu, 'wu', wu);

    const centerXu = Math.max(0, Math.round((parentUnits.wu - wu) / 2));
    console.log('[CenterH] centerXu(units)', centerXu);

    if (!prevUnitsRef.current) {
      prevUnitsRef.current = { ...(node.layout?.units || {}) };
    }
    const prevUnits = { ...prevUnitsRef.current };
    const nextUnits = {
      xu: centerXu,
      yu: node.layout?.units?.yu ?? 0,
      wu: node.layout?.units?.wu,
      hu: node.layout?.units?.hu,
    };
    console.log('[CenterH] prevUnits', prevUnits, 'nextUnits', nextUnits);
    onUpdateNode((n) => ({
      ...n,
      layout: {
        units: nextUnits,
      },
    } as Node));
    let secId = explicitSectionId;
    if (!secId) {
      const sectionEl = nodeContentEl.closest('[id^="section-content-"]') as HTMLElement | null;
      if (sectionEl && sectionEl.id.startsWith('section-content-')) {
        secId = sectionEl.id.replace('section-content-', '');
      }
    }
    if (secId) {
      console.log('[CenterH] pushLayout', { secId, nodeId, prevUnits, nextUnits });
      BuilderState.pushLayout(secId, nodeId, prevUnits, nextUnits);
    }
    prevUnitsRef.current = null;
  }, [node, cols, aspect, onUpdateNode, explicitSectionId]);

  const centerVertically = React.useCallback(() => {
    const nodeId = node.id;
    const sectionId = explicitSectionId;
    console.log('[CenterV] start', { nodeId, sectionId });

    const nodeContentEl = document.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement | null;
    if (!nodeContentEl) {
      console.warn('[CenterV] Could not find node element with data-node-id:', nodeId);
      return;
    }
    console.log('[CenterV] nodeContentEl found', nodeContentEl);

    let wrapperEl: HTMLElement | null = nodeContentEl.parentElement;
    while (wrapperEl) {
      const style = window.getComputedStyle(wrapperEl);
      if (style.position === 'absolute') {
        break;
      }
      wrapperEl = wrapperEl.parentElement;
    }

    if (!wrapperEl) {
      console.warn('[CenterV] Could not find absolutely positioned wrapper for node:', nodeId);
      return;
    }
    console.log('[CenterV] wrapperEl', wrapperEl, window.getComputedStyle(wrapperEl).position);

    let parentEl: HTMLElement | null = null;
    let parentHeight: number = 0;

    const containerAncestor = wrapperEl.closest('[data-node-type="container"]') as HTMLElement | null;
    const anyNodeAncestor = wrapperEl.closest('[data-node-id]') as HTMLElement | null;
    const sectionAncestor = wrapperEl.closest('[id^="section-content-"]') as HTMLElement | null;
    console.log('[CenterV] ancestors', { containerAncestor, anyNodeAncestor, sectionAncestor });
    if (containerAncestor) {
      parentEl = containerAncestor;
    } else if (anyNodeAncestor && anyNodeAncestor.getAttribute('data-node-id') !== nodeId) {
      parentEl = anyNodeAncestor;
    } else if (sectionAncestor) {
      parentEl = sectionAncestor;
    }

    if (parentEl) {
      const rect = parentEl.getBoundingClientRect();
      parentHeight = rect.height;
    }

    if (!parentEl || parentHeight === 0) {
      console.warn('[CenterV] Could not find parent container or section content', { parentEl, parentHeight });
      return;
    }
    console.log('[CenterV] parentEl', parentEl, 'parentHeight', parentHeight);

    // Compute parent bounds in virtual units
    const contentEl = document.getElementById(`section-content-${explicitSectionId}`) as HTMLElement | null;
    if (!contentEl) {
      console.warn('[CenterV] Could not find section content element');
      return;
    }
    const contentRect = contentEl.getBoundingClientRect();
    const parentRect = parentEl.getBoundingClientRect();
    const parentPx = {
      x: parentRect.left - contentRect.left,
      y: parentRect.top - contentRect.top,
      w: parentRect.width,
      h: parentRect.height,
    };
    const actualTransform = makeVirtualTransform(
      { width: contentRect.width, height: contentRect.height },
      cols,
      aspect
    );
    const parentUnits = actualTransform.toUnits({ ...parentPx, w: parentPx.w, h: parentPx.h });
    
    const elementHu = node.layout?.units?.hu;
    let hu: number;
    if (elementHu) {
      hu = elementHu;
    } else {
      const wrapperRect = wrapperEl.getBoundingClientRect();
      const wrapperPx = {
        x: wrapperRect.left - contentRect.left,
        y: wrapperRect.top - contentRect.top,
        w: wrapperRect.width,
        h: wrapperRect.height,
      };
      const wrapperUnits = actualTransform.toUnits({ ...wrapperPx, w: wrapperPx.w, h: wrapperPx.h });
      hu = wrapperUnits.hu;
    }
    console.log('[CenterV] parentUnitsH', parentUnits.hu, 'hu', hu);

    const centerYu = Math.max(0, Math.round((parentUnits.hu - hu) / 2));
    console.log('[CenterV] centerYu(units)', centerYu);

    if (!prevUnitsRef.current) {
      prevUnitsRef.current = { ...(node.layout?.units || {}) };
    }
    const prevUnits = { ...prevUnitsRef.current };
    const nextUnits = {
      xu: node.layout?.units?.xu ?? 0,
      yu: centerYu,
      wu: node.layout?.units?.wu,
      hu: node.layout?.units?.hu,
    };
    console.log('[CenterV] prevUnits', prevUnits, 'nextUnits', nextUnits);
    onUpdateNode((n) => ({
      ...n,
      layout: {
        units: nextUnits,
      },
    } as Node));
    let secId = explicitSectionId;
    if (!secId) {
      const sectionEl = nodeContentEl.closest('[id^="section-content-"]') as HTMLElement | null;
      if (sectionEl && sectionEl.id.startsWith('section-content-')) {
        secId = sectionEl.id.replace('section-content-', '');
      }
    }
    if (secId) {
      console.log('[CenterV] pushLayout', { secId, nodeId, prevUnits, nextUnits });
      BuilderState.pushLayout(secId, nodeId, prevUnits, nextUnits);
    }
    prevUnitsRef.current = null;
  }, [node, cols, aspect, onUpdateNode, explicitSectionId]);

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
                const nextXu = xUnit === 'units'
                  ? Math.max(0, Math.round(xVal))
                  : xUnit === 'px'
                  ? Math.max(0, Math.round(xVal / cellPx))
                  : Math.max(0, Math.round((xVal * 16) / cellPx));
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
                const nextXu = xUnit === 'units'
                  ? Math.max(0, Math.round(xVal))
                  : xUnit === 'px'
                  ? Math.max(0, Math.round(xVal / cellPx))
                  : Math.max(0, Math.round((xVal * 16) / cellPx));
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
                const nextYu = yUnit === 'units'
                  ? Math.max(0, Math.round(yVal))
                  : yUnit === 'px'
                  ? Math.max(0, Math.round(yVal / cellPx))
                  : Math.max(0, Math.round((yVal * 16) / cellPx));
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
                const nextYu = yUnit === 'units'
                  ? Math.max(0, Math.round(yVal))
                  : yUnit === 'px'
                  ? Math.max(0, Math.round(yVal / cellPx))
                  : Math.max(0, Math.round((yVal * 16) / cellPx));
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
      <div className="mt-3 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={centerHorizontally}
        >
          Center Horizontally
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={centerVertically}
        >
          Center Vertically
        </Button>
      </div>
      <div className="text-xs text-muted-foreground mt-1">Virtual grid: {cols} cols @ {aspect.num}:{aspect.den}</div>
    </div>
  );
};


