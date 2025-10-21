import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/shared/components/ui/Dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Trash, Download, Save } from 'lucide-react';
import type { ImageResponse } from '@/shared/types/ImageData';

type Props = {
    open: boolean;
    image: ImageResponse | null;
    canManage?: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (id: string, data: { new_name?: string; new_description?: string | null }) => void;
    onRequestDelete?: () => void;
};

export const ImagePreviewDialog: React.FC<Props> = ({ open, image, canManage = false, onOpenChange, onSave, onRequestDelete }) => {
    const [name, setName] = React.useState('');
    const [desc, setDesc] = React.useState<string | undefined>('');
    const [zoomOpen, setZoomOpen] = React.useState(false);

    React.useEffect(() => {
        setName(image?.name || '');
        setDesc(image?.description || '');
    }, [image?.id]);

    if (!image) return null;

    const downloadHref = `${image.public_url}?download=1`;

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[720px]">
                    <DialogHeader>
                        <DialogTitle>Image details</DialogTitle>
                        <DialogDescription>Click the preview to open a larger view.</DialogDescription>
                    </DialogHeader>

                    <div className="grid md:grid-cols-[280px_1fr] gap-4">
                        <div className="relative rounded-md border overflow-hidden bg-muted/20">
                            {/* Clickable preview with strong affordance */}
                            <button
                                className="w-full block group cursor-zoom-in"
                                title="Click to view bigger"
                                onClick={() => setZoomOpen(true)}
                            >
                                <img
                                    src={image.public_url}
                                    alt={image.name}
                                    className="w-full h-[260px] object-contain bg-background transition-opacity group-hover:opacity-90"
                                />
                                <div className="pointer-events-none absolute bottom-1 right-1 rounded-md px-2 py-1 text-[10px] bg-background/80 border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                    View larger
                                </div>
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">Name</label>
                                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Image name" />
                            </div>
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">Description</label>
                                <Textarea value={desc ?? ''} onChange={(e) => setDesc(e.target.value)} placeholder="Optional description" rows={4} />
                            </div>
                            <div className="text-xs text-muted-foreground">
                                <div>File type: {image.extension?.toUpperCase() || '—'}</div>
                                <div>Location: {image.folder ? image.folder : 'Home'}</div>
                                <div>ID: {image.id}</div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <a
                            href={downloadHref}
                            download={`${(image.name || image.id)}.${image.extension || 'bin'}`}
                            className="inline-flex items-center justify-center rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent transition-colors"
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Download
                        </a>
                        {onRequestDelete && (
                            <Button
                                variant="destructive"
                                onClick={() => {
                                    if (!canManage) { window.alert('You do not have permission to delete images.'); return; }
                                    onRequestDelete();
                                }}
                            >
                                <Trash className="mr-2 h-4 w-4" />
                                Delete
                            </Button>
                        )}
                        <Button
                            onClick={() => {
                                if (!canManage) { window.alert('You do not have permission to save image updates.'); return; }
                                onSave(image.id, { new_name: name.trim() || image.name, new_description: (desc ?? '').trim() || null });
                            }}
                        >
                            <Save className="mr-2 h-4 w-4" />
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* fullscreen-ish viewer using the same dialog system */}
            <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
                <DialogContent className="max-w-[95vw] max-h-[95vh] p-2">
                    <div className="w-[80vw] h-[80vh] flex items-center justify-center bg-black/80 rounded-md cursor-zoom-out" title="Click to close" onClick={() => setZoomOpen(false)}>
                        <img src={image.public_url} alt={image.name} className="max-w-full max-h-full object-contain" />
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};
