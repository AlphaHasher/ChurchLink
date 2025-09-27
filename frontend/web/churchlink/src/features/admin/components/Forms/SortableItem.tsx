import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";

type SortableItemProps = {
  id: string;
  children: (bind: {
    attributes: any;
    listeners: any;
    setNodeRef: (el: HTMLElement | null) => void;
    setActivatorNodeRef: (el: HTMLElement | null) => void;
    style: React.CSSProperties;
  }) => ReactNode;
};

export function SortableItem({ id, children }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <>{children({ attributes, listeners, setNodeRef, setActivatorNodeRef, style })}</>
  );
}
