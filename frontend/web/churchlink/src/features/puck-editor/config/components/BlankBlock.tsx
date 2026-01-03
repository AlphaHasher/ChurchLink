import type { ComponentConfig } from "@measured/puck";
import styles from "../../styles/components/Blank.module.css";
import { getClassNameFactory } from "../../utils/classNames";

const getClassName = getClassNameFactory("Blank", styles);

export type BlankBlockProps = Record<string, never>;

export const BlankBlock: ComponentConfig<BlankBlockProps> = {
  label: "Blank Space",
  fields: {},
  defaultProps: {},
  render: () => {
    return <div className={getClassName()}></div>;
  },
};
