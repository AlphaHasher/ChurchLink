import { SermonCard } from './SermonCard';
import { ChurchSermon } from '@/shared/types/ChurchSermon';

interface SermonListProps {
    items: ChurchSermon[];
    onItemClick?: (s: ChurchSermon) => void;
}

export default function SermonList({ items, onItemClick }: SermonListProps) {
    if (!items || items.length === 0) return <p>No sermons found.</p>;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {items.map((s) => (
                <SermonCard key={s.id} sermon={s} onClick={() => onItemClick?.(s)} />
            ))}
        </div>
    )
}
