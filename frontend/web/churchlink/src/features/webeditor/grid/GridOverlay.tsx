// GridOverlay.tsx - Translucent grid overlay with rounded squares
import { useEffect, useMemo, useState } from 'react';

/**
 * Render a tiled rounded-square SVG grid overlay sized by `cellPx` and positioned by the given offsets.
 *
 * The overlay uses a repeating SVG background of rounded squares with a subtle shadow and stroke. It starts fully transparent on first render to avoid a visual flash, then transitions opacity when mounted and when `active` changes.
 *
 * @param cols - Number of columns (currently unused; included for API symmetry).
 * @param rows - Number of rows (currently unused; included for API symmetry).
 * @param cellPx - Size in pixels of each grid cell (controls pattern tile size and square dimensions).
 * @param offsetX - Horizontal background offset in pixels.
 * @param offsetY - Vertical background offset in pixels.
 * @param opacity - Fill opacity for each rounded square (default 0.12).
 * @param active - Whether the overlay is visible (transitions opacity; default true).
 * @returns A React element that renders the grid overlay as a repeating background.
 */
export function GridOverlay({
  cols,
  rows,
  cellPx,
  offsetX,
  offsetY,
  opacity = 0.12,
  active = true,
}: {
  cols: number;
  rows: number;
  cellPx: number;
  offsetX: number;
  offsetY: number;
  opacity?: number;
  active?: boolean;
}) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setHasMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const dataUrl = useMemo(() => {
    const squareSize = cellPx * 0.72;
    const gap = cellPx - squareSize;
    const borderRadius = Math.min(8, cellPx * 0.45);

    const svgPattern = `
      <svg width="${cellPx}" height="${cellPx}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="1.6" flood-color="rgba(15,23,42,0.38)" />
          </filter>
        </defs>
        <rect 
          x="${gap / 2}" 
          y="${gap / 2}" 
          width="${squareSize}" 
          height="${squareSize}" 
          rx="${borderRadius}" 
          ry="${borderRadius}" 
          fill="rgba(255,255,255,${opacity})"
          filter="url(#shadow)"
          stroke="rgba(148,163,184,0.35)"
          stroke-width="0.75"
        />
      </svg>
    `;

    return `data:image/svg+xml;base64,${btoa(svgPattern)}`;
  }, [cellPx, opacity]);

  const targetOpacity = active ? 1 : 0;
  const opacityValue = hasMounted ? targetOpacity : active ? 0 : 0;

  return (
    <div
      aria-hidden
      className="absolute inset-0 w-full h-full"
      style={{
        backgroundImage: `url("${dataUrl}")`,
        backgroundSize: `${cellPx}px ${cellPx}px`,
        backgroundPosition: `${offsetX}px ${offsetY}px`,
        backgroundRepeat: 'repeat',
        opacity: opacityValue,
        transition: 'opacity 300ms ease-in-out',
        willChange: 'opacity',
      }}
    />
  );
}