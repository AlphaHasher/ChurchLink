// GridOverlay.tsx - Translucent grid overlay with rounded squares

export function GridOverlay({
  gridSize,
  opacity = 0.12,
}: {
  gridSize: number;
  opacity?: number;
}) {
  // SVG pattern for rounded squares with gaps
  const squareSize = gridSize * 0.75; // 75% of grid cell size
  const gap = gridSize * 0.25; // 25% gap
  const borderRadius = Math.min(3, gridSize * 0.2); // Rounded corners
  
  const svgPattern = `
    <svg width="${gridSize}" height="${gridSize}" xmlns="http://www.w3.org/2000/svg">
      <rect 
        x="${gap / 2}" 
        y="${gap / 2}" 
        width="${squareSize}" 
        height="${squareSize}" 
        rx="${borderRadius}" 
        ry="${borderRadius}" 
        fill="rgba(0,0,0,${opacity})"
      />
    </svg>
  `;
  
  const dataUrl = `data:image/svg+xml;base64,${btoa(svgPattern)}`;
  
  return (
    <div
      aria-hidden
      className="absolute inset-0 w-full h-full"
      style={{
        backgroundImage: `url("${dataUrl}")`,
        backgroundSize: `${gridSize}px ${gridSize}px`,
        backgroundRepeat: 'repeat',
      }}
    />
  );
}