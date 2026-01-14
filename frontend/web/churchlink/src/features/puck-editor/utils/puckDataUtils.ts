import type { Data, ComponentData } from "@puckeditor/core";

/**
 * Recursively find a component by ID in the Puck data tree
 * Returns both the component and its path for nested updates
 */
export function findComponentRecursive(
  data: Data,
  componentId: string | undefined
): { component: ComponentData; path: string[] } | null {
  if (!componentId) return null;
  // Search in root content
  const contentIndex = data.content?.findIndex((c) => c.props?.id === componentId);
  if (contentIndex !== undefined && contentIndex !== -1 && data.content) {
    return {
      component: data.content[contentIndex],
      path: ["content", contentIndex.toString()],
    };
  }

  // Recursively search in children slots
  function searchInChildren(
    components: ComponentData[],
    parentPath: string[]
  ): { component: ComponentData; path: string[] } | null {
    for (let i = 0; i < components.length; i++) {
      const comp = components[i];
      if (comp.props?.id === componentId) {
        return { component: comp, path: [...parentPath, i.toString()] };
      }

      // Recursively search in this component's children
      if (Array.isArray(comp.props?.children)) {
        const found = searchInChildren(
          comp.props.children as ComponentData[],
          [...parentPath, i.toString(), "props", "children"]
        );
        if (found) return found;
      }
    }
    return null;
  }

  if (data.content) {
    return searchInChildren(data.content, ["content"]);
  }

  return null;
}

/**
 * Recursively update a component by ID in the Puck data tree
 * Handles both root-level and deeply nested components
 */
export function updateComponentRecursive(
  data: Data,
  componentId: string | undefined,
  newProps: Record<string, unknown>
): Data {
  if (!componentId) return data;
  const result = findComponentRecursive(data, componentId);
  if (!result) return data;

  // Deep clone data to avoid mutations
  const newData = JSON.parse(JSON.stringify(data)) as Data;

  // Navigate to component using path and update
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = newData;
  for (let i = 0; i < result.path.length - 1; i++) {
    current = current[result.path[i]];
  }

  const lastKey = result.path[result.path.length - 1];
  current[lastKey] = {
    ...current[lastKey],
    props: { ...current[lastKey].props, ...newProps },
  };

  return newData;
}
