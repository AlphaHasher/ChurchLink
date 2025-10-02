export type Selection = { sectionId?: string; nodeId?: string } | null;

type Action =
  | { type: 'layout'; sectionId: string; nodeId: string; prev: any; next: any }
  | { type: 'select'; prev: Selection; next: Selection };

export type ActivePaddingOverlay = {
  sectionId: string;
  nodeId: string;
  values: [number, number, number, number];
};

export type ResizeHandle = 'move' | 'e' | 's' | 'w' | 'n' | 'se' | 'sw' | 'ne' | 'nw';

export type ActiveResize = {
  sectionId: string;
  nodeId: string;
  handle: ResizeHandle;
} | null;

export type ActiveEditing = {
  sectionId: string;
  nodeId: string;
} | null;

class BuilderStateClass {
  private _selection: Selection = null;
  private _draggingNodeId: string | null = null;
  private _resizing: ActiveResize = null;
  private _editing: ActiveEditing = null;
  private _undoStack: Action[] = [];
  private _redoStack: Action[] = [];
  private listeners: Set<() => void> = new Set();
  private _nodePxCache: Map<string, { sectionId: string; x: number; y: number; w?: number; h?: number }> = new Map();
  private _paddingOverlay: ActivePaddingOverlay | null = null;
  private _paddingOverlayListeners: Set<(payload: ActivePaddingOverlay | null) => void> = new Set();

  get selection() { return this._selection; }
  get draggingNodeId() { return this._draggingNodeId; }
  get resizing() { return this._resizing; }
  get editing() { return this._editing; }
  get paddingOverlay() { return this._paddingOverlay; }
  get canUndo() { return this._undoStack.length > 0; }
  get canRedo() { return this._redoStack.length > 0; }

  subscribe(fn: () => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private notify() { this.listeners.forEach((fn) => fn()); }

  setSelection(next: Selection) {
    const prev = this._selection;
    this._selection = next;
    this._undoStack.push({ type: 'select', prev, next });
    this._redoStack = [];
    this.notify();
  }

  clearSelection() { this.setSelection(null); }

  startDragging(nodeId: string) { this._draggingNodeId = nodeId; this.notify(); }
  stopDragging() { this._draggingNodeId = null; this.notify(); }

  startResizing(sectionId: string, nodeId: string, handle: ResizeHandle) {
    this._resizing = { sectionId, nodeId, handle };
    if (!this._editing || this._editing.nodeId !== nodeId || this._editing.sectionId !== sectionId) {
      this._editing = null;
    }
    this.notify();
  }

  stopResizing() {
    if (this._resizing) {
      this._resizing = null;
      this.notify();
    }
  }

  startEditing(sectionId: string, nodeId: string) {
    if (this._editing && this._editing.sectionId === sectionId && this._editing.nodeId === nodeId) return;
    this._editing = { sectionId, nodeId };
    this.notify();
  }

  stopEditing(sectionId?: string, nodeId?: string) {
    if (!this._editing) return;
    if (sectionId && nodeId) {
      if (this._editing.sectionId !== sectionId || this._editing.nodeId !== nodeId) return;
    }
    this._editing = null;
    this.notify();
  }

  pushLayout(sectionId: string, nodeId: string, prev: any, next: any) {
    this._undoStack.push({ type: 'layout', sectionId, nodeId, prev, next });
    this._redoStack = [];
  }

  setNodePixelLayout(sectionId: string, nodeId: string, px: { x: number; y: number; w?: number; h?: number }) {
    this._nodePxCache.set(nodeId, { sectionId, ...px });
  }

  clearNodePixelLayout(sectionId: string, nodeId: string) {
    const entry = this._nodePxCache.get(nodeId);
    if (entry && entry.sectionId === sectionId) {
      this._nodePxCache.delete(nodeId);
    }
  }

  showPaddingOverlay(sectionId: string, nodeId: string, values: [number, number, number, number]) {
    this._paddingOverlay = { sectionId, nodeId, values };
    this.notify();
    this._paddingOverlayListeners.forEach((listener) => listener(this._paddingOverlay));
  }

  hidePaddingOverlay(sectionId?: string, nodeId?: string) {
    if (!this._paddingOverlay) return;
    if (sectionId && nodeId) {
      if (this._paddingOverlay.sectionId !== sectionId || this._paddingOverlay.nodeId !== nodeId) return;
    }
    this._paddingOverlay = null;
    this.notify();
    this._paddingOverlayListeners.forEach((listener) => listener(this._paddingOverlay));
  }

  onPaddingOverlayChange(listener: (payload: ActivePaddingOverlay | null) => void) {
    this._paddingOverlayListeners.add(listener);
    return () => {
      this._paddingOverlayListeners.delete(listener);
    };
  }

  getNodePixelLayout(nodeId: string) {
    return this._nodePxCache.get(nodeId) ?? null;
  }

  undo() {
    const action = this._undoStack.pop();
    if (!action) return null;
    this._redoStack.push(action);
    this.notify();
    return action;
  }

  redo() {
    const action = this._redoStack.pop();
    if (!action) return null;
    this._undoStack.push(action);
    this.notify();
    return action;
  }
}

export const BuilderState = new BuilderStateClass();


