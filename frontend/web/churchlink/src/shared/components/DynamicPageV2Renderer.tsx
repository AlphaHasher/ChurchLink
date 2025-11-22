import React from "react";
import EventSection from "@/features/admin/components/WebBuilder/sections/EventSection";
import MapSection from "@sections/MapSection";
import ServiceTimesSection from "@sections/ServiceTimesSection";
import MenuSection from "@sections/MenuSection";
import ContactInfoSection from "@sections/ContactInfoSection";
import PaypalSection from "@sections/PaypalSection";
import { PageV2, SectionV2, Node } from "@/shared/types/pageV2";
import { getPublicUrl } from "@/helpers/MediaInteraction";
import { useLocalize } from "@/shared/utils/localizationUtils";
import { makeVirtualTransform, VirtualTransform } from "@/features/webeditor/grid/virtualGrid";
import { cn } from "@/lib/utils";
import DOMPurify from 'dompurify';

const highlightClass = (node: Node, highlightNodeId?: string) =>
  node.id === highlightNodeId ? "outline outline-2 outline-red-500/70" : undefined;

function enforceFullSize(content: React.ReactNode): React.ReactNode {
  // If content is a Fragment, promote its children and wrap them for size enforcement
  if (React.isValidElement(content) && (content as any).type === React.Fragment) {
    const children = React.Children.toArray(
      (content as any).props?.children ?? []
    );
    const filled = children.map((child) => {
      if (!React.isValidElement<any>(child)) return child;
      const existingStyle: any = (child.props && (child.props as any).style) || {};
      const existingClass: any = (child.props && (child.props as any).className) || "";
      const mergedStyle: React.CSSProperties = {
        ...existingStyle,
        width: (existingStyle as any).width ?? "100%",
        height: (existingStyle as any).height ?? "100%",
      };
      const mergedClassName = cn(existingClass, "block", "w-full", "h-full");
      return React.cloneElement(child as React.ReactElement<any>, {
        className: mergedClassName,
        style: mergedStyle,
      } as any);
    });
    return (
      <div className="block w-full h-full" style={{ width: "100%", height: "100%" }}>
        {filled}
      </div>
    );
  }

  // Non-element -> wrap in a full-size container
  if (!React.isValidElement(content)) {
    return (
      <div className="block w-full h-full" style={{ width: "100%", height: "100%" }}>
        {content}
      </div>
    );
  }

  // Regular element -> clone with enforced width/height
  const element: React.ReactElement<any> = content as React.ReactElement<any>;
  const existingStyle = (element.props && element.props.style) || {};
  const existingClass = (element.props && element.props.className) || "";
  const mergedStyle: React.CSSProperties = {
    ...existingStyle,
    width: (existingStyle as any).width ?? "100%",
    height: (existingStyle as any).height ?? "100%",
  };
  const mergedClassName = cn(existingClass, "block", "w-full", "h-full");
  return React.cloneElement(element, { className: mergedClassName, style: mergedStyle });
}

function enforceWidthOnly(content: React.ReactNode): React.ReactNode {
  if (React.isValidElement(content) && (content as any).type === React.Fragment) {
    const children = React.Children.toArray((content as any).props?.children ?? []);
    const filled = children.map((child) => {
      if (!React.isValidElement<any>(child)) return child;
      const existingStyle: any = (child.props && (child.props as any).style) || {};
      const existingClass: any = (child.props && (child.props as any).className) || "";
      const mergedStyle: React.CSSProperties = {
        ...existingStyle,
        width: (existingStyle as any).width ?? "100%",
      };
      const mergedClassName = cn(existingClass, "block", "w-full");
      return React.cloneElement(child as React.ReactElement<any>, {
        className: mergedClassName,
        style: mergedStyle,
      } as any);
    });
    return (
      <div className="block w-full" style={{ width: "100%" }}>
        {filled}
      </div>
    );
  }
  if (!React.isValidElement(content)) {
    return (
      <div className="block w-full" style={{ width: "100%" }}>
        {content}
      </div>
    );
  }
  const element: React.ReactElement<any> = content as React.ReactElement<any>;
  const existingStyle = (element.props && element.props.style) || {};
  const existingClass = (element.props && element.props.className) || "";
  const mergedStyle: React.CSSProperties = {
    ...existingStyle,
    width: (existingStyle as any).width ?? "100%",
  };
  const mergedClassName = cn(existingClass, "block", "w-full");
  return React.cloneElement(element, { className: mergedClassName, style: mergedStyle });
}

