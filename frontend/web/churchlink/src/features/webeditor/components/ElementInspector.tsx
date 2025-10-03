import React from "react";

import { Button } from "@/shared/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/shared/components/ui/sheet";
import { Separator } from "@/shared/components/ui/separator";
import { Node, TextNode } from "@/shared/types/pageV2";

import { ButtonInspector } from "./element-inspector/ButtonInspector";
import { ContainerInspector } from "./element-inspector/ContainerInspector";
import { EventListInspector } from "./element-inspector/EventListInspector";
import { LayoutSizeControls } from "./element-inspector/LayoutSizeControls";
import { PositionControls } from "./element-inspector/PositionControls";
import { TextInspector } from "./element-inspector/TextInspector";

interface ElementInspectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedNode: Node | null;
  onUpdateNode: (updater: (node: Node) => Node) => void;
  fontManager?: any; // Font manager from useFontManager hook
  gridSize?: number; // px per grid unit for converting wu/hu ⇄ px/rem
}

export const ElementInspector: React.FC<ElementInspectorProps> = ({
  open,
  onOpenChange,
  selectedNode,
  onUpdateNode,
  fontManager,
  gridSize,
}) => {
  const renderContent = () => {
    if (!selectedNode) {
      return (
        <div className="px-6 py-4">
          <SheetHeader>
            <SheetTitle>Element Inspector</SheetTitle>
            <SheetDescription>
              Select an element to edit its properties
            </SheetDescription>
          </SheetHeader>
        </div>
      );
    }

    const getElementTypeName = (type: string) => {
      switch (type) {
        case "text":
          return "Text Element";
        case "button":
          return "Button Element";
        case "container":
          return "Container Element";
        case "eventList":
          return "Event List Element";
        default:
          return "Unknown Element";
      }
    };

    return (
      <>
        <div className="px-6 py-4 border-b">
          <SheetHeader>
            <SheetTitle>{getElementTypeName(selectedNode.type)}</SheetTitle>
            <SheetDescription>
              Edit properties for this {selectedNode.type} element
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-y-auto h-[calc(100vh-120px)]">
          <div className="rounded-lg border p-3 bg-muted/30">
            <div className="text-xs font-mono text-muted-foreground">ID: {selectedNode.id}</div>
            <div className="text-xs font-mono text-muted-foreground">Type: {selectedNode.type}</div>
          </div>

          <Separator />

          <PositionControls node={selectedNode} onUpdateNode={onUpdateNode} gridSize={gridSize} />
          <LayoutSizeControls node={selectedNode} onUpdateNode={onUpdateNode} gridSize={gridSize} />

          {selectedNode.type === "text" && (
            <TextInspector
              node={selectedNode as TextNode}
              onUpdate={onUpdateNode}
              fontManager={fontManager}
              gridSize={gridSize}
            />
          )}

          {selectedNode.type === "button" && <ButtonInspector node={selectedNode} onUpdate={onUpdateNode} />}

          {selectedNode.type === "container" && <ContainerInspector node={selectedNode} onUpdate={onUpdateNode} />}

          {selectedNode.type === "eventList" && <EventListInspector node={selectedNode} onUpdate={onUpdateNode} />}

          <Separator />

          <div className="pt-4 pb-6">
            <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
              Close Inspector
            </Button>
          </div>
        </div>
      </>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent side="right" className="w-[400px] sm:w-[500px] p-0" onInteractOutside={(e) => e.preventDefault()}>
        {renderContent()}
      </SheetContent>
    </Sheet>
  );
};

export default ElementInspector;
