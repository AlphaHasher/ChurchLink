import { SermonCard } from './SermonCard';
import type { ChurchSermon } from '@/shared/types/ChurchSermon';

interface SermonListProps {
    items: ChurchSermon[];
    onItemClick?: (sermon: ChurchSermon) => void;
    ministryNameMap?: Record<string, string>;
}

export default function SermonList({ items, onItemClick, ministryNameMap }: SermonListProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {items.map((s) => (
                <SermonCard key={s.id} sermon={s} onClick={() => onItemClick?.(s)} ministryNameMap={ministryNameMap} />
            ))}
        </div>
    )
}