function resolveLocalizedProp(node: Node, key: string, activeLocale?: string, defaultLocale?: string): any {
  const i18n = (node as any).i18n as Record<string, Record<string, any>> | undefined;
  const locale = activeLocale || defaultLocale;
  if (locale && i18n && i18n[locale] && Object.prototype.hasOwnProperty.call(i18n[locale], key)) {
    return i18n[locale][key];
  }
  return (node as any).props?.[key];
}

const renderNode = (
  node: Node,
  highlightNodeId?: string,
  sectionFontFamily?: string,
  transform?: VirtualTransform | null,
  forceFlowLayout?: boolean,
  activeLocale?: string,
  defaultLocale?: string,
  localizeFn?: (text: string) => string,
  domOffsets?: Record<string, { x: number; y: number }>
): React.ReactNode => {
  const nodeFontFamily = (node as any).style?.fontFamily || sectionFontFamily;
  const nodeStyleRaw = (node as any).style || {};
  // const customCss = (nodeStyleRaw as any).customCss as string | undefined; // disabled
  const nodeStyle: React.CSSProperties = {
    ...(nodeFontFamily ? { fontFamily: nodeFontFamily } : {}),
    ...((nodeStyleRaw as any)?.background ? { background: (nodeStyleRaw as any).background } : {}),
    ...(nodeStyleRaw?.backgroundColor ? { backgroundColor: nodeStyleRaw.backgroundColor } : {}),
    ...(typeof nodeStyleRaw?.borderRadius === "number" ? { borderRadius: nodeStyleRaw.borderRadius } : {}),
  };

  switch (node.type) {
    case "text": {
      const directHtml = resolveLocalizedProp(node, 'html', activeLocale, defaultLocale);
      const baseHtml = (node as any).props?.html ?? (node as any).props?.text ?? "";
      const isNonDefaultLocale = !!activeLocale && activeLocale !== 'en';
      let htmlToInject = (directHtml != null && String(directHtml).trim())
        ? String(directHtml)
        : ((isNonDefaultLocale && baseHtml && localizeFn)
          ? localizeFn(String(baseHtml))
          : String(baseHtml));

      // Sanitize user-controlled HTML to prevent XSS attacks; DOMPurify strips dangerous tags/attrs
      // (e.g., <script>, onload) while allowing safe text formatting. Defaults block unsafe URI schemes like javascript:.
      const sanitizedHtml = DOMPurify.sanitize(htmlToInject, {
        ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'u', 'br', 'ul', 'ol', 'li', 'a'],
        ALLOWED_ATTR: ['href', 'target', 'rel'], // Safe attrs only; no onclick, style, etc.
        ALLOW_DATA_ATTR: false,
      });

      const align = (node as any).props?.align ?? "left";
      const variant = (node as any).props?.variant ?? "p";
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

      const Tag = ["h1", "h2", "h3"].includes(variant) ? (variant as any) : "p";

      // Derive per-side paddings consistent with builder
      const paddingTop = nodeStyleRaw?.paddingTop ?? paddingY;
      const paddingBottom = nodeStyleRaw?.paddingBottom ?? paddingY;
      const paddingLeft = nodeStyleRaw?.paddingLeft ?? paddingX ?? paddingY;
      const paddingRight = nodeStyleRaw?.paddingRight ?? paddingX ?? paddingY;

      const isItalic = textStyles.includes("italic");
      const isUnderline = textStyles.includes("underline");

      // Wrapper fills the node box; background and paddings apply to wrapper
      const wrapperStyle: React.CSSProperties = {
        ...nodeStyle,
        ...(backgroundColor ? { backgroundColor } : {}),
        ...(typeof borderRadius === "number" ? { borderRadius } : {}),
        ...(typeof paddingTop === "number" && transform ? { paddingTop: paddingTop * transform.cellPx } : {}),
        ...(typeof paddingBottom === "number" && transform ? { paddingBottom: paddingBottom * transform.cellPx } : {}),
        ...(typeof paddingLeft === "number" && transform ? { paddingLeft: paddingLeft * transform.cellPx } : {}),
        ...(typeof paddingRight === "number" && transform ? { paddingRight: paddingRight * transform.cellPx } : {}),
        width: "100%",
        height: "100%",
        display: "block",
      };
      const gridScale = transform ? (transform.cellPx / 16) : 1;
      const baseRemByVariant: Record<string, number> = {
        h1: 2.25,
        h2: 1.875,
        h3: 1.5,
        lead: 1.25,
        muted: 0.875,
        p: 1,
      };
      const effectiveRem =
        typeof fontSize === "number" && fontSize > 0
          ? fontSize
          : (baseRemByVariant[variant] ?? 1);
      const innerStyle: React.CSSProperties = {
        fontSize: `${effectiveRem * 16 * gridScale}px`,
        ...(fontWeight && fontWeight !== 400 ? { fontWeight } : {}),
        ...(elementFontFamily ? { fontFamily: elementFontFamily } : {}),
        ...(isUnderline && underlineThickness ? { textDecorationThickness: `${underlineThickness * gridScale}px` } : {}),
        ...(color ? { color } : {}),
        whiteSpace: 'pre-line',
      };

      return (
        <>
          <div
            className={cn(
              "block w-full h-full align-top break-words",
              (node as any).style?.className,
              !elementFontFamily && nodeFontFamily && "[&>*]:font-[inherit] [&>*_*]:font-[inherit]",
              highlightClass(node, highlightNodeId)
            )}
            style={wrapperStyle}
          >
            <Tag
              className={cn(
                align === "center" && "text-center",
                align === "right" && "text-right",
                isItalic && "italic",
                isUnderline && "underline",
                (node as any).style?.className
              )}
              style={innerStyle}
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            />
          </div>
          {/* <ScopedStyle nodeId={node.id} css={customCss} /> */}
        </>
      );
    }
    case "button": {
      const direct = resolveLocalizedProp(node, 'label', activeLocale, defaultLocale);
      const baseLabel = (node as any).props?.label ?? "Button";
      const label = (direct != null && String(direct).trim())
        ? direct
        : ((activeLocale && activeLocale !== 'en' && baseLabel && localizeFn)
          ? localizeFn(String(baseLabel))
          : String(baseLabel));
      const href = (node as any).props?.href;
      const className = cn(
        (node as any).style?.className ?? "px-4 py-2 bg-blue-600 text-white rounded text-center",
        nodeFontFamily && "[&>*]:font-[inherit]",
        highlightClass(node, highlightNodeId)
      );
      // Allow numeric padding in Tailwind units similar to text
      const paddingY = nodeStyleRaw?.paddingY;
      const paddingX = nodeStyleRaw?.paddingX;
      const paddingTop = nodeStyleRaw?.paddingTop ?? paddingY;
      const paddingBottom = nodeStyleRaw?.paddingBottom ?? paddingY;
      const paddingLeft = nodeStyleRaw?.paddingLeft ?? paddingX;
      const paddingRight = nodeStyleRaw?.paddingRight ?? paddingX;
      const gridScale = transform ? (transform.cellPx / 16) : 1;
      const fontSizeRem = typeof (nodeStyleRaw as any)?.fontSize === "number" ? (nodeStyleRaw as any).fontSize : 1;
      const inlineStyle: React.CSSProperties = {
        ...nodeStyle,
        fontSize: `${fontSizeRem * 16 * gridScale}px`,
        ...(typeof paddingTop === "number" && transform ? { paddingTop: paddingTop * transform.cellPx } : {}),
        ...(typeof paddingBottom === "number" && transform ? { paddingBottom: paddingBottom * transform.cellPx } : {}),
        ...(typeof paddingLeft === "number" && transform ? { paddingLeft: paddingLeft * transform.cellPx } : {}),
        ...(typeof paddingRight === "number" && transform ? { paddingRight: paddingRight * transform.cellPx } : {}),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        margin: 0,
        whiteSpace: "nowrap",
        width: "100%",
        height: "100%",
      };
      if (href) {
        return (
          <>
            <a href={href} className={className} style={inlineStyle}>
              {label}
            </a>
            {/* <ScopedStyle nodeId={node.id} css={customCss} /> */}
          </>
        );
      }
      return (
        <>
          <button className={className} style={inlineStyle}>
            {label}
          </button>
          {/* <ScopedStyle nodeId={node.id} css={customCss} /> */}
        </>
      );
    }
    case "eventList": {
      // Match builder: respect background/backgroundColor/borderRadius on wrapper
      const inlineStyle: React.CSSProperties = {
        ...nodeStyle,
      };
      return (
        <>
          <div
            className={cn(
              nodeFontFamily && "[&>*]:font-[inherit] [&>*_*]:font-[inherit]",
              highlightClass(node, highlightNodeId)
            )}
            style={inlineStyle}
          >
            <EventSection
              showFilters={(node as any).props?.showFilters !== false}
              lockedFilters={(node as any).props?.lockedFilters}
              title={(node as any).props?.title}
              showTitle={(node as any).props?.showTitle !== false}
            />
          </div>
          {/* <ScopedStyle nodeId={node.id} css={customCss} /> */}
        </>
      );
    }
    case "map": {
      const url = (node as any).props?.embedUrl || "";
      const inlineStyle: React.CSSProperties = {
        ...nodeStyle,
      };
      return (
        <div className={cn('block w-full', (node as any).style?.className, highlightClass(node, highlightNodeId))} style={inlineStyle}>
          <MapSection isEditing={false} data={{ embedUrl: url }} hideTitle disableInteractions />
        </div>
      );
    }
    case "paypal": {
      const BASE_W = 200;
      const BASE_H = 200;
      let scale = 1;
      const units = (node as any)?.layout?.units as { wu?: number; hu?: number } | undefined;
      if (!forceFlowLayout && units && transform) {
        const wpx = typeof units.wu === "number" ? (units.wu * transform.cellPx) : 0;
        const hpx = typeof units.hu === "number" ? (units.hu * transform.cellPx) : 0;
        const widthScale = wpx > 0 ? (wpx / BASE_W) : 1;
        const heightScale = hpx > 0 ? (hpx / BASE_H) : 1;
        scale = Math.max(0.2, Math.min(widthScale, heightScale));
      } else if (!forceFlowLayout && transform) {
        scale = Math.max(0.2, transform.cellPx / 16);
      }
      const inlineStyle: React.CSSProperties = {
        ...nodeStyle,
        display: "block",
        width: "100%",
        overflow: "visible",
      };
      if (forceFlowLayout) {
        return (
          <div className={cn((node as any).style?.className, highlightClass(node, highlightNodeId))} style={inlineStyle}>
            <PaypalSection isEditing={false} />
          </div>
        );
      } else {
        return (
          <div className={cn((node as any).style?.className, highlightClass(node, highlightNodeId))} style={{ ...inlineStyle, height: undefined }}>
            <div
              style={{
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                width: `${100 / (scale || 1)}%`,
              }}
            >
              <PaypalSection isEditing={false} />
            </div>
          </div>
        );
      }
    }
    case "serviceTimes": {
      const defaultData = { title: "Service Times", times: [{ label: "Sunday", time: "9:00 AM" }, { label: "Sunday", time: "11:00 AM" }] };
      const data = (node as any).props?.data ?? defaultData;
      return (
        <div className={cn((node as any).style?.className, highlightClass(node, highlightNodeId))} style={nodeStyle}>
          <ServiceTimesSection data={data} isEditing={false} />
        </div>
      );
    }
    case "menu": {
      const defaultData = { items: [] as Array<{ title: string; imageUrl: string; description?: string; linkUrl?: string }> };
      const data = (node as any).props?.data ?? defaultData;
      return (
        <div className={cn((node as any).style?.className, highlightClass(node, highlightNodeId))} style={nodeStyle}>
          <MenuSection data={data} isEditing={false} />
        </div>
      );
    }
    case "contactInfo": {
      const defaultData = { items: [{ label: "Phone", value: "(555) 123-4567" }, { label: "Email", value: "hello@yourchurch.org" }] };
      const data = (node as any).props?.data ?? defaultData;
      return (
        <div className={cn((node as any).style?.className, highlightClass(node, highlightNodeId))} style={nodeStyle}>
          <ContactInfoSection data={data} isEditing={false} />
        </div>
      );
    }
    case "container": {
      const maxWidth = (node as any).props?.maxWidth ?? "xl";
      const px = (node as any).props?.paddingX ?? 4;
      const py = (node as any).props?.paddingY ?? 6;
      const mwClass =
        maxWidth === "full"
          ? "w-full"
          : maxWidth === "2xl"
            ? "max-w-7xl"
            : maxWidth === "xl"
              ? "max-w-6xl"
              : maxWidth === "lg"
                ? "max-w-5xl"
                : maxWidth === "md"
                  ? "max-w-3xl"
                  : "max-w-xl";
      const pxClass =
        px === 0 ? "px-0" : px === 2 ? "px-2" : px === 4 ? "px-4" : px === 6 ? "px-6" : "px-4";
      const pyClass =
        py === 0 ? "py-0" : py === 2 ? "py-2" : py === 4 ? "py-4" : py === 6 ? "py-6" : "py-6";

      // Container grid origin is not needed when using DOM offset alignment (builder parity)
      const containerContent = (node.children ?? []).map((child) => {
        const hasLayout = !!child.layout?.units;
        const childRendered = renderNode(child, highlightNodeId, nodeFontFamily, transform, forceFlowLayout, activeLocale, defaultLocale, localizeFn, domOffsets);

        if (hasLayout && transform && !forceFlowLayout) {
          const rect = transform.toPx(child.layout!.units);
          const domOffset = (domOffsets && domOffsets[node.id]) || { x: 0, y: 0 };
          const style: React.CSSProperties = {
            // Builder equivalent: child px relative to content minus real DOM container offset
            left: (rect.x || 0) - domOffset.x,
            top: (rect.y || 0) - domOffset.y,
          };
          const sizeMode = (child as any).props?.sizeMode === "natural"
            ? "natural"
            : (child.type === "map" || child.type === "paypal")
              ? "widthOnly"
              : "full";
          if (typeof rect.w === "number") style.width = rect.w;
          if (sizeMode === "full" && typeof rect.h === "number") style.height = rect.h;

          const enforcedChild =
            sizeMode === "widthOnly"
              ? enforceWidthOnly(childRendered)
              : sizeMode === "natural"
                ? childRendered
                : enforceFullSize(childRendered);

          return (
            <div key={child.id} className="absolute" style={style}>
              <div className={cn("w-full", sizeMode === "full" && "h-full")}>{enforcedChild}</div>
            </div>
          );
        }

        const isContainer = child.type === "container";
        if (forceFlowLayout) {
          return (
            <div key={child.id} className="relative">
              {childRendered}
            </div>
          );
        }
        return (
          <div key={child.id} className={cn("relative", !isContainer && "inline-block")} style={{ width: !isContainer ? "fit-content" : undefined }}>
            {childRendered}
          </div>
        );
      });

      // Also apply container-level background/border radius and paddings if provided on style
      const containerInlineStyle: React.CSSProperties = {
        ...nodeStyle,
        ...(typeof (node as any).style?.paddingTop === "number" && transform ? { paddingTop: (node as any).style?.paddingTop * transform.cellPx } : {}),
        ...(typeof (node as any).style?.paddingBottom === "number" && transform ? { paddingBottom: (node as any).style?.paddingBottom * transform.cellPx } : {}),
        ...(typeof (node as any).style?.paddingLeft === "number" && transform ? { paddingLeft: (node as any).style?.paddingLeft * transform.cellPx } : {}),
        ...(typeof (node as any).style?.paddingRight === "number" && transform ? { paddingRight: (node as any).style?.paddingRight * transform.cellPx } : {}),
      };
      return (
        <>
          <div
            id={node.id}
            className={cn(
              "mx-auto relative",
              mwClass,
              pxClass,
              pyClass,
              (node as any).style?.className,
              nodeFontFamily && "[&>*]:font-[inherit] [&>*_*]:font-[inherit]",
              highlightClass(node, highlightNodeId)
            )}
            style={containerInlineStyle}
          >
            {containerContent}
          </div>
          {/* <ScopedStyle nodeId={node.id} css={customCss} /> */}
        </>
      );
    }
    case "image": {
      const src = getPublicUrl((node as any).props?.src) || "";
      const directAlt = resolveLocalizedProp(node, 'alt', activeLocale, defaultLocale);
      const baseAlt = (node as any).props?.alt || "";
      const alt = (directAlt != null && String(directAlt).trim())
        ? directAlt
        : ((activeLocale && activeLocale !== 'en' && baseAlt && localizeFn)
          ? localizeFn(String(baseAlt))
          : String(baseAlt));
      const objectFit = (node as any).props?.objectFit || "cover";
      const styleFilter = (nodeStyle as any)?.filter as string | undefined;
      const hasShadow = styleFilter ? /drop-shadow\(/.test(styleFilter) : false;
      const inlineStyles: React.CSSProperties = {
        ...nodeStyle,
        ...(hasShadow ? {} : { overflow: 'hidden' }),
        display: 'block',
      };
      return (
        <>
          <div
            className={cn((node as any).style?.className, highlightClass(node, highlightNodeId))}
            style={inlineStyles}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt} style={{ width: '100%', height: '100%', objectFit, filter: styleFilter }} />
          </div>
        </>
      );
    }
    default: {
      return null;
    }
  }
};

