// DynamicPageV2RendererBuilder.tsx - Builder-specific renderer with grid and draggable support
import React from 'react';
import { GridOverlay } from './GridOverlay';
import { DraggableNode } from './DraggableNode';
import { defaultGridSize, unitsToPx, snapToGrid, pxToUnits } from './gridMath';
import { PageV2, SectionV2, Node } from '@/shared/types/pageV2';
import EventSection from '@/features/admin/components/WebBuilder/sections/EventSection';

function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(' ');
}

const highlightClass = (node: Node, highlightNodeId?: string) =>
  node.id === highlightNodeId ? 'outline outline-2 outline-red-500/70' : undefined;

// Reuse the rendering logic from DynamicPageV2Renderer
const renderNode = (
  node: Node,
  highlightNodeId?: string,
  sectionFontFamily?: string,
  sectionId?: string,
  onNodeHover?: (nodeId: string | null) => void,
  onNodeClick?: (sectionId: string, nodeId: string) => void,
  hoveredNodeId?: string | null,
  selectedNodeId?: string | null
): React.ReactNode => {
  const nodeFontFamily = (node as any).style?.fontFamily || sectionFontFamily;
  const nodeStyle = nodeFontFamily ? { fontFamily: nodeFontFamily } : undefined;
  const isHovered = hoveredNodeId === node.id;
  const isSelected = selectedNodeId === node.id;
  
  // Determine cursor style
  const cursorClass = isSelected && isHovered ? 'cursor-move' : 'cursor-pointer';
  const interactiveClass = `${cursorClass} transition-all`;
  
  // Show black outline for selected OR hovered (not both - selected takes precedence)
  const outlineClass = isSelected ? 'outline outline-2 outline-black' : isHovered ? 'outline outline-2 outline-black' : '';

  const handleMouseEnter = (e: React.MouseEvent) => {
    // Only handle if the target is this element, not a child
    if (e.target !== e.currentTarget) return;
    e.stopPropagation();
    onNodeHover?.(node.id);
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    // Only handle if the target is this element, not a child
    if (e.target !== e.currentTarget) return;
    e.stopPropagation();
    onNodeHover?.(null);
  };

  const handleClick = (e: React.MouseEvent) => {
    // Stop propagation to prevent parent selection
    e.stopPropagation();
    if (sectionId) {
      onNodeClick?.(sectionId, node.id);
    }
  };
  
  switch (node.type) {
    case 'text': {
      const html = (node as any).props?.html ?? (node as any).props?.text ?? '';
      const align = (node as any).props?.align ?? 'left';
      const variant = (node as any).props?.variant ?? 'p';
      const paddingY = (node as any).style?.paddingY ?? 0;
      const paddingX = (node as any).style?.paddingX ?? 0;
      const textStyles = (node as any).style?.textStyles || [];
      const fontSize = (node as any).style?.fontSize;
      const fontWeight = (node as any).style?.fontWeight;
      const width = (node as any).style?.width;
      const elementFontFamily = (node as any).style?.fontFamily;
      const underlineThickness = (node as any).style?.underlineThickness;
      const color = (node as any).style?.color;
      const backgroundColor = (node as any).style?.backgroundColor;
      
      const Tag = ['h1', 'h2', 'h3'].includes(variant) ? (variant as any) : 'p';
      
      // Build padding classes dynamically
      const pyClass = paddingY > 0 ? `py-${paddingY}` : '';
      const pxClass = paddingX > 0 ? `px-${paddingX}` : '';
      
      // Build text style classes
      const isBold = textStyles.includes('bold');
      const isItalic = textStyles.includes('italic');
      const isUnderline = textStyles.includes('underline');
      
      // Build inline styles
      const inlineStyles: React.CSSProperties = {
        ...nodeStyle,
        ...(fontSize && fontSize !== 1 ? { fontSize: `${fontSize}rem` } : {}),
        ...(fontWeight && fontWeight !== 400 ? { fontWeight } : {}),
        ...(width && width !== 'auto' ? { width, display: 'inline-block' } : {}),
        ...(elementFontFamily ? { fontFamily: elementFontFamily } : {}),
        ...(isUnderline && underlineThickness ? { textDecorationThickness: `${underlineThickness}px` } : {}),
        ...(color ? { color } : {}),
        ...(backgroundColor ? { backgroundColor } : {}),
      };
      
      return (
        <Tag
          className={cn(
            align === 'center' && 'text-center',
            align === 'right' && 'text-right',
            pyClass,
            pxClass,
            isBold && 'font-bold',
            isItalic && 'italic',
            isUnderline && 'underline',
            (node as any).style?.className,
            highlightClass(node, highlightNodeId),
            !elementFontFamily && nodeFontFamily && '[&_*]:!font-[inherit]',
            'inline-block max-w-full w-fit align-top break-words',
            interactiveClass,
            outlineClass
          )}
          style={inlineStyles}
          dangerouslySetInnerHTML={{ __html: html }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
        />
      );
    }
    case 'button': {
      const label = (node as any).props?.label ?? 'Button';
      const href = (node as any).props?.href;
      const className = cn(
        (node as any).style?.className ?? 'px-4 py-2 bg-blue-600 text-white rounded',
        highlightClass(node, highlightNodeId),
        nodeFontFamily && '[&_*]:!font-[inherit]',
        interactiveClass,
        outlineClass
      );
      if (href) {
        return (
          <a 
            href={href} 
            className={className} 
            style={nodeStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
          >
            {label}
          </a>
        );
      }
      return (
        <button 
          className={className} 
          style={nodeStyle}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
        >
          {label}
        </button>
      );
    }
    case 'container': {
      const maxWidth = (node as any).props?.maxWidth ?? 'xl';
      const px = (node as any).props?.paddingX ?? 4;
      const py = (node as any).props?.paddingY ?? 6;
      const mwClass =
        maxWidth === 'full'
          ? 'w-full'
          : maxWidth === '2xl'
          ? 'max-w-7xl'
          : maxWidth === 'xl'
          ? 'max-w-6xl'
          : maxWidth === 'lg'
          ? 'max-w-5xl'
          : maxWidth === 'md'
          ? 'max-w-3xl'
          : 'max-w-xl';
      const pxClass =
        px === 0 ? 'px-0' : px === 2 ? 'px-2' : px === 4 ? 'px-4' : px === 6 ? 'px-6' : 'px-4';
      const pyClass =
        py === 0 ? 'py-0' : py === 2 ? 'py-2' : py === 4 ? 'py-4' : py === 6 ? 'py-6' : 'py-6';
      return (
        <div
          className={cn(
            'mx-auto',
            mwClass,
            pxClass,
            pyClass,
            highlightClass(node, highlightNodeId),
            nodeFontFamily && '[&_*]:!font-[inherit]',
            interactiveClass,
            outlineClass
          )}
          style={nodeStyle}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
        >
          {(node.children ?? []).map((c) => (
            <React.Fragment key={c.id}>
              {renderNode(c, highlightNodeId, nodeFontFamily, sectionId, onNodeHover, onNodeClick, hoveredNodeId, selectedNodeId)}
            </React.Fragment>
          ))}
        </div>
      );
    }
    case 'eventList': {
      return (
        <div
          className={cn(
            highlightClass(node, highlightNodeId),
            nodeFontFamily && '[&_*]:!font-[inherit]',
            interactiveClass,
            outlineClass
          )}
          style={nodeStyle}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
        >
          <EventSection
            showFilters={(node as any).props?.showFilters !== false}
            eventName={(node as any).props?.eventName}
            lockedFilters={(node as any).props?.lockedFilters}
            title={(node as any).props?.title}
            showTitle={(node as any).props?.showTitle !== false}
          />
        </div>
      );
    }
    default: {
      return null;
    }
  }
};

export const DynamicPageV2RendererBuilder: React.FC<{
  page: PageV2;
  highlightNodeId?: string;
  hoveredNodeId?: string | null;
  selectedNodeId?: string | null;
  onUpdateNodeLayout: (
    sectionId: string,
    nodeId: string,
    units: { xu: number; yu: number }
  ) => void;
  onNodeHover?: (nodeId: string | null) => void;
  onNodeClick?: (sectionId: string, nodeId: string) => void;
}> = ({ page, highlightNodeId, hoveredNodeId, selectedNodeId, onUpdateNodeLayout, onNodeHover, onNodeClick }) => {
  const defaultFontFamily = (page as any).styleTokens?.defaultFontFamily as string | undefined;
  const defaultFontFallback = (page as any).styleTokens?.defaultFontFallback as
    | string
    | undefined;
  const fontFamily = defaultFontFamily || defaultFontFallback;

  return (
    <div
      className="w-full min-h-full"
      style={fontFamily ? ({ fontFamily } as React.CSSProperties) : undefined}
    >
      {page.sections.map((section: SectionV2) => {
        const isFull = section.fullHeight === true;
        const bg = section.background?.className as string | undefined;
        const gridClass = section.grid?.className ?? '';
        const hasWidthClass = /(^|\s)w-/.test(gridClass);
        const gridClasses = cn(gridClass, !hasWidthClass && 'w-full');

        const gridSize = section.builderGrid?.gridSize ?? defaultGridSize;
        const showGrid = section.builderGrid?.showGrid ?? true;

        // Get section-level font from styleTokens or page default
        const sectionFontFamily = (section.styleTokens as any)?.fontFamily || fontFamily;

        return (
          <section
            key={section.id}
            className={cn(
              'w-full relative',
              isFull ? 'min-h-screen flex items-center' : '',
              bg,
              sectionFontFamily && '[&_*]:!font-[inherit]'
            )}
            style={{
              ...(section.background?.style as React.CSSProperties),
              ...(sectionFontFamily ? { fontFamily: sectionFontFamily } : {}),
            }}
          >
            {/* Grid overlay - absolute to section */}
            {showGrid && (
              <div className="pointer-events-none absolute inset-0">
                <GridOverlay gridSize={gridSize} />
              </div>
            )}
            
            {/* Content wrapper with original grid classes for layout constraints */}
            <div className={cn(gridClasses, 'relative')} id={`section-content-${section.id}`}>
              {/* Children - both flow and absolute */}
              {section.children.map((node) => {
                const hasAbs = !!node.layout?.units;
                const isNodeSelected = selectedNodeId === node.id;
                
                if (hasAbs) {
                  // Use existing DraggableNode for absolute positioned
                  const x = unitsToPx(node.layout!.units.xu, gridSize);
                  const y = unitsToPx(node.layout!.units.yu, gridSize);
                  const w = node.layout?.units.wu ? unitsToPx(node.layout!.units.wu!, gridSize) : undefined;
                  const h = node.layout?.units.hu ? unitsToPx(node.layout!.units.hu!, gridSize) : undefined;

                  return (
                    <DraggableNode
                      key={node.id}
                      node={{
                        ...node,
                        layout: { units: node.layout!.units, px: { x, y, w, h } },
                      }}
                      gridSize={gridSize}
                      defaultSize={{ w, h }}
                      selected={node.id === selectedNodeId}
                      onCommitLayout={(nodeId, units) => onUpdateNodeLayout(section.id, nodeId, units)}
                      render={(n) => renderNode(n, highlightNodeId, sectionFontFamily, section.id, onNodeHover, onNodeClick, hoveredNodeId, selectedNodeId)}
                    />
                  );
                }

                // Normal flow elements with drag capability when selected
                const FlowWrapper = () => {
                  const wrapperRef = React.useRef<HTMLDivElement>(null);
                  const [isDragging, setIsDragging] = React.useState(false);
                  const [dragPos, setDragPos] = React.useState<{ x: number; y: number } | null>(null);
                  const dragState = React.useRef<{ startX: number; startY: number; startRect: DOMRect; moved: boolean } | null>(null);

                  React.useEffect(() => {
                    const wrapper = wrapperRef.current;
                    if (!isNodeSelected || !wrapper) {
                      return undefined;
                    }

                    let pointerId: number | null = null;

                    const handlePointerDown = (e: PointerEvent) => {
                      onNodeClick?.(section.id, node.id);
                      const rect = wrapper.getBoundingClientRect();
                      dragState.current = {
                        startX: e.clientX,
                        startY: e.clientY,
                        startRect: rect,
                        moved: false,
                      };
                      pointerId = e.pointerId;
                      wrapper.setPointerCapture(e.pointerId);
                    };

                    const handlePointerMove = (e: PointerEvent) => {
                      if (!dragState.current) return;

                      const dx = e.clientX - dragState.current.startX;
                      const dy = e.clientY - dragState.current.startY;

                      if (!dragState.current.moved && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
                        dragState.current.moved = true;
                        setIsDragging(true);
                      }

                      if (dragState.current.moved) {
                        const container = document.getElementById(`section-content-${section.id}`);
                        if (!container) return;

                        const containerRect = container.getBoundingClientRect();
                        const x = dragState.current.startRect.left - containerRect.left + dx;
                        const y = dragState.current.startRect.top - containerRect.top + dy;

                        setDragPos({ x, y });
                      }
                    };

                    const handlePointerUp = (e: PointerEvent) => {
                      if (!dragState.current) return;

                      if (dragState.current.moved && isDragging) {
                        const container = document.getElementById(`section-content-${section.id}`);
                        if (!container) return;

                        const containerRect = container.getBoundingClientRect();
                        const dx = e.clientX - dragState.current.startX;
                        const dy = e.clientY - dragState.current.startY;

                        let x = dragState.current.startRect.left - containerRect.left + dx;
                        let y = dragState.current.startRect.top - containerRect.top + dy;

                        x = snapToGrid(x, gridSize);
                        y = snapToGrid(y, gridSize);

                        const xu = pxToUnits(x, gridSize);
                        const yu = pxToUnits(y, gridSize);

                        onUpdateNodeLayout(section.id, node.id, { xu, yu });
                      }

                      setIsDragging(false);
                      setDragPos(null);
                      dragState.current = null;
                      if (pointerId !== null) {
                        wrapper.releasePointerCapture(pointerId);
                        pointerId = null;
                      }
                    };

                    wrapper.addEventListener('pointerdown', handlePointerDown);
                    wrapper.addEventListener('pointermove', handlePointerMove);
                    wrapper.addEventListener('pointerup', handlePointerUp);

                    return () => {
                      wrapper.removeEventListener('pointerdown', handlePointerDown);
                      wrapper.removeEventListener('pointermove', handlePointerMove);
                      wrapper.removeEventListener('pointerup', handlePointerUp);
                    };
                  }, [
                    gridSize,
                    isDragging,
                    isNodeSelected,
                    node.id,
                    onNodeClick,
                    onUpdateNodeLayout,
                    section.id,
                  ]);

                  if (isDragging && dragPos) {
                    return (
                      <div
                        ref={wrapperRef}
                        className="absolute z-50 opacity-80"
                        style={{ left: dragPos.x, top: dragPos.y }}
                      >
                        {renderNode(node, highlightNodeId, sectionFontFamily, section.id, onNodeHover, onNodeClick, hoveredNodeId, selectedNodeId)}
                      </div>
                    );
                  }

                  return (
                    <div ref={wrapperRef} className="relative">
                      {renderNode(node, highlightNodeId, sectionFontFamily, section.id, onNodeHover, onNodeClick, hoveredNodeId, selectedNodeId)}
                    </div>
                  );
                };

                return <FlowWrapper key={node.id} />;
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
};
