// DraggableNode.tsx - Draggable node with grid snapping
import React, { useCallback, useRef, useState } from 'react';
import { pxToUnits, unitsToPx, edgeSnap } from './gridMath';
import { Node } from '@/shared/types/pageV2';
import { BuilderState, ResizeHandle } from '@/features/webeditor/state/BuilderState';

function mergeClassNames(...classes: Array<string | undefined | null | false>) {
  return classes.filter(Boolean).join(' ');
}

function enforceFullSize(content: React.ReactNode): React.ReactNode {
  // If content is a Fragment, promote its element children to fill and wrap for stable measurement
  if (React.isValidElement(content) && (content as any).type === React.Fragment) {
    const children = React.Children.toArray((content as any).props?.children ?? []);
    const filled = children.map((child) => {
      if (!React.isValidElement<any>(child)) return child;
      const existingStyle: any = (child.props && (child.props as any).style) || {};
      const existingClass: any = (child.props && (child.props as any).className) || '';
      const mergedStyle: React.CSSProperties = {
        ...existingStyle,
        width: (existingStyle as any).width ?? '100%',
        height: (existingStyle as any).height ?? '100%',
      };
      const mergedClassName = mergeClassNames(existingClass, 'block', 'w-full', 'h-full');
      return React.cloneElement(child as React.ReactElement<any>, { className: mergedClassName, style: mergedStyle } as any);
    });
    return (
      <div className="block w-full h-full" style={{ width: '100%', height: '100%' }}>
        {filled}
      </div>
    );
  }
  // Non-element -> wrap
  if (!React.isValidElement(content)) {
    return (
      <div className="block w-full h-full" style={{ width: '100%', height: '100%' }}>
        {content}
      </div>
    );
  }
  // Regular element -> clone with full-size
  const element: React.ReactElement<any> = content as React.ReactElement<any>;
  const existingStyle = (element.props && element.props.style) || {};
  const existingClass = (element.props && element.props.className) || '';
  const mergedStyle: React.CSSProperties = {
    ...existingStyle,
    width: (existingStyle as any).width ?? '100%',
    height: (existingStyle as any).height ?? '100%',
  };
  const mergedClassName = mergeClassNames(existingClass, 'block', 'w-full', 'h-full');
  return React.cloneElement(element, { className: mergedClassName, style: mergedStyle });
}

type DragNodeProps = {
  sectionId: string;
  node: Node;
  gridSize: number;
  onCommitLayout: (nodeId: string, units: Partial<{ xu: number; yu: number; wu: number; hu: number }>) => void;
  // Optionally provide starting width/height in px for a hover frame, etc.
  defaultSize?: { w?: number; h?: number };
  // For highlighting selection
  selected?: boolean;
  render: (node: Node) => React.ReactNode;
  onSelect?: () => void;
  onDoubleSelect?: () => void;
  containerId?: string;
  enforceChildFullSize?: boolean;
  // When true, allow pointer events to reach rendered content (needed for containers with draggable children)
  allowContentPointerEvents?: boolean;
};

