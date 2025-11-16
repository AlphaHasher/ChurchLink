// DynamicPageV2RendererBuilder.tsx - Builder-specific renderer with grid and draggable support
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { GridOverlay } from './GridOverlay';
import { DraggableNode } from './DraggableNode';
import { makeVirtualTransform, VirtualTransform } from './virtualGrid';
import { PageV2, SectionV2, Node } from '@/shared/types/pageV2';
import EventSection from '@sections/EventSection';
import MapSection from '@sections/MapSection';
import ServiceTimesSection from '@sections/ServiceTimesSection';
import MenuSection from '@sections/MenuSection';
import ContactInfoSection from '@sections/ContactInfoSection';
import PaypalSection from '@sections/PaypalSection';
// import ScopedStyle from '@/shared/components/ScopedStyle';
import { ActivePaddingOverlay, BuilderState } from '@/features/webeditor/state/BuilderState';
import { getPublicUrl } from '@/helpers/MediaInteraction';
import { useLocalize } from '@/shared/utils/localizationUtils';

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


type PaddingOverlayProps = {
  layer: ActivePaddingOverlay | null;
  transform: VirtualTransform | null;
  node: Node | null;
};

const PaddingOverlay: React.FC<PaddingOverlayProps> = ({ layer, transform, node }) => {
  const [overlay, setOverlay] = React.useState<ActivePaddingOverlay | null>(layer ?? BuilderState.paddingOverlay);

  React.useEffect(() => {
    const unsub = BuilderState.onPaddingOverlayChange((next) => setOverlay(next));
    return unsub;
  }, []);

  const data = overlay ?? layer;
  if (!data || !transform || !node || !node.layout?.units) return null;
  const { values } = data;
  const [top, right, bottom, left] = values;
  const { x, y, w, h } = transform.toPx(node.layout.units);

  return (
    <div className="absolute inset-0 pointer-events-none">
      <div
        className="absolute"
        style={{
          left: x,
          top: y,
          width: w,
          height: h,
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

/**
 * Concatenates class name fragments into a single space-separated string.
 *
 * @param classes - Class name fragments; falsy values (`undefined`, `null`, `false`, `''`) are ignored.
 * @returns A space-separated string of the truthy class names, or an empty string if none are provided.
 */
function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(' ');
}


/**
 * Retrieve a localized property value for a node, falling back to the node's base prop.
 *
 * Checks the node's `i18n` map for `activeLocale` (or `defaultLocale` when `activeLocale` is absent)
 * and returns the keyed value if present; otherwise returns `node.props?.[key]`.
 *
 * @param node - The node object containing optional `i18n` and `props`.
 * @param key - The property key to look up.
 * @param activeLocale - Preferred locale to resolve the property.
 * @param defaultLocale - Locale to use if `activeLocale` is not provided.
 * @returns The localized value for `key` when available for the chosen locale, otherwise the node's prop value for `key`, or `undefined` if not found.
 */
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
  transform?: VirtualTransform,  
  onUpdateNodeLayout?: (sectionId: string, nodeId: string, units: Partial<{ xu: number; yu: number; wu: number; hu: number }>) => void,  // Added for nested commits
  forceFlowLayout?: boolean,
  activeLocale?: string,
  defaultLocale?: string,
  localizeFn?: (text: string) => string,
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
      const directHtml = resolveLocalizedProp(node, 'html', activeLocale, defaultLocale);
      const baseHtml = (node as any).props?.html ?? (node as any).props?.text ?? '';
      const html = (directHtml != null && String(directHtml).trim())
        ? directHtml
        : ((activeLocale && activeLocale !== 'en' && baseHtml && localizeFn)
            ? localizeFn(String(baseHtml))
            : String(baseHtml));
      const align = (node as any).props?.align ?? 'left';
      const variant = (node as any).props?.variant ?? 'p';
      const nodeStyleRaw = (node as any).style || {};
      const paddingY = nodeStyleRaw?.paddingY ?? 0;
      const paddingX = nodeStyleRaw?.paddingX ?? 0;
      const textStyles = nodeStyleRaw?.textStyles || [];
      const fontSize = nodeStyleRaw?.fontSize;
      const fontWeight = nodeStyleRaw?.fontWeight;
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

      const paddingStyles: React.CSSProperties = transform ? {
        ...(typeof paddingTop === 'number' ? { paddingTop: paddingTop * transform.cellPx } : {}),
        ...(typeof paddingBottom === 'number' ? { paddingBottom: paddingBottom * transform.cellPx } : {}),
        ...(typeof paddingLeft === 'number' ? { paddingLeft: paddingLeft * transform.cellPx } : {}),
        ...(typeof paddingRight === 'number' ? { paddingRight: paddingRight * transform.cellPx } : {}),
      } : {};

      const wrapperStyle: React.CSSProperties = {
        ...nodeStyle,
        width: '100%',
        height: '100%',
        display: 'block',
        ...((nodeStyleRaw as any)?.background ? { background: (nodeStyleRaw as any).background } : {}),
        ...(backgroundColor ? { backgroundColor } : {}),
        ...(typeof borderRadius === 'number' ? { borderRadius } : {}),
        ...paddingStyles,
      };

      const gridScale = transform ? (transform.cellPx / 16) : 1; // scale relative to grid cell size
      const baseRemByVariant: Record<string, number> = {
        h1: 2.25,
        h2: 1.875,
        h3: 1.5,
        lead: 1.25,
        muted: 0.875,
        p: 1,
      };
      const effectiveRem =
        typeof fontSize === 'number' && fontSize > 0
          ? fontSize
          : (baseRemByVariant[variant] ?? 1);
      const innerStyle: React.CSSProperties = {
        fontSize: `${effectiveRem * 16 * gridScale}px`,
        ...(fontWeight && fontWeight !== 400 ? { fontWeight } : {}),
        ...(elementFontFamily ? { fontFamily: elementFontFamily } : {}),
        ...(isUnderline && underlineThickness ? { textDecorationThickness: `${underlineThickness * gridScale}px` } : {}),
        ...(color ? { color } : {}),
      };

      const nodeClassName = nodeStyleRaw?.className;

      return (
        <>
          <div
            data-node-id={node.id}
            data-node-type={node.type}
            className={cn(
              'block w-full h-full align-top break-words',
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
      const directAlt = resolveLocalizedProp(node, 'alt', activeLocale, defaultLocale);
      const baseAlt = (node as any).props?.alt || '';
      const alt = (directAlt != null && String(directAlt).trim())
        ? directAlt
        : ((activeLocale && activeLocale !== 'en' && baseAlt && localizeFn)
            ? localizeFn(String(baseAlt))
            : String(baseAlt));
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
      const direct = resolveLocalizedProp(node, 'label', activeLocale, defaultLocale);
      const baseLabel = (node as any).props?.label ?? 'Button';
      const label = (direct != null && String(direct).trim())
        ? direct
        : ((activeLocale && activeLocale !== 'en' && baseLabel && localizeFn)
            ? localizeFn(String(baseLabel))
            : String(baseLabel));
      const href = (node as any).props?.href;
      const className = cn(
        (node as any).style?.className ?? 'px-4 py-2 bg-blue-600 text-white rounded text-center',
        nodeFontFamily && '[&>*]:font-[inherit]',
        interactiveClass,
        outlineClass
      );
      const gridScaleBtn = transform ? (transform.cellPx / 16) : 1;
      const fontSizeRemBtn = typeof (nodeStyleRaw as any)?.fontSize === 'number' ? (nodeStyleRaw as any).fontSize : 1; // default 1rem
      const inlineStyle: React.CSSProperties = {
        ...nodeStyle,
        ...((nodeStyleRaw as any)?.background ? { background: (nodeStyleRaw as any).background } : {}),
        ...(nodeStyleRaw?.backgroundColor ? { backgroundColor: nodeStyleRaw.backgroundColor } : {}),
        ...(typeof nodeStyleRaw?.borderRadius === 'number' ? { borderRadius: nodeStyleRaw.borderRadius } : {}),
        fontSize: `${fontSizeRemBtn * 16 * gridScaleBtn}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        margin: 0,
        whiteSpace: 'nowrap',
        width: '100%',
        height: '100%',
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
          <MapSection isEditing={false} data={{ embedUrl: url }} hideTitle disableInteractions />
        </div>
      );
    }
    case 'serviceTimes': {
      const nodeStyleRaw = (node as any).style || {};
      const inlineStyle: React.CSSProperties = {
        ...nodeStyle,
        ...((nodeStyleRaw as any)?.background ? { background: (nodeStyleRaw as any).background } : {}),
        ...(nodeStyleRaw?.backgroundColor ? { backgroundColor: nodeStyleRaw.backgroundColor } : {}),
        ...(typeof nodeStyleRaw?.borderRadius === 'number' ? { borderRadius: nodeStyleRaw.borderRadius } : {}),
      };
      const defaultData = { title: 'Service Times', times: [{ label: 'Sunday', time: '9:00 AM' }, { label: 'Sunday', time: '11:00 AM' }] };
      const data = (node as any).props?.data ?? defaultData;
      return (
        <div
          data-node-id={node.id}
          data-node-type={node.type}
          className={cn(interactiveClass, outlineClass)}
          style={inlineStyle}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
        >
          <ServiceTimesSection data={data} isEditing={false} />
        </div>
      );
    }
    case 'menu': {
      const nodeStyleRaw = (node as any).style || {};
      const inlineStyle: React.CSSProperties = {
        ...nodeStyle,
        ...((nodeStyleRaw as any)?.background ? { background: (nodeStyleRaw as any).background } : {}),
        ...(nodeStyleRaw?.backgroundColor ? { backgroundColor: nodeStyleRaw.backgroundColor } : {}),
        ...(typeof nodeStyleRaw?.borderRadius === 'number' ? { borderRadius: nodeStyleRaw.borderRadius } : {}),
      };
      const defaultData = { items: [] as Array<{ title: string; imageUrl: string; description?: string; linkUrl?: string }> };
      const data = (node as any).props?.data ?? defaultData;
      return (
        <div
          data-node-id={node.id}
          data-node-type={node.type}
          className={cn(interactiveClass, outlineClass)}
          style={inlineStyle}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
        >
          <MenuSection data={data} isEditing={false} />
        </div>
      );
    }
    case 'contactInfo': {
      const nodeStyleRaw = (node as any).style || {};
      const inlineStyle: React.CSSProperties = {
        ...nodeStyle,
        ...((nodeStyleRaw as any)?.background ? { background: (nodeStyleRaw as any).background } : {}),
        ...(nodeStyleRaw?.backgroundColor ? { backgroundColor: nodeStyleRaw.backgroundColor } : {}),
        ...(typeof nodeStyleRaw?.borderRadius === 'number' ? { borderRadius: nodeStyleRaw.borderRadius } : {}),
      };
      const defaultData = { items: [{ label: 'Phone', value: '(555) 123-4567' }, { label: 'Email', value: 'hello@yourchurch.org' }] };
      const data = (node as any).props?.data ?? defaultData;
      return (
        <div
          data-node-id={node.id}
          data-node-type={node.type}
          className={cn(interactiveClass, outlineClass)}
          style={inlineStyle}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
        >
          <ContactInfoSection data={data} isEditing={false} />
        </div>
      );
    }
    case 'paypal': {
      const nodeStyleRaw = (node as any).style || {};
      const BASE_W = 200;
      const BASE_H = 200;
      let scale = 1;
      if (!forceFlowLayout && transform && (node as any)?.layout?.units) {
        const size = transform.toPx((node as any).layout.units);
        const w = (size && typeof size.w === 'number') ? size.w : 0;
        const h = (size && typeof size.h === 'number') ? size.h : 0;
        const widthScale = w > 0 ? (w / BASE_W) : 1;
        const heightScale = h > 0 ? (h / BASE_H) : 1;
        scale = Math.max(0.2, Math.min(widthScale, heightScale));
      } else if (!forceFlowLayout && transform) {
        scale = Math.max(0.2, transform.cellPx / 16);
      }
      const inlineStyle: React.CSSProperties = {
        ...nodeStyle,
        ...((nodeStyleRaw as any)?.background ? { background: (nodeStyleRaw as any).background } : {}),
        ...(nodeStyleRaw?.backgroundColor ? { backgroundColor: nodeStyleRaw.backgroundColor } : {}),
        ...(typeof nodeStyleRaw?.borderRadius === 'number' ? { borderRadius: nodeStyleRaw.borderRadius } : {}),
        display: 'block',
        width: '100%',
        overflow: 'visible',
      };
      if (forceFlowLayout) {
        return (
          <div
            className={cn(interactiveClass, outlineClass)}
            style={inlineStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
          >
            <PaypalSection data={{}} isEditing={false} />
          </div>
        );
      } else {
        return (
          <div
            className={cn(interactiveClass, outlineClass)}
            style={inlineStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
          >
            <div
              style={{
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                width: `${100 / (scale || 1)}%`,
              }}
            >
              <PaypalSection data={{}} isEditing={false} />
            </div>
          </div>
        );
      }
    }
    case 'container': {
      const nodeStyleRaw = (node as any).style || {};
      const maxWidthToken = (node as any).props?.maxWidth ?? 'xl';
      const paddingXToken = (node as any).props?.paddingX ?? 4;
      const paddingYToken = (node as any).props?.paddingY ?? 6;

      const tailwindSpacingPx = (value: number) => value * 4;
      const tailwindMaxWidthPx: Record<string, number | undefined> = {
        full: undefined,
        '2xl': 1280,
        xl: 1152,
        lg: 1024,
        md: 768,
      };

      const innerMaxWidth = tailwindMaxWidthPx[maxWidthToken] ?? undefined;
      const innerPaddingStyle: React.CSSProperties = {
        width: '100%',
        height: '100%',
        paddingLeft: tailwindSpacingPx(paddingXToken),
        paddingRight: tailwindSpacingPx(paddingXToken),
        paddingTop: tailwindSpacingPx(paddingYToken),
        paddingBottom: tailwindSpacingPx(paddingYToken),
        ...(innerMaxWidth ? { maxWidth: innerMaxWidth, marginLeft: 'auto', marginRight: 'auto' } : {}),
        ...(nodeFontFamily ? { fontFamily: nodeFontFamily } : {}),
      };
      // Render container div with nested children wrapped in DraggableNode for absolute positioning
      const containerContent = (node.children ?? []).map((c) => {
        const childHasLayout = !!c.layout?.units;
        if (childHasLayout && transform && onUpdateNodeLayout && sectionId && !forceFlowLayout) {
          const childSize = transform.toPx(c.layout!.units);
          const cw = childSize.w;
          const ch = childSize.h;
          const childRendered = renderNode(c, highlightNodeId, nodeFontFamily, sectionId, onNodeHover, onNodeClick, onNodeDoubleClick, hoveredNodeId, selectedNodeId, transform, onUpdateNodeLayout, forceFlowLayout, activeLocale, defaultLocale, localizeFn);
          return (
            <DraggableNode
              key={c.id}
              sectionId={sectionId}
              node={{
                ...c,
                layout: { units: c.layout!.units },
              }}
              transform={transform}
              defaultSize={{ w: cw, h: ch }}
              selected={selectedNodeId === c.id}
              onCommitLayout={(nodeId, units) => onUpdateNodeLayout(sectionId, nodeId, units)}
              onSelect={() => onNodeClick?.(sectionId, c.id)}
              onDoubleSelect={() => onNodeDoubleClick?.(sectionId, c.id)}
              render={() => childRendered}
              containerId={node.id}
              parentUnits={
                (() => {
                  const u = node.layout?.units;
                  return u && typeof u.xu === 'number' && typeof u.yu === 'number' && typeof u.wu === 'number' && typeof u.hu === 'number'
                    ? { xu: u.xu, yu: u.yu, wu: u.wu, hu: u.hu }
                    : undefined;
                })()
              }
              enforceChildFullSize
              allowContentPointerEvents
            />
          );
        } else {
          // Fallback for missing layout or params - render without wrapper
          if (!childHasLayout && process.env.NODE_ENV === 'development') {
            console.warn(`Nested node ${c.id} missing layout.units - rendering as flow inside container.`);
          }
          const childRendered = renderNode(c, highlightNodeId, nodeFontFamily, sectionId, onNodeHover, onNodeClick, onNodeDoubleClick, hoveredNodeId, selectedNodeId, transform, onUpdateNodeLayout, forceFlowLayout, activeLocale, defaultLocale);
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
              'relative',
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
            <div style={innerPaddingStyle}>
              {containerContent}
            </div>
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
  const localize = useLocalize();

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

        const gridEnabled = section.builderGrid?.showGrid ?? true;
        const shouldShowGrid = gridEnabled && isInteracting;

        // Get section-level font from styleTokens or page default
        const sectionFontFamily = (section.styleTokens as any)?.fontFamily || fontFamily;

        const cols = section.builderGrid?.cols ?? 64;
        const aspect = section.builderGrid?.aspect ?? { num: 16, den: 9 };

        return (
          <SectionWithVirtualGrid
            key={section.id}
            section={section}
            bg={bg}
            gridClasses={gridClasses}
            sectionFontFamily={sectionFontFamily}
            gridEnabled={gridEnabled}
            shouldShowGrid={shouldShowGrid}
            cols={cols}
            aspect={aspect}
            highlightNodeId={highlightNodeId}
            hoveredNodeId={hoveredNodeId}
            selectedNodeId={selectedNodeId}
            onNodeHover={onNodeHover}
            onNodeClick={onNodeClick}
            onNodeDoubleClick={onNodeDoubleClick}
            onUpdateNodeLayout={onUpdateNodeLayout}
            activeLocale={activeLocale}
            defaultLocale={defaultLocale}
            localize={localize}
            activePaddingOverlay={activePaddingOverlay}
          />
        );
      })}
    </div>
  );
};

// Component that measures container and computes virtual transform
const SectionWithVirtualGrid: React.FC<{
  section: SectionV2;
  bg?: string;
  gridClasses: string;
  sectionFontFamily?: string;
  gridEnabled: boolean;
  shouldShowGrid: boolean;
  cols: number;
  aspect: { num: number; den: number };
  highlightNodeId?: string;
  hoveredNodeId?: string | null;
  selectedNodeId?: string | null;
  onNodeHover?: (nodeId: string | null) => void;
  onNodeClick?: (sectionId: string, nodeId: string) => void;
  onNodeDoubleClick?: (sectionId: string, nodeId: string) => void;
  onUpdateNodeLayout: (sectionId: string, nodeId: string, units: Partial<{ xu: number; yu: number; wu: number; hu: number }>) => void;
  activeLocale?: string;
  defaultLocale?: string;
  localize?: (text: string) => string;
  activePaddingOverlay: ActivePaddingOverlay | null;
}> = ({
  section,
  bg,
  gridClasses,
  sectionFontFamily,
  gridEnabled,
  shouldShowGrid,
  cols,
  aspect,
  highlightNodeId,
  hoveredNodeId,
  selectedNodeId,
  onNodeHover,
  onNodeClick,
  onNodeDoubleClick,
  onUpdateNodeLayout,
  activeLocale,
  defaultLocale,
  localize,
  activePaddingOverlay,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<VirtualTransform | null>(null);

  const updateTransform = useCallback(() => {
    if (!contentRef.current) return;
    const rect = contentRef.current.getBoundingClientRect();
    const hasInvalidCols = typeof cols !== 'number' || cols <= 0 || Number.isNaN(cols);
    const hasInvalidAspectNum = !aspect || typeof aspect.num !== 'number' || aspect.num <= 0 || Number.isNaN(aspect.num);
    const safeCols = hasInvalidCols ? 1 : cols;
    const safeAspectNum = hasInvalidAspectNum ? 1 : aspect.num;
    const hasInvalidAspectDen = !aspect || typeof aspect.den !== 'number' || aspect.den <= 0 || Number.isNaN(aspect.den);
    const safeAspectDen = hasInvalidAspectDen ? 1 : aspect.den;
    if (hasInvalidCols || hasInvalidAspectNum || hasInvalidAspectDen) {
      console.warn('SectionWithVirtualGrid: Invalid grid config detected; coercing to safe defaults.', {
        cols,
        aspect,
      });
    }
    const virtualHeightPx = rect.width * safeAspectDen / safeAspectNum;
    const newTransform = makeVirtualTransform(
      { width: rect.width, height: virtualHeightPx },
      safeCols,
      { num: safeAspectNum, den: safeAspectDen }
    );
    setTransform(newTransform);
  }, [cols, aspect, aspect?.den]);

  useEffect(() => {
    updateTransform();
    const resizeObserver = new ResizeObserver(() => {
      updateTransform();
    });
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }
    return () => {
      resizeObserver.disconnect();
    };
  }, [updateTransform]);

  const locked = section.lockLayout === true;
  const rootContainerNode = (section.children || []).find((n) => n.type === 'container') || null;
  const rootContainerId = rootContainerNode?.id;

  return (
    <section
      className={cn(
        'w-full relative',
        bg,
        sectionFontFamily && '[&>*]:font-[inherit] [&>*_*]:font-[inherit]'
      )}
      style={{
        ...(section.background?.style as React.CSSProperties),
        ...(sectionFontFamily ? { fontFamily: sectionFontFamily } : {}),
        ...(locked
          ? {}
          : { height: transform ? (transform.rows * transform.cellPx) : `${(section.heightPercent ?? 100)}vh` }),
      }}
    >
      {gridEnabled && transform && (
        <div className="pointer-events-none absolute inset-0">
          <GridOverlay
            cellPx={transform.cellPx}
            offsetX={transform.offsetX}
            offsetY={transform.offsetY}
            active={shouldShowGrid}
          />
        </div>
      )}

      {/* Content wrapper with original grid classes for layout constraints - remains relative for absolute children */}
      <div
        ref={contentRef}
        className={cn(gridClasses, 'relative', !locked && 'h-full min-h-full')}
        id={`section-content-${section.id}`}
        style={{ ...(locked ? {} : { minHeight: 'inherit' }), position: 'relative' }}
      >
        {transform &&
          (() => {
            const sectionUnits = { xu: 0, yu: 0, wu: transform.cols, hu: transform.rows };
            const normalizeUnits = (units?: { xu?: number; yu?: number; wu?: number; hu?: number } | null, fallback = sectionUnits) => ({
              xu: typeof units?.xu === 'number' ? units.xu : fallback.xu,
              yu: typeof units?.yu === 'number' ? units.yu : fallback.yu,
              wu: typeof units?.wu === 'number' ? units.wu : fallback.wu,
              hu: typeof units?.hu === 'number' ? units.hu : fallback.hu,
            });
            const rootUnits = normalizeUnits(rootContainerNode?.layout?.units, sectionUnits);

            return section.children.map((node) => {
              const hasLayout = !!node.layout?.units;
              let rendered: React.ReactNode;
              if (hasLayout && !locked) {
                const topLevelSize = transform.toPx(node.layout!.units);
                const w = topLevelSize.w;
                const h = topLevelSize.h;
                rendered = renderNode(node, highlightNodeId, sectionFontFamily, section.id, onNodeHover, onNodeClick, onNodeDoubleClick, hoveredNodeId, selectedNodeId, transform, onUpdateNodeLayout, false, activeLocale, defaultLocale, localize);

                const handleCommitLayout = (nodeId: string, units: Partial<{ xu: number; yu: number; wu: number; hu: number }>) => {
                  if (node.type !== 'container') {
                    onUpdateNodeLayout(section.id, nodeId, units as any);
                    return;
                  }

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
                      layout: { units: node.layout!.units },
                    }}
                    transform={transform}
                    defaultSize={{ w, h }}
                    selected={node.id === selectedNodeId}
                    onCommitLayout={handleCommitLayout}
                    onSelect={() => !locked && onNodeClick?.(section.id, node.id)}
                    onDoubleSelect={() => !locked && onNodeDoubleClick?.(section.id, node.id)}
                    render={() => rendered}
                    containerId={node.type === 'container' ? `section-content-${section.id}` : (rootContainerId ?? `section-content-${section.id}`)}
                    parentUnits={node.type === 'container' ? sectionUnits : rootUnits}
                    enforceChildFullSize
                    allowContentPointerEvents={node.type === 'container' || node.type === 'button'}
                    disabled={locked}
                  />
                );
              } else {
                rendered = renderNode(node, highlightNodeId, sectionFontFamily, section.id, onNodeHover, onNodeClick, onNodeDoubleClick, hoveredNodeId, selectedNodeId, transform, onUpdateNodeLayout, locked, activeLocale, defaultLocale, localize);
                return <div key={node.id} className="relative">{rendered}</div>;
              }
            });
          })()}

        {activePaddingOverlay && activePaddingOverlay.sectionId === section.id && activePaddingOverlay.nodeId && transform && (
          <PaddingOverlay
            layer={activePaddingOverlay}
            transform={transform}
            node={section.children.find((n) => n.id === activePaddingOverlay.nodeId) ?? null}
          />
        )}
      </div>
    </section>
  );
};