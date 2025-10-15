// GridOverlay.tsx - Translucent grid overlay with rounded squares
import { useEffect, useMemo, useState } from 'react';

export function GridOverlay({
  gridSize,
  opacity = 0.12,
  active = true,
}: {
  gridSize: number;
  opacity?: number;
  active?: boolean;
}) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setHasMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const dataUrl = useMemo(() => {
    const squareSize = gridSize * 0.72;
    const gap = gridSize - squareSize;
    const borderRadius = Math.min(8, gridSize * 0.45);

    const svgPattern = `
      <svg width="${gridSize}" height="${gridSize}" xmlns="http://www.w3.org/2000/svg">
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
  }, [gridSize, opacity]);

  const targetOpacity = active ? 1 : 0;
  const opacityValue = hasMounted ? targetOpacity : active ? 0 : 0;

  return (
    <div
      aria-hidden
      className="absolute inset-0 w-full h-full"
      style={{
        backgroundImage: `url("${dataUrl}")`,
        backgroundSize: `${gridSize}px ${gridSize}px`,
        backgroundRepeat: 'repeat',
        opacity: opacityValue,
        transition: 'opacity 300ms ease-in-out',
        willChange: 'opacity',
      }}
    />
  );
}