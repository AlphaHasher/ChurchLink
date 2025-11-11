import { useState, useRef, useCallback } from "react";
import { Node, SectionV2 } from "@/shared/types/pageV2";
import { newId, defaultSection, createPresetSection } from "../utils/sectionHelpers";
import { BuilderState } from "@/features/webeditor/state/BuilderState";
import { getDefaultHu, getDefaultWu } from "../utils/nodeDefaults";

type EditorSelection = { sectionId?: string; nodeId?: string } | null;

// Add helper function to initialize layouts recursively
const initializeLayouts = (nodes: Node[], parentYu = 0, isNested = false): Node[] => {
  let currentYu = parentYu;

  return nodes.map((node) => {
    const newNode = { ...node };
    const layout = { ...(newNode.layout ?? {}) };
    const units = { ...(layout.units ?? {}) } as {
      xu?: number;
      yu?: number;
      wu?: number;
      hu?: number;
    };

    const hasYu = typeof units.yu === "number";
    const hasXu = typeof units.xu === "number";
    const hasWu = typeof units.wu === "number";
    const hasHu = typeof units.hu === "number";

    const defaultWu = getDefaultWu(newNode.type);
    const defaultHu = getDefaultHu(newNode.type);

    const assignedYu = hasYu ? (units.yu as number) : currentYu;
    const assignedXu = hasXu ? (units.xu as number) : 0;
    const assignedWu = hasWu ? (units.wu as number) : defaultWu;
    const assignedHu = hasHu ? (units.hu as number) : defaultHu;

    layout.units = {
      ...units,
      xu: assignedXu,
      yu: assignedYu,
      wu: assignedWu,
      hu: assignedHu,
    };

    newNode.layout = layout;

    if (!hasYu) {
      currentYu += isNested ? 1 : 2;
    }

    if (newNode.children && newNode.children.length > 0) {
      newNode.children = initializeLayouts(newNode.children, 0, true); // Reset yu for nested
    }

    return newNode;
  });
};

/**
 * Manage editor sections, node selection, clipboard, and layout-aware CRUD operations for sections and nodes.
 *
 * Provides state and actions for creating, copying, pasting, deleting, selecting, reordering, and updating
 * sections and nodes while maintaining consistent layout units and history for undo/redo.
 *
 * @returns An object with the current editor state and actions:
 * - `sections` — current list of sections (with initialized layout units)
 * - `setSections` — setter that applies layout initialization when updating sections
 * - `selection`, `setSelection` — currently selected section/node and its setter
 * - `selectedSectionId`, `setSelectedSectionId` — selected section id and its setter
 * - `highlightNodeId`, `setHighlightNodeId` — node id to highlight and its setter
 * - `hoveredNodeId`, `setHoveredNodeId` — node id being hovered and its setter
 * - `deleteSectionId`, `setDeleteSectionId` — queued section id for deletion and its setter
 * - `deleteNodeId`, `setDeleteNodeId` — queued node (sectionId + nodeId) for deletion and its setter
 * - `copySelected` — copy the currently selected node to an internal clipboard
 * - `pasteClipboard` — paste the clipboard node into the current or specified section/context
 * - `deleteNode` — execute queued node deletion
 * - `deleteSelectedNode` — queue and delete the currently selected node
 * - `addSection` — append a default section
 * - `addSectionPreset` — append a preset section (ensures a unique, human-friendly name)
 * - `addElement` — insert a new node (various types) into the appropriate section/container with computed layout
 * - `onSelectNode` — convenience to set selection by sectionId and nodeId
 * - `updateSelectedNode` — apply an updater to the selected node (clears pixel cache and triggers overlay updates)
 * - `updateNodeLayout` — update a node's layout units and shift descendants when moving containers
 * - `reorderSections` — move a section to another position (updates history and layouts)
 */
