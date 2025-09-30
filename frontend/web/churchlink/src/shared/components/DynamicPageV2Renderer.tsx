import React from "react";
import EventSection from "@/features/admin/components/WebBuilder/sections/EventSection";
import { PageV2, SectionV2, Node } from "@/shared/types/pageV2";

function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(" ");
}

const highlightClass = (node: Node, highlightNodeId?: string) =>
  node.id === highlightNodeId ? "outline outline-2 outline-red-500/70" : undefined;

const renderNode = (node: Node, highlightNodeId?: string, sectionFontFamily?: string): React.ReactNode => {
  // Get node-level font or fall back to section font
  const nodeFontFamily = (node as any).style?.fontFamily || sectionFontFamily;
  const nodeStyle = nodeFontFamily ? { fontFamily: nodeFontFamily } : undefined;
  
  switch (node.type) {
    case "text": {
      const html = (node as any).props?.html ?? (node as any).props?.text ?? "";
      const align = (node as any).props?.align ?? "left";
      const variant = (node as any).props?.variant ?? "p";
      const Tag = ["h1", "h2", "h3"].includes(variant) ? (variant as any) : "p";
      return (
        <Tag
          className={cn(
            align === "center" && "text-center",
            align === "right" && "text-right",
            (node as any).style?.className,
            highlightClass(node, highlightNodeId),
            nodeFontFamily && "[&_*]:!font-[inherit]" // Force children to inherit
          )}
          style={nodeStyle}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }
    case "button": {
      const label = (node as any).props?.label ?? "Button";
      const href = (node as any).props?.href;
      const className = cn(
        (node as any).style?.className ?? "px-4 py-2 bg-blue-600 text-white rounded",
        highlightClass(node, highlightNodeId),
        nodeFontFamily && "[&_*]:!font-[inherit]" // Force children to inherit
      );
      if (href) {
        return (
          <a href={href} className={className} style={nodeStyle}>
            {label}
          </a>
        );
      }
      return <button className={className} style={nodeStyle}>{label}</button>;
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
      // Note: using tailwind classnames constructed at runtime can be purged; keep sensible defaults
      const pxClass = px === 0 ? "px-0" : px === 2 ? "px-2" : px === 4 ? "px-4" : px === 6 ? "px-6" : "px-4";
      const pyClass = py === 0 ? "py-0" : py === 2 ? "py-2" : py === 4 ? "py-4" : py === 6 ? "py-6" : "py-6";
      return (
        <div 
          className={cn(
            "mx-auto", 
            mwClass, 
            pxClass, 
            pyClass, 
            highlightClass(node, highlightNodeId),
            nodeFontFamily && "[&_*]:!font-[inherit]" // Force children to inherit
          )}
          style={nodeStyle}
        >
          {(node.children ?? []).map((c) => (
            <React.Fragment key={c.id}>{renderNode(c, highlightNodeId, nodeFontFamily)}</React.Fragment>
          ))}
        </div>
      );
    }
    case "eventList": {
      return (
        <div 
          className={cn(
            highlightClass(node, highlightNodeId),
            nodeFontFamily && "[&_*]:!font-[inherit]" // Force children to inherit
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
    default: {
      return null;
    }
  }
};

const DynamicPageV2Renderer: React.FC<{ page: PageV2; highlightNodeId?: string }> = ({ page, highlightNodeId }) => {
  const defaultFontFamily = (page as any).styleTokens?.defaultFontFamily as string | undefined;
  const defaultFontFallback = (page as any).styleTokens?.defaultFontFallback as string | undefined;
  const fontFamily = defaultFontFamily || defaultFontFallback;
  
  // Debug
  React.useEffect(() => {
    console.log("DynamicPageV2Renderer - fontFamily:", fontFamily, "styleTokens:", page.styleTokens);
  }, [fontFamily, page.styleTokens]);
  
  return (
    <div
      className="w-full min-h-full"
      style={fontFamily ? ({ fontFamily } as React.CSSProperties) : undefined}
    >
      {page.sections.map((section: SectionV2) => {
        const isFull = section.fullHeight === true;
        const bg = section.background?.className as string | undefined;
        const gridClass = section.grid?.className ?? "";
        const hasWidthClass = /(^|\s)w-/.test(gridClass);
        const gridClasses = cn(gridClass, !hasWidthClass && "w-full");
        
        // Get section-level font from styleTokens or page default
        const sectionFontFamily = (section.styleTokens as any)?.fontFamily || fontFamily;
        
        return (
          <section
            key={section.id}
            className={cn(
              "w-full", 
              isFull ? "min-h-screen flex items-center" : "", 
              bg,
              sectionFontFamily && "[&_*]:!font-[inherit]" // Force children to inherit section font
            )}
            style={{
              ...(section.background?.style as React.CSSProperties),
              ...(sectionFontFamily ? { fontFamily: sectionFontFamily } : {}),
            }}
          >
            <div className={gridClasses}>
              {section.children.map((node) => (
                <React.Fragment key={node.id}>{renderNode(node, highlightNodeId, sectionFontFamily)}</React.Fragment>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default DynamicPageV2Renderer;


