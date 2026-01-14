import type { ComponentConfig } from "@measured/puck";
import type { ReactNode } from "react";
import { usePuck } from "@measured/puck";
import { withLayout } from "../shared/Layout";
import { GroupedFieldsPanel } from "../../fields/grouped/GroupedFieldsPanel";
import { gridContainerGroups } from "../../fields/grouped/componentConfigs/gridContainer";
import { extractComponentId } from "../../utils/puckFieldUtils";
import { findComponentRecursive, updateComponentRecursive } from "../../utils/puckDataUtils";

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
      type: "custom",
      label: "Settings",
      render: ({ id }: { id: string }) => {
        const componentId = extractComponentId(id);
        const { appState, dispatch } = usePuck();
        const componentResult = findComponentRecursive(appState.data, componentId);
        const component = componentResult?.component;

        const handleChange = (newProps: Record<string, unknown>) => {
          if (!component) return;
          const newData = updateComponentRecursive(appState.data, componentId, newProps);
          dispatch({ type: "setData", data: newData });
        };

        return (
          <GroupedFieldsPanel
            value={(component?.props as Record<string, unknown>) || {}}
            onChange={handleChange}
            config={gridContainerGroups}
          />
        );
      },
    } as any,
    children: {
      type: "slot",
    },
  } as any,
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
