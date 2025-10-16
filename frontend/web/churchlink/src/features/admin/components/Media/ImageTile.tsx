import React from 'react';
import type { ImageResponse } from '@/shared/types/ImageData';

interface Props {
    asset: ImageResponse;
    compact?: boolean;
    dragging?: boolean;
    selectionMode?: boolean;
    errored?: boolean;
    onErrorImage: () => void;
    onDragStartTile: (ev: React.DragEvent<HTMLDivElement>) => void;
    onDragEndTile: () => void;
    onSelect: () => void;
    onRequestDelete: () => void;
    onContextMenu?: (pos: { x: number; y: number }) => void;
}

const ImageTile: React.FC<Props> = ({
    asset,
    compact,
    dragging,
    onErrorImage,
    onDragStartTile,
    onDragEndTile,
    onSelect,
    onContextMenu,
}) => {
    return (
        <div
            className={[
                'group relative rounded-lg border bg-card text-card-foreground transition-all select-none',
                compact ? 'h-[160px]' : 'h-[200px]',
                dragging ? 'opacity-50' : 'hover:bg-accent/40 hover:shadow-sm',
                'cursor-pointer',
            ].join(' ')}
            draggable
            onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/image-id', asset.id);
                onDragStartTile(e);
            }}
            onDragEnd={() => onDragEndTile()}
            onDoubleClick={onSelect}
            onClick={(e) => {
                if (e.defaultPrevented) return;
                onSelect();
            }}
            onContextMenu={(e) => {
                if (!onContextMenu) return;
                e.preventDefault();
                e.stopPropagation();
                onContextMenu({ x: e.clientX, y: e.clientY });
            }}
            title={asset.name}
        >
            <div className="relative w-full h-[120px] flex items-center justify-center overflow-hidden rounded-md">
                <img
                    src={asset.thumb_url}
                    alt={asset.name}
                    className="w-full h-full object-cover transition-transform group-hover:scale-[1.02]"
                    onError={onErrorImage}
                    draggable={false}
                />
                <div className="pointer-events-none absolute inset-0 rounded-md ring-0 group-hover:ring-2 group-hover:ring-primary/40" />
            </div>
            {/* More room for names: 2-line area with wrap, tiny padding */}
            <div className="px-1 py-0.5 text-[12px] leading-tight whitespace-normal break-words h-[34px] overflow-hidden">
                {asset.name || asset.id}
            </div>
        </div>
    );
};

export default ImageTile;
