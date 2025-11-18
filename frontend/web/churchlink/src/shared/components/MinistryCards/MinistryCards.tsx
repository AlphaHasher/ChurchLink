import { Ministry } from '@/shared/types/Ministry';

interface MinistryCardsProps {
    ministryIds: string[];
    availableMinistries: Ministry[];
    className?: string;
    emptyState?: React.ReactNode;
}

/**
 * Reusable component to display ministry cards/badges
 * Used in Forms, Bulletins, and other features that display ministries
 */
export const MinistryCards = ({ 
    ministryIds, 
    availableMinistries, 
    className = '',
    emptyState
}: MinistryCardsProps) => {
    const getMinistryName = (id: string): string => {
        const ministry = availableMinistries?.find((m) => m.id === id);
        return ministry?.name || id;
    };

    if (!ministryIds || ministryIds.length === 0) {
        return emptyState ? <>{emptyState}</> : <span className="text-gray-400 italic">-</span>;
    }

    return (
        <div className={`flex flex-wrap gap-1 min-w-0 ${className}`}>
            {ministryIds.map((id: string) => (
                <span 
                    key={id} 
                    className="inline-flex items-center rounded border px-2 py-0.5 text-xs bg-muted/40"
                >
                    {getMinistryName(id)}
                </span>
            ))}
        </div>
    );
};
