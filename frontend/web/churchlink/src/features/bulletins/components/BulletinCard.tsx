import { format } from 'date-fns';
import { Card } from '@/shared/components/ui/card';
import { ChurchBulletin } from '@/shared/types/ChurchBulletin';
import { getLocalizedBulletinFields } from '@/shared/utils/localeUtils';
import { BulletinMediaImage } from '@/features/bulletins/components/BulletinMediaImage';

interface BulletinCardProps {
    bulletin: ChurchBulletin;
    onClick?: () => void;
}

export function BulletinCard({ bulletin, onClick }: BulletinCardProps) {
    const publishDate = bulletin.publish_date ? new Date(bulletin.publish_date) : undefined;
    const weekLabel = publishDate ? format(publishDate, 'MMM dd, yyyy') : '';
    
    // Use localized text based on user's browser locale
    const localizedFields = getLocalizedBulletinFields(bulletin);
    
    return (
	<Card
		className="group flex h-full w-full flex-col overflow-hidden transition-all duration-300 cursor-pointer hover:shadow-xl hover:-translate-y-1 relative bg-gradient-to-br from-gray-50 via-white to-gray-100 py-0 gap-2"
            onClick={onClick}
        >
            {/* Thumbnail Image */}
            <BulletinMediaImage
                bulletin={bulletin}
                alt={localizedFields.headline}
                containerClassName="aspect-video overflow-hidden bg-gray-200"
                imageClassName="transition-transform duration-300 group-hover:scale-105"
            />
            
		<div className="flex flex-col gap-2 px-5 py-4">
                <div>
				<h3 className="text-lg font-semibold leading-tight line-clamp-2 text-gray-900">
                        {localizedFields.headline}
                    </h3>
                </div>

			{publishDate && (
				<div className="text-xs uppercase tracking-wide text-gray-500 font-medium">
                        {weekLabel}
                    </div>
                )}

			{bulletin.ministries && bulletin.ministries.length > 0 && (
				<div className="flex flex-wrap gap-1">
                        {bulletin.ministries.slice(0, 3).map((ministry, idx) => (
                            <span
                                key={idx}
                                className="inline-flex items-center rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-800"
                            >
                                {ministry}
                            </span>
                        ))}
					{bulletin.ministries.length > 3 && (
						<span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                                +{bulletin.ministries.length - 3} more
                            </span>
                        )}
                    </div>
                )}
            </div>
        </Card>
    );
}
