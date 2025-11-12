export type Selection = { sectionId?: string; nodeId?: string } | null;
import type { SectionV2 } from '@/shared/types/pageV2';

type Action =
  | { type: 'layout'; sectionId: string; nodeId: string; prev: any; next: any }
  | { type: 'select'; prev: Selection; next: Selection }
  | { type: 'node'; sectionId: string; nodeId: string; prev: any; next: any }
  | { type: 'sections'; prev: SectionV2[]; next: SectionV2[] };

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
  private _gridAdjustingSectionId: string | null = null;
  private _undoStack: Action[] = [];
  private _redoStack: Action[] = [];
  private _suppressHistory = false;
  private listeners: Set<() => void> = new Set();
  private _paddingOverlay: ActivePaddingOverlay | null = null;
  private _paddingOverlayListeners: Set<(payload: ActivePaddingOverlay | null) => void> = new Set();
  private _edgeContactByContainer: Map<string, { top: boolean; right: boolean; bottom: boolean; left: boolean }> = new Map();
  private _edgeContactListeners: Set<(
    payload: { containerId: string; edges: { top: boolean; right: boolean; bottom: boolean; left: boolean } } | null
  ) => void> = new Set();
  private _nodePixelLayouts: Map<string, any> = new Map();

  get selection() { return this._selection; }
  get draggingNodeId() { return this._draggingNodeId; }
  get resizing() { return this._resizing; }
  get editing() { return this._editing; }
  get gridAdjustingSectionId() { return this._gridAdjustingSectionId; }
  get paddingOverlay() { return this._paddingOverlay; }
  get edgeContacts() { return this._edgeContactByContainer; }
  get canUndo() { return this._undoStack.length > 0; }
  get canRedo() { return this._redoStack.length > 0; }
  get isHistorySuppressed() { return this._suppressHistory; }

  subscribe(fn: () => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private notify() { this.listeners.forEach((fn) => fn()); }

  setSelection(next: Selection) {
    const prev = this._selection;
    this._selection = next;
    this._undoStack.push({ type: 'select', prev, next });
    this._redoStack = [];
    this.notify();
  }

  // Set selection without recording to history (used by undo/redo application)
  setSelectionSilent(next: Selection) {
    this._selection = next;
    this.notify();
  }

  clearSelection() { this.setSelection(null); }

  startDragging(nodeId: string) { this._draggingNodeId = nodeId; this.notify(); }
  stopDragging() { this._draggingNodeId = null; this.notify(); }

  startAdjustingGrid(sectionId: string) {
    if (this._gridAdjustingSectionId === sectionId) return;
    this._gridAdjustingSectionId = sectionId;
    this.notify();
  }

  stopAdjustingGrid(sectionId?: string) {
    if (!this._gridAdjustingSectionId) return;
    if (sectionId && this._gridAdjustingSectionId !== sectionId) return;
    this._gridAdjustingSectionId = null;
    this.notify();
  }

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
    if (!this._suppressHistory) {
      this._undoStack.push({ type: 'layout', sectionId, nodeId, prev, next });
      this._redoStack = [];
    }
  }

  pushNode(sectionId: string, nodeId: string, prev: any, next: any) {
    if (!this._suppressHistory) {
      this._undoStack.push({ type: 'node', sectionId, nodeId, prev, next });
      this._redoStack = [];
    }
  }

  pushSections(prev: SectionV2[], next: SectionV2[]) {
    if (!this._suppressHistory) {
      this._undoStack.push({ type: 'sections', prev, next });
      this._redoStack = [];
    }
  }

  withoutHistory<T>(fn: () => T): T {
    const prev = this._suppressHistory;
    this._suppressHistory = true;
    try {
      return fn();
    } finally {
      this._suppressHistory = prev;
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

  // Edge contact highlight for container bounds while dragging/resizing children
  setEdgeContact(containerId: string, edges: { top: boolean; right: boolean; bottom: boolean; left: boolean }) {
    const prev = this._edgeContactByContainer.get(containerId);
    const changed = !prev || prev.top !== edges.top || prev.right !== edges.right || prev.bottom !== edges.bottom || prev.left !== edges.left;
    if (!changed) return;
    this._edgeContactByContainer.set(containerId, edges);
    this.notify();
    const payload = { containerId, edges } as const;
    this._edgeContactListeners.forEach((l) => l(payload));
  }

  clearEdgeContact(containerId?: string) {
    if (containerId) {
      if (!this._edgeContactByContainer.has(containerId)) return;
      this._edgeContactByContainer.delete(containerId);
      this.notify();
      this._edgeContactListeners.forEach((l) => l(null));
      return;
    }
    if (this._edgeContactByContainer.size === 0) return;
    this._edgeContactByContainer.clear();
    this.notify();
    this._edgeContactListeners.forEach((l) => l(null));
  }

  onEdgeContactChange(
    listener: (
      payload: { containerId: string; edges: { top: boolean; right: boolean; bottom: boolean; left: boolean } } | null
    ) => void
  ) {
    this._edgeContactListeners.add(listener);
    return () => {
      this._edgeContactListeners.delete(listener);
    };
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

  clearNodePixelLayout(nodeId: string) {
    this._nodePixelLayouts.delete(nodeId);
  }

  getNodePixelLayout(nodeId: string): any | undefined {
    return this._nodePixelLayouts.get(nodeId);
  }

  setNodePixelLayout(nodeId: string, layout: any) {
    this._nodePixelLayouts.set(nodeId, layout);
  }


  resetForModeSwitch() {
    this._undoStack = [];
    this._redoStack = [];

    this.setSelectionSilent(null);
    this.stopEditing();
    this.stopResizing();
    this.stopDragging();
    this.stopAdjustingGrid();

    this.hidePaddingOverlay();
    this.clearEdgeContact();

    this._nodePixelLayouts.clear();

    this.notify();
  }
}

export const BuilderState = new BuilderStateClass();