const SectionWithVirtualGridPublic: React.FC<{
  section: SectionV2;
  bg?: string;
  gridClasses: string;
  sectionFontFamily?: string;
  highlightNodeId?: string;
  activeLocale?: string;
  defaultLocale?: string;
  localize: (t: string) => string;
}> = ({ section, bg, gridClasses, sectionFontFamily, highlightNodeId, activeLocale, defaultLocale, localize }) => {
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [transform, setTransform] = React.useState<VirtualTransform | null>(null);
  const [containerDomOffsets, setContainerDomOffsets] = React.useState<Record<string, { x: number; y: number }>>({});

  const cols = section.builderGrid?.cols ?? 64;
  const aspect = section.builderGrid?.aspect ?? { num: 16, den: 9 };

  const updateTransform = React.useCallback(() => {
    if (!contentRef.current) return;
    const rect = contentRef.current.getBoundingClientRect();
    const virtualHeightPx = rect.width * aspect.den / aspect.num;
    const newTransform = makeVirtualTransform(
      { width: rect.width, height: virtualHeightPx },
      cols,
      aspect
    );
    setTransform(newTransform);
  }, [cols, aspect]);

  React.useEffect(() => {
    updateTransform();
    const ro = new ResizeObserver(() => updateTransform());
    if (contentRef.current) ro.observe(contentRef.current);
    return () => {
      ro.disconnect();
    };
  }, [updateTransform]);

  const locked = section.lockLayout === true;

  // Re-introduce DOM offset measurement for containers (used for nested children placement)
  React.useLayoutEffect(() => {
    if (!contentRef.current || !transform) return;
    const contentRect = contentRef.current.getBoundingClientRect();
    const mapping: Record<string, { x: number; y: number }> = {};
    const walk = (nodes: Node[] | undefined) => {
      if (!nodes) return;
      for (const n of nodes) {
        if (n.type === "container") {
          const el = document.getElementById(n.id);
          if (el) {
            const r = el.getBoundingClientRect();
            mapping[n.id] = { x: r.left - contentRect.left, y: r.top - contentRect.top };
          }
        }
        const maybeChildren = (n as any).children as Node[] | undefined;
        if (maybeChildren && Array.isArray(maybeChildren)) walk(maybeChildren);
      }
    };
    walk(section.children as any);
    setContainerDomOffsets(mapping);
  }, [section.children, transform]);

  const baseBgStyle = (section.background?.style as React.CSSProperties) || {};
  const brightnessVar = (baseBgStyle as any)['--bg-brightness'];
  const bgImage = (baseBgStyle as any).backgroundImage as string | undefined;
  const sectionStyle: React.CSSProperties = { ...baseBgStyle };
  delete (sectionStyle as any)['--bg-brightness'];
  if (bgImage && brightnessVar && String(brightnessVar) !== '100') {
    delete (sectionStyle as any).backgroundImage;
  }
  return (
    <section
      className={cn(
        "w-full relative overflow-x-hidden",
        bg,
        sectionFontFamily && "[&>*]:font-[inherit] [&>*_*]:font-[inherit]"
      )}
      style={{
        ...sectionStyle,
        ...(sectionFontFamily ? { fontFamily: sectionFontFamily } : {}),
        ...(locked
          ? {}
          : { height: transform ? (transform.rows * transform.cellPx) : `${(section.heightPercent ?? 100)}vh` }),
      }}
    >
      {bgImage && brightnessVar && String(brightnessVar) !== '100' && (
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: bgImage,
            backgroundSize: (baseBgStyle as any).backgroundSize,
            backgroundPosition: (baseBgStyle as any).backgroundPosition,
            backgroundRepeat: (baseBgStyle as any).backgroundRepeat,
            filter: `brightness(${brightnessVar}%)`,
            zIndex: 0,
          }}
        />
      )}
      <div
        ref={contentRef}
        className={cn(gridClasses, "relative", !locked && "h-full min-h-full")}
        id={`section-content-${section.id}`}
        style={{ ...(locked ? {} : { minHeight: "inherit" }), position: "relative" }}
      >
        {section.children.map((node) => {
          const hasLayout = !!node.layout?.units;
          const rendered = renderNode(node, highlightNodeId, sectionFontFamily, transform, locked, activeLocale, defaultLocale, localize, containerDomOffsets);

          if (hasLayout && !locked && transform) {
            const { xu, yu, wu, hu } = node.layout!.units;
            const style: React.CSSProperties = {
              // Match builder: position using virtual grid px including transform offsets
              left: transform.offsetX + (xu * transform.cellPx),
              top: transform.offsetY + (yu * transform.cellPx),
            };
            const sizeMode = (node as any).props?.sizeMode === "natural"
              ? "natural"
              : (node.type === "map" || node.type === "paypal")
                ? "widthOnly"
                : "full";
            if (typeof wu === "number") style.width = wu * transform.cellPx;
            if (sizeMode === "full" && typeof hu === "number") style.height = hu * transform.cellPx;

            const enforcedRendered =
              sizeMode === "widthOnly"
                ? enforceWidthOnly(rendered)
                : sizeMode === "natural"
                  ? rendered
                  : enforceFullSize(rendered);

            return (
              <div key={node.id} className="absolute" style={style}>
                <div className={cn("w-full", sizeMode === "full" && "h-full")}>{enforcedRendered}</div>
              </div>
            );
          }

          const isContainer = node.type === "container";
          if (locked) {
            return (
              <div key={node.id} className="relative">
                {rendered}
              </div>
            );
          }
          return (
            <div key={node.id} className={cn("relative", !isContainer && "inline-block")} style={{ width: !isContainer ? "fit-content" : undefined }}>
              {rendered}
            </div>
          );
        })}
      </div>
    </section>
  );
};

