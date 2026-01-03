import type { ComponentConfig } from "@measured/puck";
import styles from "../../styles/components/Space.module.css";
import { getClassNameFactory } from "../../utils/classNames";
import { spacingOptions } from "../shared/options";

const getClassName = getClassNameFactory("Space", styles);

export type SpaceBlockProps = {
  direction: "" | "vertical" | "horizontal";
  size: string;
};

export const SpaceBlock: ComponentConfig<SpaceBlockProps> = {
  label: "Space",
  fields: {
    size: {
      type: "select",
      label: "Size",
      options: spacingOptions,
    },
    direction: {
      type: "radio",
      label: "Direction",
      options: [
        { value: "vertical", label: "Vertical" },
        { value: "horizontal", label: "Horizontal" },
        { value: "", label: "Both" },
      ],
    },
  },
  defaultProps: {
    direction: "",
    size: "24px",
  },
  inline: true,
  render: ({ direction, size, puck }) => {
    return (
      <div
        ref={puck.dragRef}
        className={getClassName(direction ? { [direction]: true } : {})}
        style={{ "--size": size } as React.CSSProperties}
      />
    );
  },
};
