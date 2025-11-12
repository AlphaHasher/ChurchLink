// DraggableNode.tsx - Draggable node with grid snapping
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Node } from '@/shared/types/pageV2';
import { BuilderState, ResizeHandle } from '@/features/webeditor/state/BuilderState';
import { VirtualTransform } from './virtualGrid';

/**
 * Combine multiple class name values into a single space-separated string.
 *
 * @param classes - One or more class name values; falsy values (undefined, null, false, empty string) are ignored
 * @returns The concatenated class names separated by single spaces
 */
function mergeClassNames(...classes: Array<string | undefined | null | false>) {
  return classes.filter(Boolean).join(' ');
}

/**
 * Ensure a React node occupies the full width and height of its container.
 *
 * When given a Fragment, applies full-size classes/styles to element children and wraps them in a full-size container; when given a non-element value, wraps it in a full-size container; when given a React element, returns a cloned element with width/height set to 100% and full-size utility classes merged with existing classes.
 *
 * @param content - The React node to enforce full-size on
 * @returns A React node guaranteed to render with 100% width and height (preserving and merging existing `className` and `style`)
 */
function enforceFullSize(content: React.ReactNode): React.ReactNode {
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
  parentUnits?: { xu: number; yu: number; wu: number; hu: number };
  originPx?: { x: number; y: number };
  enforceChildFullSize?: boolean;
  allowContentPointerEvents?: boolean;
  disabled?: boolean;
  cssScale?: number; // when parent canvas is CSS-scaled (e.g., slide-scaling), compensate pointer math
};

