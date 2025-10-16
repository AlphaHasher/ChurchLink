// DynamicPageV2RendererBuilder.tsx - Builder-specific renderer with grid and draggable support
import React, { useEffect, useState } from 'react';
import { GridOverlay } from './GridOverlay';
import { DraggableNode } from './DraggableNode';
import { defaultGridSize, unitsToPx } from './gridMath';
import { PageV2, SectionV2, Node } from '@/shared/types/pageV2';
import EventSection from '@sections/EventSection';
import MapSection from '@sections/MapSection';
// import ServiceTimesSection from '@sections/ServiceTimesSection';
// import MenuSection from '@sections/MenuSection';
// import ContactInfoSection from '@sections/ContactInfoSection';
import PaypalSection from '@sections/PaypalSection';
// import ScopedStyle from '@/shared/components/ScopedStyle';
import { ActivePaddingOverlay, BuilderState } from '@/features/webeditor/state/BuilderState';
import { getPublicUrl } from '@/helpers/MediaInteraction';

const PADDING_COLORS = {
  top: 'rgba(239,68,68,0.28)',
  right: 'rgba(249,115,22,0.28)',
  bottom: 'rgba(34,197,94,0.28)',
  left: 'rgba(59,130,246,0.28)',
} as const;

const TAILWIND_SPACING_UNIT_PX = 4;

function tailwindSpacingToPx(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return value * TAILWIND_SPACING_UNIT_PX;
}

function tailwindSpacingToRem(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
  if (value === 0) return '0';
  const rem = value * 0.25;
  const formatted = rem.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  return formatted.length ? `${formatted}rem` : `${rem}rem`;
}

type PaddingOverlayProps = {
  layer: ActivePaddingOverlay | null;
};

const PaddingOverlay: React.FC<PaddingOverlayProps> = ({ layer }) => {
  const [overlay, setOverlay] = React.useState<ActivePaddingOverlay | null>(layer ?? BuilderState.paddingOverlay);

  React.useEffect(() => {
    const unsub = BuilderState.onPaddingOverlayChange((next) => setOverlay(next));
    return unsub;
  }, []);

  const data = overlay ?? layer;
  if (!data) return null;
  const { nodeId, sectionId, values } = data;
  const cache = BuilderState.getNodePixelLayout(nodeId);
  if (!cache || cache.sectionId !== sectionId) return null;
  const [top, right, bottom, left] = values;

  return (
    <div className="absolute inset-0 pointer-events-none">
      <div
        className="absolute"
        style={{
          left: cache.x,
          top: cache.y,
          width: cache.w,
          height: cache.h,
          pointerEvents: 'none',
        }}
      >
        {top > 0 && (
          <div
            className="absolute inset-x-0"
            style={{
              height: tailwindSpacingToPx(top),
              backgroundColor: PADDING_COLORS.top,
              top: 0,
            }}
          />
        )}
        {bottom > 0 && (
          <div
            className="absolute inset-x-0"
            style={{
              height: tailwindSpacingToPx(bottom),
              backgroundColor: PADDING_COLORS.bottom,
              bottom: 0,
            }}
          />
        )}
        {left > 0 && (
          <div
            className="absolute inset-y-0"
            style={{
              width: tailwindSpacingToPx(left),
              backgroundColor: PADDING_COLORS.left,
              left: 0,
            }}
          />
        )}
        {right > 0 && (
          <div
            className="absolute inset-y-0"
            style={{
              width: tailwindSpacingToPx(right),
              backgroundColor: PADDING_COLORS.right,
              right: 0,
            }}
          />
        )}
      </div>
    </div>
  );
};

function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(' ');
}

// highlightClass removed (no red outlines)

// Updated renderNode signature with additional optional params for nesting
function resolveLocalizedProp(node: Node, key: string, activeLocale?: string, defaultLocale?: string): any {
  const i18n = (node as any).i18n as Record<string, Record<string, any>> | undefined;
  const locale = activeLocale || defaultLocale;
  if (locale && i18n && i18n[locale] && i18n[locale].hasOwnProperty(key)) {
    return i18n[locale][key];
  }
  return (node as any).props?.[key];
}