export function DraggableNode({
  sectionId,
  node,
  gridSize,
  onCommitLayout,
  defaultSize,
  selected,
  render,
  onSelect,
  onDoubleSelect,
  containerId,
  enforceChildFullSize,
  allowContentPointerEvents,
}: DragNodeProps) {
  const [dragging, setDragging] = useState(false);
  const [tempPos, setTempPos] = useState<{ x: number; y: number } | null>(null);
  const [tempSize, setTempSize] = useState<{ w: number; h: number } | null>(null);
  const startRef = useRef<{ pointerX: number; pointerY: number; x0: number; y0: number; w0: number; h0: number } | null>(null);
  const resizeRef = useRef<
    | null
    | {
        mode: ResizeHandle;
        startX: number;
        startY: number;
        x0: number;
        y0: number;
        w0: number;
        h0: number;
      }
  >(null);
  const pressedRef = useRef<boolean>(false);

  const activeEditing = BuilderState.editing;
  const isEditing = activeEditing?.sectionId === sectionId && activeEditing?.nodeId === node.id;

  const cachedLayout = BuilderState.getNodePixelLayout(node.id);
  const x = cachedLayout?.x ?? node.layout?.px?.x ?? unitsToPx(node.layout?.units.xu ?? 0, gridSize);
  const y = cachedLayout?.y ?? node.layout?.px?.y ?? unitsToPx(node.layout?.units.yu ?? 0, gridSize);
  const baseWidth = cachedLayout?.w ?? node.layout?.px?.w ?? (node.layout?.units.wu ? unitsToPx(node.layout.units.wu, gridSize) : undefined);
  const baseHeight = cachedLayout?.h ?? node.layout?.px?.h ?? (node.layout?.units.hu ? unitsToPx(node.layout.units.hu, gridSize) : undefined);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (isEditing) return; // Disable drag when editing text
    const wrapper = e.currentTarget as HTMLElement;
    // Measure actual child box instead of wrapper which includes outlines/handles
    const child = wrapper.firstElementChild as HTMLElement | null;
    const innerRect = (child ?? wrapper).getBoundingClientRect();
    const parent = wrapper.offsetParent as HTMLElement | null;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const pointerX = e.clientX - rect.left;
    const pointerY = e.clientY - rect.top;
    startRef.current = { pointerX, pointerY, x0: x, y0: y, w0: innerRect.width, h0: innerRect.height };
    setTempSize(null);
    wrapper.setPointerCapture(e.pointerId);
    pressedRef.current = true;
    onSelect?.();
    e.stopPropagation();
  }, [isEditing, x, y, onSelect]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging || !startRef.current) return;
    const wrapper = e.currentTarget as HTMLElement;
    const container = wrapper.offsetParent as HTMLElement | null;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const pointerX = e.clientX - containerRect.left;
    const pointerY = e.clientY - containerRect.top;
      const dx = pointerX - startRef.current.pointerX;
      const dy = pointerY - startRef.current.pointerY;

    // If resizing, keep opposite edges pinned and do NOT snap while dragging
    if (resizeRef.current) {
      const { mode, x0, y0, w0, h0 } = resizeRef.current;
      let nx = x0;
      let ny = y0;
      let nw = w0;
      let nh = h0;
      if (mode.includes('e')) nw = Math.max(8, w0 + dx);
      if (mode.includes('s')) nh = Math.max(8, h0 + dy);
      if (mode.includes('w')) { nx = x0 + dx; nw = Math.max(8, w0 - dx); }
      if (mode.includes('n')) { ny = y0 + dy; nh = Math.max(8, h0 - dy); }

      // Clamp within container while dragging
      if (containerId) {
        const parentEl = document.getElementById(containerId);
        if (parentEl) {
          const parentRect = parentEl.getBoundingClientRect();
          const parentWidth = parentRect.width;
          const parentHeight = parentRect.height;
          nx = Math.max(0, Math.min(nx, parentWidth - nw));
          // Only clamp Y if the container is taller than the element; otherwise keep relative Y
          if (parentHeight > nh) {
            ny = Math.max(0, Math.min(ny, parentHeight - nh));
          }
        }
      }

      setTempPos({ x: nx, y: ny });
      setTempSize({ w: nw, h: nh });
      e.stopPropagation();
      return;
    }

    const rawX = startRef.current.x0 + dx;
    const rawY = startRef.current.y0 + dy;
    let snappedX = edgeSnap(rawX, startRef.current.w0, gridSize);
    let snappedY = edgeSnap(rawY, startRef.current.h0, gridSize);

    if (containerId && startRef.current) {
      const parentEl = document.getElementById(containerId);
      if (parentEl) {
        const parentRect = parentEl.getBoundingClientRect();
        const parentWidth = parentRect.width;
        const parentHeight = parentRect.height;
        snappedX = Math.max(0, Math.min(snappedX, parentWidth - startRef.current.w0));
        if (parentHeight > startRef.current.h0) {
          snappedY = Math.max(0, Math.min(snappedY, parentHeight - startRef.current.h0));
        }
      }
    }

    setTempPos({ x: snappedX, y: snappedY });
    e.stopPropagation();
  }, [dragging, gridSize, containerId]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging || !startRef.current) return;

    if (resizeRef.current) {
      const nx = tempPos?.x ?? startRef.current.x0;
      const ny = tempPos?.y ?? startRef.current.y0;
      const w = tempSize?.w ?? startRef.current.w0;
      const h = tempSize?.h ?? startRef.current.h0;
      let xu = pxToUnits(nx, gridSize);
      let yu = pxToUnits(ny, gridSize);
      let wu = pxToUnits(w, gridSize);
      let hu = pxToUnits(h, gridSize);

    if (containerId) {
      const parentEl = document.getElementById(containerId);
      if (parentEl) {
        const parentRect = parentEl.getBoundingClientRect();
        const parentWidth = parentRect.width / gridSize;
        const parentHeight = parentRect.height / gridSize;
        wu = Math.max(1, Math.min(wu, parentWidth));
        hu = Math.max(1, Math.min(hu, parentHeight));
        xu = Math.max(0, Math.min(xu, parentWidth - wu));
        if (parentHeight > hu) {
          yu = Math.max(0, Math.min(yu, parentHeight - hu));
        }
        }
      }

      onCommitLayout(node.id, { xu, yu, wu, hu });
      BuilderState.setNodePixelLayout(sectionId, node.id, { x: nx, y: ny, w, h });
      resizeRef.current = null;
      setTempSize(null);
      setDragging(false);
      setTempPos(null);
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      startRef.current = null;
      BuilderState.stopResizing();
      BuilderState.stopDragging();
      e.stopPropagation();
      return;
    }

    if (!tempPos) return;
    let xu = pxToUnits(tempPos.x, gridSize);
    let yu = pxToUnits(tempPos.y, gridSize);

    if (containerId && startRef.current) {
      const parentEl = document.getElementById(containerId);
      if (parentEl) {
        const parentRect = parentEl.getBoundingClientRect();
        const parentWidth = parentRect.width / gridSize;  // in units
        const parentHeight = parentRect.height / gridSize;
        const nodeWu = startRef.current.w0 / gridSize;
        const nodeHu = startRef.current.h0 / gridSize;
        xu = Math.max(0, Math.min(xu, parentWidth - nodeWu));
        if (parentHeight > nodeHu) {
          yu = Math.max(0, Math.min(yu, parentHeight - nodeHu));
        }
      }
    }

    onCommitLayout(node.id, { xu, yu });
    BuilderState.setNodePixelLayout(sectionId, node.id, { x: tempPos.x, y: tempPos.y, w: tempSize?.w ?? startRef.current.w0, h: tempSize?.h ?? startRef.current.h0 });
    setDragging(false);
    setTempPos(null);
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    startRef.current = null;
    BuilderState.stopDragging();
    if (dragging) {
      e.preventDefault();
    }
    e.stopPropagation();
  }, [dragging, gridSize, tempPos, node.id, onCommitLayout, containerId]);

  // Position to render (during drag show temp, otherwise snap)
  const renderX = tempPos?.x ?? x;
  const renderY = tempPos?.y ?? y;
  const renderW = tempSize?.w ?? baseWidth ?? defaultSize?.w;
  const renderH = tempSize?.h ?? baseHeight ?? defaultSize?.h;

  // Activate dragging or resizing only after small movement threshold
  const onWrapperPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!startRef.current) return;
    if (!isEditing && !dragging && pressedRef.current && !resizeRef.current) {
      const dx = e.clientX - (startRef.current.pointerX + (e.currentTarget.offsetParent as HTMLElement).getBoundingClientRect().left - (e.currentTarget.offsetParent as HTMLElement).getBoundingClientRect().left);
      const dy = e.clientY - (startRef.current.pointerY + 0);
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist > 3) {
        setDragging(true);
        BuilderState.startDragging(node.id);
      }
    }
    if (!isEditing) onPointerMove(e);
  }, [dragging, onPointerMove, isEditing]);

  const onWrapperPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging && pressedRef.current) {
      // simple click -> just select, no drag
      pressedRef.current = false;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      e.stopPropagation();
      BuilderState.stopDragging();
      return;
    }
    pressedRef.current = false;
    onPointerUp(e);
  }, [dragging, onPointerUp]);

  const renderedContent = enforceChildFullSize ? enforceFullSize(render(node)) : render(node);

  return (
    <div
      className={`absolute ${dragging ? 'select-none' : ''}`}
      style={{
        left: renderX,
        top: renderY,
        width: renderW,
        height: renderH,
        transform: 'translateZ(0)', // GPU hint
        zIndex: dragging ? 60 : (selected ? 50 : 10),
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onWrapperPointerMove}
      onPointerUp={onWrapperPointerUp}
        onClick={(e) => {
          // Prevent click bubbling to parent containers which would select the container instead
          e.stopPropagation();
          onSelect?.();
        }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        BuilderState.startEditing(sectionId, node.id);
        onDoubleSelect?.();
      }}
      data-draggable="true"
    >
      <div
        className={enforceChildFullSize ? 'w-full h-full' : undefined}
        style={{
          pointerEvents: (isEditing || allowContentPointerEvents) ? ('auto' as const) : ('none' as const),
          userSelect: isEditing ? ('text' as const) : ('none' as const),
          width: enforceChildFullSize ? '100%' : undefined,
          height: enforceChildFullSize ? '100%' : undefined,
        }}
        onBlur={() => BuilderState.stopEditing(sectionId, node.id)}
      >
        {renderedContent}
      </div>
      {/* True selection outline (no ring classes) */}
      {selected && !isEditing && (
        <div className="absolute inset-0 border border-blue-500 pointer-events-none" />
      )}
      {/* Resize handles */}
      {selected && !isEditing && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          {['n','s','e','w','ne','nw','se','sw'].map((dir) => {
            const style: React.CSSProperties = {};
            let cursor = 'default';
            if (dir === 'n' || dir === 's') cursor = 'ns-resize';
            if (dir === 'e' || dir === 'w') cursor = 'ew-resize';
            if (dir === 'nw' || dir === 'se') cursor = 'nwse-resize';
            if (dir === 'ne' || dir === 'sw') cursor = 'nesw-resize';

            // Edge hit areas leave a gap for corner boxes so corners get priority/correct cursor
            if (dir === 'n') { style.top = -3; style.left = 6; style.right = 6; style.height = 6; }
            if (dir === 's') { style.bottom = -3; style.left = 6; style.right = 6; style.height = 6; }
            if (dir === 'w') { style.left = -3; style.top = 6; style.bottom = 6; style.width = 6; }
            if (dir === 'e') { style.right = -3; style.top = 6; style.bottom = 6; style.width = 6; }

            if (dir === 'nw') { style.top = -6; style.left = -6; style.width = 12; style.height = 12; }
            if (dir === 'ne') { style.top = -6; style.right = -6; style.width = 12; style.height = 12; }
            if (dir === 'sw') { style.bottom = -6; style.left = -6; style.width = 12; style.height = 12; }
            if (dir === 'se') { style.bottom = -6; style.right = -6; style.width = 12; style.height = 12; }

            const isCorner = dir.length === 2;

            return (
              <div
                key={dir}
                className="absolute pointer-events-auto"
                style={{
                  ...style,
                  cursor,
                  backgroundColor: isCorner ? '#ffffff' : 'rgba(59,130,246,0.15)',
                  border: isCorner ? '1px solid #3b82f6' : 'none',
                  borderRadius: isCorner ? 2 : 0,
                  zIndex: isCorner ? 2 : 1,
                }}
                onPointerDown={(e) => {
                  const wrapper = e.currentTarget.parentElement?.parentElement as HTMLElement | null;
                  if (!wrapper) return;
                  const offsetParent = wrapper.offsetParent as HTMLElement | null;
                  if (!offsetParent) return;
                  const rect = wrapper.getBoundingClientRect();
                  const parentRect = offsetParent.getBoundingClientRect();
                  resizeRef.current = {
                    mode: dir as ResizeHandle,
                    startX: e.clientX,
                    startY: e.clientY,
                    x0: rect.left - parentRect.left,
                    y0: rect.top - parentRect.top,
                    w0: rect.width,
                    h0: rect.height,
                  };
                  startRef.current = {
                    pointerX: e.clientX - parentRect.left,
                    pointerY: e.clientY - parentRect.top,
                    x0: resizeRef.current.x0,
                    y0: resizeRef.current.y0,
                    w0: rect.width,
                    h0: rect.height,
                  };
                  BuilderState.startResizing(sectionId, node.id, dir as ResizeHandle);
                  wrapper.setPointerCapture(e.pointerId);
                  pressedRef.current = true;
                  setDragging(true);
                  setTempPos({ x: resizeRef.current.x0, y: resizeRef.current.y0 });
                  setTempSize({ w: rect.width, h: rect.height });
                  e.stopPropagation();
                }}
                onPointerUp={(e) => {
                  (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                }}
              />
            );
          })}
        </div>
      )}
      {selected && isEditing && (
        <div className="absolute inset-0 border border-blue-500 pointer-events-none" />
      )}
    </div>
  );
}