export function useSectionManager() {
  const [sections, setSections] = useState<SectionV2[]>([]);
  const [selection, setSelection] = useState<EditorSelection>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [highlightNodeId, setHighlightNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [deleteSectionId, setDeleteSectionId] = useState<string | null>(null);
  const [deleteNodeId, setDeleteNodeId] = useState<{ sectionId: string; nodeId: string } | null>(null);
  const isAddingRef = useRef(false);
  const clipboardRef = useRef<{ sectionId: string; node: Node } | null>(null);

  // Update setSections to always initialize layouts
  const setSectionsWithLayouts = useCallback((updater: SectionV2[] | ((prev: SectionV2[]) => SectionV2[])) => {
    setSections((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return next.map((section) => ({
        ...section,
        children: initializeLayouts(section.children || []),
      }));
    });
  }, []);

  const findParentAndIndex = useCallback(function find(
    nodes: Node[],
    targetId: string,
    parent: Node | null = null
  ): { parentChildren: Node[]; index: number; parentNode: Node | null } | null {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.id === targetId) return { parentChildren: nodes, index: i, parentNode: parent };
      if (n.children && n.children.length) {
        const found = find(n.children, targetId, n);
        if (found) return found;
      }
    }
    return null;
  }, []);

  const addSection = useCallback(() => {
    const prev = sections;
    const next = [...sections, defaultSection()];
    BuilderState.pushSections(prev, next);
    setSectionsWithLayouts(next);
  }, [sections, setSectionsWithLayouts]);

  const addSectionPreset = useCallback((key: string) => {
    const newSection = createPresetSection(key);
    if (newSection) {

      const keyToName: Record<string, string> = {
        hero: "hero",
        events: "events",
        map: "map",
        paypal: "paypal",
        serviceTimes: "service times",
        menu: "menu",
        contactInfo: "contact info",
      };
      
      const baseName = keyToName[key] || key;
      
      const existingNames = sections
        .map((s) => (s.styleTokens as any)?.name as string | undefined)
        .filter((name): name is string => typeof name === 'string' && name.trim() !== '');
      
      let uniqueName = baseName;
      let counter = 0;
      
      if (existingNames.includes(baseName)) {
        counter = 1;
        uniqueName = `${baseName} ${counter}`;
        
        while (existingNames.includes(uniqueName)) {
          counter++;
          uniqueName = `${baseName} ${counter}`;
        }
      }
      
      newSection.styleTokens = {
        ...newSection.styleTokens,
        name: uniqueName,
      };
      
      const prev = sections;
      const next = [...sections, newSection];
      BuilderState.pushSections(prev, next);
      setSectionsWithLayouts(next);
    }
  }, [sections, setSectionsWithLayouts]);

  const addElement = useCallback(
    (type: Node["type"]) => {
      if (isAddingRef.current) return;
      isAddingRef.current = true;

      try {
        const prev = sections;

        const createNewNode = (): Node => {
          if (type === "text") {
            return { id: `${newId()}-t`, type: "text", props: { html: "Edit me" } } as Node;
          }
          if (type === "button") {
            return { id: `${newId()}-b`, type: "button", props: { label: "Click" } } as Node;
          }
          if (type === "image") {
            return { id: `${newId()}-img`, type: "image", props: { src: "https://placehold.co/600x400", alt: "Image" } } as Node;
          }
          if (type === "eventList") {
            return { id: `${newId()}-e`, type: "eventList", props: { showFilters: true } } as Node;
          }
          if (type === "map") {
            return { id: `${newId()}-map`, type: "map", props: { embedUrl: "https://www.google.com/maps/embed?pb=..." } } as Node;
          }
          return {
            id: `${newId()}-c`,
            type: "container",
            props: { maxWidth: "xl", paddingX: 4, paddingY: 6 },
            children: [],
          } as Node;
        };

        const computeNextYu = (children: Node[] | undefined): number => {
          if (!children || !children.length) return 0;
          let nextYu = 0;
          for (const child of children) {
            const yu = child.layout?.units?.yu;
            if (typeof yu === "number") {
              nextYu = Math.max(nextYu, yu + 1);
            }
          }
          return nextYu;
        };

        const newNodeBase = createNewNode();

        let next: SectionV2[] | null = null;

        if (prev.length === 0) {
          const s = defaultSection();
          const existingChildren = s.children ?? [];
          const containerChild = existingChildren.find((child) => child.type === "container");
          const targetContainer =
            containerChild ??
            ({
              id: `${newId()}-root-container`,
              type: "container",
              props: { maxWidth: "xl", paddingX: 4, paddingY: 6 },
              children: [],
            } as Node);

          const containerChildren = [...(targetContainer.children ?? [])];
          const nextYu = computeNextYu(containerChildren);
          const nodeToInsert = {
            ...newNodeBase,
            layout: { units: { xu: 0, yu: nextYu } },
          } as Node;
          containerChildren.push(nodeToInsert);

          const updatedContainer = {
            ...targetContainer,
            children: containerChildren,
          } as Node;

          if (containerChild) {
            s.children = existingChildren.map((child) =>
              child.id === containerChild.id ? updatedContainer : child
            );
          } else {
            s.children = [...existingChildren, updatedContainer];
          }
          next = [s];
        } else {
          const targetSectionId =
            selection?.sectionId ??
            selectedSectionId ??
            prev[prev.length - 1]?.id;

          const section =
            prev.find((sec) => sec.id === targetSectionId) ?? prev[prev.length - 1];
          const sectionChildren = section.children ?? [];

          const selectionContext =
            type !== "container" && selection?.sectionId === section.id && selection.nodeId
              ? findParentAndIndex(sectionChildren, selection.nodeId)
              : null;

          let parentNodeId: string | null = null;
          let insertIndex = -1;
          let parentChildren: Node[] = sectionChildren;

          if (type === "container") {
            if (selectionContext && selectionContext.parentChildren === sectionChildren) {
              insertIndex = selectionContext.index + 1;
            } else {
              insertIndex = sectionChildren.length;
            }
          } else {
            if (selectionContext) {
              const selectedNode = selectionContext.parentChildren[selectionContext.index];
              if (selectedNode.type === "container") {
                parentNodeId = selectedNode.id;
                parentChildren = selectedNode.children ?? [];
                insertIndex = parentChildren.length;
              } else {
                const parentNode = selectionContext.parentNode;
                if (parentNode && parentNode.type === "container") {
                  parentNodeId = parentNode.id;
                  parentChildren = parentNode.children ?? [];
                } else {
                  parentChildren = sectionChildren;
                  parentNodeId = null;
                }
                insertIndex = selectionContext.index + 1;
              }
            }

            if (insertIndex === -1) {
              const fallbackContainer = sectionChildren.find((node) => node.type === "container");
              if (fallbackContainer) {
                parentNodeId = fallbackContainer.id;
                parentChildren = fallbackContainer.children ?? [];
                insertIndex = parentChildren.length;
              } else {
                parentNodeId = null;
                parentChildren = sectionChildren;
                insertIndex = parentChildren.length;
              }
            }
          }

          const nodeToInsert = {
            ...newNodeBase,
            layout: {
              units: {
                xu: 0,
                yu: computeNextYu(parentChildren),
              },
            },
          } as Node;

          const updatedSections = prev.map((s) => {
            if (s.id !== section.id) return s;

            if (!parentNodeId) {
              const updatedChildren = [...(s.children ?? [])];
              updatedChildren.splice(insertIndex, 0, nodeToInsert);
              return { ...s, children: updatedChildren };
            }

            let inserted = false;
            const insertIntoNodes = (nodes: Node[]): Node[] => {
              return nodes.map((node) => {
                if (inserted) return node;
                if (node.id === parentNodeId) {
                  inserted = true;
                  const childList = [...(node.children ?? [])];
                  childList.splice(insertIndex, 0, nodeToInsert);
                  return { ...node, children: childList };
                }
                if (node.children && node.children.length) {
                  const updatedKids = insertIntoNodes(node.children);
                  if (updatedKids !== node.children) {
                    return { ...node, children: updatedKids };
                  }
                }
                return node;
              });
            };

            const updatedChildren = insertIntoNodes(s.children ?? []);
            return { ...s, children: updatedChildren };
          });

          next = updatedSections;
        }

        if (next && next !== sections) {
          BuilderState.pushSections(prev, next);
          setSectionsWithLayouts(next);
        }
      } finally {
        isAddingRef.current = false;
      }
    },
    [sections, setSectionsWithLayouts, selection, selectedSectionId, findParentAndIndex]
  );

  const onSelectNode = useCallback((sectionId: string, nodeId: string) => {
    setSelection({ sectionId, nodeId });
    setSelectedSectionId(null);
  }, []);

  const updateSelectedNode = useCallback((updater: (node: Node) => Node) => {
    setSectionsWithLayouts((prev) =>
      prev.map((s) => {
        if (!selection?.sectionId || s.id !== selection.sectionId) return s;
        const walk = (nodes: Node[]): Node[] =>
          nodes.map((n) => {
            if (n.id === selection.nodeId) return updater(n);
            if (n.children && n.children.length) return { ...n, children: walk(n.children) } as Node;
            return n;
          });
        return { ...s, children: walk(s.children) };
      })
    );

    if (selection?.sectionId && selection?.nodeId) {
      const { sectionId, nodeId } = selection;
      // Ensure any pixel cache is cleared so unit updates reflect immediately in the renderer
      BuilderState.clearNodePixelLayout(sectionId, nodeId);
      // Do not push to history here; inspector controls push a single history entry on commit
      setTimeout(() => {
        const cache = BuilderState.getNodePixelLayout(nodeId);
        if (cache) {
          BuilderState.showPaddingOverlay(sectionId, nodeId, [0, 0, 0, 0]);
        }
      }, 0);
    }
  }, [selection, setSectionsWithLayouts]);

  // Deep clone a node and all descendants with fresh IDs and without px cache
  const deepCloneWithNewIds = useCallback(function clone(node: Node): Node {
    const clonedChildren = node.children ? node.children.map((c) => clone(c)) : undefined;
    const layoutUnits = node.layout?.units ? { ...node.layout.units } : undefined;
    return {
      ...node,
      id: `${newId()}`,
      children: clonedChildren,
      layout: layoutUnits ? { units: layoutUnits } : undefined,
    } as Node;
  }, []);

  const copySelected = useCallback(() => {
    if (!selection?.sectionId || !selection?.nodeId) return;
    const s = sections.find((x) => x.id === selection.sectionId);
    if (!s) return;
    const located = findParentAndIndex(s.children || [], selection.nodeId);
    if (!located) return;
    const original = located.parentChildren[located.index];
    clipboardRef.current = { sectionId: s.id, node: { ...original } };
  }, [selection, sections, findParentAndIndex]);

  const pasteClipboard = useCallback(() => {
    const payload = clipboardRef.current;
    if (!payload) return;

    const targetSectionId = selection?.sectionId ?? selectedSectionId ?? payload.sectionId;
    if (!targetSectionId) return;

    const prev = sections;
    const next = sections.map((s) => {
      if (s.id !== targetSectionId) return s;

      const cloned = deepCloneWithNewIds(payload.node);
      const insertionContext = selection?.nodeId ? findParentAndIndex(s.children || [], selection.nodeId) : null;
      if (insertionContext) {
        const { parentChildren, index } = insertionContext;
        const selectedNode = parentChildren[index];
        const selectedYu = selectedNode?.layout?.units?.yu ?? 0;
        if (cloned.layout?.units) {
          cloned.layout.units.yu = (typeof cloned.layout.units.yu === 'number' ? cloned.layout.units.yu : selectedYu) + 1;
        } else {
          cloned.layout = { units: { xu: 0, yu: selectedYu + 1 } };
        }

        const rebuild = (nodes: Node[]): Node[] => {
          if (nodes === parentChildren) {
            const arr = [...nodes];
            arr.splice(index + 1, 0, cloned);
            return arr;
          }
          return nodes.map((n) => (n.children && n.children.length ? { ...n, children: rebuild(n.children) } as Node : n));
        };

        const nextChildren = rebuild(s.children || []);
        setSelection({ sectionId: s.id, nodeId: cloned.id });
        return { ...s, children: nextChildren };
      }

      let maxYu = 0;
      for (const child of s.children || []) {
        const yu = child.layout?.units?.yu;
        if (typeof yu === 'number') maxYu = Math.max(maxYu, yu + 1);
      }
      if (cloned.layout?.units) {
        cloned.layout.units.yu = (typeof cloned.layout.units.yu === 'number' ? cloned.layout.units.yu : maxYu) + 1;
      } else {
        cloned.layout = { units: { xu: 0, yu: maxYu + 1 } };
      }
      const nextChildren = [...(s.children || []), cloned];
      setSelection({ sectionId: s.id, nodeId: cloned.id });
      return { ...s, children: nextChildren };
    });
    BuilderState.pushSections(prev, next);
    setSectionsWithLayouts(next);
  }, [sections, selection, selectedSectionId, setSectionsWithLayouts, deepCloneWithNewIds, findParentAndIndex, setSelection]);

  const deleteSection = useCallback(() => {
    if (!deleteSectionId) return;
    const prev = sections;
    const next = sections.filter((x) => x.id !== deleteSectionId);
    BuilderState.pushSections(prev, next);
    setSectionsWithLayouts(next);
    setDeleteSectionId(null);
  }, [deleteSectionId, sections, setSectionsWithLayouts]);

  const deleteNode = useCallback(() => {
    if (!deleteNodeId) return;
    const prev = sections;
    const next = sections.map((s) => {
      if (s.id !== deleteNodeId.sectionId) return s;
      const removeNode = (nodes: Node[]): Node[] =>
        nodes
          .filter((n) => n.id !== deleteNodeId.nodeId)
          .map((n) => {
            if (n.children && n.children.length > 0) {
              return { ...n, children: removeNode(n.children) } as Node;
            }
            return n;
          });
      return { ...s, children: removeNode(s.children || []) };
    });
    BuilderState.pushSections(prev, next);
    setSectionsWithLayouts(next);
    setDeleteNodeId(null);
    setSelection(null);
    setHighlightNodeId(null);
  }, [deleteNodeId, sections, setSectionsWithLayouts]);

  const deleteSelectedNode = useCallback(() => {
    if (!selection?.sectionId || !selection?.nodeId) return;
    setDeleteNodeId({ sectionId: selection.sectionId, nodeId: selection.nodeId });
    // Reuse existing delete flow
    setTimeout(() => {
      deleteNode();
    }, 0);
  }, [selection, setDeleteNodeId, deleteNode]);

  const updateNodeLayout = useCallback(
    (sectionId: string, nodeId: string, units: Partial<{ xu: number; yu: number; wu: number; hu: number }>) => {
      setSectionsWithLayouts((prev) =>
        prev.map((s) => {
          if (s.id !== sectionId) return s;
          const walk = (nodes: Node[]): Node[] =>
            nodes.map((n): Node => {
              if (n.id === nodeId) {
                const prevUnits = { ...(n.layout?.units || {}) };
                const nextUnits = {
                  xu: units.xu ?? n.layout?.units?.xu ?? 0,
                  yu: units.yu ?? n.layout?.units?.yu ?? 0,
                  wu: units.wu ?? n.layout?.units?.wu,
                  hu: units.hu ?? n.layout?.units?.hu,
                };
                const dxu = (nextUnits.xu ?? 0) - (prevUnits.xu ?? 0);
                const dyu = (nextUnits.yu ?? 0) - (prevUnits.yu ?? 0);

                // If moving a container, shift all descendants by the same delta so visual stays in place
                const shiftChildren = (children: Node[] | undefined): Node[] | undefined => {
                  if (!children || children.length === 0) return children;
                  return children.map((child) => {
                    const cu = { ...(child.layout?.units || {}) };
                    const shifted: Node = {
                      ...child,
                      layout: {
                        units: {
                          xu: (cu.xu ?? 0) + dxu,
                          yu: (cu.yu ?? 0) + dyu,
                          wu: cu.wu,
                          hu: cu.hu,
                        },
                      },
                      children: shiftChildren(child.children),
                    } as Node;
                    // Track history per child move for proper undo/redo
                    BuilderState.pushLayout(sectionId, child.id, cu, (shifted.layout as any).units);
                    return shifted;
                  });
                };

                const withShiftedChildren =
                  n.type === 'container' && (dxu !== 0 || dyu !== 0)
                    ? shiftChildren(n.children)
                    : n.children;

                BuilderState.pushLayout(sectionId, nodeId, prevUnits, nextUnits);
                // Clear any cached pixel overrides so the renderer uses updated units
                BuilderState.clearNodePixelLayout(sectionId, nodeId);
                return {
                  ...n,
                  layout: { units: nextUnits },
                  children: withShiftedChildren,
                } as Node;
              }
              if (n.children && n.children.length) {
                return { ...n, children: walk(n.children) } as Node;
              }
              return n;
            });
          return { ...s, children: walk(s.children) };
        })
      );
    },
    [setSectionsWithLayouts]
  );

  const reorderSections = useCallback((activeId: string, overId: string) => {
    const prev = sections;
    const activeIndex = prev.findIndex((s) => s.id === activeId);
    const overIndex = prev.findIndex((s) => s.id === overId);
    
    if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) return;
    
    const next = [...prev];
    const [removed] = next.splice(activeIndex, 1);
    next.splice(overIndex, 0, removed);
    
    BuilderState.pushSections(prev, next);
    setSectionsWithLayouts(next);
  }, [sections, setSectionsWithLayouts]);

  return {
    sections,
    setSections: setSectionsWithLayouts,
    selection,
    setSelection,
    copySelected,
    pasteClipboard,
    selectedSectionId,
    setSelectedSectionId,
    highlightNodeId,
    setHighlightNodeId,
    hoveredNodeId,
    setHoveredNodeId,
    deleteSectionId,
    setDeleteSectionId,
    deleteNodeId,
    setDeleteNodeId,
    deleteNode,
    addSection,
    addSectionPreset,
    addElement,
    onSelectNode,
    updateSelectedNode,
    deleteSection,
    updateNodeLayout,
    deleteSelectedNode,
    reorderSections,
  };
}