const DynamicPageV2Renderer: React.FC<{ page: PageV2; highlightNodeId?: string; activeLocale?: string; defaultLocale?: string }> = ({ page, highlightNodeId, activeLocale, defaultLocale }) => {
  const defaultFontFamily = (page as any).styleTokens?.defaultFontFamily as string | undefined;
  const defaultFontFallback = (page as any).styleTokens?.defaultFontFallback as string | undefined;
  const fontFamily = defaultFontFamily || defaultFontFallback;
  const localize = useLocalize();
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(max-width: 768px)").matches;
  });

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(max-width: 768px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return (
    <div
      className="w-full min-h-full overflow-x-hidden max-w-full"
      style={fontFamily ? ({ fontFamily } as React.CSSProperties) : undefined}
    >
      {(isMobile && Array.isArray((page as any)?.sectionsMobile) && (page as any).sectionsMobile.length ? (page as any).sectionsMobile : page.sections).map((section: SectionV2) => {
        const bg = section.background?.className as string | undefined;
        const gridClass = section.grid?.className ?? "";
        const hasWidthClass = /(^|\s)w-/.test(gridClass);
        const gridClasses = cn(gridClass, !hasWidthClass && "w-full");

        const sectionFontFamily = (section.styleTokens as any)?.fontFamily || fontFamily;

        return (
          <SectionWithVirtualGridPublic
            key={section.id}
            section={section}
            bg={bg}
            gridClasses={gridClasses}
            sectionFontFamily={sectionFontFamily}
            highlightNodeId={highlightNodeId}
            activeLocale={activeLocale}
            defaultLocale={defaultLocale || (page as any)?.defaultLocale}
            localize={localize}
          />
        );
      })}
    </div>
  );
};

export default DynamicPageV2Renderer;

