import { BulletinCard } from './BulletinCard';
import { ChurchBulletin } from '@/shared/types/ChurchBulletin';

interface BulletinListProps {
    items: ChurchBulletin[];
    onItemClick?: (b: ChurchBulletin) => void;
}

export default function BulletinList({ items, onItemClick }: BulletinListProps) {
    if (!items || items.length === 0) return <p>No bulletins found.</p>;

    return (
        <div className="flex flex-wrap justify-center gap-6">
            {items.map((b) => (
                <div
                    key={b.id}
                    className="flex w-full sm:w-[320px] md:w-[360px] lg:w-[380px]"
                >
                    <BulletinCard bulletin={b} onClick={() => onItemClick?.(b)} />
                </div>
            ))}
        </div>
    )
}
