import React from "react";
import EventSection from "@/features/admin/components/WebBuilder/sections/EventSection";
import { PageV2, SectionV2, Node } from "@/shared/types/pageV2";
import { defaultGridSize, unitsToPx } from "@/features/webeditor/grid/gridMath";

function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(" ");
}

const highlightClass = (node: Node, highlightNodeId?: string) =>
  node.id === highlightNodeId ? "outline outline-2 outline-red-500/70" : undefined;

function enforceFullSize(content: React.ReactNode): React.ReactNode {
  if (!React.isValidElement(content)) return content;

  const element = content as React.ReactElement<any>;
  const existingStyle = element.props?.style || {};
  const existingClassName = element.props?.className || "";

  const mergedStyle: React.CSSProperties = {
    ...existingStyle,
    width: existingStyle.width ?? "100%",
    height: existingStyle.height ?? "100%",
  };

  return React.cloneElement(element, {
    className: cn(existingClassName, "w-full", "h-full"),
    style: mergedStyle,
  });
}

const renderNode = (
  node: Node,
  highlightNodeId?: string,
  sectionFontFamily?: string,
  gridSize?: number
): React.ReactNode => {
  const nodeFontFamily = (node as any).style?.fontFamily || sectionFontFamily;
  const nodeStyle = nodeFontFamily ? { fontFamily: nodeFontFamily } : undefined;

  switch (node.type) {
    case "text": {
      const html = (node as any).props?.html ?? (node as any).props?.text ?? "";
      const align = (node as any).props?.align ?? "left";
      const variant = (node as any).props?.variant ?? "p";
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

      const Tag = ["h1", "h2", "h3"].includes(variant) ? (variant as any) : "p";

      const pyClass = paddingY > 0 ? `py-${paddingY}` : "";
      const pxClass = paddingX > 0 ? `px-${paddingX}` : "";

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
      };

      return (
        <Tag
          className={cn(
            align === "center" && "text-center",
            align === "right" && "text-right",
            pyClass,
            pxClass,
            isBold && "font-bold",
            isItalic && "italic",
            isUnderline && "underline",
            (node as any).style?.className,
            !elementFontFamily && nodeFontFamily && "[&>*]:font-[inherit] [&>*_*]:font-[inherit]",
            "inline-block max-w-full w-fit align-top break-words",
            highlightClass(node, highlightNodeId)
          )}
          style={inlineStyles}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }
    case "button": {
      const label = (node as any).props?.label ?? "Button";
      const href = (node as any).props?.href;
      const className = cn(
        (node as any).style?.className ?? "px-4 py-2 bg-blue-600 text-white rounded",
        nodeFontFamily && "[&>*]:font-[inherit]",
        highlightClass(node, highlightNodeId)
      );
      if (href) {
        return (
          <a href={href} className={className} style={nodeStyle}>
            {label}
          </a>
        );
      }
      return (
        <button className={className} style={nodeStyle}>
          {label}
        </button>
      );
    }
    case "eventList": {
      return (
        <div
          className={cn(
            nodeFontFamily && "[&>*]:font-[inherit] [&>*_*]:font-[inherit]",
            highlightClass(node, highlightNodeId)
          )}
          style={nodeStyle}
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
        const childRendered = renderNode(child, highlightNodeId, nodeFontFamily, gridSize);

        if (hasLayout && gridSize) {
          const { xu, yu, wu, hu } = child.layout!.units;
          const style: React.CSSProperties = {
            left: unitsToPx(xu, gridSize),
            top: unitsToPx(yu, gridSize),
          };
          if (typeof wu === "number") style.width = unitsToPx(wu, gridSize);
          if (typeof hu === "number") style.height = unitsToPx(hu, gridSize);

          const enforcedChild = enforceFullSize(childRendered);

          return (
            <div key={child.id} className="absolute" style={style}>
              <div className="w-full h-full">{enforcedChild}</div>
            </div>
          );
        }

        const isContainer = child.type === "container";
        return (
          <div
            key={child.id}
            className={cn("relative", !isContainer && "inline-block")}
            style={{ width: !isContainer ? "fit-content" : undefined }}
          >
            {childRendered}
          </div>
        );
      });

      return (
        <div
          id={node.id}
          className={cn(
            "mx-auto relative",
            mwClass,
            pxClass,
            pyClass,
            nodeFontFamily && "[&>*]:font-[inherit] [&>*_*]:font-[inherit]",
            highlightClass(node, highlightNodeId)
          )}
          style={nodeStyle}
        >
          {containerContent}
        </div>
      );
    }
    default: {
      return null;
    }
  }
};

const DynamicPageV2Renderer: React.FC<{ page: PageV2; highlightNodeId?: string }> = ({ page, highlightNodeId }) => {
  const defaultFontFamily = (page as any).styleTokens?.defaultFontFamily as string | undefined;
  const defaultFontFallback = (page as any).styleTokens?.defaultFontFallback as string | undefined;
  const fontFamily = defaultFontFamily || defaultFontFallback;

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
                const rendered = renderNode(node, highlightNodeId, sectionFontFamily, gridSize);

                if (hasLayout) {
                  const { xu, yu, wu, hu } = node.layout!.units;
                  const style: React.CSSProperties = {
                    left: unitsToPx(xu, gridSize),
                    top: unitsToPx(yu, gridSize),
                  };
                  if (typeof wu === "number") style.width = unitsToPx(wu, gridSize);
                  if (typeof hu === "number") style.height = unitsToPx(hu, gridSize);

                  const enforcedRendered = enforceFullSize(rendered);

                  return (
                    <div key={node.id} className="absolute" style={style}>
                      <div className="w-full h-full">{enforcedRendered}</div>
                    </div>
                  );
                }

                const isContainer = node.type === "container";
                return (
                  <div
                    key={node.id}
                    className={cn("relative", !isContainer && "inline-block")}
                    style={{ width: !isContainer ? "fit-content" : undefined }}
                  >
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


