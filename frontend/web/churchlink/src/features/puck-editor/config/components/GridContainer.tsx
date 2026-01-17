import type { ComponentConfig } from "@puckeditor/core";
import type { ReactNode } from "react";
import { withLayout } from "../shared/Layout";

export type GridContainerProps = {
  name: string;
  layoutMode: "row" | "column";
  gap: number;
  itemMinWidth?: number;
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
    itemMinWidth: {
      type: "number",
      label: "Item Min Width (px)",
      min: 50,
    },
    children: {
      type: "slot",
    },
  },
  defaultProps: {
    name: "Container",
    layoutMode: "row",
    gap: 24,
    itemMinWidth: 300,
    children: [] as unknown as ReactNode,
  },
  resolveData: async ({ props }) => ({
    props: { ...props, children: props.children ?? [] },
  }),
  render: ({
    layoutMode,
    children: ChildrenSlot,
    gap,
    itemMinWidth = 300,
  }) => {
    // Defensive check for slot during deletion
    if (!ChildrenSlot || typeof ChildrenSlot !== "function") {
      return <div className="w-full" />;
    }

    const isRow = layoutMode === "row";

    // clamp(min, preferred, max)
    const responsiveGap = `clamp(4px, 2vw, ${gap}px)`;

    const containerStyles: React.CSSProperties = {
      display: isRow ? "grid" : "flex",
      flexDirection: !isRow ? "column" : undefined,
      gridTemplateColumns: isRow ? `repeat(auto-fit, minmax(${itemMinWidth}px, 1fr))` : undefined,
      gap: responsiveGap,
      alignItems: "flex-start",
      width: "100%",
    };

    // Cast to any to allow JSX invocation with props
    const SlotComponent = ChildrenSlot as any;

    return (
      <SlotComponent
        className="w-full"
        style={containerStyles}
      />
    );
  },
};

export const GridContainer = withLayout(GridContainerInternal);
