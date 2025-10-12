import React from "react";
import { Button } from "@/shared/components/ui/button";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/shared/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/components/ui/collapsible";
import { SidebarMenuSub, SidebarMenuSubItem } from "@/shared/components/ui/sidebar";
import { X } from "lucide-react";

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
  pageTitle?: string;
  slug?: string;
}

const EditorSidebar: React.FC<EditorSidebarProps> = ({ onAddSection, elements, onAddElement, sectionPresets = [], onAddSectionPreset, currentSections = [], onFocusSection, onFocusNode, onDeleteSection, pageTitle, slug }) => {

  const renderSectionTree = (nodes: SidebarSectionNode[], depth = 0) => (
    nodes.map((node) => {
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
              {node.type === 'section' && (
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center justify-end text-muted-foreground transition-transform translate-x-[180%] group-hover/menu-item:translate-x-0 group-hover/menu-item:pointer-events-auto">
                  <div className="absolute inset-y-0 right-full w-16 h-full" />
                  <div className="relative z-10 flex items-center pr-1 bg-transparent rounded-r-md">
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
                    {renderSectionTree(currentSections)}
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


