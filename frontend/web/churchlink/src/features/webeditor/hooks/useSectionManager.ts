import { useState, useRef, useCallback } from "react";
import { Node, SectionV2 } from "@/shared/types/pageV2";
import { newId, defaultSection, createPresetSection } from "../utils/sectionHelpers";
import { BuilderState } from "@/features/webeditor/state/BuilderState";

type EditorSelection = { sectionId?: string; nodeId?: string } | null;

// Add helper function to initialize layouts recursively
const initializeLayouts = (nodes: Node[], parentYu = 0, isNested = false): Node[] => {
  let currentYu = parentYu;
  return nodes.map((node) => {
    const newNode = { ...node };
    if (!newNode.layout) {
      newNode.layout = { units: { xu: 0, yu: currentYu } };
      currentYu += isNested ? 1 : 2;  // Tighter spacing for nested, looser for top-level
    } else if (!newNode.layout.units) {
      newNode.layout.units = { xu: 0, yu: currentYu };
      currentYu += isNested ? 1 : 2;
    }
    if (newNode.children && newNode.children.length > 0) {
      newNode.children = initializeLayouts(newNode.children, 0, true);  // Reset yu for nested
    }
    return newNode;
  });
};

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

  const addSection = useCallback(() => {
    const prev = sections;
    const next = [...sections, defaultSection()];
    BuilderState.pushSections(prev, next);
    setSectionsWithLayouts(next);
  }, [sections, setSectionsWithLayouts]);

  const addSectionPreset = useCallback((key: string) => {
    const newSection = createPresetSection(key);
    if (newSection) {
      const prev = sections;
      const next = [...sections, newSection];
      BuilderState.pushSections(prev, next);
      setSectionsWithLayouts(next);
    }
  }, [sections, setSectionsWithLayouts]);

  const addElement = useCallback((type: Node["type"]) => {
    if (isAddingRef.current) return;
    isAddingRef.current = true;

    const prev = sections;
    let newNode: Node;
    let nextYu = 0;

    if (type === "text") {
      newNode = { id: `${newId()}-t`, type: "text", props: { html: "Edit me" } } as Node;
    } else if (type === "button") {
      newNode = { id: `${newId()}-b`, type: "button", props: { label: "Click" } } as Node;
    } else if (type === "image") {
      newNode = { id: `${newId()}-img`, type: "image", props: { src: "https://placehold.co/600x400", alt: "Image" } } as Node;
    } else if (type === "eventList") {
      newNode = { id: `${newId()}-e`, type: "eventList", props: { showFilters: true } } as Node;
    } else {
      newNode = { id: `${newId()}-c`, type: "container", props: { maxWidth: "xl", paddingX: 4, paddingY: 6 }, children: [] } as Node;
    }

    newNode.layout = {
      units: {
        xu: 0,
        yu: nextYu
      }
    };

    let next: SectionV2[] = [];
    if (prev.length === 0) {
      const container = { id: `${newId()}-c0`, type: "container", props: { maxWidth: "xl", paddingX: 4, paddingY: 6 }, children: [] } as Node;
      const s = defaultSection();
      s.children = [container, newNode];
      next = [s];
    } else {
      const copy = prev.map((s) => ({ ...s, children: [...(s.children || [])] }));
      const last = copy[copy.length - 1];
      if (last.children) {
        for (const child of last.children) {
          if (child.layout?.units?.yu !== undefined) {
            nextYu = Math.max(nextYu, child.layout.units.yu + 1);
          }
        }
      }
      (newNode.layout as any).units.yu = nextYu;
      last.children = [...(last.children ?? []), newNode];
      next = copy;
    }
    BuilderState.pushSections(prev, next);
    setSectionsWithLayouts(next);
    isAddingRef.current = false;
  }, [sections, setSectionsWithLayouts]);

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

  const findParentAndIndex = useCallback(function find(nodes: Node[], targetId: string): { parentChildren: Node[]; index: number } | null {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.id === targetId) return { parentChildren: nodes, index: i };
      if (n.children && n.children.length) {
        const found = find(n.children, targetId);
        if (found) return found;
      }
    }
    return null;
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
                BuilderState.pushLayout(sectionId, nodeId, prevUnits, nextUnits);
                // Clear any cached pixel overrides so the renderer uses updated units
                BuilderState.clearNodePixelLayout(sectionId, nodeId);
                return {
                  ...n,
                  layout: { units: nextUnits },
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
  };
}
