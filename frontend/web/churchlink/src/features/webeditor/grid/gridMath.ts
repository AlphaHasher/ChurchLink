// gridMath.ts - Core math utilities for grid snapping and coordinate conversion
export const defaultGridSize = 16;

export function snapToGrid(px: number, gridSize: number): number {
  return Math.round(px / gridSize) * gridSize;
}

export function pxToUnits(px: number, gridSize: number): number {
  return Math.round(px / gridSize);
}

export function unitsToPx(u: number, gridSize: number): number {
  return u * gridSize;
}

export function edgeSnap(pos: number, size: number, gridSize: number): number {
  const leftSnap = snapToGrid(pos, gridSize);
  const rightSnap = snapToGrid(pos + size, gridSize) - size;
  const distLeft = Math.abs(pos - leftSnap);
  const distRight = Math.abs((pos + size) - (rightSnap + size));
  return distLeft <= distRight ? leftSnap : rightSnap;
}