const renderNode = (
  node: Node,
  highlightNodeId?: string,
  sectionFontFamily?: string,
  sectionId?: string,
  onNodeHover?: (nodeId: string | null) => void,
  onNodeClick?: (sectionId: string, nodeId: string) => void,
  onNodeDoubleClick?: (sectionId: string, nodeId: string) => void,
  hoveredNodeId?: string | null,
  selectedNodeId?: string | null,
  gridSize?: number,  // Added for nested positioning
  onUpdateNodeLayout?: (sectionId: string, nodeId: string, units: Partial<{ xu: number; yu: number; wu: number; hu: number }>) => void,  // Added for nested commits
  forceFlowLayout?: boolean,
  activeLocale?: string,
  defaultLocale?: string,
): React.ReactNode => {
  const nodeFontFamily = (node as any).style?.fontFamily || sectionFontFamily;
  const nodeStyle = nodeFontFamily ? { fontFamily: nodeFontFamily } : undefined;
  // const customCss = (node as any).style?.customCss as string | undefined; // disabled
  const isHovered = hoveredNodeId === node.id;
  const isSelected = selectedNodeId === node.id;

  // Determine cursor style
  const cursorClass = isSelected && isHovered ? 'cursor-move' : 'cursor-pointer';
  const interactiveClass = `${cursorClass} transition-all`;

  // No black outline; selection visuals handled in DraggableNode
  const outlineClass = '';

  const handleMouseEnter = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNodeHover?.(node.id);
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNodeHover?.(null);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const target = e.target as HTMLElement;
    const closest = target.closest('[data-node-id]') as HTMLElement | null;
    const self = e.currentTarget as HTMLElement;
    if (!closest || closest !== self) return; // Only select the top-most wrapper for this node
    if (sectionId) onNodeClick?.(sectionId, node.id);
  };
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const target = e.target as HTMLElement;
    const closest = target.closest('[data-node-id]') as HTMLElement | null;
    const self = e.currentTarget as HTMLElement;
    if (!closest || closest !== self) return;
    if (sectionId) onNodeDoubleClick?.(sectionId, node.id);
  };

  switch (node.type) {
    case 'text': {
      const html = resolveLocalizedProp(node, 'html', activeLocale, defaultLocale) ?? (node as any).props?.text ?? '';
      const align = (node as any).props?.align ?? 'left';
      const variant = (node as any).props?.variant ?? 'p';
      const nodeStyleRaw = (node as any).style || {};
      const paddingY = nodeStyleRaw?.paddingY ?? 0;
      const paddingX = nodeStyleRaw?.paddingX ?? 0;
      const textStyles = nodeStyleRaw?.textStyles || [];
      const fontSize = nodeStyleRaw?.fontSize;
      const fontWeight = nodeStyleRaw?.fontWeight;
      const width = nodeStyleRaw?.width;
      const elementFontFamily = nodeStyleRaw?.fontFamily;
      const underlineThickness = nodeStyleRaw?.underlineThickness;
      const color = nodeStyleRaw?.color;
      const backgroundColor = nodeStyleRaw?.backgroundColor;
      const borderRadius = nodeStyleRaw?.borderRadius as number | undefined;

      const paddingTop = nodeStyleRaw?.paddingTop ?? paddingY;
      const paddingBottom = nodeStyleRaw?.paddingBottom ?? paddingY;
      const paddingLeft = nodeStyleRaw?.paddingLeft ?? paddingX ?? paddingY;
      const paddingRight = nodeStyleRaw?.paddingRight ?? paddingX ?? paddingY;

      const Tag = ['h1', 'h2', 'h3'].includes(variant) ? (variant as any) : 'p';

      // Build text style classes
      const isItalic = textStyles.includes('italic');
      const isUnderline = textStyles.includes('underline');

      // Build inline styles

      const paddingStyles: React.CSSProperties = {
        ...(typeof paddingTop === 'number' ? { paddingTop: tailwindSpacingToRem(paddingTop) } : {}),
        ...(typeof paddingBottom === 'number' ? { paddingBottom: tailwindSpacingToRem(paddingBottom) } : {}),
        ...(typeof paddingLeft === 'number' ? { paddingLeft: tailwindSpacingToRem(paddingLeft) } : {}),
        ...(typeof paddingRight === 'number' ? { paddingRight: tailwindSpacingToRem(paddingRight) } : {}),
      };

      const wrapperStyle: React.CSSProperties = {
        ...nodeStyle,
        ...(width && width !== 'auto' ? { width, display: 'inline-block' } : { display: 'inline-block' }),
        ...((nodeStyleRaw as any)?.background ? { background: (nodeStyleRaw as any).background } : {}),
        ...(backgroundColor ? { backgroundColor } : {}),
        ...(typeof borderRadius === 'number' ? { borderRadius } : {}),
        ...paddingStyles,
      };

      const innerStyle: React.CSSProperties = {
        ...(fontSize && fontSize !== 1 ? { fontSize: `${fontSize}rem` } : {}),
        ...(fontWeight && fontWeight !== 400 ? { fontWeight } : {}),
        ...(elementFontFamily ? { fontFamily: elementFontFamily } : {}),
        ...(isUnderline && underlineThickness ? { textDecorationThickness: `${underlineThickness}px` } : {}),
        ...(color ? { color } : {}),
      };

      const nodeClassName = nodeStyleRaw?.className;

      return (
        <>
          <div
            data-node-id={node.id}
            data-node-type={node.type}
            className={cn(
              'inline-block max-w-full w-fit align-top break-words',
              interactiveClass,
              outlineClass,
              nodeClassName,
              !elementFontFamily && nodeFontFamily && '[&>*]:font-[inherit] [&>*_*]:font-[inherit]'
            )}
            // data-node-id used by ScopedStyle; disabled
            style={wrapperStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
          >
            <Tag
              className={cn(
                align === 'center' && 'text-center',
                align === 'right' && 'text-right',
                isItalic && 'italic',
                isUnderline && 'underline',
                nodeClassName
              )}
              style={innerStyle}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
          {/* <ScopedStyle nodeId={node.id} css={customCss} /> */}
        </>
      );
    }
    case 'image': {
      const nodeStyleRaw = (node as any).style || {};
      const src = (node as any).props?.src || '';
      const alt = resolveLocalizedProp(node, 'alt', activeLocale, defaultLocale) || '';
      const objectFit = (node as any).props?.objectFit || 'cover';
      const inlineStyle: React.CSSProperties = {
        ...nodeStyle,
        ...((nodeStyleRaw as any)?.background ? { background: (nodeStyleRaw as any).background } : {}),
        ...(nodeStyleRaw?.backgroundColor ? { backgroundColor: nodeStyleRaw.backgroundColor } : {}),
        ...(typeof nodeStyleRaw?.borderRadius === 'number' ? { borderRadius: nodeStyleRaw.borderRadius } : {}),
        overflow: 'hidden',
        display: 'block',
      };

      return (
        <>
          <div
            data-node-id={node.id}
            data-node-type={node.type}
            className={cn(
              interactiveClass,
              outlineClass
            )}
            style={inlineStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getPublicUrl(src)}
              alt={alt}
              draggable={false}
              style={{ width: '100%', height: '100%', objectFit }}
              onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
            />
          </div>
          {/* <ScopedStyle nodeId={node.id} css={customCss} /> */}
        </>
      );
    }
    case 'button': {
      const nodeStyleRaw = (node as any).style || {};
      const label = resolveLocalizedProp(node, 'label', activeLocale, defaultLocale) ?? 'Button';
      const href = (node as any).props?.href;
      const className = cn(
        (node as any).style?.className ?? 'px-4 py-2 bg-blue-600 text-white rounded text-center',
        nodeFontFamily && '[&>*]:font-[inherit]',
        interactiveClass,
        outlineClass
      );
      const inlineStyle: React.CSSProperties = {
        ...nodeStyle,
        ...((nodeStyleRaw as any)?.background ? { background: (nodeStyleRaw as any).background } : {}),
        ...(nodeStyleRaw?.backgroundColor ? { backgroundColor: nodeStyleRaw.backgroundColor } : {}),
        ...(typeof nodeStyleRaw?.borderRadius === 'number' ? { borderRadius: nodeStyleRaw.borderRadius } : {}),
      };
      if (href) {
        return (
          <>
            <a
              href={href}
              className={className}
              style={inlineStyle}
              // data-node-id used by ScopedStyle; disabled
              draggable={false}
              onDragStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                // Prevent navigation while editing in builder
                e.preventDefault();
                e.stopPropagation();
              }}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {label}
            </a>
            {/* <ScopedStyle nodeId={node.id} css={customCss} /> */}
          </>
        );
      }
      return (
        <>
          <button
            data-node-id={node.id}
            data-node-type={node.type}
            className={className}
            style={inlineStyle}
            // data-node-id used by ScopedStyle; disabled
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
          >
            {label}
          </button>
          {/* <ScopedStyle nodeId={node.id} css={customCss} /> */}
        </>
      );
    }
    case 'eventList': {
      const nodeStyleRaw = (node as any).style || {};
      const inlineStyle: React.CSSProperties = {
        ...nodeStyle,
        ...((nodeStyleRaw as any)?.background ? { background: (nodeStyleRaw as any).background } : {}),
        ...(nodeStyleRaw?.backgroundColor ? { backgroundColor: nodeStyleRaw.backgroundColor } : {}),
        ...(typeof nodeStyleRaw?.borderRadius === 'number' ? { borderRadius: nodeStyleRaw.borderRadius } : {}),
      };
      return (
        <>
          <div
            data-node-id={node.id}
            data-node-type={node.type}
            className={cn(
              nodeFontFamily && '[&>*]:font-[inherit] [&>*_*]:font-[inherit]',
              interactiveClass,
              outlineClass
            )}
            style={inlineStyle}
            // data-node-id used by ScopedStyle; disabled
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
          >
            <EventSection
              showFilters={(node as any).props?.showFilters !== false}
              eventName={(node as any).props?.eventName}
              lockedFilters={(node as any).props?.lockedFilters}
              title={(node as any).props?.title}
              showTitle={(node as any).props?.showTitle !== false}
            />
          </div>
          {/* <ScopedStyle nodeId={node.id} css={customCss} /> */}
        </>
      );
    }
    case 'map': {
      const nodeStyleRaw = (node as any).style || {};
      const url = (node as any).props?.embedUrl || '';
      const inlineStyle: React.CSSProperties = {
        ...nodeStyle,
        ...((nodeStyleRaw as any)?.background ? { background: (nodeStyleRaw as any).background } : {}),
        ...(nodeStyleRaw?.backgroundColor ? { backgroundColor: nodeStyleRaw.backgroundColor } : {}),
        ...(typeof nodeStyleRaw?.borderRadius === 'number' ? { borderRadius: nodeStyleRaw.borderRadius } : {}),
      };
      return (
        <div
          data-node-id={node.id}
          data-node-type={node.type}
          id={node.id}
          className={cn('block w-full', interactiveClass, outlineClass)}
          style={inlineStyle}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
        >
          <MapSection isEditing={false} data={{ embedUrl: url }} hideTitle unstyled disableInteractions />
        </div>
      );
    }
    case 'paypal': {
      const nodeStyleRaw = (node as any).style || {};
      const inlineStyle: React.CSSProperties = {
        ...nodeStyle,
        ...((nodeStyleRaw as any)?.background ? { background: (nodeStyleRaw as any).background } : {}),
        ...(nodeStyleRaw?.backgroundColor ? { backgroundColor: nodeStyleRaw.backgroundColor } : {}),
        ...(typeof nodeStyleRaw?.borderRadius === 'number' ? { borderRadius: nodeStyleRaw.borderRadius } : {}),
      };
      return (
        <div className={cn(interactiveClass, outlineClass)} style={inlineStyle} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} onClick={handleClick}>
          <PaypalSection data={{}} isEditing={false} />
        </div>
      );
    }
    case 'container': {
      const nodeStyleRaw = (node as any).style || {};
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
      // Render container div with nested children wrapped in DraggableNode for absolute positioning
      const containerContent = (node.children ?? []).map((c) => {
        const childHasLayout = !!c.layout?.units;
        if (childHasLayout && gridSize && onUpdateNodeLayout && sectionId && !forceFlowLayout) {
          const cachedPx = BuilderState.getNodePixelLayout(c.id);
          const hasCustomPx = cachedPx && cachedPx.sectionId === sectionId;
          const cx = hasCustomPx ? cachedPx!.x : unitsToPx(c.layout!.units.xu, gridSize);
          const cy = hasCustomPx ? cachedPx!.y : unitsToPx(c.layout!.units.yu, gridSize);
          const cw = hasCustomPx && typeof cachedPx!.w === 'number' ? cachedPx!.w : (c.layout?.units.wu ? unitsToPx(c.layout!.units.wu!, gridSize) : undefined);
          const ch = hasCustomPx && typeof cachedPx!.h === 'number' ? cachedPx!.h : (c.layout?.units.hu ? unitsToPx(c.layout!.units.hu!, gridSize) : undefined);
          const childRendered = renderNode(c, highlightNodeId, nodeFontFamily, sectionId, onNodeHover, onNodeClick, onNodeDoubleClick, hoveredNodeId, selectedNodeId, gridSize, onUpdateNodeLayout, forceFlowLayout, activeLocale, defaultLocale);
          return (
            <DraggableNode
              key={c.id}
              sectionId={sectionId}
              node={{
                ...c,
                layout: { units: c.layout!.units, px: { x: cx, y: cy, w: cw, h: ch } },
              }}
              gridSize={gridSize}
              defaultSize={{ w: cw, h: ch }}
              selected={selectedNodeId === c.id}
              onCommitLayout={(nodeId, units) => onUpdateNodeLayout(sectionId, nodeId, units)}
              onSelect={() => onNodeClick?.(sectionId, c.id)}
              onDoubleSelect={() => onNodeDoubleClick?.(sectionId, c.id)}
              render={() => childRendered}
              containerId={node.id}
              enforceChildFullSize={c.type === 'container' || c.type === 'button' || c.type === 'text'}
              allowContentPointerEvents
            />
          );
        } else {
          // Fallback for missing layout or params - render without wrapper
          if (!childHasLayout) console.warn(`Nested node ${c.id} missing layout.units - rendering as flow inside container.`);
          const childRendered = renderNode(c, highlightNodeId, nodeFontFamily, sectionId, onNodeHover, onNodeClick, onNodeDoubleClick, hoveredNodeId, selectedNodeId, gridSize, onUpdateNodeLayout, forceFlowLayout, activeLocale, defaultLocale);
          return <div key={c.id} className="relative">{childRendered}</div>;
        }
      });
      return (
        <>
          <div
            data-node-id={node.id}
            data-node-type={node.type}
            id={node.id}
            data-draggable="true"
            className={cn(
              'mx-auto relative',
              mwClass,
              pxClass,
              pyClass,
              nodeFontFamily && '[&>*]:font-[inherit] [&>*_*]:font-[inherit]',
              interactiveClass,
              outlineClass
            )}
            style={{
              ...nodeStyle,
              ...((nodeStyleRaw as any)?.background ? { background: (nodeStyleRaw as any).background } : {}),
              ...(nodeStyleRaw?.backgroundColor ? { backgroundColor: nodeStyleRaw.backgroundColor } : {}),
              ...(typeof nodeStyleRaw?.borderRadius === 'number' ? { borderRadius: nodeStyleRaw.borderRadius } : {}),
            }}
            // data-node-id used by ScopedStyle; disabled
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
          >
            {containerContent}
          </div>
          {/* <ScopedStyle nodeId={node.id} css={customCss} /> */}
        </>
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
    units: Partial<{ xu: number; yu: number; wu: number; hu: number }>
  ) => void;
  onNodeHover?: (nodeId: string | null) => void;
  onNodeClick?: (sectionId: string, nodeId: string) => void;
  onNodeDoubleClick?: (sectionId: string, nodeId: string) => void;
  activeLocale?: string;
  defaultLocale?: string;
}> = ({ page, highlightNodeId, hoveredNodeId, selectedNodeId, onUpdateNodeLayout, onNodeHover, onNodeClick, onNodeDoubleClick, activeLocale, defaultLocale }) => {
  const defaultFontFamily = (page as any).styleTokens?.defaultFontFamily as string | undefined;
  const defaultFontFallback = (page as any).styleTokens?.defaultFontFallback as string | undefined;
  const fontFamily = defaultFontFamily || defaultFontFallback;

  const [isInteracting, setIsInteracting] = useState<boolean>(
    Boolean(BuilderState.draggingNodeId || BuilderState.resizing || BuilderState.gridAdjustingSectionId)
  );

  const [activePaddingOverlay, setActivePaddingOverlay] = useState(BuilderState.paddingOverlay);

  useEffect(() => {
    const unsubscribe = BuilderState.subscribe(() => {
      setIsInteracting(Boolean(BuilderState.draggingNodeId || BuilderState.resizing || BuilderState.gridAdjustingSectionId));
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = BuilderState.onPaddingOverlayChange((payload) => setActivePaddingOverlay(payload));
    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <div
      className="w-full min-h-full"
      style={fontFamily ? ({ fontFamily } as React.CSSProperties) : undefined}
    >
      {page.sections.map((section: SectionV2) => {
        const bg = section.background?.className as string | undefined;
        const gridClass = section.grid?.className ?? '';
        const hasWidthClass = /(^|\s)w-/.test(gridClass);
        const gridClasses = cn(gridClass, !hasWidthClass && 'w-full');

        const gridSize = section.builderGrid?.gridSize ?? defaultGridSize;
        const gridEnabled = section.builderGrid?.showGrid ?? true;
        const shouldShowGrid = gridEnabled && isInteracting;

        // Get section-level font from styleTokens or page default
        const sectionFontFamily = (section.styleTokens as any)?.fontFamily || fontFamily;

        return (
          <section
            key={section.id}
            className={cn(
              'w-full relative',
              bg,
              sectionFontFamily && '[&>*]:font-[inherit] [&>*_*]:font-[inherit]'
            )}
            style={{
              ...(section.background?.style as React.CSSProperties),
              ...(sectionFontFamily ? { fontFamily: sectionFontFamily } : {}),
              minHeight: `${(section.heightPercent ?? 100)}vh`,
            }}
          >
            {gridEnabled && (
              <div className="pointer-events-none absolute inset-0">
                <GridOverlay gridSize={gridSize} active={shouldShowGrid} />
              </div>
            )}

            {/* Content wrapper with original grid classes for layout constraints - remains relative for absolute children */}
            <div
              className={cn(gridClasses, 'relative h-full min-h-full')}
              id={`section-content-${section.id}`}
              style={{ minHeight: 'inherit', position: 'relative' }}
            >
              {section.children.map((node) => {
                const hasLayout = !!node.layout?.units;
                const locked = section.lockLayout === true;
                let rendered: React.ReactNode;
                if (hasLayout && !locked) {
                  const cachedPx = BuilderState.getNodePixelLayout(node.id);
                  const hasCustomPx = cachedPx && cachedPx.sectionId === section.id;
                  const x = hasCustomPx ? cachedPx!.x : unitsToPx(node.layout!.units.xu, gridSize);
                  const y = hasCustomPx ? cachedPx!.y : unitsToPx(node.layout!.units.yu, gridSize);
                  const w = hasCustomPx && typeof cachedPx!.w === 'number' ? cachedPx!.w : (node.layout?.units.wu ? unitsToPx(node.layout!.units.wu!, gridSize) : undefined);
                  const h = hasCustomPx && typeof cachedPx!.h === 'number' ? cachedPx!.h : (node.layout?.units.hu ? unitsToPx(node.layout!.units.hu!, gridSize) : undefined);
                  rendered = renderNode(node, highlightNodeId, sectionFontFamily, section.id, onNodeHover, onNodeClick, onNodeDoubleClick, hoveredNodeId, selectedNodeId, gridSize, onUpdateNodeLayout, false, activeLocale, defaultLocale);

                  const handleCommitLayout = (nodeId: string, units: Partial<{ xu: number; yu: number; wu: number; hu: number }>) => {
                    if (node.type !== 'container') {
                      onUpdateNodeLayout(section.id, nodeId, units as any);
                      return;
                    }

                    // Removed unused prevPx to satisfy linter after child delta removal
                    const prevUnits = node.layout?.units ?? { xu: 0, yu: 0, wu: node.layout?.units?.wu, hu: node.layout?.units?.hu };

                    const nextUnits = {
                      xu: units.xu ?? prevUnits.xu ?? 0,
                      yu: units.yu ?? prevUnits.yu ?? 0,
                      wu: units.wu ?? prevUnits.wu,
                      hu: units.hu ?? prevUnits.hu,
                    };

                    onUpdateNodeLayout(section.id, nodeId, nextUnits);
                  };

                  return (
                    <DraggableNode
                      key={node.id}
                      sectionId={section.id}
                      node={{
                        ...node,
                        layout: { units: node.layout!.units, px: { x, y, w, h } },
                      }}
                      gridSize={gridSize}
                      defaultSize={{ w, h }}
                      selected={node.id === selectedNodeId}
                      onCommitLayout={handleCommitLayout}
                      onSelect={() => !locked && onNodeClick?.(section.id, node.id)}
                      onDoubleSelect={() => !locked && onNodeDoubleClick?.(section.id, node.id)}
                      render={() => rendered}
                      containerId={`section-content-${section.id}`}
                      enforceChildFullSize={node.type === 'container' || node.type === 'button' || node.type === 'text'}
                      allowContentPointerEvents={node.type === 'container' || node.type === 'button'}
                      disabled={locked}
                    />
                  );
                } else {
                  // Flow layout for locked sections or nodes without layout
                  rendered = renderNode(node, highlightNodeId, sectionFontFamily, section.id, onNodeHover, onNodeClick, onNodeDoubleClick, hoveredNodeId, selectedNodeId, gridSize, onUpdateNodeLayout, locked, activeLocale, defaultLocale);
                  return <div key={node.id} className="relative">{rendered}</div>;
                }
              })}

              {activePaddingOverlay && activePaddingOverlay.sectionId === section.id && activePaddingOverlay.nodeId && (
                <PaddingOverlay layer={activePaddingOverlay} />
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
};
