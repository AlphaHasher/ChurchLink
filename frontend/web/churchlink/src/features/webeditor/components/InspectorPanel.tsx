import React, { useEffect } from "react";
import { Node, PageV2, SectionV2 } from "@/shared/types/pageV2";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/shared/components/ui/sheet";
import { SectionInspector } from "./section-inspector/SectionInspector";
import { SimpleNodeInspector } from "./section-inspector/SimpleNodeInspector";
import { findSelectedNode } from "@/features/webeditor/utils/nodeHelpers";
import { getDefaultWu, getDefaultHu } from "@/features/webeditor/utils/nodeDefaults";

interface InspectorPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedSectionId: string | null;
  selection: { sectionId?: string; nodeId?: string } | null;
  sections: SectionV2[];
  setSections: React.Dispatch<React.SetStateAction<SectionV2[]>>;
  highlightNodeId: string | null;
  setHighlightNodeId: (id: string | null) => void;
  updateSelectedNode: (updater: (node: Node) => Node) => void;
  page: PageV2 | null;
  fontManager: any; // Font manager hook return type
  onRequestDeleteSection?: (id: string) => void;
  // gridSize removed from props, compute inside
}

const InspectorPanel: React.FC<InspectorPanelProps> = ({
  open,
  onOpenChange,
  selectedSectionId,
  selection,
  sections,
  setSections,
  setHighlightNodeId,
  updateSelectedNode,
  page,
  fontManager,
  onRequestDeleteSection,
}) => {
  const selectedNode = findSelectedNode(sections, selection?.sectionId, selection?.nodeId);
  const selectedSection = selectedSectionId ? sections.find((s) => s.id === selectedSectionId) : undefined;

  // Ensure selectedNode has layout if missing - run on selection change
  useEffect(() => {
    if (selection?.nodeId && selectedNode && !selectedNode.layout) {
      updateSelectedNode((n) => ({
        ...n,
        layout: { 
          units: { 
            xu: n.layout?.units?.xu ?? 0, 
            yu: n.layout?.units?.yu ?? 0, 
            wu: getDefaultWu(n.type), 
            hu: getDefaultHu(n.type) 
          } 
        }
      }));
    }
  }, [selection?.nodeId, selectedNode, updateSelectedNode]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent side="right" className="w-[460px] sm:w-[540px] p-0" onInteractOutside={(e) => e.preventDefault()}>
        <SheetHeader>
          <SheetTitle>Inspector</SheetTitle>
          <SheetDescription>
            Configure properties for the selected section or element.
          </SheetDescription>
        </SheetHeader>
        <div className="px-6 py-4 space-y-4 overflow-y-auto">
          {selectedSection && selectedSectionId ? (
            <SectionInspector
              section={selectedSection}
              sections={sections}
              setSections={setSections}
              page={page}
              fontManager={fontManager}
              setHighlightNodeId={setHighlightNodeId}
              onRequestDeleteSection={onRequestDeleteSection}
            />
          ) : selection?.nodeId && selectedNode ? (
            <SimpleNodeInspector
              node={selectedNode}
              onUpdateNode={updateSelectedNode}
            />
          ) : (
            <div className="text-sm text-gray-500">Select a section or element.</div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default InspectorPanel;
