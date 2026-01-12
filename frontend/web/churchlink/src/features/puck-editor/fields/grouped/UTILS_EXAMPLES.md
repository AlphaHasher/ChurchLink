# Dot-Path Utilities - Usage Examples

These utilities provide immutable operations on nested object properties using dot-path notation.

## Overview

The utilities support:
- **Simple paths:** `"heading"` → top-level property
- **Nested objects:** `"badge.label"` → nested property
- **Array items:** `"buttons.0.label"` → array element property
- **Deep nesting:** `"section.0.content.padding.top"` → unlimited depth

All operations are **immutable** - they return new objects without modifying the original.

## Usage Examples

### getValueAtPath - Retrieve Nested Values

```typescript
import { getValueAtPath } from "./utils";

const page = {
  heading: "Welcome",
  buttons: [
    { label: "Click", variant: "primary" },
    { label: "Submit", variant: "secondary" },
  ],
  padding: { top: 16, bottom: 16 },
};

// Simple property
getValueAtPath(page, "heading"); // "Welcome"

// Nested object
getValueAtPath(page, "padding.top"); // 16

// Array item
getValueAtPath(page, "buttons.0.label"); // "Click"
getValueAtPath(page, "buttons.1.variant"); // "secondary"

// Deep nesting
getValueAtPath(page, "buttons.0.variant"); // "primary"

// Nonexistent path returns undefined
getValueAtPath(page, "buttons.5.label"); // undefined
getValueAtPath(page, "nonexistent.path"); // undefined
```

### setValueAtPath - Update Nested Values Immutably

```typescript
import { setValueAtPath } from "./utils";

const page = {
  heading: "Welcome",
  buttons: [{ label: "Click" }],
  padding: { top: 16 },
};

// Update top-level property
const updated1 = setValueAtPath(page, "heading", "Hello");
// { heading: "Hello", buttons: [...], padding: { top: 16 } }
// Original `page` is unchanged

// Update nested object
const updated2 = setValueAtPath(page, "padding.top", 32);
// { heading: "Welcome", buttons: [...], padding: { top: 32 } }

// Update array item
const updated3 = setValueAtPath(page, "buttons.0.label", "Submit");
// { heading: "Welcome", buttons: [{ label: "Submit" }], padding: { top: 16 } }

// Create missing nested properties
const empty = {};
const created = setValueAtPath(empty, "badge.label", "New");
// { badge: { label: "New" } }
```

### addArrayItem - Add Items to Arrays

```typescript
import { addArrayItem } from "./utils";

const page = {
  buttons: [
    { label: "Click", variant: "primary" },
  ],
};

// Add to top-level array
const withMore = addArrayItem(page, "buttons", { label: "Submit", variant: "secondary" });
// { buttons: [
//   { label: "Click", variant: "primary" },
//   { label: "Submit", variant: "secondary" }
// ] }

// Add to nested array
const data = {
  section: {
    buttons: [{ label: "A" }],
  },
};
const updated = addArrayItem(data, "section.buttons", { label: "B" });
// { section: { buttons: [{ label: "A" }, { label: "B" }] } }

// Original is unchanged
console.log(page.buttons.length); // Still 1
```

### removeArrayItem - Remove Array Items by Index

```typescript
import { removeArrayItem } from "./utils";

const page = {
  buttons: [
    { label: "A" },
    { label: "B" },
    { label: "C" },
  ],
};

// Remove middle item
const updated = removeArrayItem(page, "buttons", 1);
// { buttons: [{ label: "A" }, { label: "C" }] }

// Remove first item
const updated2 = removeArrayItem(page, "buttons", 0);
// { buttons: [{ label: "B" }, { label: "C" }] }

// Remove last item
const updated3 = removeArrayItem(page, "buttons", 2);
// { buttons: [{ label: "A" }, { label: "B" }] }

// Out-of-bounds indices are ignored
const noChange = removeArrayItem(page, "buttons", 5);
// Original object returned unchanged
```

