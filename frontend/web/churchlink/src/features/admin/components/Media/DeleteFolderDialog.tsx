import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/Dialog';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';

export const DeleteFolderDialog: React.FC<{
    open: boolean;
    folderName: string;
    onOpenChange: (open: boolean) => void;
    onCancel: () => void;
    onConfirm: (opts: { delete_within: boolean }) => void;
}> = ({ open, folderName, onOpenChange, onCancel, onConfirm }) => {
    const [deleteWithin, setDeleteWithin] = useState(true);
    const [confirmText, setConfirmText] = useState('');

    useEffect(() => {
        if (open) {
            setDeleteWithin(true);
            setConfirmText('');
        }
    }, [open]);

    const canDelete = confirmText.trim().toLowerCase() === 'delete';

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete Folder</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 text-sm">
                    <p>
                        You’re deleting <span className="font-semibold">{folderName}</span>.
                    </p>
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={deleteWithin}
                            onChange={(e) => setDeleteWithin(e.target.checked)}
                        />
                        <span>Also delete everything inside</span>
                    </label>
                    <div className="space-y-1">
                        <Label htmlFor="confirm">Type <span className="font-semibold">delete</span> to confirm</Label>
                        <Input id="confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button
                        variant="destructive"
                        disabled={!canDelete}
                        onClick={() => onConfirm({ delete_within: deleteWithin })}
                    >
                        Delete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
