// DraggableNode.tsx - Draggable node with grid snapping
import React, { useCallback, useRef, useState } from 'react';
import { pxToUnits, snapToGrid, unitsToPx } from './gridMath';
import { Node } from '@/shared/types/pageV2';

type DragNodeProps = {
  node: Node;
  gridSize: number;
  onCommitLayout: (nodeId: string, units: { xu: number; yu: number }) => void;
  // Optionally provide starting width/height in px for a hover frame, etc.
  defaultSize?: { w?: number; h?: number };
  // For highlighting selection
  selected?: boolean;
  render: (node: Node) => React.ReactNode;
  onSelect?: () => void;
};

export function DraggableNode({
  node,
  gridSize,
  onCommitLayout,
  defaultSize,
  selected,
  render,
  onSelect,
}: DragNodeProps) {
  const [dragging, setDragging] = useState(false);
  const [tempPos, setTempPos] = useState<{ x: number; y: number } | null>(null);
  const startRef = useRef<{ pointerX: number; pointerY: number; x0: number; y0: number } | null>(null);

  const x = node.layout?.px?.x ?? unitsToPx(node.layout?.units.xu ?? 0, gridSize);
  const y = node.layout?.px?.y ?? unitsToPx(node.layout?.units.yu ?? 0, gridSize);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const el = (e.currentTarget.parentElement as HTMLElement); // the absolute wrapper
    if (!el.parentElement) return;
    const rect = el.parentElement.getBoundingClientRect();
    const pointerX = e.clientX - rect.left;
    const pointerY = e.clientY - rect.top;
    startRef.current = { pointerX, pointerY, x0: x, y0: y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    onSelect?.();
    e.stopPropagation();
  }, [x, y]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging || !startRef.current) return;
    const el = (e.currentTarget.parentElement as HTMLElement);
    if (!el.parentElement) return;
    const rect = el.parentElement.getBoundingClientRect();
    const pointerX = e.clientX - rect.left;
    const pointerY = e.clientY - rect.top;
    const dx = pointerX - startRef.current.pointerX;
    const dy = pointerY - startRef.current.pointerY;
    setTempPos({ x: startRef.current.x0 + dx, y: startRef.current.y0 + dy });
    e.stopPropagation();
  }, [dragging]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging || !startRef.current) return;
    const finalX = snapToGrid((tempPos?.x ?? x), gridSize);
    const finalY = snapToGrid((tempPos?.y ?? y), gridSize);
    const xu = pxToUnits(finalX, gridSize);
    const yu = pxToUnits(finalY, gridSize);

    onCommitLayout(node.id, { xu, yu });

    setDragging(false);
    setTempPos(null);
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    startRef.current = null;
    e.stopPropagation();
  }, [dragging, gridSize, tempPos, x, y, node.id, onCommitLayout]);

  // Position to render (during drag show temp, otherwise snap)
  const renderX = tempPos?.x ?? x;
  const renderY = tempPos?.y ?? y;

  return (
    <div
      className="absolute"
      style={{
        left: renderX,
        top: renderY,
        width: defaultSize?.w,
        height: defaultSize?.h,
        transform: 'translateZ(0)', // GPU hint
      }}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className={`cursor-move select-none ${selected ? 'ring-2 ring-blue-500' : ''} ${dragging ? 'opacity-70' : ''}`}
      >
        {render(node)}
      </div>
    </div>
  );
}