### moveArrayItem - Reorder Array Items

```typescript
import { moveArrayItem } from "./utils";

const page = {
  buttons: [
    { label: "A" },
    { label: "B" },
    { label: "C" },
  ],
};

// Move first item to end
const moved1 = moveArrayItem(page, "buttons", 0, 2);
// { buttons: [{ label: "B" }, { label: "C" }, { label: "A" }] }

// Move last item to beginning
const moved2 = moveArrayItem(page, "buttons", 2, 0);
// { buttons: [{ label: "C" }, { label: "A" }, { label: "B" }] }

// Swap adjacent items
const moved3 = moveArrayItem(page, "buttons", 0, 1);
// { buttons: [{ label: "B" }, { label: "A" }, { label: "C" }] }

// Same index returns original
const noChange = moveArrayItem(page, "buttons", 0, 0);
// Original object returned unchanged
```

## Real-World Example: Form Field Manager

```typescript
import {
  getValueAtPath,
  setValueAtPath,
  addArrayItem,
  removeArrayItem,
  moveArrayItem,
} from "./utils";

// Form data
let form = {
  title: "Contact Form",
  fields: [
    { name: "email", type: "email", required: true },
    { name: "message", type: "textarea", required: false },
  ],
};

// Add a new field
form = addArrayItem(form, "fields", {
  name: "phone",
  type: "tel",
  required: false,
});

// Update field type
form = setValueAtPath(form, "fields.1.type", "text");

// Get field value
const fieldType = getValueAtPath(form, "fields.0.type"); // "email"

// Reorder: move phone field to position 1
form = moveArrayItem(form, "fields", 2, 1);

// Remove message field
form = removeArrayItem(form, "fields", 2);

// Final form has: email, phone fields in that order
```

## API Reference

### getValueAtPath(obj, path)
- **obj:** The object to read from
- **path:** Dot-path string (e.g., "buttons.0.label")
- **Returns:** The value at the path, or `undefined` if not found

### setValueAtPath(obj, path, value)
- **obj:** The object to update
- **path:** Dot-path string
- **value:** The new value
- **Returns:** New object with updated value (original unchanged)

### addArrayItem(obj, arrayPath, item)
- **obj:** The object containing the array
- **arrayPath:** Dot-path to the array
- **item:** The item to add
- **Returns:** New object with item added (original unchanged)

### removeArrayItem(obj, arrayPath, index)
- **obj:** The object containing the array
- **arrayPath:** Dot-path to the array
- **index:** Zero-based index to remove
- **Returns:** New object with item removed (original unchanged)

### moveArrayItem(obj, arrayPath, fromIndex, toIndex)
- **obj:** The object containing the array
- **arrayPath:** Dot-path to the array
- **fromIndex:** Current position
- **toIndex:** Target position
- **Returns:** New object with item moved (original unchanged)

## Key Features

1. **Immutable Operations** - All functions return new objects, never modifying the original
2. **Type Safe** - Full TypeScript support with proper types
3. **Deep Path Support** - Works with any level of nesting
4. **Array Index Support** - Numeric indices work naturally in paths
5. **Edge Case Handling** - Gracefully handles missing paths, out-of-bounds indices, etc.
6. **Whitespace Tolerant** - Paths with spaces like `"badge . label"` are handled correctly

## Common Patterns

### Update Multiple Values
```typescript
let obj = { name: "John", age: 30 };
obj = setValueAtPath(obj, "name", "Jane");
obj = setValueAtPath(obj, "age", 25);
```

### Batch Array Operations
```typescript
let form = { fields: [] };
form = addArrayItem(form, "fields", { name: "email" });
form = addArrayItem(form, "fields", { name: "password" });
form = moveArrayItem(form, "fields", 1, 0); // Reorder
```

### Conditional Updates
```typescript
const value = getValueAtPath(obj, "user.email");
if (value) {
  obj = setValueAtPath(obj, "user.email", value.toLowerCase());
}
```
