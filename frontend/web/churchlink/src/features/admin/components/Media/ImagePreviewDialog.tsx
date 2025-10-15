import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/Dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import type { ImageResponse } from '@/shared/types/ImageData';
import { getPublicUrl } from '@/helpers/MediaInteraction';

export const ImagePreviewDialog: React.FC<{
    open: boolean;
    image: ImageResponse | null;
    onOpenChange: (open: boolean) => void;
    onSave: (id: string, data: { new_name?: string; new_description?: string | null }) => Promise<void>;
}> = ({ open, image, onOpenChange, onSave }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState<string>('');

    useEffect(() => {
        setName(image?.name ?? '');
        setDescription(image?.description ?? '');
    }, [image]);

    if (!image) return null;

    const full = getPublicUrl(image.id);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Preview</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                    <div className="relative w-full h-full">
                        <img src={full} alt={image.name || image.id} className="w-full h-full object-contain rounded" />
                    </div>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="name">Name</Label>
                            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                        </div>
                        <div>
                            <Label htmlFor="desc">Description</Label>
                            <Textarea id="desc" value={description || ''} onChange={(e) => setDescription(e.target.value)} />
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        onClick={() =>
                            onSave(image.id, {
                                new_name: name && name !== image.name ? name : undefined,
                                new_description: description !== (image.description || '') ? description : undefined,
                            })
                        }
                    >
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
