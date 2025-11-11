import { format } from 'date-fns';
import { Calendar, Paperclip, Users } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/shared/components/ui/Dialog';
import { ChurchBulletin } from '@/shared/types/ChurchBulletin';
import { getLocalizedBulletinFields } from '@/shared/utils/localeUtils';
import { BulletinMediaImage } from '@/features/bulletins/components/BulletinMediaImage';

interface BulletinDetailsModalProps {
    bulletin: ChurchBulletin | null;
    isOpen: boolean;
    onClose: () => void;
}

export function BulletinDetailsModal({ 
    bulletin, 
    isOpen, 
    onClose
}: BulletinDetailsModalProps) {
    const publishDate = bulletin?.publish_date ? new Date(bulletin.publish_date) : null;
    const updatedAtSource = bulletin ? bulletin.updated_at ?? bulletin.created_at ?? null : null;
    const updatedAt = updatedAtSource ? new Date(updatedAtSource) : null;
    
    // Get localized fields if bulletin exists
    const localizedFields = bulletin ? getLocalizedBulletinFields(bulletin) : null;

    return (
        <Dialog open={isOpen} onOpenChange={(next) => !next && onClose()}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto sm:pr-6">
                {!bulletin || !localizedFields ? (
                    <>
                        <DialogHeader>
                            <DialogTitle>Bulletin details</DialogTitle>
                        </DialogHeader>
                        <p className="py-4 text-sm text-gray-600">Select a bulletin to view its details.</p>
                    </>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold leading-tight text-center">
                                {localizedFields.headline}
                            </DialogTitle>
                        </DialogHeader>

                        <BulletinMediaImage
                            bulletin={bulletin}
                            alt={localizedFields.headline}
                            containerClassName="mt-3 overflow-hidden rounded-lg bg-gray-100"
                            imageClassName="w-full h-full object-cover"
                            loading="eager"
                        />

                        <div className="space-y-6">
                            <div className="prose prose-sm max-w-none">
                                <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                                    {localizedFields.body}
                                </div>
                            </div>

                            {bulletin.attachments && bulletin.attachments.length > 0 && (
                                <div className="border-t pt-4">
                                    <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                        <Paperclip className="h-4 w-4" />
                                        Attachments
                                    </h3>
                                    <div className="space-y-2">
                                        {bulletin.attachments.map((att, idx) => (
                                            <a
                                                key={idx}
                                                href={att.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                                            >
                                                <p className="text-sm font-medium text-gray-900 truncate">
                                                    {att.title}
                                                </p>
                                                <svg
                                                    className="h-5 w-5 text-gray-500 flex-shrink-0"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                                    />
                                                </svg>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 border-t pt-4">
                                {publishDate && (
                                    <div className="flex items-center gap-3 text-gray-700">
                                        <Calendar className="h-5 w-5 text-gray-500" />
                                        <div>
                                            <p className="font-medium">Publish Date</p>
                                            <p className="text-sm text-gray-600">
                                                {format(publishDate, 'MMMM dd, yyyy')}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {bulletin.ministries && bulletin.ministries.length > 0 && (
                                    <div className="flex items-start gap-3 text-gray-700">
                                        <Users className="h-5 w-5 text-gray-500 mt-0.5" />
                                        <div>
                                            <p className="font-medium">Ministries</p>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {bulletin.ministries.map((ministry, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800"
                                                    >
                                                        {ministry}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {updatedAt && (
                                <div className="text-xs text-gray-500 border-t pt-3">
                                    Last updated: {format(updatedAt, 'MMMM dd, yyyy • h:mm a')}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
