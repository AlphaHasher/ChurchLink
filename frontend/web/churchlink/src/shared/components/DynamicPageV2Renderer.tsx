import React from "react";
import EventSection from "@sections/EventSection";
import MapSection from "@sections/MapSection";
// import ServiceTimesSection from "@sections/ServiceTimesSection";
// import MenuSection from "@sections/MenuSection";
// import ContactInfoSection from "@sections/ContactInfoSection";
import PaypalSection from "@sections/PaypalSection";
// ScopedStyle temporarily disabled due to drag measurement regressions
import { PageV2, SectionV2, Node } from "@/shared/types/pageV2";
import { defaultGridSize, unitsToPx } from "@/features/webeditor/grid/gridMath";
import { getPublicUrl } from "@/helpers/MediaInteraction";
import { useLocalize } from "@/shared/utils/localizationUtils";

function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(" ");
}

function mergeClassNames(
  ...classes: Array<string | undefined | null | false>
) {
  return classes.filter(Boolean).join(" ");
}

// Match builder padding conversion: Tailwind spacing unit -> rem (n * 0.25rem)
function tailwindSpacingToRem(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return undefined;
  if (value === 0) return "0";
  const rem = value * 0.25;
  const formatted = rem.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  return formatted.length ? `${formatted}rem` : `${rem}rem`;
}

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
      const mergedClassName = mergeClassNames(existingClass, "block", "w-full", "h-full");
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
  const mergedClassName = mergeClassNames(existingClass, "block", "w-full", "h-full");
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
      const mergedClassName = mergeClassNames(existingClass, "block", "w-full");
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
  const mergedClassName = mergeClassNames(existingClass, "block", "w-full");
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
  gridSize?: number,
  forceFlowLayout?: boolean,
  activeLocale?: string,
  defaultLocale?: string,
  localizeFn?: (text: string) => string
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
      const baseHtmlProp = (node as any).props?.html as string | undefined;
      const baseTextProp = (node as any).props?.text as string | undefined;
      const isNonDefaultLocale = !!activeLocale && !!(defaultLocale || 'en') && activeLocale !== (defaultLocale || 'en');

      const hasDirectHtml = !!(directHtml != null && String(directHtml).trim());
      const canUseBaseAuthoredHtml = !!(baseHtmlProp && !isNonDefaultLocale);
      const shouldInjectHtml = hasDirectHtml || canUseBaseAuthoredHtml;
      const htmlToInject = hasDirectHtml ? String(directHtml) : String(baseHtmlProp ?? "");

      const baseTextSource = (baseTextProp != null && String(baseTextProp).trim())
        ? String(baseTextProp)
        : (typeof baseHtmlProp === 'string' ? String(baseHtmlProp).replace(/<[^>]*>/g, '') : "");
      const textToRender = (isNonDefaultLocale && baseTextSource && localizeFn)
        ? localizeFn(String(baseTextSource))
        : String(baseTextSource);
      const align = (node as any).props?.align ?? "left";
      const variant = (node as any).props?.variant ?? "p";
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

      const Tag = ["h1", "h2", "h3"].includes(variant) ? (variant as any) : "p";

      // Derive per-side paddings consistent with builder
      const paddingTop = nodeStyleRaw?.paddingTop ?? paddingY;
      const paddingBottom = nodeStyleRaw?.paddingBottom ?? paddingY;
      const paddingLeft = nodeStyleRaw?.paddingLeft ?? paddingX ?? paddingY;
      const paddingRight = nodeStyleRaw?.paddingRight ?? paddingX ?? paddingY;

      const isBold = textStyles.includes("bold");
      const isItalic = textStyles.includes("italic");
      const isUnderline = textStyles.includes("underline");

      const inlineStyles: React.CSSProperties = {
        ...nodeStyle,
        ...(fontSize && fontSize !== 1 ? { fontSize: `${fontSize}rem` } : {}),
        ...(fontWeight && fontWeight !== 400 ? { fontWeight } : {}),
        ...(width && width !== "auto" ? { width, display: "inline-block" } : {}),
        ...(elementFontFamily ? { fontFamily: elementFontFamily } : {}),
        ...(isUnderline && underlineThickness ? { textDecorationThickness: `${underlineThickness}px` } : {}),
        ...(color ? { color } : {}),
        ...(backgroundColor ? { backgroundColor } : {}),
        ...(typeof borderRadius === "number" ? { borderRadius } : {}),
        ...(typeof paddingTop === "number" ? { paddingTop: tailwindSpacingToRem(paddingTop) } : {}),
        ...(typeof paddingBottom === "number" ? { paddingBottom: tailwindSpacingToRem(paddingBottom) } : {}),
        ...(typeof paddingLeft === "number" ? { paddingLeft: tailwindSpacingToRem(paddingLeft) } : {}),
        ...(typeof paddingRight === "number" ? { paddingRight: tailwindSpacingToRem(paddingRight) } : {}),
      };

      return (
        <>
          {shouldInjectHtml ? (
            <Tag
              className={cn(
                align === "center" && "text-center",
                align === "right" && "text-right",
                isBold && "font-bold",
                isItalic && "italic",
                isUnderline && "underline",
                (node as any).style?.className,
                !elementFontFamily && nodeFontFamily && "[&>*]:font-[inherit] [&>*_*]:font-[inherit]",
                "inline-block max-w-full w-fit align-top break-words",
                highlightClass(node, highlightNodeId)
              )}
              style={inlineStyles}
              dangerouslySetInnerHTML={{ __html: htmlToInject }}
            />
          ) : (
            <Tag
              className={cn(
                align === "center" && "text-center",
                align === "right" && "text-right",
                isBold && "font-bold",
                isItalic && "italic",
                isUnderline && "underline",
                (node as any).style?.className,
                !elementFontFamily && nodeFontFamily && "[&>*]:font-[inherit] [&>*_*]:font-[inherit]",
                "inline-block max-w-full w-fit align-top break-words",
                highlightClass(node, highlightNodeId)
              )}
              style={inlineStyles}
            >
              {textToRender}
            </Tag>
          )}
          {/* <ScopedStyle nodeId={node.id} css={customCss} /> */}
        </>
      );
    }
    case "button": {
      const direct = resolveLocalizedProp(node, 'label', activeLocale, defaultLocale);
      const baseLabel = (node as any).props?.label ?? "Button";
      const label = (direct != null && String(direct).trim())
        ? direct
        : ((activeLocale && activeLocale !== defaultLocale && baseLabel && localizeFn)
            ? localizeFn(String(baseLabel))
            : String(baseLabel));
      const href = (node as any).props?.href;
      const className = cn(
        (node as any).style?.className ?? "px-4 py-2 bg-blue-600 text-white rounded",
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
      const inlineStyle: React.CSSProperties = {
        ...nodeStyle,
        ...(typeof paddingTop === "number" ? { paddingTop: tailwindSpacingToRem(paddingTop) } : {}),
        ...(typeof paddingBottom === "number" ? { paddingBottom: tailwindSpacingToRem(paddingBottom) } : {}),
        ...(typeof paddingLeft === "number" ? { paddingLeft: tailwindSpacingToRem(paddingLeft) } : {}),
        ...(typeof paddingRight === "number" ? { paddingRight: tailwindSpacingToRem(paddingRight) } : {}),
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
      // Event list container should also respect padding/background/border radius
      const paddingY = nodeStyleRaw?.paddingY;
      const paddingX = nodeStyleRaw?.paddingX;
      const paddingTop = nodeStyleRaw?.paddingTop ?? paddingY;
      const paddingBottom = nodeStyleRaw?.paddingBottom ?? paddingY;
      const paddingLeft = nodeStyleRaw?.paddingLeft ?? paddingX;
      const paddingRight = nodeStyleRaw?.paddingRight ?? paddingX;
      const inlineStyle: React.CSSProperties = {
        ...nodeStyle,
        ...(typeof paddingTop === "number" ? { paddingTop: tailwindSpacingToRem(paddingTop) } : {}),
        ...(typeof paddingBottom === "number" ? { paddingBottom: tailwindSpacingToRem(paddingBottom) } : {}),
        ...(typeof paddingLeft === "number" ? { paddingLeft: tailwindSpacingToRem(paddingLeft) } : {}),
        ...(typeof paddingRight === "number" ? { paddingRight: tailwindSpacingToRem(paddingRight) } : {}),
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
    case "map": {
      const url = (node as any).props?.embedUrl || "";
      const paddingY = nodeStyleRaw?.paddingY;
      const paddingX = nodeStyleRaw?.paddingX;
      const paddingTop = nodeStyleRaw?.paddingTop ?? paddingY;
      const paddingBottom = nodeStyleRaw?.paddingBottom ?? paddingY;
      const paddingLeft = nodeStyleRaw?.paddingLeft ?? paddingX;
      const paddingRight = nodeStyleRaw?.paddingRight ?? paddingX;
      const inlineStyle: React.CSSProperties = {
        ...nodeStyle,
        ...(typeof paddingTop === "number" ? { paddingTop: tailwindSpacingToRem(paddingTop) } : {}),
        ...(typeof paddingBottom === "number" ? { paddingBottom: tailwindSpacingToRem(paddingBottom) } : {}),
        ...(typeof paddingLeft === "number" ? { paddingLeft: tailwindSpacingToRem(paddingLeft) } : {}),
        ...(typeof paddingRight === "number" ? { paddingRight: tailwindSpacingToRem(paddingRight) } : {}),
      };
      return (
        <div className={cn('block w-full', (node as any).style?.className, highlightClass(node, highlightNodeId))} style={inlineStyle}>
          <MapSection isEditing={false} data={{ embedUrl: url }} hideTitle unstyled />
        </div>
      );
    }
    case "paypal": {
      // In V2, paypal is rendered as a locked section content; here allow rendering the UI component
      return (
        <div className={cn((node as any).style?.className, highlightClass(node, highlightNodeId))} style={nodeStyle}>
          <PaypalSection data={{}} isEditing={false} />
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

      const containerContent = (node.children ?? []).map((child) => {
        const hasLayout = !!child.layout?.units;
        const childRendered = renderNode(child, highlightNodeId, nodeFontFamily, gridSize, forceFlowLayout, activeLocale, defaultLocale);

        if (hasLayout && gridSize && !forceFlowLayout) {
          const { xu, yu, wu, hu } = child.layout!.units;
          const style: React.CSSProperties = {
            left: unitsToPx(xu, gridSize),
            top: unitsToPx(yu, gridSize),
          };
          if (typeof wu === "number") style.width = unitsToPx(wu, gridSize);
          if (typeof hu === "number") style.height = unitsToPx(hu, gridSize);

          const enforcedChild =
            child.type === "text" || child.type === "button"
              ? enforceWidthOnly(childRendered)
              : enforceFullSize(childRendered);

          return (
            <div key={child.id} className="absolute" style={style}>
              <div className="w-full h-full">{enforcedChild}</div>
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
        ...(typeof (node as any).style?.paddingTop === "number" ? { paddingTop: tailwindSpacingToRem((node as any).style?.paddingTop) } : {}),
        ...(typeof (node as any).style?.paddingBottom === "number" ? { paddingBottom: tailwindSpacingToRem((node as any).style?.paddingBottom) } : {}),
        ...(typeof (node as any).style?.paddingLeft === "number" ? { paddingLeft: tailwindSpacingToRem((node as any).style?.paddingLeft) } : {}),
        ...(typeof (node as any).style?.paddingRight === "number" ? { paddingRight: tailwindSpacingToRem((node as any).style?.paddingRight) } : {}),
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
        : ((activeLocale && activeLocale !== defaultLocale && baseAlt && localizeFn)
            ? localizeFn(String(baseAlt))
            : String(baseAlt));
      const objectFit = (node as any).props?.objectFit || "cover";
      const inlineStyles: React.CSSProperties = {
        ...nodeStyle,
        overflow: "hidden",
        display: "block",
      };
      return (
        <>
          <div
            className={cn((node as any).style?.className, highlightClass(node, highlightNodeId))}
            style={inlineStyles}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt} style={{ width: "100%", height: "100%", objectFit }} />
          </div>
        </>
      );
    }
    case "menu": {
      // V1 only; for V2 treat as container/text composition in presets
      return null;
    }
    default: {
      return null;
    }
  }
};

const DynamicPageV2Renderer: React.FC<{ page: PageV2; highlightNodeId?: string; activeLocale?: string; defaultLocale?: string }> = ({ page, highlightNodeId, activeLocale, defaultLocale }) => {
  const defaultFontFamily = (page as any).styleTokens?.defaultFontFamily as string | undefined;
  const defaultFontFallback = (page as any).styleTokens?.defaultFontFallback as string | undefined;
  const fontFamily = defaultFontFamily || defaultFontFallback;
  const localize = useLocalize();

  return (
    <div
      className="w-full min-h-full"
      style={fontFamily ? ({ fontFamily } as React.CSSProperties) : undefined}
    >
      {page.sections.map((section: SectionV2) => {
        const bg = section.background?.className as string | undefined;
        const gridClass = section.grid?.className ?? "";
        const hasWidthClass = /(^|\s)w-/.test(gridClass);
        const gridClasses = cn(gridClass, !hasWidthClass && "w-full");

        const sectionFontFamily = (section.styleTokens as any)?.fontFamily || fontFamily;
        const gridSize = section.builderGrid?.gridSize ?? defaultGridSize;

        return (
          <section
            key={section.id}
            className={cn(
              "w-full relative",
              bg,
              sectionFontFamily && "[&>*]:font-[inherit] [&>*_*]:font-[inherit]"
            )}
            style={{
              ...(section.background?.style as React.CSSProperties),
              ...(sectionFontFamily ? { fontFamily: sectionFontFamily } : {}),
              minHeight: `${section.heightPercent ?? 100}vh`,
            }}
          >
            <div
              className={cn(gridClasses, "relative h-full min-h-full")}
              id={`section-content-${section.id}`}
              style={{ minHeight: "inherit" }}
            >
              {section.children.map((node) => {
                const hasLayout = !!node.layout?.units;
                const forceFlow = section.lockLayout === true;
                const rendered = renderNode(node, highlightNodeId, sectionFontFamily, gridSize, forceFlow, activeLocale, (defaultLocale || (page as any)?.defaultLocale), localize);

                if (hasLayout && !forceFlow) {
                  const { xu, yu, wu, hu } = node.layout!.units;
                  const style: React.CSSProperties = {
                    left: unitsToPx(xu, gridSize),
                    top: unitsToPx(yu, gridSize),
                  };
                  if (typeof wu === "number") style.width = unitsToPx(wu, gridSize);
                  if (typeof hu === "number") style.height = unitsToPx(hu, gridSize);

                  const enforcedRendered =
                    node.type === "text" || node.type === "button"
                      ? enforceWidthOnly(rendered)
                      : enforceFullSize(rendered);

                  return (
                    <div key={node.id} className="absolute" style={style}>
                      <div className="w-full h-full">{enforcedRendered}</div>
                    </div>
                  );
                }

                const isContainer = node.type === "container";
                if (forceFlow) {
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
      })}
    </div>
  );
};

export default DynamicPageV2Renderer;


