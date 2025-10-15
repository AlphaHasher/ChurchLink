# Grid-Based Drag & Drop System

This directory contains a complete implementation of a grid-based drag-and-drop system for the web editor.

## Features

- ✅ **Translucent square grid overlay** behind each section
- ✅ **Drag & drop nodes** within sections with pointer events
- ✅ **Snap to grid** on drop for precise positioning
- ✅ **Persistent positioning** stored as grid units (xu, yu)
- ✅ **Separation of concerns** - builder vs. view rendering

## Architecture

### Files Overview

- **`gridMath.ts`** - Core math utilities (snap, px↔units conversion)
- **`GridOverlay.tsx`** - Visual grid using CSS gradients
- **`SectionCanvas.tsx`** - Canvas wrapper for sections with grid
- **`DraggableNode.tsx`** - Draggable node component with snapping
- **`DynamicPageV2RendererBuilder.tsx`** - Builder-specific renderer

### Data Model

Nodes can optionally have absolute positioning via the `layout` property:

```typescript
type Node = {
  id: string;
  type: string;
  props?: Record<string, any>;
  // ... other fields
  layout?: {
    units: {
      xu: number;  // columns from left
      yu: number;  // rows from top
      wu?: number; // optional width in units
      hu?: number; // optional height in units
    };
    px?: {         // cached for convenience (recomputed when gridSize changes)
      x: number;
      y: number;
      w?: number;
      h?: number;
    };
  };
};
```

Sections can configure grid behavior:

```typescript
type SectionV2 = {
  // ... other fields
  builderGrid?: {
    gridSize?: number;  // px per cell (default: 16)
    showGrid?: boolean; // show overlay (default: true)
  };
};
```

## How to Use

### 1. Enable Grid for a Node

To make a node draggable and positioned absolutely, add the `layout` property:

```typescript
const node: Node = {
  id: "text-1",
  type: "text",
  props: { html: "Drag me!" },
  layout: {
    units: { xu: 10, yu: 5 }, // Position at (10×16px, 5×16px) = (160px, 80px)
  },
};
```

### 2. Configure Grid Settings

You can configure grid settings per section in the Inspector Panel:

- **Show Grid Overlay** - Toggle the translucent grid lines
- **Grid Size** - Set the cell size in pixels (8-64px, default 16px)

Or programmatically:

```typescript
const section: SectionV2 = {
  id: "section-1",
  kind: "section",
  builderGrid: {
    gridSize: 20,    // 20px grid cells
    showGrid: true,  // Show grid overlay
  },
  children: [/* nodes */],
};
```

### 3. Dragging Behavior

- **Click and drag** any node with `layout.units` set
- During drag: position updates smoothly (pixel-precise)
- **On release**: position snaps to nearest grid point
- Position saved as grid units (`xu`, `yu`)

### 4. View Mode vs. Builder Mode

- **Builder Mode** (WebEditor): Uses `DynamicPageV2RendererBuilder`
  - Shows grid overlay
  - Nodes are draggable
  - Position snapping enabled

- **View Mode** (DynamicPageV2Renderer): Uses standard renderer
  - No grid overlay
  - Nodes render at their saved positions
  - No drag behavior

## Grid Math

The system uses three core functions:

```typescript
// Snap pixel value to nearest grid point
snapToGrid(px: number, gridSize: number): number

// Convert pixels to grid units
pxToUnits(px: number, gridSize: number): number

// Convert grid units to pixels
unitsToPx(u: number, gridSize: number): number
```

### Example

With `gridSize = 16`:

```typescript
snapToGrid(167, 16) // → 160 (nearest multiple of 16)
pxToUnits(160, 16)  // → 10 (grid columns)
unitsToPx(10, 16)   // → 160 (pixels)
```

## Advanced Usage

### Keyboard Nudging (Future Enhancement)

You can add arrow key support to move selected nodes by grid units:

```typescript
function handleKeyDown(e: KeyboardEvent) {
  if (!selectedNode) return;
  const d = e.shiftKey ? 4 : 1; // 4 units with Shift, 1 otherwise
  
  const updates = {
    ArrowLeft: { xu: selectedNode.layout.units.xu - d, yu: selectedNode.layout.units.yu },
    ArrowRight: { xu: selectedNode.layout.units.xu + d, yu: selectedNode.layout.units.yu },
    ArrowUp: { xu: selectedNode.layout.units.xu, yu: selectedNode.layout.units.yu - d },
    ArrowDown: { xu: selectedNode.layout.units.xu, yu: selectedNode.layout.units.yu + d },
  };
  
  if (updates[e.key]) {
    updateNodeLayout(sectionId, selectedNode.id, updates[e.key]);
  }
}
```

### Resize Handles (Future Enhancement)

To add width/height resizing:

1. Store `wu` and `hu` in `layout.units`
2. Add resize handles (corners/edges)
3. On drag, update `wu`/`hu` based on pointer delta
4. Snap final dimensions to grid

### Constraints

To prevent nodes from being dragged outside section bounds:

```typescript
const finalX = Math.max(0, Math.min(snapToGrid(x, gridSize), maxX));
const finalY = Math.max(0, Math.min(snapToGrid(y, gridSize), maxY));
```

## Performance Tips

- Grid overlay uses CSS gradients (GPU-accelerated)
- `transform: translateZ(0)` hint for GPU compositing
- Dragging uses `pointer-events` (no mouse/touch split)
- Updates batched via React state (no direct DOM manipulation)

## Testing

To test the grid system:

1. Navigate to the Web Editor
2. Create or open a page
3. Select a section in the Inspector Panel
4. Configure grid settings (enable overlay, adjust size)
5. Add elements to the section
6. Manually set `layout.units` on a node (via dev tools or code)
7. Drag the node and verify it snaps to the grid on release

## Migration Guide

### Existing Pages Without Grid

Pages created before grid implementation will render normally:

- Nodes without `layout` property render in flow layout
- Grid overlay only shows in builder mode
- No breaking changes to existing functionality

### Enabling Grid for Existing Elements

To convert an existing element to use grid positioning:

```typescript
// Before: flow layout
const node = {
  id: "text-1",
  type: "text",
  props: { html: "Hello" },
};

// After: absolute positioning
const node = {
  id: "text-1",
  type: "text",
  props: { html: "Hello" },
  layout: {
    units: { xu: 5, yu: 3 }, // Position at grid (5, 3)
  },
};
```

## Known Limitations

1. **No automatic layout conversion** - Existing flow layouts must be manually converted
2. **No undo/redo** for drag operations (yet)
3. **No multi-select** drag (one node at a time)
4. **No rotation** or advanced transforms
5. **No z-index control** (stacking order is DOM order)

## Future Enhancements

- [ ] Keyboard nudging (arrow keys)
- [ ] Resize handles (wu/hu)
- [ ] Multi-select and group drag
- [ ] Alignment guides (snap to other nodes)
- [ ] Copy/paste with position
- [ ] Undo/redo for drag operations
- [ ] Z-index/layer management
- [ ] Grid snap toggle (hold key to disable)
- [ ] Responsive positioning (different xu/yu per breakpoint)

## Questions?

For implementation questions or feature requests, contact the development team or open an issue in the project repository.
