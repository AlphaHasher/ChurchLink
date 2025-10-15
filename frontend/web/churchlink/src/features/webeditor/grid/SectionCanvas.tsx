// SectionCanvas.tsx - Canvas wrapper for sections with grid overlay
import React, { useRef } from 'react';
import { GridOverlay } from './GridOverlay';

export function SectionCanvas({
  children,
  showGrid,
  gridSize,
  className = '',
  style,
}: {
  children: React.ReactNode;
  showGrid: boolean;
  gridSize: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  return (
    <div
      ref={ref}
      className={`relative w-full min-h-full flex-1 ${className}`}
      style={style}
    >
      {showGrid && <GridOverlay gridSize={gridSize} />}
      {/* children will be absolutely positioned nodes + flow content if needed */}
      {children}
    </div>
  );
}
