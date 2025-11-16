export function roundToTwoOrFiveThousandths(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const snapped = Math.round(value / 0.005) * 0.005;
  return Number(snapped.toFixed(3));
}


