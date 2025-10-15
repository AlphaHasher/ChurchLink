import * as React from "react";

import { NumberSelector, NumberSelectorProps } from "@/shared/components/NumberSelector";

export type NumericDragInputProps = NumberSelectorProps;

export const NumericDragInput = React.forwardRef<HTMLInputElement, NumericDragInputProps>(
  ({ dragCursorClassName = "cursor-ew-resize", ...props }, ref) => {
    return <NumberSelector ref={ref} dragCursorClassName={dragCursorClassName} {...props} />;
  }
);

NumericDragInput.displayName = "NumericDragInput";


