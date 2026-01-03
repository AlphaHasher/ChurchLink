import { CSSProperties, forwardRef, ReactNode } from "react";
import styles from "../../styles/components/Section.module.css";
import { getClassNameFactory } from "../../utils/classNames";

const getClassName = getClassNameFactory("Section", styles);

export type SectionProps = {
  className?: string;
  children: ReactNode;
  maxWidth?: string;
  style?: CSSProperties;
};

export const Section = forwardRef<HTMLDivElement, SectionProps>(
  ({ children, className, maxWidth = "1280px", style = {} }, ref) => {
    return (
      <div
        className={`${getClassName()}${className ? ` ${className}` : ""}`}
        style={{
          ...style,
        }}
        ref={ref}
      >
        <div className={getClassName("inner")} style={{ maxWidth }}>
          {children}
        </div>
      </div>
    );
  }
);

Section.displayName = "Section";
