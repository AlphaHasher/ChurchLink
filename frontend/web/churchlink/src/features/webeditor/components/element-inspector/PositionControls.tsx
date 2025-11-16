import React from 'react';

import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { NumericDragInput } from '@/shared/components/NumericDragInput';
import { Node, SectionV2 } from '@/shared/types/pageV2';
import { BuilderState } from '@/features/webeditor/state/BuilderState';
import { makeVirtualTransform } from '@/features/webeditor/grid/virtualGrid';
import { getDefaultHu, getDefaultWu } from '@/features/webeditor/utils/nodeDefaults';

type PositionControlsProps = {
  node: Node;
  onUpdateNode: (updater: (node: Node) => Node) => void;
  section?: SectionV2;
  sectionId?: string;
};


export const PositionControls: React.FC<PositionControlsProps> = ({ node, onUpdateNode, section, sectionId: explicitSectionId }) => {
  const xu = node.layout?.units?.xu ?? 0;
  const yu = node.layout?.units?.yu ?? 0;
  
  const cols = section?.builderGrid?.cols ?? 64;
  const aspect = section?.builderGrid?.aspect ?? { num: 16, den: 9 };
  const [cellPxState, setCellPxState] = React.useState<number>(16);
  const resolvedSectionId = explicitSectionId ?? section?.id ?? BuilderState.selection?.sectionId ?? null;
  React.useEffect(() => {
    if (!resolvedSectionId) return;
    const el = document.getElementById(`section-content-${resolvedSectionId}`);
    if (!el) return;
    const compute = () => {
      const rect = el.getBoundingClientRect();
      const width = rect.width || 0;
      if (width <= 0) return;
      const virtualHeightPx = width * aspect.den / aspect.num;
      const vt = makeVirtualTransform({ width, height: virtualHeightPx }, cols, aspect);
      setCellPxState(vt.cellPx);
    };
    compute();
    const ro = new ResizeObserver(() => compute());
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [resolvedSectionId, cols, aspect.den, aspect.num, aspect]);
  const cellPx = cellPxState;

  const sectionRows = React.useMemo(() => Math.round(cols * aspect.den / aspect.num), [cols, aspect.den, aspect.num]);

  const normalizeUnits = React.useCallback((target: Node) => {
    const units = (target.layout?.units ?? {}) as Partial<{ xu: number; yu: number; wu: number; hu: number }>;
    return {
      xu: typeof units.xu === 'number' ? units.xu : 0,
      yu: typeof units.yu === 'number' ? units.yu : 0,
      wu: typeof units.wu === 'number' ? units.wu : getDefaultWu(target.type),
      hu: typeof units.hu === 'number' ? units.hu : getDefaultHu(target.type),
    };
  }, []);

  const rootParentUnits = React.useMemo(() => ({
    xu: 0,
    yu: 0,
    wu: cols,
    hu: sectionRows,
  }), [cols, sectionRows]);

  const resolveParentUnits = React.useCallback(() => {
    const walk = (children: Node[] | undefined, parentUnits: { xu: number; yu: number; wu: number; hu: number }): { xu: number; yu: number; wu: number; hu: number } | null => {
      if (!children) return null;
      for (const child of children) {
        if (child.id === node.id) {
          return parentUnits;
        }
        const childUnits = normalizeUnits(child);
        if (child.children && child.children.length) {
          const found = walk(child.children, childUnits);
          if (found) return found;
        }
      }
      return null;
    };

    return walk(section?.children, rootParentUnits) ?? rootParentUnits;
  }, [section, node.id, normalizeUnits, rootParentUnits]);

  const prevUnitsRef = React.useRef<null | { xu?: number; yu?: number; wu?: number; hu?: number }>(null);
  const prevDescendantsRef = React.useRef<
    | null
    | Array<{
        id: string;
        units: { xu?: number; yu?: number; wu?: number; hu?: number };
      }>
  >(null);

  const snapshotDescendantUnits = React.useCallback((children?: Node[]): Array<{ id: string; units: { xu?: number; yu?: number; wu?: number; hu?: number } }> => {
    if (!children || !children.length) return [];
    const records: Array<{ id: string; units: { xu?: number; yu?: number; wu?: number; hu?: number } }> = [];
    const walk = (nodes?: Node[]) => {
      if (!nodes) return;
      for (const child of nodes) {
        const units = { ...(child.layout?.units ?? {}) };
        records.push({ id: child.id, units });
        if (child.children && child.children.length) {
          walk(child.children);
        }
      }
    };
    walk(children);
    return records;
  }, []);

  const shiftDescendantUnits = React.useCallback(
    (children: Node[] | undefined, dxu: number, dyu: number): Node[] | undefined => {
      if (!children || (dxu === 0 && dyu === 0)) return children;
      return children.map((child) => {
        const childUnits = { ...(child.layout?.units ?? {}) };
        const shiftedUnits = {
          ...childUnits,
          xu: (childUnits.xu ?? 0) + dxu,
          yu: (childUnits.yu ?? 0) + dyu,
        };
        return {
          ...child,
          layout: { units: shiftedUnits },
          children: shiftDescendantUnits(child.children, dxu, dyu),
        } as Node;
      });
    },
    []
  );

  const [xVal, setXVal] = React.useState<number>(xu);
  const [yVal, setYVal] = React.useState<number>(yu);

  React.useEffect(() => {
    const formatUnits = (val: number) => Number(val.toFixed(3));
    setXVal(formatUnits(xu));
    setYVal(formatUnits(yu));
  }, [xu, yu]);

  const commitX = React.useCallback((val: number) => {
    const nodeUnits = normalizeUnits(node);
    if (!prevUnitsRef.current) {
      prevUnitsRef.current = { ...nodeUnits };
      if (node.type === 'container') {
        prevDescendantsRef.current = snapshotDescendantUnits(node.children);
      }
    }
    const nextXu = Math.max(0, Math.round(val));
    onUpdateNode((n) => {
      const normalized = normalizeUnits(n);
      const deltaXu = nextXu - normalized.xu;
      const nextUnits = { ...normalized, xu: nextXu };
      const nextChildren =
        n.type === 'container' && (deltaXu !== 0)
          ? shiftDescendantUnits(n.children, deltaXu, 0)
          : n.children;
      return {
        ...n,
        layout: {
          ...n.layout,
          units: nextUnits,
        },
        children: nextChildren,
      } as Node;
    });
  }, [cellPx, normalizeUnits, node, onUpdateNode, shiftDescendantUnits, snapshotDescendantUnits]);

  const commitY = React.useCallback((val: number) => {
    const nodeUnits = normalizeUnits(node);
    if (!prevUnitsRef.current) {
      prevUnitsRef.current = { ...nodeUnits };
      if (node.type === 'container') {
        prevDescendantsRef.current = snapshotDescendantUnits(node.children);
      }
    }
    const nextYu = Math.max(0, Math.round(val));
    onUpdateNode((n) => {
      const normalized = normalizeUnits(n);
      const deltaYu = nextYu - normalized.yu;
      const nextUnits = { ...normalized, yu: nextYu };
      const nextChildren =
        n.type === 'container' && (deltaYu !== 0)
          ? shiftDescendantUnits(n.children, 0, deltaYu)
          : n.children;
      return {
        ...n,
        layout: {
          ...n.layout,
          units: nextUnits,
        },
        children: nextChildren,
      } as Node;
    });
  }, [normalizeUnits, node, onUpdateNode, shiftDescendantUnits, snapshotDescendantUnits]);

  const centerHorizontally = React.useCallback(() => {
    const parentUnits = resolveParentUnits();
    const nodeUnits = normalizeUnits(node);
    const available = parentUnits.wu - nodeUnits.wu;
    const minXu = parentUnits.xu;
    const maxXu = parentUnits.xu + Math.max(0, available);
    const target = Math.round(parentUnits.xu + Math.max(0, available) / 2);
    const centerXu = Math.max(minXu, Math.min(target, maxXu));

    if (centerXu === nodeUnits.xu) {
      return;
    }

    if (!prevUnitsRef.current) {
      prevUnitsRef.current = { ...nodeUnits };
    }
    const prevUnits = { ...prevUnitsRef.current };
    const nextUnits = { ...nodeUnits, xu: centerXu };

    const isContainer = node.type === 'container';
    const prevChildrenLayouts = isContainer ? snapshotDescendantUnits(node.children) : null;

    onUpdateNode((n) => {
      const normalized = normalizeUnits(n);
      const deltaXu = centerXu - normalized.xu;
      const nextChildren =
        n.type === 'container' && (deltaXu !== 0)
          ? shiftDescendantUnits(n.children, deltaXu, 0)
          : n.children;
      return {
        ...n,
        layout: {
          ...n.layout,
          units: { ...normalized, xu: centerXu },
        },
        children: nextChildren,
      } as Node;
    });

    const secId = explicitSectionId ?? section?.id ?? BuilderState.selection?.sectionId ?? null;
    if (secId) {
      BuilderState.pushLayout(secId, node.id, prevUnits, nextUnits);
      const deltaXu = (nextUnits.xu ?? 0) - (prevUnits.xu ?? 0);
      const deltaYu = (nextUnits.yu ?? 0) - (prevUnits.yu ?? 0);
      if (
        isContainer &&
        prevChildrenLayouts &&
        prevChildrenLayouts.length &&
        (deltaXu !== 0 || deltaYu !== 0)
      ) {
        for (const entry of prevChildrenLayouts) {
          const prevChildUnits = { ...entry.units };
          const nextChildUnits = {
            ...entry.units,
            xu: (entry.units.xu ?? 0) + deltaXu,
            yu: (entry.units.yu ?? 0) + deltaYu,
          };
          BuilderState.pushLayout(secId, entry.id, prevChildUnits, nextChildUnits);
        }
      }
    }
    prevUnitsRef.current = null;
    prevDescendantsRef.current = null;
  }, [resolveParentUnits, normalizeUnits, node, onUpdateNode, explicitSectionId, section?.id, shiftDescendantUnits, snapshotDescendantUnits]);

  const centerVertically = React.useCallback(() => {
    const parentUnits = resolveParentUnits();
    const nodeUnits = normalizeUnits(node);
    const available = parentUnits.hu - nodeUnits.hu;
    const minYu = parentUnits.yu;
    const maxYu = parentUnits.yu + Math.max(0, available);
    const target = Math.round(parentUnits.yu + Math.max(0, available) / 2);
    const centerYu = Math.max(minYu, Math.min(target, maxYu));

    if (centerYu === nodeUnits.yu) {
      return;
    }

    if (!prevUnitsRef.current) {
      prevUnitsRef.current = { ...nodeUnits };
    }
    const prevUnits = { ...prevUnitsRef.current };
    const nextUnits = { ...nodeUnits, yu: centerYu };

    const isContainer = node.type === 'container';
    const prevChildrenLayouts = isContainer ? snapshotDescendantUnits(node.children) : null;

    onUpdateNode((n) => {
      const normalized = normalizeUnits(n);
      const deltaYu = centerYu - normalized.yu;
      const nextChildren =
        n.type === 'container' && (deltaYu !== 0)
          ? shiftDescendantUnits(n.children, 0, deltaYu)
          : n.children;
      return {
        ...n,
        layout: {
          ...n.layout,
          units: { ...normalized, yu: centerYu },
        },
        children: nextChildren,
      } as Node;
    });

    const secId = explicitSectionId ?? section?.id ?? BuilderState.selection?.sectionId ?? null;
    if (secId) {
      BuilderState.pushLayout(secId, node.id, prevUnits, nextUnits);
      const deltaXu = (nextUnits.xu ?? 0) - (prevUnits.xu ?? 0);
      const deltaYu = (nextUnits.yu ?? 0) - (prevUnits.yu ?? 0);
      if (
        isContainer &&
        prevChildrenLayouts &&
        prevChildrenLayouts.length &&
        (deltaXu !== 0 || deltaYu !== 0)
      ) {
        for (const entry of prevChildrenLayouts) {
          const prevChildUnits = { ...entry.units };
          const nextChildUnits = {
            ...entry.units,
            xu: (entry.units.xu ?? 0) + deltaXu,
            yu: (entry.units.yu ?? 0) + deltaYu,
          };
          BuilderState.pushLayout(secId, entry.id, prevChildUnits, nextChildUnits);
        }
      }
    }
    prevUnitsRef.current = null;
    prevDescendantsRef.current = null;
  }, [resolveParentUnits, normalizeUnits, node, onUpdateNode, explicitSectionId, section?.id, shiftDescendantUnits, snapshotDescendantUnits]);

  return (
    <div className="rounded-lg border p-3 bg-muted/40">
      <div className="text-sm font-semibold mb-2">Position</div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>X</Label>
          <div className="flex items-center gap-2">
            <NumericDragInput
              min={0}
              step={1}
              transformValue={(v) => Number((v).toFixed(3))}
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
                const nextXu = Math.max(0, Math.round(xVal));
                const nodeUnits = normalizeUnits(node);
                const nextUnits = { ...nodeUnits, xu: nextXu };
                const deltaXu = (nextUnits.xu ?? 0) - (prevUnits.xu ?? 0);
                const deltaYu = (nextUnits.yu ?? 0) - (prevUnits.yu ?? 0);
                BuilderState.pushLayout(sectionId, nodeId, prevUnits, nextUnits);
                if (
                  node.type === 'container' &&
                  prevDescendantsRef.current &&
                  (deltaXu !== 0 || deltaYu !== 0)
                ) {
                  for (const entry of prevDescendantsRef.current) {
                    const prevChildUnits = { ...entry.units };
                    const nextChildUnits = {
                      ...entry.units,
                      xu: (entry.units.xu ?? 0) + deltaXu,
                      yu: (entry.units.yu ?? 0) + deltaYu,
                    };
                    BuilderState.pushLayout(sectionId, entry.id, prevChildUnits, nextChildUnits);
                  }
                }
                prevUnitsRef.current = null;
                prevDescendantsRef.current = null;
              }
            }}
            onBlur={() => {
              const sectionId = BuilderState.selection?.sectionId;
              const nodeId = BuilderState.selection?.nodeId;
              if (sectionId && nodeId && prevUnitsRef.current) {
                const prevUnits = { ...prevUnitsRef.current };
                const nextXu = Math.max(0, Math.round(xVal));
                const nodeUnits = normalizeUnits(node);
                const nextUnits = { ...nodeUnits, xu: nextXu };
                const deltaXu = (nextUnits.xu ?? 0) - (prevUnits.xu ?? 0);
                const deltaYu = (nextUnits.yu ?? 0) - (prevUnits.yu ?? 0);
                BuilderState.pushLayout(sectionId, nodeId, prevUnits, nextUnits);
                if (
                  node.type === 'container' &&
                  prevDescendantsRef.current &&
                  (deltaXu !== 0 || deltaYu !== 0)
                ) {
                  for (const entry of prevDescendantsRef.current) {
                    const prevChildUnits = { ...entry.units };
                    const nextChildUnits = {
                      ...entry.units,
                      xu: (entry.units.xu ?? 0) + deltaXu,
                      yu: (entry.units.yu ?? 0) + deltaYu,
                    };
                    BuilderState.pushLayout(sectionId, entry.id, prevChildUnits, nextChildUnits);
                  }
                }
                prevUnitsRef.current = null;
                prevDescendantsRef.current = null;
              }
            }}
            />
            <div className="text-xs text-muted-foreground">units</div>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Y</Label>
          <div className="flex items-center gap-2">
            <NumericDragInput
              min={0}
              step={1}
              transformValue={(v) => Number((v).toFixed(3))}
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
                const nextYu = Math.max(0, Math.round(yVal));
                const nodeUnits = normalizeUnits(node);
                const nextUnits = { ...nodeUnits, yu: nextYu };
                const deltaXu = (nextUnits.xu ?? 0) - (prevUnits.xu ?? 0);
                const deltaYu = (nextUnits.yu ?? 0) - (prevUnits.yu ?? 0);
                BuilderState.pushLayout(sectionId, nodeId, prevUnits, nextUnits);
                if (
                  node.type === 'container' &&
                  prevDescendantsRef.current &&
                  (deltaXu !== 0 || deltaYu !== 0)
                ) {
                  for (const entry of prevDescendantsRef.current) {
                    const prevChildUnits = { ...entry.units };
                    const nextChildUnits = {
                      ...entry.units,
                      xu: (entry.units.xu ?? 0) + deltaXu,
                      yu: (entry.units.yu ?? 0) + deltaYu,
                    };
                    BuilderState.pushLayout(sectionId, entry.id, prevChildUnits, nextChildUnits);
                  }
                }
                prevUnitsRef.current = null;
                prevDescendantsRef.current = null;
              }
            }}
            onBlur={() => {
              const sectionId = BuilderState.selection?.sectionId;
              const nodeId = BuilderState.selection?.nodeId;
              if (sectionId && nodeId && prevUnitsRef.current) {
                const prevUnits = { ...prevUnitsRef.current };
                const nextYu = Math.max(0, Math.round(yVal));
                const nodeUnits = normalizeUnits(node);
                const nextUnits = { ...nodeUnits, yu: nextYu };
                const deltaXu = (nextUnits.xu ?? 0) - (prevUnits.xu ?? 0);
                const deltaYu = (nextUnits.yu ?? 0) - (prevUnits.yu ?? 0);
                BuilderState.pushLayout(sectionId, nodeId, prevUnits, nextUnits);
                if (
                  node.type === 'container' &&
                  prevDescendantsRef.current &&
                  (deltaXu !== 0 || deltaYu !== 0)
                ) {
                  for (const entry of prevDescendantsRef.current) {
                    const prevChildUnits = { ...entry.units };
                    const nextChildUnits = {
                      ...entry.units,
                      xu: (entry.units.xu ?? 0) + deltaXu,
                      yu: (entry.units.yu ?? 0) + deltaYu,
                    };
                    BuilderState.pushLayout(sectionId, entry.id, prevChildUnits, nextChildUnits);
                  }
                }
                prevUnitsRef.current = null;
                prevDescendantsRef.current = null;
              }
            }}
            />
            <div className="text-xs text-muted-foreground">units</div>
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


