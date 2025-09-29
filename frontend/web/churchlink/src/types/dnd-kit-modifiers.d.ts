declare module "@dnd-kit/modifiers" {
  import type { Modifier } from "@dnd-kit/core";
  export const restrictToVerticalAxis: Modifier;
  export const restrictToFirstScrollableAncestor: Modifier;
  export const restrictToParentElement: Modifier;
  export const restrictToWindowEdges: Modifier;
}
