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
}

const ImageTile: React.FC<Props> = ({
    asset,
    compact,
    dragging,
    selectionMode,
    errored,
    onErrorImage,
    onDragStartTile,
    onDragEndTile,
    onSelect,
    onRequestDelete,
}) => {
    return (
        <div
            className={[
                'group relative rounded-lg border bg-card text-card-foreground transition-all',
                compact ? 'h-[140px]' : 'h-[180px]',
                dragging ? 'opacity-50' : 'hover:bg-accent/40',
            ].join(' ')}
            draggable
            onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/image-id', asset.id);
                onDragStartTile(e); // no custom drag image -> no jitter
            }}
            onDragEnd={() => onDragEndTile()}
            title={asset.name}
        >
            <div className="relative w-full h-full bg-gray-100 flex items-center justify-center">
                <img
                    src={`${asset.thumb_url}`}
                    alt={asset.name}
                    className="w-full h-full object-cover rounded-md"
                    onError={onErrorImage}
                    draggable={false}
                />
            </div>
            <div className="mt-1 px-1 text-[11px] truncate">{asset.name || asset.id}</div>
        </div>
    );
};

export default ImageTile;
