import { CSSProperties, forwardRef, ReactNode } from "react";
import type {
  ComponentConfig,
  DefaultComponentProps,
  ObjectField,
} from "@puckeditor/core";
import { spacingOptions } from "./options";
import { getClassNameFactory } from "../../utils/classNames";
import styles from "../../styles/components/Layout.module.css";

const getClassName = getClassNameFactory("Layout", styles);

const marginClasses: Record<string, string> = {
  none: "",
  small:  "mx-1   sm:mx-3   md:mx-6   lg:mx-16  xl:mx-32  2xl:mx-48",
  medium: "mx-2   sm:mx-4   md:mx-12  lg:mx-32  xl:mx-48  2xl:mx-64",
  large:  "mx-3   sm:mx-6   md:mx-20  lg:mx-48  xl:mx-64  2xl:mx-80",
  xl:     "mx-4   sm:mx-8   md:mx-32  lg:mx-64  xl:mx-80  2xl:mx-96",
};

type LayoutFieldProps = {
  padding?: string;
  spanCol?: number;
  spanRow?: number;
  grow?: boolean;
  marginOverride?: "none" | "small" | "medium" | "large" | "xl" | "custom" | "page-default";
  customMarginPx?: number;
};

export type WithLayout<Props extends DefaultComponentProps> = Props & {
  layout?: LayoutFieldProps;
};

type LayoutProps = WithLayout<{
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}>;

export const layoutField: ObjectField<LayoutFieldProps> = {
  type: "object",
  objectFields: {
    spanCol: {
      label: "Grid Columns",
      type: "number",
      min: 1,
      max: 12,
    },
    spanRow: {
      label: "Grid Rows",
      type: "number",
      min: 1,
      max: 12,
    },
    grow: {
      label: "Flex Grow",
      type: "radio",
      options: [
        { label: "true", value: true },
        { label: "false", value: false },
      ],
    },
    padding: {
      type: "select",
      label: "Vertical Padding",
      options: [{ label: "0px", value: "0px" }, ...spacingOptions],
    },
    marginOverride: {
      type: "select",
      label: "Horizontal Margin",
      options: [
        { label: "Use Page Margin", value: "page-default" },
        { label: "None (Full Width)", value: "none" },
        { label: "Small", value: "small" },
        { label: "Medium", value: "medium" },
        { label: "Large", value: "large" },
        { label: "Extra Large", value: "xl" },
        { label: "Custom", value: "custom" },
      ],
    },
    customMarginPx: {
      type: "number",
      label: "Custom Margin (px)",
      min: 0,
    },
  },
};

const Layout = forwardRef<HTMLDivElement, LayoutProps>(
  ({ children, className, layout, style }, ref) => {
    // Apply margin override if set (and not "page-default")
    let marginClass = "";
    let customMarginStyle: CSSProperties = {};

    if (layout?.marginOverride && layout.marginOverride !== "page-default") {
      if (layout.marginOverride === "custom" && (layout.customMarginPx ?? 0) > 0) {
        const marginPx = layout.customMarginPx ?? 0;
        // clamp(min, preferred, max)
        customMarginStyle = {
          paddingLeft: `clamp(0px, 2vw, ${marginPx}px)`,
          paddingRight: `clamp(0px, 2vw, ${marginPx}px)`,
        };
      } else {
        marginClass = marginClasses[layout.marginOverride] || "";
      }
    }

    return (
      <div
        className={`${className} ${marginClass}`.trim()}
        style={{
          gridColumn: layout?.spanCol
            ? `span ${Math.max(Math.min(layout.spanCol, 12), 1)}`
            : undefined,
          gridRow: layout?.spanRow
            ? `span ${Math.max(Math.min(layout.spanRow, 12), 1)}`
            : undefined,
          paddingTop: layout?.padding,
          paddingBottom: layout?.padding,
          flex: layout?.grow ? "1 1 0" : undefined,
          ...customMarginStyle,
          ...style,
        }}
        ref={ref}
      >
        {children}
      </div>
    );
  }
);

Layout.displayName = "Layout";

export { Layout };

export function withLayout<
  ThisComponentConfig extends ComponentConfig<any> = ComponentConfig<any>
>(componentConfig: ThisComponentConfig): ThisComponentConfig {
  return {
    ...componentConfig,
    fields: {
      ...componentConfig.fields,
      layout: layoutField,
    },
    defaultProps: {
      ...componentConfig.defaultProps,
      layout: {
        spanCol: 1,
        spanRow: 1,
        padding: "0px",
        grow: false,
        marginOverride: "page-default",
        ...componentConfig.defaultProps?.layout,
      },
    },
    resolveFields: (_, params) => {
      if (params.parent?.type === "Grid") {
        return {
          ...componentConfig.fields,
          layout: {
            ...layoutField,
            objectFields: {
              spanCol: layoutField.objectFields.spanCol,
              spanRow: layoutField.objectFields.spanRow,
              padding: layoutField.objectFields.padding,
              marginOverride: layoutField.objectFields.marginOverride,
              customMarginPx: layoutField.objectFields.customMarginPx,
            },
          },
        };
      }
      if (params.parent?.type === "Flex") {
        return {
          ...componentConfig.fields,
          layout: {
            ...layoutField,
            objectFields: {
              grow: layoutField.objectFields.grow,
              padding: layoutField.objectFields.padding,
              marginOverride: layoutField.objectFields.marginOverride,
              customMarginPx: layoutField.objectFields.customMarginPx,
            },
          },
        };
      }

      return {
        ...componentConfig.fields,
        layout: {
          ...layoutField,
          objectFields: {
            padding: layoutField.objectFields.padding,
            marginOverride: layoutField.objectFields.marginOverride,
            customMarginPx: layoutField.objectFields.customMarginPx,
          },
        },
      };
    },
    inline: true,
    render: (props) => (
      <Layout
        className={getClassName()}
        layout={props.layout as LayoutFieldProps}
        ref={props.puck.dragRef}
      >
        {componentConfig.render(props)}
      </Layout>
    ),
  };
}
