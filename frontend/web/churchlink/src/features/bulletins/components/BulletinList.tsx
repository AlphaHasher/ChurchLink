import { BulletinCard } from './BulletinCard';
import type { ChurchBulletin } from '@/shared/types/ChurchBulletin';

interface BulletinListProps {
    items: ChurchBulletin[];
    onItemClick?: (bulletin: ChurchBulletin) => void;
    ministryNameMap?: Record<string, string>;
}

export default function BulletinList({ items, onItemClick, ministryNameMap }: BulletinListProps) {
    if (!items || items.length === 0) return <p>No bulletins found.</p>;

    return (
        <div className="flex flex-wrap justify-center gap-6">
            {items.map((b) => (
                <div
                    key={b.id}
                    className="flex w-full sm:w-[320px] md:w-[360px] lg:w-[380px]"
                >
                    <BulletinCard bulletin={b} onClick={() => onItemClick?.(b)} ministryNameMap={ministryNameMap} />
                </div>
            ))}
        </div>
    )
}
