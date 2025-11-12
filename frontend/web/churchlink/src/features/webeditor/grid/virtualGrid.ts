// virtualGrid.ts - Virtual grid transform for fixed logical resolution and aspect ratio
export type VirtualTransform = {
  cols: number;
  rows: number;
  cellPx: number;
  offsetX: number;
  offsetY: number;
  toPx: (unitsRect: { xu: number; yu: number; wu?: number; hu?: number }) => { x: number; y: number; w?: number; h?: number };
  toUnits: (pxRect: { x: number; y: number; w: number; h: number }) => { xu: number; yu: number; wu: number; hu: number };
};

/**
 * Create a VirtualTransform that maps between grid unit coordinates and pixel coordinates while preserving a fixed logical aspect ratio and centering the grid inside the container.
 *
 * @param containerRect - The container size in pixels used to compute cell size and centering offsets.
 * @param cols - Number of logical columns in the virtual grid.
 * @param aspect - Desired aspect ratio represented as `{ num, den }` (num/den).
 * @returns A VirtualTransform containing the computed `cols`, `rows`, `cellPx`, `offsetX`, `offsetY` and two mapping methods:
 *          `toPx` (converts `{ xu, yu, wu?, hu? }` to pixel `{ x, y, w?, h? }`) and
 *          `toUnits` (converts pixel `{ x, y, w, h }` to `{ xu, yu, wu, hu }`).
 */
export function makeVirtualTransform(
  containerRect: { width: number; height: number },
  cols: number,
  aspect: { num: number; den: number }
): VirtualTransform {
  const rows = Math.round(cols * aspect.den / aspect.num);
  const cellPx = containerRect.width / cols;
  const contentW = cols * cellPx;
  const contentH = rows * cellPx;
  const offsetX = (containerRect.width - contentW) / 2;
  const offsetY = (containerRect.height - contentH) / 2;

  const toPx = (unitsRect: { xu: number; yu: number; wu?: number; hu?: number }) => ({
    x: offsetX + unitsRect.xu * cellPx,
    y: offsetY + unitsRect.yu * cellPx,
    w: unitsRect.wu !== undefined ? unitsRect.wu * cellPx : undefined,
    h: unitsRect.hu !== undefined ? unitsRect.hu * cellPx : undefined,
  });

  const toUnits = (pxRect: { x: number; y: number; w: number; h: number }) => ({
    xu: Math.round((pxRect.x - offsetX) / cellPx),
    yu: Math.round((pxRect.y - offsetY) / cellPx),
    wu: Math.round(pxRect.w / cellPx),
    hu: Math.round(pxRect.h / cellPx),
  });

  return {
    cols,
    rows,
    cellPx,
    offsetX,
    offsetY,
    toPx,
    toUnits,
  };
}
