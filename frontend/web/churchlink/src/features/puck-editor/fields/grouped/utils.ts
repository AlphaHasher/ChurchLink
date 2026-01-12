/**
 * Utility functions for manipulating nested object properties using dot-path notation.
 * Supports simple paths ("heading"), nested objects ("badge.label"),
 * and array items ("buttons.0.label").
 */

/**
 * Parse a dot-path into segments, handling array indices
 * "buttons.0.label" -> ["buttons", "0", "label"]
 */
function parsePath(path: string): string[] {
  return path.split(".").map((segment) => segment.trim()).filter(Boolean);
}

/**
 * Get value at dot-path
 * @example
 * getValueAtPath({ buttons: [{ label: "Click" }] }, "buttons.0.label") // "Click"
 */
export function getValueAtPath(
  obj: Record<string, unknown>,
  path: string
): unknown {
  const segments = parsePath(path);

  let current: unknown = obj;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof current === "object") {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Set value at dot-path immutably
 * Returns new object with updated value, leaving original unchanged
 * @example
 * setValueAtPath({ buttons: [{ label: "Click" }] }, "buttons.0.label", "Submit")
 * // { buttons: [{ label: "Submit" }] }
 */
export function setValueAtPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const segments = parsePath(path);

  if (segments.length === 0) {
    return obj;
  }

  const [first, ...rest] = segments;

  // Base case: set direct property
  if (rest.length === 0) {
    return {
      ...obj,
      [first]: value,
    };
  }

  // Recursive case: update nested property
  const currentValue = obj[first];
  const isArrayIndex = /^\d+$/.test(rest[0]);

  let nestedObj: unknown;

  if (isArrayIndex && Array.isArray(currentValue)) {
    // Handle array
    nestedObj = [...currentValue];
    (nestedObj as unknown[])[parseInt(rest[0], 10)] = setValueAtPath(
      { value: (currentValue as unknown[])[parseInt(rest[0], 10)] },
      rest.slice(1).join("."),
      value
    ).value;
  } else if (typeof currentValue === "object" && currentValue !== null) {
    // Handle nested object
    nestedObj = setValueAtPath(
      currentValue as Record<string, unknown>,
      rest.join("."),
      value
    );
  } else {
    // Create new object/array based on next segment
    const nextSegment = rest[0];
    nestedObj = /^\d+$/.test(nextSegment) ? [] : {};

    if (Array.isArray(nestedObj)) {
      nestedObj = setValueAtPath(
        { value: undefined },
        rest.join("."),
        value
      ).value;
    } else {
      nestedObj = setValueAtPath(
        nestedObj as Record<string, unknown>,
        rest.join("."),
        value
      );
    }
  }

  return {
    ...obj,
    [first]: nestedObj,
  };
}

/**
 * Add item to array at path
 * @example
 * addArrayItem({ buttons: [{ label: "A" }] }, "buttons", { label: "B" })
 * // { buttons: [{ label: "A" }, { label: "B" }] }
 */
export function addArrayItem(
  obj: Record<string, unknown>,
  arrayPath: string,
  item: unknown
): Record<string, unknown> {
  const currentArray = getValueAtPath(obj, arrayPath);

  if (!Array.isArray(currentArray)) {
    return obj;
  }

  return setValueAtPath(obj, arrayPath, [...currentArray, item]);
}

/**
 * Remove item from array at path by index
 * @example
 * removeArrayItem({ buttons: [{ label: "A" }, { label: "B" }] }, "buttons", 0)
 * // { buttons: [{ label: "B" }] }
 */
export function removeArrayItem(
  obj: Record<string, unknown>,
  arrayPath: string,
  index: number
): Record<string, unknown> {
  const currentArray = getValueAtPath(obj, arrayPath);

  if (!Array.isArray(currentArray)) {
    return obj;
  }

  if (index < 0 || index >= currentArray.length) {
    return obj;
  }

  const newArray = currentArray.filter((_, i) => i !== index);
  return setValueAtPath(obj, arrayPath, newArray);
}

/**
 * Move array item (for reordering)
 * @example
 * moveArrayItem({ buttons: [{ label: "A" }, { label: "B" }, { label: "C" }] }, "buttons", 0, 2)
 * // { buttons: [{ label: "B" }, { label: "C" }, { label: "A" }] }
 */
export function moveArrayItem(
  obj: Record<string, unknown>,
  arrayPath: string,
  fromIndex: number,
  toIndex: number
): Record<string, unknown> {
  const currentArray = getValueAtPath(obj, arrayPath);

  if (!Array.isArray(currentArray)) {
    return obj;
  }

  if (
    fromIndex < 0 ||
    fromIndex >= currentArray.length ||
    toIndex < 0 ||
    toIndex >= currentArray.length
  ) {
    return obj;
  }

  if (fromIndex === toIndex) {
    return obj;
  }

  const newArray = [...currentArray];
  const [movedItem] = newArray.splice(fromIndex, 1);
  newArray.splice(toIndex, 0, movedItem);

  return setValueAtPath(obj, arrayPath, newArray);
}
