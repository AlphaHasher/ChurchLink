import { format } from 'date-fns';
import { Star } from 'lucide-react';
import { Card } from '@/shared/components/ui/card';
import { ChurchSermon } from '@/shared/types/ChurchSermon';
import { buildThumbnailUrl, formatDurationLabel, resolveDurationSeconds } from '@/features/sermons/utils/media';

interface SermonCardProps {
    sermon: ChurchSermon;
    onClick?: () => void;
}

export function SermonCard({ sermon, onClick }: SermonCardProps) {
    const posted = sermon.date_posted ? new Date(sermon.date_posted) : undefined;
    const thumbnail = buildThumbnailUrl(sermon);
    const durationLabel = formatDurationLabel(resolveDurationSeconds(sermon));

    return (
        <Card
            className="group overflow-hidden transition-all duration-300 cursor-pointer hover:shadow-xl hover:-translate-y-1 flex flex-col py-0"
            onClick={onClick}
        >
            {/* Video Thumbnail */}
            <div className="relative aspect-video w-full bg-gray-200 flex-shrink-0">
                {sermon.is_favorited && (
                    <Star
                        className="absolute right-3 top-3 z-20 h-6 w-6 text-yellow-400 drop-shadow-lg"
                        fill="#facc15"
                        strokeWidth={1.5}
                    />
                )}
                {thumbnail ? (
                    <div
                        aria-hidden
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: `url(${thumbnail})` }}
                    />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-300 via-slate-200 to-slate-100" />
                )}

                {durationLabel && (
                    <div className="absolute bottom-3 right-3 inline-flex items-center rounded-md text-xs font-medium bg-black/70 backdrop-blur-sm text-white">
                        {durationLabel}
                    </div>
                )}
            </div>

            {/* Info Section Below Video */}
            <div className="flex flex-col gap-1 p-3 flex-1">
                <h3 className="text-sm font-semibold leading-tight line-clamp-2">
                    {sermon.title}
                </h3>
                <p className="text-xs text-gray-600 line-clamp-1">{sermon.speaker}</p>
                {posted && (
                    <div className="text-xs text-gray-500">
                        {format(posted, 'MMM dd, yyyy')}
                    </div>
                )}
            </div>
        </Card>
    );
}
