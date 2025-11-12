import React from "react";
import { Button } from "@/shared/components/ui/button";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/shared/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/components/ui/collapsible";
import { SidebarMenuSub, SidebarMenuSubItem } from "@/shared/components/ui/sidebar";
import { X, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type ElementItem = { type: string; label: string };

type SidebarSectionNode = {
  id: string;
  label: string;
  type: 'section' | 'container' | 'node';
  sectionId: string;
  children?: SidebarSectionNode[];
};

interface EditorSidebarProps {
  onAddSection: () => void;
  elements: ElementItem[];
  onAddElement: (type: string) => void;
  sectionPresets?: Array<{ key: string; label: string }>;
  onAddSectionPreset?: (key: string) => void;
  currentSections?: SidebarSectionNode[];
  onFocusSection?: (id: string) => void;
  onFocusNode?: (sectionId: string, nodeId: string) => void;
  onDeleteSection?: (id: string) => void;
  onReorderSections?: (activeId: string, overId: string) => void;
  pageTitle?: string;
  slug?: string;
}

// Sortable section item component
const SortableSectionItem: React.FC<{
  node: SidebarSectionNode;
  depth: number;
  onFocusSection?: (id: string) => void;
  onFocusNode?: (sectionId: string, nodeId: string) => void;
  onDeleteSection?: (id: string) => void;
  renderSectionTree: (nodes: SidebarSectionNode[], depth: number) => React.ReactNode;
}> = ({ node, depth, onFocusSection, onFocusNode, onDeleteSection, renderSectionTree }) => {
  const [isOpen, setIsOpen] = React.useState(depth < 1);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hasChildren = Array.isArray(node.children) && node.children.length > 0;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      setIsOpen(!isOpen);
    }
    if (node.type === 'section') {
      onFocusSection?.(node.id);
    } else {
      onFocusNode?.(node.sectionId, node.id);
    }
  };

  const displayLabel = node.label;

  if (hasChildren) {
    return (
      <div ref={setNodeRef} style={style}>
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="group/nested">
          <SidebarMenuSubItem className="group/menu-item relative">
            <div className="flex items-center w-full gap-1 relative h-full">
              <button
                className="cursor-grab active:cursor-grabbing p-1 hover:bg-accent rounded flex-shrink-0 z-10"
                {...attributes}
                {...listeners}
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground" />
              </button>
              <div 
                className="flex-1 min-w-0 relative cursor-pointer" 
                onClick={handleClick}
                onMouseDown={(e) => {
                  // Ensure clicks work
                  e.stopPropagation();
                }}
              >
                <SidebarMenuButton 
                  className="justify-start w-full h-full rounded-md hover:bg-accent transition-colors pointer-events-auto" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClick(e);
                  }}
                >
                  <span className="truncate block w-full" title={node.label}>{displayLabel}</span>
                </SidebarMenuButton>
              </div>
            </div>
            {node.type === 'section' && (
              <div className="absolute inset-y-0 right-0 flex items-center justify-end text-muted-foreground transition-transform translate-x-[180%] group-hover/menu-item:translate-x-0 z-20 pointer-events-none group-hover/menu-item:pointer-events-auto">
                <div className="absolute inset-y-0 right-full w-16 h-full pointer-events-none" />
                <div className="relative z-10 flex items-center pr-1 bg-transparent rounded-r-md pointer-events-auto">
                  <button
                    className="rounded-md p-1.5 hover:bg-accent hover:text-accent-foreground"
                    title="Delete section"
                    aria-label="Delete section"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteSection?.(node.id); }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </SidebarMenuSubItem>
          <CollapsibleContent>
            <SidebarMenuSub className="ml-2 border-l border-border/40 pl-3 space-y-1">
              {renderSectionTree(node.children!, depth + 1)}
            </SidebarMenuSub>
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style}>
      <SidebarMenuSubItem>
        <div className="flex items-center w-full gap-1">
          <button
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-accent rounded flex-shrink-0"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </button>
          <SidebarMenuButton 
            className="justify-start flex-1" 
            onClick={handleClick}
          >
            <span className="truncate" title={node.label}>{displayLabel}</span>
          </SidebarMenuButton>
        </div>
      </SidebarMenuSubItem>
    </div>
  );
};

