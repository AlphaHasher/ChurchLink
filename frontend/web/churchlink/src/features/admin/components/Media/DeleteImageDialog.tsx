import React from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/Dialog';
import { Button } from '@/shared/components/ui/button';

export const DeleteImageDialog: React.FC<{
    open: boolean;
    assetName: string;
    onCancel: () => void;
    onConfirm: () => void;
}> = ({ open, assetName, onCancel, onConfirm }) => (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Delete Image</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
                <p>
                    Are you sure you want to delete "<span className="font-semibold">{assetName}</span>"? This cannot be undone.
                </p>
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={onCancel}>
                    Cancel
                </Button>
                <Button variant="destructive" onClick={onConfirm}>
                    Delete
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
);
