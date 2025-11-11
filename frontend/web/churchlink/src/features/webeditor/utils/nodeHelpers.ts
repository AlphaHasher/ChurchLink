import { Node, SectionV2 } from "@/shared/types/pageV2";

/**
 * Locate a Node within a section's subtree by its section and node identifiers.
 *
 * @param sections - Array of sections to search.
 * @param sectionId - Identifier of the target section.
 * @param nodeId - Identifier of the target node inside the section.
 * @returns The matching Node if found; `undefined` if no match exists or if `sectionId` or `nodeId` is not provided.
 */
export function findSelectedNode(
  sections: SectionV2[],
  sectionId?: string,
  nodeId?: string
): Node | undefined {
  if (!sectionId || !nodeId) return undefined;
  
  for (const s of sections) {
    if (s.id === sectionId) {
      const walk = (nodes: Node[]): Node | undefined => {
        for (const n of nodes) {
          if (n.id === nodeId) return n;
          if (n.children) {
            const found = walk(n.children);
            if (found) return found;
          }
        }
        return undefined;
      };
      return walk(s.children);
    }
  }
  return undefined;
}
