import { useState, useRef, useCallback } from "react";
import { Node, SectionV2 } from "@/shared/types/pageV2";
import { newId, defaultSection, createPresetSection } from "../utils/sectionHelpers";

type EditorSelection = { sectionId?: string; nodeId?: string } | null;

export function useSectionManager() {
  const [sections, setSections] = useState<SectionV2[]>([]);
  const [selection, setSelection] = useState<EditorSelection>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [highlightNodeId, setHighlightNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [deleteSectionId, setDeleteSectionId] = useState<string | null>(null);
  const isAddingRef = useRef(false);

  const addSection = useCallback(() => {
    setSections((prev) => [...prev, defaultSection()]);
  }, []);

  const addSectionPreset = useCallback((key: string) => {
    const newSection = createPresetSection(key);
    if (newSection) {
      setSections((prev) => [...prev, newSection]);
    }
  }, []);

  const addElement = useCallback((type: Node["type"]) => {
    if (isAddingRef.current) return;
    isAddingRef.current = true;

    setSections((prev) => {
      if (prev.length === 0) {
        const s = defaultSection();
        isAddingRef.current = false;
        return [s];
      }

      const copy = [...prev];
      const last = copy[copy.length - 1];

      const findContainer = (nodes: Node[]): Node | null => {
        for (const node of nodes) {
          if (node.type === "container") return node;
          if (node.children && node.children.length > 0) {
            const found = findContainer(node.children);
            if (found) return found;
          }
        }
        return null;
      };

      const target = findContainer(last.children || []);

      if (target && target.type === "container") {
        const newNode: Node =
          type === "text"
            ? { id: `${newId()}-t`, type: "text", props: { html: "Edit me" } }
            : type === "button"
            ? { id: `${newId()}-b`, type: "button", props: { label: "Click" } }
            : type === "eventList"
            ? { id: `${newId()}-e`, type: "eventList", props: { showFilters: true } }
            : { id: `${newId()}-c`, type: "container", props: { maxWidth: "xl", paddingX: 4, paddingY: 6 }, children: [] };

        target.children = [...(target.children ?? []), newNode];
      }

      isAddingRef.current = false;
      return copy;
    });
  }, []);

  const onSelectNode = useCallback((sectionId: string, nodeId: string) => {
    setSelection({ sectionId, nodeId });
    setSelectedSectionId(null);
  }, []);

  const updateSelectedNode = useCallback((updater: (node: Node) => Node) => {
    setSections((prev) =>
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
  }, [selection]);

  const deleteSection = useCallback(() => {
    if (!deleteSectionId) return;
    setSections((prev) => prev.filter((x) => x.id !== deleteSectionId));
    setDeleteSectionId(null);
  }, [deleteSectionId]);

  const updateNodeLayout = useCallback(
    (sectionId: string, nodeId: string, units: { xu: number; yu: number }) => {
      setSections((prev) =>
        prev.map((s) => {
          if (s.id !== sectionId) return s;
          const walk = (nodes: Node[]): Node[] =>
            nodes.map((n) => {
              if (n.id === nodeId) {
                return {
                  ...n,
                  layout: {
                    units: { ...n.layout?.units, ...units },
                    // px will be re-derived next render
                  },
                };
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
    []
  );

  return {
    sections,
    setSections,
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