const EditorSidebar: React.FC<EditorSidebarProps> = ({ onAddSection, elements, onAddElement, sectionPresets = [], onAddSectionPreset, currentSections = [], onFocusSection, onFocusNode, onDeleteSection, onReorderSections, pageTitle, slug }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && onReorderSections) {
      onReorderSections(String(active.id), String(over.id));
    }
  };

  const renderSectionTree = (nodes: SidebarSectionNode[], depth = 0) => (
    nodes.map((node) => {
      // Only make sections draggable, not nested nodes
      if (node.type === 'section' && depth === 0) {
        return (
          <SortableSectionItem
            key={node.id}
            node={node}
            depth={depth}
            onFocusSection={onFocusSection}
            onFocusNode={onFocusNode}
            onDeleteSection={onDeleteSection}
            renderSectionTree={renderSectionTree}
          />
        );
      }

      // Non-section nodes or nested nodes render normally
      const hasChildren = Array.isArray(node.children) && node.children.length > 0;

      const handleClick = () => {
        if (node.type === 'section') {
          onFocusSection?.(node.id);
        } else {
          onFocusNode?.(node.sectionId, node.id);
        }
      };

      const displayLabel = node.label;

      if (hasChildren) {
        return (
          <Collapsible key={node.id} defaultOpen={depth < 1} className="group/nested">
            <SidebarMenuSubItem className="group/menu-item relative">
              <CollapsibleTrigger asChild>
                <SidebarMenuButton className="justify-start" onClick={handleClick}>
                  <span className="truncate" title={node.label}>{displayLabel}</span>
                </SidebarMenuButton>
              </CollapsibleTrigger>
            </SidebarMenuSubItem>
            <CollapsibleContent>
              <SidebarMenuSub className="ml-2 border-l border-border/40 pl-3 space-y-1">
                {renderSectionTree(node.children!, depth + 1)}
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        );
      }

      return (
        <SidebarMenuSubItem key={node.id}>
          <SidebarMenuButton className="justify-start" onClick={handleClick}>
            <span className="truncate" title={node.label}>{displayLabel}</span>
          </SidebarMenuButton>
        </SidebarMenuSubItem>
      );
    })
  );

  const sectionIds = currentSections.filter(s => s.type === 'section').map(s => s.id);
  return (
    // Offset the fixed shadcn sidebar by the top bar height (h-12)
    <>
    <Sidebar
      collapsible="icon"
      className="border-r top-12"
      style={{
        // Narrower editor sidebar
        ["--sidebar-width" as any]: "14rem",
        ["--sidebar-width-icon" as any]: "2.75rem",
      }}
    >
      <SidebarHeader>
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium truncate group-data-[collapsible=icon]:hidden" title={pageTitle}>{pageTitle || "Untitled"}</div>
          <Button size="sm" variant="secondary" className="group-data-[collapsible=icon]:hidden" onClick={onAddSection}>+ Section</Button>
        </div>
      </SidebarHeader>
      {/* Collapsible groups for Sections and Elements */}
      <SidebarContent>
        {/* Current Page (sections) */}
        <SidebarGroup>
          <SidebarMenu>
            <Collapsible defaultOpen className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton className="justify-start">
                    <span>Current Page</span>
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={sectionIds}
                        strategy={verticalListSortingStrategy}
                      >
                        {renderSectionTree(currentSections)}
                      </SortableContext>
                    </DndContext>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarMenu>
            <Collapsible defaultOpen className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton className="justify-start">
                    <span>Sections</span>
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {sectionPresets.map((p) => (
                      <SidebarMenuSubItem key={p.key}>
                        <SidebarMenuButton className="justify-start" onClick={() => onAddSectionPreset?.(p.key)}>
                          <span>{p.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarMenu>
            <Collapsible defaultOpen className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton className="justify-start">
                    <span>Elements</span>
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {elements.map((e) => (
                      <SidebarMenuSubItem key={e.type}>
                        <SidebarMenuButton className="justify-start" onClick={() => onAddElement(e.type)}>
                          <span>{e.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="text-xs text-muted-foreground px-2 truncate" title={slug}>Editing: {pageTitle} ({slug})</div>
      </SidebarFooter>
    </Sidebar>
    </>
  );
};

export default EditorSidebar;


