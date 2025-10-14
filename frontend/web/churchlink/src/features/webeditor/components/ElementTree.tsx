import React from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { Node } from "@/shared/types/pageV2";

interface ElementTreeProps {
  nodes: Node[];
  onHover: (nodeId: string | null) => void;
  onLeave: () => void;
}

interface NodeItemProps {
  node: Node;
  onHover: (nodeId: string | null) => void;
}

const NodeItem: React.FC<NodeItemProps> = ({ node, onHover }) => {
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const label = node.type;
  const handleMouseEnter = () => onHover(node.id);

  return (
    <Collapsible
      defaultOpen
      className="border rounded"
    >
      <CollapsibleTrigger
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-accent"
        onMouseEnter={handleMouseEnter}
      >
        <span>{label}</span>
        <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t bg-muted/40 px-3 py-2 space-y-2" onMouseEnter={handleMouseEnter}>
        <div className="text-xs text-muted-foreground break-all">ID: {node.id}</div>
        {node.type === "text" && (
          <div className="text-xs text-muted-foreground line-clamp-2">
            {(node as any).props?.html ?? (node as any).props?.text ?? ""}
          </div>
        )}
        {node.type === "button" && (
          <div className="text-xs text-muted-foreground">
            Label: {(node as any).props?.label ?? "Button"}
          </div>
        )}
        {hasChildren && (
          <div className="space-y-1 pl-2 border-l border-dashed">
            {node.children!.map((child) => (
              <NodeItem key={child.id} node={child} onHover={onHover} />
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

const ElementTree: React.FC<ElementTreeProps> = ({ nodes, onHover, onLeave }) => {
  return (
    <div className="space-y-1" onMouseLeave={() => onLeave()}>
      {nodes.map((node) => (
        <NodeItem key={node.id} node={node} onHover={onHover} />
      ))}
    </div>
  );
};

export default ElementTree;


