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

