import React from "react";
import { Button } from "@/shared/components/ui/button";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/shared/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/components/ui/collapsible";
import { SidebarMenuSub, SidebarMenuSubItem } from "@/shared/components/ui/sidebar";
import { X } from "lucide-react";

type ElementItem = { type: string; label: string };

interface EditorSidebarProps {
  onAddSection: () => void;
  elements: ElementItem[];
  onAddElement: (type: string) => void;
  sectionPresets?: Array<{ key: string; label: string }>;
  onAddSectionPreset?: (key: string) => void;
  currentSections?: Array<{ id: string; label: string }>;
  onFocusSection?: (id: string) => void;
  onDeleteSection?: (id: string) => void;
  pageTitle?: string;
  slug?: string;
}

const EditorSidebar: React.FC<EditorSidebarProps> = ({ onAddSection, elements, onAddElement, sectionPresets = [], onAddSectionPreset, currentSections = [], onFocusSection, onDeleteSection, pageTitle, slug }) => {
  return (
    // Offset the fixed shadcn sidebar by the top bar height (h-12)
    <Sidebar
      collapsible="offcanvas"
      className="border-r top-12"
      style={{
        // Narrower editor sidebar
        ["--sidebar-width" as any]: "14rem",
        ["--sidebar-width-icon" as any]: "2.75rem",
      }}
    >
      <SidebarHeader>
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium truncate" title={pageTitle}>{pageTitle || "Untitled"}</div>
          <Button size="sm" variant="secondary" onClick={onAddSection}>+ Section</Button>
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
                  <SidebarMenuButton className="justify-between">
                    <span>Current Page</span>
                    <span className="text-xs text-muted-foreground">{currentSections.length}</span>
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {currentSections.map((p, idx) => (
                      <SidebarMenuSubItem key={p.id} className="group/menu-item relative">
                        <SidebarMenuButton className="justify-start" onClick={() => onFocusSection?.(p.id)}>
                          <span>{idx + 1}. {p.label}</span>
                        </SidebarMenuButton>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center justify-end text-muted-foreground transition-transform translate-x-[180%] group-hover/menu-item:translate-x-0 group-hover/menu-item:pointer-events-auto">
                          <div className="absolute inset-y-0 right-full w-16 h-full" />
                          <div className="relative z-10 flex items-center pr-1 bg-transparent rounded-r-md">
                            <button
                              className="rounded-md p-1.5 hover:bg-accent hover:text-accent-foreground"
                              title="Delete section"
                              aria-label="Delete section"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteSection?.(p.id); }}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
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
                  <SidebarMenuButton className="justify-between">
                    <span>Sections</span>
                    <span className="text-xs text-muted-foreground">{sectionPresets.length}</span>
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
                  <SidebarMenuButton className="justify-between">
                    <span>Elements</span>
                    <span className="text-xs text-muted-foreground">{elements.length}</span>
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
  );
};

export default EditorSidebar;