/**
 * Render an interactive, grid-aware draggable and resizable node inside a section.
 *
 * Renders the node at its transformed position and size, provides pointer handlers for click, drag and resize,
 * enforces container bounds and optional child full-size behavior, and reports finalized layout changes
 * via `onCommitLayout`.
 *
 * @param sectionId - ID of the section that contains this node.
 * @param node - The node data to render (position, size, type, id).
 * @param transform - VirtualTransform used to convert between grid units and pixels and to obtain grid metrics.
 * @param onCommitLayout - Callback invoked with final layout ({ xu, yu, wu?, hu? }) when a drag or resize completes.
 * @param defaultSize - Fallback size (pixels) used when the node has no layout.
 * @param selected - Whether the node is currently selected (affects outlines and handles).
 * @param render - Function that receives `node` and returns the node's React content.
 * @param onSelect - Optional callback invoked when the node is selected (click).
 * @param onDoubleSelect - Optional callback invoked on double-click (also triggers editing).
 * @param containerId - Optional parent container element ID; used to clamp movement/resizing and to compute edge contacts.
 * @param parentUnits - Optional integer unit bounds of the parent container to use instead of reading live DOM.
 * @param originPx - Optional origin offset in pixels to override measured origin (useful for fixed origins or tests).
 * @param enforceChildFullSize - When true, wraps child content so it always fills the node's width/height.
 * @param allowContentPointerEvents - When true allows pointer events on the node's content even when not editing.
 * @param disabled - When true disables dragging, resizing, and editing interactions.
 * @param cssScale - CSS scale factor applied to the canvas; used to compensate pointer math and sizing.
 * @returns A JSX element that renders the node with interactive drag/resize behavior and visual indicators.
 */
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
  parentUnits,
  originPx,
  enforceChildFullSize,
  allowContentPointerEvents,
  disabled,
  cssScale = 1,
}: DragNodeProps) {
  const [dragging, setDragging] = useState(false);
  const [tempPos, setTempPos] = useState<{ x: number; y: number } | null>(null);
  const [tempSize, setTempSize] = useState<{ w: number; h: number } | null>(null);
  const startRef = useRef<{ pointerX: number; pointerY: number; x0: number; y0: number; w0: number; h0: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [measuredOrigin, setMeasuredOrigin] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [autoScale, setAutoScale] = useState<number>(1);
  const subscribeSelfEdgeContact = useCallback(
    (listener: () => void) =>
      BuilderState.onEdgeContactChange((payload) => {
        if (!payload || payload.containerId === node.id) listener();
      }),
    [node.id]
  );
  const getSelfEdgeContactSnapshot = useCallback(
    () => BuilderState.edgeContacts.get(node.id) ?? null,
    [node.id]
  );
  const selfEdgeContact = useSyncExternalStore(
    subscribeSelfEdgeContact,
    getSelfEdgeContactSnapshot,
    () => null
  );
  const subscribeParentEdgeContact = useCallback(
    (listener: () => void) => {
      if (!containerId) return () => {};
      return BuilderState.onEdgeContactChange((payload) => {
        if (!payload || payload.containerId === containerId) listener();
      });
    },
    [containerId]
  );
  const getParentEdgeContactSnapshot = useCallback(
    () => (containerId ? BuilderState.edgeContacts.get(containerId) ?? null : null),
    [containerId]
  );
  const parentEdgeContact = useSyncExternalStore(
    subscribeParentEdgeContact,
    getParentEdgeContactSnapshot,
    () => null
  );
  const hasSelfEdgeContact = Boolean(
    selfEdgeContact && (selfEdgeContact.top || selfEdgeContact.right || selfEdgeContact.bottom || selfEdgeContact.left)
  );
  const hasParentEdgeContact = Boolean(
    parentEdgeContact && (parentEdgeContact.top || parentEdgeContact.right || parentEdgeContact.bottom || parentEdgeContact.left)
  );
  useEffect(() => {
    if (!containerId) return;
    const parentEl = document.getElementById(containerId);
    if (!parentEl) return;
    if (parentEl.dataset?.draggable === 'true') return;
    const prevOutline = parentEl.style.outline;
    const prevOutlineOffset = parentEl.style.outlineOffset;
    if (hasParentEdgeContact) {
      parentEl.style.outline = '2px solid #ef4444';
      parentEl.style.outlineOffset = '-1px';
    } else {
      parentEl.style.outline = prevOutline;
      parentEl.style.outlineOffset = prevOutlineOffset;
    }
    return () => {
      const activeEdges = BuilderState.edgeContacts.get(containerId);
      const stillActive =
        !!activeEdges && (activeEdges.top || activeEdges.right || activeEdges.bottom || activeEdges.left);
      if (!stillActive) {
        parentEl.style.outline = prevOutline;
        parentEl.style.outlineOffset = prevOutlineOffset;
      }
    };
  }, [containerId, hasParentEdgeContact]);
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
  const draggingNodeId = useSyncExternalStore(
    (listener) => BuilderState.subscribe(listener),
    () => BuilderState.draggingNodeId,
    () => BuilderState.draggingNodeId
  );

  useLayoutEffect(() => {
    if (containerId && draggingNodeId && draggingNodeId !== node.id) {
      return;
    }
    if (originPx) {
      setMeasuredOrigin(originPx);
      setAutoScale(1);
      return;
    }
    const el = wrapperRef.current;
    const content = document.getElementById(`section-content-${sectionId}`);
    if (!el || !content) {
      setMeasuredOrigin({ x: 0, y: 0 });
      setAutoScale(1);
      return;
    }
    const offsetParent = el.offsetParent as HTMLElement | null;
    if (!offsetParent) {
      setMeasuredOrigin({ x: 0, y: 0 });
      setAutoScale(1);
      return;
    }
    const pRect = offsetParent.getBoundingClientRect();
    const cRect = content.getBoundingClientRect();
    setMeasuredOrigin({ x: (pRect.left - cRect.left) / cssScale, y: (pRect.top - cRect.top) / cssScale });

    try {
      const isSectionRoot = offsetParent.id === `section-content-${sectionId}`;
      let gridParentWidthPx = transform.cols * transform.cellPx;
      if (!isSectionRoot) {
        const parentUnits = transform.toUnits({
          x: (pRect.left - cRect.left),
          y: (pRect.top - cRect.top),
          w: pRect.width,
          h: pRect.height,
        });
        gridParentWidthPx = parentUnits.wu * transform.cellPx;
      }
      const domParentWidthPx = pRect.width;
      const nextScale = gridParentWidthPx > 0 ? (domParentWidthPx / gridParentWidthPx) : 1;
      setAutoScale(Number.isFinite(nextScale) && nextScale > 0 ? nextScale : 1);
    } catch {
      setAutoScale(1);
    }
    // Also watch for parent size changes
    const ro = new ResizeObserver(() => {
      const pRect2 = offsetParent.getBoundingClientRect();
      const cRect2 = content.getBoundingClientRect();
      setMeasuredOrigin({ x: (pRect2.left - cRect2.left) / cssScale, y: (pRect2.top - cRect2.top) / cssScale });
      try {
        const isSectionRoot2 = offsetParent.id === `section-content-${sectionId}`;
        let gridParentWidthPx2 = transform.cols * transform.cellPx;
        if (!isSectionRoot2) {
          const parentUnits2 = transform.toUnits({
            x: (pRect2.left - cRect2.left),
            y: (pRect2.top - cRect2.top),
            w: pRect2.width,
            h: pRect2.height,
          });
          gridParentWidthPx2 = parentUnits2.wu * transform.cellPx;
        }
        const domParentWidthPx2 = pRect2.width;
        const nextScale2 = gridParentWidthPx2 > 0 ? (domParentWidthPx2 / gridParentWidthPx2) : 1;
        setAutoScale(Number.isFinite(nextScale2) && nextScale2 > 0 ? nextScale2 : 1);
      } catch {
        setAutoScale(1);
      }
    });
    ro.observe(offsetParent);
    return () => ro.disconnect();
  }, [sectionId, originPx, cssScale, transform, containerId, draggingNodeId, node.id]);

  // Continuously refresh origin so children visually track moving containers during drag
  // We keep this lightweight by only committing state when the computed origin actually changes.
  useLayoutEffect(() => {
    if (originPx) return;
    if (!containerId) return; // Only needed for nested nodes
    if (containerId && draggingNodeId && draggingNodeId !== node.id) return;
    let raf = 0;
    let running = true;
    const tick = () => {
      if (!running) return;
      const el = wrapperRef.current;
      const content = document.getElementById(`section-content-${sectionId}`);
      if (el && content) {
        const offsetParent = el.offsetParent as HTMLElement | null;
        if (offsetParent) {
          const pRect = offsetParent.getBoundingClientRect();
          const cRect = content.getBoundingClientRect();
          const ox = (pRect.left - cRect.left) / cssScale;
          const oy = (pRect.top - cRect.top) / cssScale;
          setMeasuredOrigin((prev) => (prev.x !== ox || prev.y !== oy ? { x: ox, y: oy } : prev));
        }
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => {
      running = false;
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [sectionId, cssScale, containerId, originPx, draggingNodeId, node.id]);

  const originX = originPx?.x ?? measuredOrigin.x;
  const originY = originPx?.y ?? measuredOrigin.y;
  const scale = (cssScale || 1) * (autoScale || 1);
  const isContainerNode = node.type === 'container';
  const _gridPx = transform.toPx(node.layout?.units ?? { xu: 0, yu: 0 });
  const x = _gridPx.x - originX;
  const y = _gridPx.y - originY;
  const baseWidth = _gridPx.w;
  const baseHeight = _gridPx.h;

  const toUnitsFloat = useCallback((pxRect: { x: number; y: number; w: number; h: number }) => {
    const cell = transform.cellPx;
    const ox = transform.offsetX;
    const oy = transform.offsetY;
    return {
      xu: (pxRect.x - ox) / cell,
      yu: (pxRect.y - oy) / cell,
      wu: pxRect.w / cell,
      hu: pxRect.h / cell,
    };
  }, [transform.cellPx, transform.offsetX, transform.offsetY]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    if (isEditing) return; // Disable drag when editing text
    const wrapper = e.currentTarget as HTMLElement;
    // Measure actual child box instead of wrapper which includes outlines/handles
    const child = wrapper.firstElementChild as HTMLElement | null;
    const innerRect = (child ?? wrapper).getBoundingClientRect();
    const parent = wrapper.offsetParent as HTMLElement | null;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const widthPx = innerRect.width;
    const heightPx = innerRect.height;
    const pointerX = (e.clientX - rect.left) / scale;
    const pointerY = (e.clientY - rect.top) / scale;
    startRef.current = {
      pointerX,
      pointerY,
      x0: x,
      y0: y,
      w0: widthPx / cssScale,
      h0: heightPx / cssScale,
    };
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
    const pointerX = (e.clientX - containerRect.left) / scale;
    const pointerY = (e.clientY - containerRect.top) / scale;
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
          const isSectionRoot = parentEl === contentEl;
          const parentUnitsFloat = parentUnits
            ? parentUnits
            : (isSectionRoot
                ? { xu: 0, yu: 0, wu: transform.cols, hu: transform.rows }
                : toUnitsFloat({
                    x: ((parentRect.left - contentRect.left)) / cssScale,
                    y: ((parentRect.top - contentRect.top)) / cssScale,
                    w: parentRect.width / cssScale,
                    h: parentRect.height / cssScale,
                  }));
          // Use live DOM size for visual outline alignment
          const parentWidthPx = parentRect.width / cssScale;
          const parentHeightPx = parentRect.height / cssScale;
          const parentPx = {
            w: parentWidthPx,
            h: parentHeightPx,
          };
          const { xu: nxu, yu: nyu, wu: nwu, hu: nhu } = transform.toUnits({ x: nx + originX, y: ny + originY, w: nw, h: nh });
          const minXu = parentUnits ? parentUnits.xu : Math.ceil(isSectionRoot ? 0 : parentUnitsFloat.xu);
          const minYu = parentUnits ? parentUnits.yu : Math.ceil(isSectionRoot ? 0 : parentUnitsFloat.yu);
          const maxXu = parentUnits
            ? parentUnits.xu + parentUnits.wu - nwu
            : (isSectionRoot ? (transform.cols - nwu) : Math.floor(parentUnitsFloat.xu + parentUnitsFloat.wu - nwu));
          const maxYu = parentUnits
            ? parentUnits.yu + parentUnits.hu - nhu
            : (isSectionRoot ? (transform.rows - nhu) : Math.floor(parentUnitsFloat.yu + parentUnitsFloat.hu - nhu));
          const clampedUnits = {
            xu: Math.max(minXu, Math.min(nxu, maxXu)),
            yu: ((parentUnits?.hu ?? parentUnitsFloat.hu) > nhu) ? Math.max(minYu, Math.min(nyu, maxYu)) : nyu,
            wu: nwu,
            hu: nhu,
          };
          const clampedPx = transform.toPx(clampedUnits);
          nx = clampedPx.x - originX;
          ny = clampedPx.y - originY;

          // Edge contact detection for resize case
          const tol = 0.5;
          const edges = {
            left: nx <= tol,
            top: ny <= tol,
            right: Math.abs(nx + nw - parentPx.w) <= tol,
            bottom: (isSectionRoot ? transform.rows : parentUnitsFloat.hu) > nhu ? Math.abs(ny + nh - parentPx.h) <= tol : false,
          } as const;
          if (BuilderState.setEdgeContact) BuilderState.setEdgeContact(containerId, { top: edges.top, right: edges.right, bottom: edges.bottom, left: edges.left });
        }
      }

      setTempPos({ x: nx, y: ny });
      setTempSize({ w: nw, h: nh });
      e.stopPropagation();
      return;
    }

    const rawX = startRef.current.x0 + dx;
    const rawY = startRef.current.y0 + dy;
    const rectPx = { x: rawX + originX, y: rawY + originY, w: startRef.current.w0, h: startRef.current.h0 };
    const tentativeUnits = transform.toUnits(rectPx);
    let xu = tentativeUnits.xu;
    let yu = tentativeUnits.yu;
    const widthUnitsRaw = startRef.current.w0 / transform.cellPx;
    const heightUnitsRaw = startRef.current.h0 / transform.cellPx;
    const widthUnitsForClamp = node.layout?.units?.wu ?? Math.round(widthUnitsRaw);
    const heightUnitsForClamp = node.layout?.units?.hu ?? Math.round(heightUnitsRaw);

    if (containerId && startRef.current) {
      const parentEl = document.getElementById(containerId);
      if (parentEl) {
        const contentEl = document.getElementById(`section-content-${sectionId}`) || parentEl;
        const contentRect = contentEl.getBoundingClientRect();
        const parentRect = parentEl.getBoundingClientRect();
        const isSectionRoot = parentEl === contentEl;
        const parentUnitsFloat = parentUnits
          ? parentUnits
          : (isSectionRoot
              ? { xu: 0, yu: 0, wu: transform.cols, hu: transform.rows }
              : toUnitsFloat({
                  x: ((parentRect.left - contentRect.left)) / cssScale,
                  y: ((parentRect.top - contentRect.top)) / cssScale,
                  w: parentRect.width / cssScale,
                  h: parentRect.height / cssScale,
                }));
        // Use live DOM size for visual outline alignment
        const parentWidthPx = parentRect.width / cssScale;
        const parentHeightPx = parentRect.height / cssScale;
        const wu = widthUnitsForClamp;
        const hu = heightUnitsForClamp;
        const minXu = parentUnits
          ? parentUnits.xu
          : Math.ceil(isSectionRoot ? 0 : parentUnitsFloat.xu);
        const minYu = parentUnits
          ? parentUnits.yu
          : Math.ceil(isSectionRoot ? 0 : parentUnitsFloat.yu);
        const maxXu = parentUnits
          ? parentUnits.xu + parentUnits.wu - wu
          : (isSectionRoot
              ? (transform.cols - wu)
              : Math.floor(parentUnitsFloat.xu + parentUnitsFloat.wu - wu));
        const maxYu = parentUnits
          ? parentUnits.yu + parentUnits.hu - hu
          : (isSectionRoot
              ? (transform.rows - hu)
              : Math.floor(parentUnitsFloat.yu + parentUnitsFloat.hu - hu));
        xu = Math.max(minXu, Math.min(xu, maxXu));
        if ((isSectionRoot ? transform.rows : parentUnitsFloat.hu) > hu) {
          yu = Math.max(minYu, Math.min(yu, maxYu));
        }

        // Edge contact detection for move case
        const snappedPx = transform.toPx({ xu, yu, wu, hu });
        const tol = 0.5;
        const edges = {
          left: (snappedPx.x - originX) <= tol,
          top: (snappedPx.y - originY) <= tol,
          right: Math.abs((snappedPx.x - originX) + snappedPx.w! - parentWidthPx) <= tol,
          bottom: ((parentUnits?.hu ?? parentUnitsFloat.hu) > hu) ? Math.abs((snappedPx.y - originY) + snappedPx.h! - parentHeightPx) <= tol : false,
        } as const;
        if (BuilderState.setEdgeContact) BuilderState.setEdgeContact(containerId, { top: edges.top, right: edges.right, bottom: edges.bottom, left: edges.left });
      }
    }

    const snappedPxUnits = { xu, yu, wu: widthUnitsForClamp, hu: heightUnitsForClamp };
    const snappedPx = transform.toPx(snappedPxUnits);
    setTempPos({ x: snappedPx.x - originX, y: snappedPx.y - originY });
    e.stopPropagation();
  }, [dragging, transform, containerId, sectionId, disabled, node.layout?.units, originX, originY]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    if (!dragging || !startRef.current) return;

    if (resizeRef.current) {
      const nx = tempPos?.x ?? startRef.current.x0;
      const ny = tempPos?.y ?? startRef.current.y0;
      const w = tempSize?.w ?? startRef.current.w0;
      const h = tempSize?.h ?? startRef.current.h0;

      const rectPx = { x: nx + originX, y: ny + originY, w, h };
      let { xu, yu, wu, hu } = transform.toUnits(rectPx);
      wu = Math.max(1, Math.round(wu));
      hu = Math.max(1, Math.round(hu));

      if (containerId) {
        const parentEl = document.getElementById(containerId);
        if (parentEl) {
          const contentEl = document.getElementById(`section-content-${sectionId}`) || parentEl;
          const contentRect = contentEl.getBoundingClientRect();
          const parentRect = parentEl.getBoundingClientRect();
          const isSectionRoot = parentEl === contentEl;
          const parentUnitsFloat = parentUnits
            ? parentUnits
            : (isSectionRoot
                ? { xu: 0, yu: 0, wu: transform.cols, hu: transform.rows }
                : toUnitsFloat({
                    x: ((parentRect.left - contentRect.left)) / cssScale,
                    y: ((parentRect.top - contentRect.top)) / cssScale,
                    w: parentRect.width / cssScale,
                    h: parentRect.height / cssScale,
                  }));
          wu = Math.max(1, Math.min(wu, Math.floor(parentUnitsFloat.wu)));
          hu = Math.max(1, Math.min(hu, Math.floor(parentUnitsFloat.hu)));
          const minXu = parentUnits ? parentUnits.xu : Math.ceil(isSectionRoot ? 0 : parentUnitsFloat.xu);
          const minYu = parentUnits ? parentUnits.yu : Math.ceil(isSectionRoot ? 0 : parentUnitsFloat.yu);
          const maxXu = parentUnits
            ? parentUnits.xu + parentUnits.wu - wu
            : (isSectionRoot ? (transform.cols - wu) : Math.floor(parentUnitsFloat.xu + parentUnitsFloat.wu - wu));
          const maxYu = parentUnits
            ? parentUnits.yu + parentUnits.hu - hu
            : (isSectionRoot ? (transform.rows - hu) : Math.floor(parentUnitsFloat.yu + parentUnitsFloat.hu - hu));
          xu = Math.max(minXu, Math.min(xu, maxXu));
          if ((parentUnits?.hu ?? parentUnitsFloat.hu) > hu) {
            yu = Math.max(minYu, Math.min(yu, maxYu));
          }
        }
      }

      xu = Math.round(xu);
      yu = Math.round(yu);
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
      }
      e.stopPropagation();
      return;
    }

    if (!tempPos) return;
    
    const finalPxRect = {
      x: tempPos.x + originX,
      y: tempPos.y + originY,
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
        const isSectionRoot = parentEl === contentEl;
        const parentUnitsFloat = parentUnits
          ? parentUnits
          : (isSectionRoot
              ? { xu: 0, yu: 0, wu: transform.cols, hu: transform.rows }
              : toUnitsFloat({
                  x: ((parentRect.left - contentRect.left)) / cssScale,
                  y: ((parentRect.top - contentRect.top)) / cssScale,
                  w: parentRect.width / cssScale,
                  h: parentRect.height / cssScale,
                }));
        const nodeWu = Math.round(startRef.current.w0 / transform.cellPx);
        const nodeHu = Math.round(startRef.current.h0 / transform.cellPx);
        const minXu = parentUnits ? parentUnits.xu : Math.ceil(isSectionRoot ? 0 : parentUnitsFloat.xu);
        const minYu = parentUnits ? parentUnits.yu : Math.ceil(isSectionRoot ? 0 : parentUnitsFloat.yu);
        const maxXu = parentUnits
          ? parentUnits.xu + parentUnits.wu - nodeWu
          : (isSectionRoot ? (transform.cols - nodeWu) : Math.floor(parentUnitsFloat.xu + parentUnitsFloat.wu - nodeWu));
        const maxYu = parentUnits
          ? parentUnits.yu + parentUnits.hu - nodeHu
          : (isSectionRoot ? (transform.rows - nodeHu) : Math.floor(parentUnitsFloat.yu + parentUnitsFloat.hu - nodeHu));
        xu = Math.max(minXu, Math.min(xu, maxXu));
        if ((parentUnits?.hu ?? parentUnitsFloat.hu) > nodeHu) {
          yu = Math.max(minYu, Math.min(yu, maxYu));
        }
      }
    }

    xu = Math.round(xu);
    yu = Math.round(yu);
    onCommitLayout(node.id, { xu, yu });
    setDragging(false);
    setTempPos(null);
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    startRef.current = null;
    BuilderState.stopDragging();
    if (containerId) {
      if (BuilderState.clearEdgeContact) BuilderState.clearEdgeContact(containerId);
    }
    if (dragging) {
      e.preventDefault();
    }
    e.stopPropagation();
  }, [dragging, transform, tempPos, tempSize, node.id, onCommitLayout, containerId, sectionId, disabled]);

  // Position to render (during drag show temp, otherwise snap)
  const renderX = tempPos?.x ?? x;
  const renderY = tempPos?.y ?? y;
  const renderW = tempSize?.w ?? baseWidth ?? defaultSize?.w;
  const renderH = tempSize?.h ?? baseHeight ?? defaultSize?.h;
  const shouldReadParentDragVars = Boolean(containerId && draggingNodeId && draggingNodeId !== containerId);

  // Propagate live container drag delta to its descendants via CSS variables so children visually track the card during drag.
  useLayoutEffect(() => {
    if (node.type !== 'container') return;
    const el = document.getElementById(node.id);
    if (!el) return;
    const baseX = (_gridPx.x - originX);
    const baseY = (_gridPx.y - originY);
    const localDx = (tempPos?.x ?? x) - baseX;
    const localDy = (tempPos?.y ?? y) - baseY;
    (el.style as any).setProperty('--drag-dx', `${localDx}px`);
    (el.style as any).setProperty('--drag-dy', `${localDy}px`);
    return () => {
      // Reset on unmount or when this node stops being a container
      (el.style as any).setProperty('--drag-dx', `0px`);
      (el.style as any).setProperty('--drag-dy', `0px`);
    };
  }, [node.type, node.id, tempPos, x, y, _gridPx.x, _gridPx.y, originX, originY]);

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
      }
      return;
    }
    pressedRef.current = false;
    onPointerUp(e);
  }, [dragging, onPointerUp, containerId]);

  const renderedContent = enforceChildFullSize ? enforceFullSize(render(node)) : render(node);

  return (
    <div
      ref={wrapperRef}
      className={`absolute ${dragging ? 'select-none' : ''}`}
      style={{
        left: renderX,
        top: renderY,
        width: renderW,
        height: renderH,
        // Children of containers read CSS vars --drag-dx/--drag-dy from their parent container element.
        transform: `translateZ(0)${shouldReadParentDragVars ? ' translate(var(--drag-dx, 0px), var(--drag-dy, 0px))' : ''}`,
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

      {!isContainerNode && selected && !isEditing && (
        <div className="absolute inset-0 border border-blue-500 pointer-events-none" />
      )}

      {isContainerNode && ((selected && !isEditing) || dragging || hasSelfEdgeContact) && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: 0,
            top: 0,
            width: renderW,
            height: renderH,
            border: `2px solid ${hasSelfEdgeContact ? '#ef4444' : '#3b82f6'}`,
            boxSizing: 'border-box',
          }}
        />
      )}

      {/* Resize handles */}
      {selected && !isEditing && (
        <div
          className="absolute pointer-events-none"
          aria-hidden
          style={
            isContainerNode
              ? { left: 0, top: 0, width: renderW, height: renderH }
              : { left: 0, top: 0, right: 0, bottom: 0 }
          }
        >
          {['n','s','e','w','ne','nw','se','sw'].map((dir) => {
            const style: React.CSSProperties = {};
            let cursor = 'default';
            if (dir === 'n' || dir === 's') cursor = 'ns-resize';
            if (dir === 'e' || dir === 'w') cursor = 'ew-resize';
            if (dir === 'nw' || dir === 'se') cursor = 'nwse-resize';
            if (dir === 'ne' || dir === 'sw') cursor = 'nesw-resize';

            // Edge hit areas leave a gap for corner boxes so corners get priority/correct cursor
            const px = (v: number) => v / cssScale;
            if (dir === 'n') { style.top = -px(3); style.left = px(6); style.right = px(6); style.height = px(6); }
            if (dir === 's') { style.bottom = -px(3); style.left = px(6); style.right = px(6); style.height = px(6); }
            if (dir === 'w') { style.left = -px(3); style.top = px(6); style.bottom = px(6); style.width = px(6); }
            if (dir === 'e') { style.right = -px(3); style.top = px(6); style.bottom = px(6); style.width = px(6); }

            if (dir === 'nw') { style.top = -px(6); style.left = -px(6); style.width = px(12); style.height = px(12); }
            if (dir === 'ne') { style.top = -px(6); style.right = -px(6); style.width = px(12); style.height = px(12); }
            if (dir === 'sw') { style.bottom = -px(6); style.left = -px(6); style.width = px(12); style.height = px(12); }
            if (dir === 'se') { style.bottom = -px(6); style.right = -px(6); style.width = px(12); style.height = px(12); }

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
                    x0: (rect.left - parentRect.left) / scale,
                    y0: (rect.top - parentRect.top) / scale,
                    w0: rect.width / scale,
                    h0: rect.height / scale,
                  };
                  startRef.current = {
                    pointerX: (e.clientX - parentRect.left) / scale,
                    pointerY: (e.clientY - parentRect.top) / scale,
                    x0: resizeRef.current.x0,
                    y0: resizeRef.current.y0,
                    w0: rect.width / scale,
                    h0: rect.height / scale,
                  };
                  BuilderState.startResizing(sectionId, node.id, dir as ResizeHandle);
                  wrapper.setPointerCapture(e.pointerId);
                  pressedRef.current = true;
                  setDragging(true);
                  setTempPos({ x: resizeRef.current.x0, y: resizeRef.current.y0 });
                  setTempSize({ w: rect.width / scale, h: rect.height / scale });
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