import type { ComponentConfig } from "@puckeditor/core";
import type { ReactNode } from "react";
import { withLayout } from "../shared/Layout";

export type GridContainerProps = {
  name: string;
  layoutMode: "row" | "column";
  gap: number;
  children: ReactNode;
  layout?: {
    spanCol?: number;
    spanRow?: number;
    padding?: string;
    grow?: boolean;
  };
};

type GridContainerPropsInner = Omit<GridContainerProps, "layout">;

const GridContainerInternal: ComponentConfig<GridContainerPropsInner> = {
  label: "Grid Container",
  fields: {
    name: {
      type: "text",
      label: "Container Name",
    },
    layoutMode: {
      type: "radio",
      label: "Layout Mode",
      options: [
        { label: "Row", value: "row" },
        { label: "Column", value: "column" },
      ],
    },
    gap: {
      type: "number",
      label: "Gap (px)",
      min: 0,
    },
    children: {
      type: "slot",
    },
  },
  defaultProps: {
    name: "Container",
    layoutMode: "row",
    gap: 24,
    children: [] as unknown as ReactNode,
  },
  resolveData: async ({ props }) => ({
    props: { ...props, children: props.children ?? [] },
  }),
  render: ({ layoutMode, children: ChildrenSlot, gap }) => {
    // Defensive check for slot during deletion
    if (!ChildrenSlot || typeof ChildrenSlot !== "function") {
      return <div className="grid-container w-full" />;
    }

    const isRow = layoutMode === "row";

    const containerStyles: React.CSSProperties = {
      display: "flex",
      flexDirection: isRow ? "row" : "column",
      gap: `${gap}px`,
      flexWrap: isRow ? "nowrap" : "wrap", // Row: strict fit, Column: allow wrap
      width: "100%",
      alignItems: "flex-start", // Prevent items from stretching to match tallest
    };

    // Child styles: auto-scale to fill, allow shrink in row mode
    const childStyles = `
      .grid-container > * {
        flex: 1 1 0;
        min-width: 0;
      }
    `;

    // Cast to any to allow JSX invocation with props
    const SlotComponent = ChildrenSlot as any;

    return (
      <>
        <style>{childStyles}</style>
        <SlotComponent
          className="grid-container"
          style={containerStyles}
        />
      </>
    );
  },
};

export const GridContainer = withLayout(GridContainerInternal);
