// DraggableNode.tsx - Draggable node with grid snapping
import React, { useCallback, useRef, useState } from 'react';
import { Node } from '@/shared/types/pageV2';
import { BuilderState, ResizeHandle } from '@/features/webeditor/state/BuilderState';
import { VirtualTransform } from './virtualGrid';

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
  transform: VirtualTransform;
  onCommitLayout: (nodeId: string, units: Partial<{ xu: number; yu: number; wu: number; hu: number }>) => void;
  defaultSize?: { w?: number; h?: number };
  selected?: boolean;
  render: (node: Node) => React.ReactNode;
  onSelect?: () => void;
  onDoubleSelect?: () => void;
  containerId?: string;
  enforceChildFullSize?: boolean;
  allowContentPointerEvents?: boolean;
  disabled?: boolean;
};

export function DraggableNode({
  sectionId,
  node,
  transform,
  onCommitLayout,
  defaultSize,
  selected,
  render,
  onSelect,
  onDoubleSelect,
  containerId,
  enforceChildFullSize,
  allowContentPointerEvents,
  disabled,
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

  const { x, y, w: baseWidth, h: baseHeight } = transform.toPx(node.layout?.units ?? { xu: 0, yu: 0 });

  const applyParentOutline = useCallback((edges: { top: boolean; right: boolean; bottom: boolean; left: boolean } | null) => {
    if (!containerId) return;
    const parentEl = document.getElementById(containerId);
    if (!parentEl) return;
    if (edges && (edges.top || edges.right || edges.bottom || edges.left)) {
      (parentEl.style as any).boxShadow = 'inset 0 0 0 2px #ef4444';
    } else {
      (parentEl.style as any).boxShadow = '';
    }
  }, [containerId]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return; // disable interactions
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
  }, [isEditing, x, y, onSelect, disabled]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
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

      if (containerId) {
        const parentEl = document.getElementById(containerId);
        if (parentEl) {
          const contentEl = document.getElementById(`section-content-${sectionId}`) || parentEl;
          const contentRect = contentEl.getBoundingClientRect();
          const parentRect = parentEl.getBoundingClientRect();
          const parentPx = {
            x: parentRect.left - contentRect.left,
            y: parentRect.top - contentRect.top,
            w: parentRect.width,
            h: parentRect.height,
          };
          const parentUnits = transform.toUnits({ ...parentPx, w: parentPx.w, h: parentPx.h });
          const { xu: nxu, yu: nyu, wu: nwu, hu: nhu } = transform.toUnits({ x: nx, y: ny, w: nw, h: nh });
          const clampedUnits = {
            xu: Math.max(0, Math.min(nxu, parentUnits.wu - nwu)),
            yu: parentUnits.hu > nhu ? Math.max(0, Math.min(nyu, parentUnits.hu - nhu)) : nyu,
            wu: nwu,
            hu: nhu,
          };
          const clampedPx = transform.toPx(clampedUnits);
          nx = clampedPx.x;
          ny = clampedPx.y;

          // Edge contact detection for resize case
          const tol = 0.5;
          const edges = {
            left: nx <= tol,
            top: ny <= tol,
            right: Math.abs(nx + nw - parentPx.w) <= tol,
            bottom: parentUnits.hu > nhu ? Math.abs(ny + nh - parentPx.h) <= tol : false,
          } as const;
          if (BuilderState.setEdgeContact) BuilderState.setEdgeContact(containerId, { top: edges.top, right: edges.right, bottom: edges.bottom, left: edges.left });
          applyParentOutline(edges);
        }
      }

      setTempPos({ x: nx, y: ny });
      setTempSize({ w: nw, h: nh });
      e.stopPropagation();
      return;
    }

    const rawX = startRef.current.x0 + dx;
    const rawY = startRef.current.y0 + dy;

    const tentativeUnits = transform.toUnits({ x: rawX, y: rawY, w: startRef.current.w0, h: startRef.current.h0 });
    let xu = tentativeUnits.xu;
    let yu = tentativeUnits.yu;

    if (containerId && startRef.current) {
      const parentEl = document.getElementById(containerId);
      if (parentEl) {
        const contentEl = document.getElementById(`section-content-${sectionId}`) || parentEl;
        const contentRect = contentEl.getBoundingClientRect();
        const parentRect = parentEl.getBoundingClientRect();
        const parentPx = {
          x: parentRect.left - contentRect.left,
          y: parentRect.top - contentRect.top,
          w: parentRect.width,
          h: parentRect.height,
        };
        const parentUnits = transform.toUnits({ ...parentPx, w: parentPx.w, h: parentPx.h });
        const wu = node.layout?.units?.wu ?? Math.round(startRef.current.w0 / transform.cellPx);
        const hu = node.layout?.units?.hu ?? Math.round(startRef.current.h0 / transform.cellPx);
        
        xu = Math.max(0, Math.min(xu, parentUnits.wu - wu));
        if (parentUnits.hu > hu) {
          yu = Math.max(0, Math.min(yu, parentUnits.hu - hu));
        }

        // Edge contact detection for move case
        const snappedPx = transform.toPx({ xu, yu, wu, hu });
        const tol = 0.5;
        const edges = {
          left: snappedPx.x <= tol,
          top: snappedPx.y <= tol,
          right: Math.abs(snappedPx.x + snappedPx.w! - parentPx.w) <= tol,
          bottom: parentUnits.hu > hu ? Math.abs(snappedPx.y + snappedPx.h! - parentPx.h) <= tol : false,
        } as const;
        if (BuilderState.setEdgeContact) BuilderState.setEdgeContact(containerId, { top: edges.top, right: edges.right, bottom: edges.bottom, left: edges.left });
        applyParentOutline(edges);
      }
    }

    const snappedPx = transform.toPx({ xu, yu, wu: startRef.current.w0 / transform.cellPx, hu: startRef.current.h0 / transform.cellPx });
    setTempPos({ x: snappedPx.x, y: snappedPx.y });
    e.stopPropagation();
  }, [dragging, transform, containerId, sectionId, disabled, applyParentOutline, node.layout?.units]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    if (!dragging || !startRef.current) return;

    if (resizeRef.current) {
      const nx = tempPos?.x ?? startRef.current.x0;
      const ny = tempPos?.y ?? startRef.current.y0;
      const w = tempSize?.w ?? startRef.current.w0;
      const h = tempSize?.h ?? startRef.current.h0;
      
      let { xu, yu, wu, hu } = transform.toUnits({ x: nx, y: ny, w, h });

      if (containerId) {
        const parentEl = document.getElementById(containerId);
        if (parentEl) {
          const contentEl = document.getElementById(`section-content-${sectionId}`) || parentEl;
          const contentRect = contentEl.getBoundingClientRect();
          const parentRect = parentEl.getBoundingClientRect();
          const parentPx = {
            x: parentRect.left - contentRect.left,
            y: parentRect.top - contentRect.top,
            w: parentRect.width,
            h: parentRect.height,
          };
          const parentUnits = transform.toUnits({ ...parentPx, w: parentPx.w, h: parentPx.h });
          wu = Math.max(1, Math.min(wu, parentUnits.wu));
          hu = Math.max(1, Math.min(hu, parentUnits.hu));
          xu = Math.max(0, Math.min(xu, parentUnits.wu - wu));
          if (parentUnits.hu > hu) {
            yu = Math.max(0, Math.min(yu, parentUnits.hu - hu));
          }
        }
      }

      onCommitLayout(node.id, { xu, yu, wu, hu });
      resizeRef.current = null;
      setTempSize(null);
      setDragging(false);
      setTempPos(null);
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      startRef.current = null;
      BuilderState.stopResizing();
      BuilderState.stopDragging();
      if (containerId) {
        if (BuilderState.clearEdgeContact) BuilderState.clearEdgeContact(containerId);
        applyParentOutline(null);
      }
      e.stopPropagation();
      return;
    }

    if (!tempPos) return;
    
    const finalPxRect = {
      x: tempPos.x,
      y: tempPos.y,
      w: tempSize?.w ?? startRef.current.w0,
      h: tempSize?.h ?? startRef.current.h0,
    };
    let { xu, yu } = transform.toUnits(finalPxRect);

    if (containerId && startRef.current) {
      const parentEl = document.getElementById(containerId);
      if (parentEl) {
        const contentEl = document.getElementById(`section-content-${sectionId}`) || parentEl;
        const contentRect = contentEl.getBoundingClientRect();
        const parentRect = parentEl.getBoundingClientRect();
        const parentPx = {
          x: parentRect.left - contentRect.left,
          y: parentRect.top - contentRect.top,
          w: parentRect.width,
          h: parentRect.height,
        };
        const parentUnits = transform.toUnits({ ...parentPx, w: parentPx.w, h: parentPx.h });
        const nodeWu = Math.round(startRef.current.w0 / transform.cellPx);
        const nodeHu = Math.round(startRef.current.h0 / transform.cellPx);
        xu = Math.max(0, Math.min(xu, parentUnits.wu - nodeWu));
        if (parentUnits.hu > nodeHu) {
          yu = Math.max(0, Math.min(yu, parentUnits.hu - nodeHu));
        }
      }
    }

    onCommitLayout(node.id, { xu, yu });
    setDragging(false);
    setTempPos(null);
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    startRef.current = null;
    BuilderState.stopDragging();
    if (containerId) {
      if (BuilderState.clearEdgeContact) BuilderState.clearEdgeContact(containerId);
      applyParentOutline(null);
    }
    if (dragging) {
      e.preventDefault();
    }
    e.stopPropagation();
  }, [dragging, transform, tempPos, tempSize, node.id, onCommitLayout, containerId, sectionId, disabled, applyParentOutline]);

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
  }, [dragging, onPointerMove, isEditing, transform, sectionId]);

  const onWrapperPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging && pressedRef.current) {
      // simple click -> just select, no drag
      pressedRef.current = false;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      e.stopPropagation();
      BuilderState.stopDragging();
      if (containerId) {
        if (BuilderState.clearEdgeContact) BuilderState.clearEdgeContact(containerId);
        applyParentOutline(null);
      }
      return;
    }
    pressedRef.current = false;
    onPointerUp(e);
  }, [dragging, onPointerUp, containerId, applyParentOutline]);

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
        pointerEvents: disabled ? 'auto' : undefined,
        cursor: disabled ? 'default' : undefined,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onWrapperPointerMove}
      onPointerUp={onWrapperPointerUp}
        onClick={(e) => {
          // Prevent click bubbling to parent containers which would select the container instead
          e.stopPropagation();
        if (!disabled) onSelect?.();
        }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (!disabled) {
          BuilderState.startEditing(sectionId, node.id);
          onDoubleSelect?.();
        }
      }}
      data-draggable="true"
    >
      <div
        className={enforceChildFullSize ? 'w-full h-full' : undefined}
        style={{
          pointerEvents: disabled ? ('auto' as const) : ((isEditing || allowContentPointerEvents) ? ('auto' as const) : ('none' as const)),
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
