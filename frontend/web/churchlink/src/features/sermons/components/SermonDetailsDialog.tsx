import { format } from 'date-fns';
import { Calendar, Clock, ExternalLink, PlayCircle, Tag, Users } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
import { getEmbedURLFromStreamID, getStreamURLFromStreamID } from '@/helpers/YoutubeHelper';
import { useMemo } from 'react';

interface SermonDetailsDialogProps {
    sermon: ChurchSermon | null;
    open: boolean;
    onClose: () => void;
    isLoading?: boolean;
}

export function SermonDetailsDialog({ sermon, open, onClose, isLoading = false }: SermonDetailsDialogProps) {
    const videoId = useMemo(() => extractYoutubeId(sermon?.youtube_url), [sermon?.youtube_url]);
    const embedUrl = videoId ? getEmbedURLFromStreamID(videoId) : null;
    const thumbnailUrl = sermon ? buildThumbnailUrl(sermon) : null;
    const durationLabel = sermon ? formatDurationLabel(resolveDurationSeconds(sermon)) : null;

    if (!sermon) {
        return (
            <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Sermon details</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-gray-600">Select a sermon to view its details.</p>
                </DialogContent>
            </Dialog>
        );
    }

    const posted = sermon.date_posted ? new Date(sermon.date_posted) : null;
    const sermonRoles = sermon.roles && sermon.roles.length > 0 ? sermon.roles : null;
    const ministries = sermon.ministry_refs && sermon.ministry_refs.length > 0 ? sermon.ministry_refs : null;
    const tags = sermon.tags && sermon.tags.length > 0 ? sermon.tags : null;

    return (
        <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto sm:pr-6">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold leading-tight">
                        {sermon.title}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-gray-600">
                        {sermon.speaker}
                    </DialogDescription>
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

                        <div className="absolute bottom-3 left-3 flex items-center gap-2 text-white">
                            {videoId && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className="bg-white/20 text-white hover:bg-white/30"
                                    asChild
                                >
                                    <a href={getStreamURLFromStreamID(videoId)} target="_blank" rel="noreferrer">
                                        <PlayCircle className="h-4 w-4 mr-1" />
                                        Watch on YouTube
                                    </a>
                                </Button>
                            )}
                        </div>

                        {durationLabel && (
                            <div className="absolute bottom-3 right-3 inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold bg-black/70 backdrop-blur-sm text-white">
                                <Clock className="mr-1 h-4 w-4" />
                                {durationLabel}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {posted && (
                            <div className="flex items-center gap-3 text-gray-700">
                                <Calendar className="h-5 w-5 text-gray-500" />
                                <div>
                                    <p className="font-medium">Posted</p>
                                    <p className="text-sm text-gray-600">{format(posted, 'MMMM dd, yyyy')}</p>
                                </div>
                            </div>
                        )}

                        {sermon.created_at && (
                            <div className="flex items-center gap-3 text-gray-700">
                                <Users className="h-5 w-5 text-gray-500" />
                                <div>
                                    <p className="font-medium">Updated</p>
                                    <p className="text-sm text-gray-600">
                                        {format(new Date(sermon.updated_at ?? sermon.created_at), 'MMMM dd, yyyy')}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                {ministries && (
                    <div>
                        <h3 className="font-medium mb-2">Ministries</h3>
                        <div className="flex flex-wrap gap-2">
                            {ministries.map((ministry) => (
                                <span
                                    key={ministry.id}
                                    className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700"
                                >
                                    <Tag className="mr-1 h-4 w-4" />
                                    {ministry.name}
                                </span>
                            ))}
                        </div>
                    </div>
                )}                    {sermonRoles && (
                        <div>
                            <h3 className="font-medium mb-2">Target Roles</h3>
                            <div className="flex flex-wrap gap-2">
                                {sermonRoles.map((role) => (
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

                    {tags && (
                        <div>
                            <h3 className="font-medium mb-2">Tags</h3>
                            <div className="flex flex-wrap gap-2">
                                {tags.map((tag) => (
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
                            <h3 className="font-medium mb-2">Summary</h3>
                            <p className="text-gray-700 whitespace-pre-line">{sermon.summary}</p>
                        </div>
                    )}

                    {sermon.description && (
                        <div>
                            <h3 className="font-medium mb-2">Description</h3>
                            <p className="text-gray-700 whitespace-pre-line">{sermon.description}</p>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                        {sermon.youtube_url && (
                            <Button variant="outline" size="sm" asChild>
                                <a href={sermon.youtube_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
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
            </DialogContent>
        </Dialog>
    );
}
