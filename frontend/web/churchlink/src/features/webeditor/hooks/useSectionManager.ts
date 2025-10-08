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
  const isAddingRef = useRef(false);

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
    setSectionsWithLayouts((prev) => [...prev, defaultSection()]);
  }, [setSectionsWithLayouts]);

  const addSectionPreset = useCallback((key: string) => {
    const newSection = createPresetSection(key);
    if (newSection) {
      setSectionsWithLayouts((prev) => [...prev, newSection]);
    }
  }, [setSectionsWithLayouts]);

  const addElement = useCallback((type: Node["type"]) => {
    if (isAddingRef.current) return;
    isAddingRef.current = true;

    setSectionsWithLayouts((prev) => {
      let newNode: Node;
      let nextYu = 0;

      if (type === "text") {
        newNode = { id: `${newId()}-t`, type: "text", props: { html: "Edit me" } };
      } else if (type === "button") {
        newNode = { id: `${newId()}-b`, type: "button", props: { label: "Click" } };
      } else if (type === "eventList") {
        newNode = { id: `${newId()}-e`, type: "eventList", props: { showFilters: true } };
      } else {
        newNode = { id: `${newId()}-c`, type: "container", props: { maxWidth: "xl", paddingX: 4, paddingY: 6 }, children: [] };
      }

      newNode.layout = {
        units: {
          xu: 0,
          yu: nextYu
        }
      };

      if (prev.length === 0) {
        const container = { id: `${newId()}-c0`, type: "container", props: { maxWidth: "xl", paddingX: 4, paddingY: 6 }, children: [] } as Node;
        const s = defaultSection();
        s.children = [container, newNode];
        isAddingRef.current = false;
        return [s];
      }

      const copy = [...prev];
      const last = copy[copy.length - 1];

      // Compute nextYu based on existing absolute children
      if (last.children) {
        for (const child of last.children) {
          if (child.layout?.units?.yu !== undefined) {
            nextYu = Math.max(nextYu, child.layout.units.yu + 1);
          }
        }
      }

      // Update newNode yu
      (newNode.layout as any).units.yu = nextYu;

      last.children = [...(last.children ?? []), newNode];
      isAddingRef.current = false;
      return copy;
    });
  }, [setSectionsWithLayouts]);

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
      // Ensure any pixel cache is cleared so unit updates reflect immediately in the renderer
      BuilderState.clearNodePixelLayout(selection.sectionId, selection.nodeId);
      setTimeout(() => {
        const cache = BuilderState.getNodePixelLayout(selection.nodeId);
        if (cache) {
          BuilderState.showPaddingOverlay(selection.sectionId!, selection.nodeId, [0, 0, 0, 0]);
        }
      }, 0);
    }
  }, [selection, setSectionsWithLayouts]);

  const deleteSection = useCallback(() => {
    if (!deleteSectionId) return;
    setSectionsWithLayouts((prev) => prev.filter((x) => x.id !== deleteSectionId));
    setDeleteSectionId(null);
  }, [deleteSectionId, setSectionsWithLayouts]);

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
    selectedSectionId,
    setSelectedSectionId,
    highlightNodeId,
    setHighlightNodeId,
    hoveredNodeId,
    setHoveredNodeId,
    deleteSectionId,
    setDeleteSectionId,
    addSection,
    addSectionPreset,
    addElement,
    onSelectNode,
    updateSelectedNode,
    deleteSection,
    updateNodeLayout,
  };
}
