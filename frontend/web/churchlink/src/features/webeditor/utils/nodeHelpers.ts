import { Node, SectionV2 } from "@/shared/types/pageV2";

/**
 * Find a node by sectionId and nodeId in a sections array
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

