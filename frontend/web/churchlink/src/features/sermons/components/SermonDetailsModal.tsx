import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Calendar, Clock, ExternalLink, Users } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/shared/components/ui/Dialog';
import { Button } from '@/shared/components/ui/button';
import { ChurchSermon } from '@/shared/types/ChurchSermon';
import {
    buildThumbnailUrl,
    extractYoutubeId,
    formatDurationLabel,
    resolveDurationSeconds,
} from '@/features/sermons/utils/media';
import { getEmbedURLFromStreamID } from '@/helpers/YoutubeHelper';
import { favoriteSermon, unfavoriteSermon } from '@/features/sermons/api/sermonsApi';
import { useAuth } from '@/features/auth/hooks/auth-context';
import { useLocalize } from '@/shared/utils/localizationUtils';

interface SermonDetailsModalProps {
    sermon: ChurchSermon | null;
    isOpen: boolean;
    onClose: () => void;
    isLoading?: boolean;
    onFavoriteToggle?: (sermonId: string, isFavorited: boolean) => void;
    ministryNameMap?: Record<string, string>;
}

export function SermonDetailsModal({ sermon, isOpen, onClose, isLoading = false, onFavoriteToggle, ministryNameMap = {} }: SermonDetailsModalProps) {
    const localize = useLocalize();
    const videoId = useMemo(() => extractYoutubeId(sermon?.youtube_url), [sermon?.youtube_url]);
    const embedUrl = videoId ? getEmbedURLFromStreamID(videoId) : null;
    const thumbnailUrl = sermon ? buildThumbnailUrl(sermon) : null;
    const durationLabel = sermon ? formatDurationLabel(resolveDurationSeconds(sermon)) : null;
    const postedAt = sermon?.date_posted ? new Date(sermon.date_posted) : null;
    const updatedAtSource = sermon ? sermon.updated_at ?? sermon.created_at ?? null : null;
    const updatedAt = updatedAtSource ? new Date(updatedAtSource) : null;
    const { user, loading: authLoading } = useAuth();
    const [favoritePending, setFavoritePending] = useState(false);
    const [isFavorited, setIsFavorited] = useState<boolean>(false);

    useEffect(() => {
        setIsFavorited(Boolean(sermon?.is_favorited));
    }, [sermon?.id, sermon?.is_favorited]);

    const handleFavoriteToggle = async () => {
        if (!sermon) {
            return;
        }

        setFavoritePending(true);
        try {
            if (isFavorited) {
                await unfavoriteSermon(sermon.id);
                setIsFavorited(false);
                onFavoriteToggle?.(sermon.id, false);
            } else {
                await favoriteSermon(sermon.id);
                setIsFavorited(true);
                onFavoriteToggle?.(sermon.id, true);
            }
        } catch (error) {
            console.error('Failed to toggle sermon favorite state', error);
            alert('We could not update your favorites. Please try again.');
        } finally {
            setFavoritePending(false);
        }
    };

    const canFavorite = !authLoading && Boolean(user);

    return (
        <Dialog open={isOpen} onOpenChange={(next) => !next && onClose()}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto sm:pr-6 z-[999]">
                {!sermon ? (
                    <>
                        <DialogHeader>
                            <DialogTitle>Sermon details</DialogTitle>
                        </DialogHeader>
                        <p className="py-4 text-sm text-gray-600">Select a sermon to view its details.</p>
                    </>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold leading-tight">
                                {sermon.title}
                            </DialogTitle>
                            {canFavorite && (
                                <Button
                                    type="button"
                                    size="sm"
                                    className="mt-3 w-fit"
                                    onClick={handleFavoriteToggle}
                                    disabled={favoritePending}
                                >
                                    {favoritePending
                                        ? 'Saving...'
                                        : isFavorited
                                            ? 'Remove from favorites'
                                            : 'Add to favorites'}
                                </Button>
                            )}
                        </DialogHeader>

                        <div className="space-y-6">
                            <div className="relative w-full overflow-hidden rounded-lg bg-black">
                                {embedUrl ? (
                                    <div className="aspect-video w-full">
                                        <iframe
                                            title={sermon.title}
                                            src={embedUrl}
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                            allowFullScreen
                                            className="h-full w-full rounded-lg"
                                        />
                                    </div>
                                ) : thumbnailUrl ? (
                                    <div
                                        className="relative aspect-video w-full bg-cover bg-center"
                                        style={{ backgroundImage: `url(${thumbnailUrl})` }}
                                    />
                                ) : (
                                    <div className="aspect-video w-full bg-gradient-to-br from-slate-300 via-slate-200 to-slate-100" />
                                )}

                                {durationLabel && (
                                    <div className="absolute bottom-3 right-3 inline-flex items-center rounded-md bg-black/70 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                                        <Clock className="mr-1 h-4 w-4" />
                                        {durationLabel}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                {sermon.speaker && (
                                    <div className="flex items-center gap-3 text-gray-700">
                                        <Users className="h-5 w-5 text-gray-500" />
                                        <div>
                                            <p className="font-medium">Preacher</p>
                                            <p className="text-sm text-gray-600">
                                                {sermon.speaker}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {postedAt && (
                                    <div className="flex items-center gap-3 text-gray-700">
                                        <Calendar className="h-5 w-5 text-gray-500" />
                                        <div>
                                            <p className="font-medium">Posted</p>
                                            <p className="text-sm text-gray-600">
                                                {format(postedAt, 'MMMM dd, yyyy')}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {updatedAt && (
                                    <div className="flex items-center gap-3 text-gray-700">
                                        <Calendar className="h-5 w-5 text-gray-500" />
                                        <div>
                                            <p className="font-medium">Last updated</p>
                                            <p className="text-sm text-gray-600">
                                                {format(updatedAt, 'MMMM dd, yyyy')}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                        {sermon.ministry && sermon.ministry.length > 0 && (
                            <div>
                                <h3 className="mb-2 font-medium">Ministries</h3>
                                <div className="flex flex-wrap gap-2">
                                    {sermon.ministry.map((id) => (
                                        <span
                                            key={id}
                                            className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700"
                                        >
                                            {localize(ministryNameMap[id]) || id}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}                            {sermon.roles && sermon.roles.length > 0 && (
                                <div>
                                    <h3 className="mb-2 font-medium">Target roles</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {sermon.roles.map((role) => (
                                            <span
                                                key={role}
                                                className="inline-flex items-center rounded-full bg-purple-50 px-3 py-1 text-sm font-medium text-purple-700"
                                            >
                                                {role}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {sermon.tags && sermon.tags.length > 0 && (
                                <div>
                                    <h3 className="mb-2 font-medium">Tags</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {sermon.tags.map((tag) => (
                                            <span
                                                key={tag}
                                                className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700"
                                            >
                                                #{tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {sermon.summary && (
                                <div>
                                    <h3 className="mb-2 font-medium">Summary</h3>
                                    <p className="whitespace-pre-line text-gray-700">{sermon.summary}</p>
                                </div>
                            )}

                            {sermon.description && (
                                <div>
                                    <h3 className="mb-2 font-medium">Description</h3>
                                    <p className="whitespace-pre-line text-gray-700">{sermon.description}</p>
                                </div>
                            )}

                            <div className="flex flex-wrap gap-2">
                                {sermon.youtube_url && (
                                    <Button variant="outline" size="sm" asChild>
                                        <a
                                            href={sermon.youtube_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-2"
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                            Open YouTube link
                                        </a>
                                    </Button>
                                )}
                            </div>

                            {isLoading && (
                                <p className="text-sm text-gray-500">Updating details...</p>
                            )}
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
