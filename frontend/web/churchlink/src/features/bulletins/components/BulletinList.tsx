import { BulletinCard } from './BulletinCard';
import { ChurchBulletin } from '@/shared/types/ChurchBulletin';

interface BulletinListProps {
    items: ChurchBulletin[];
    onItemClick?: (b: ChurchBulletin) => void;
}

export default function BulletinList({ items, onItemClick }: BulletinListProps) {
    if (!items || items.length === 0) return <p>No bulletins found.</p>;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((b) => (
                <BulletinCard key={b.id} bulletin={b} onClick={() => onItemClick?.(b)} />
            ))}
        </div>
    )
}
