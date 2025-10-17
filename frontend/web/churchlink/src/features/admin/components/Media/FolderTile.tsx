import React, { useState } from 'react';
import { Folder } from 'lucide-react';

interface Props {
    name: string;
    compact?: boolean;
    isDraggingSomething?: boolean;
    onClick: () => void;
    onDropImage: (imageId: string) => void;
    onDropFolder: (folderName: string) => void;
    onDragStartTile?: () => void;
    onDragEndTile?: () => void;
    onContextMenu?: (pos: { x: number; y: number }) => void;
}

const FolderTile: React.FC<Props> = ({
    name,
    compact,
    isDraggingSomething,
    onClick,
    onDropImage,
    onDropFolder,
    onDragStartTile,
    onDragEndTile,
    onContextMenu,
}) => {
    const [isOver, setIsOver] = useState(false);

    return (
        <div
            className={[
                'group relative rounded-lg border bg-card text-card-foreground transition-all cursor-pointer',
                compact ? 'h-[140px]' : 'h-[180px]',
                isOver ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : 'hover:bg-accent/40',
                isDraggingSomething ? 'transition-transform' : '',
            ].join(' ')}
            draggable
            onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/folder-name', name);
                onDragStartTile?.();
            }}
            onDragEnd={(e) => {
                e.stopPropagation();
                setIsOver(false);
                onDragEndTile?.();
            }}
            onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
                setIsOver(true);
            }}
            onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsOver(false);
            }}
            onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsOver(false);
                const movingFolder = e.dataTransfer.getData('text/folder-name');
                if (movingFolder) {
                    if (movingFolder !== name) onDropFolder(movingFolder);
                    return;
                }
                const imgId = e.dataTransfer.getData('text/image-id');
                if (imgId) onDropImage(imgId);
            }}
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
            onContextMenu={(e) => {
                if (!onContextMenu) return;
                e.preventDefault();
                e.stopPropagation();
                onContextMenu({ x: e.clientX, y: e.clientY });
            }}
            style={{ transform: isOver ? 'scale(1.02)' : 'scale(1.0)' }}
            title={name}
        >
            <div className="flex h-full flex-col items-center justify-center p-3">
                <Folder className="mb-2 h-10 w-10 text-blue-500 transition-transform group-hover:scale-105" />
                <p className="max-w-full truncate text-center text-xs font-medium">{name}</p>
            </div>
        </div>
    );
};

export default FolderTile;
