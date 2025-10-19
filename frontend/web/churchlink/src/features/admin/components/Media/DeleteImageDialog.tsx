import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/components/ui/Dialog';
import { Button } from '@/shared/components/ui/button';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';

type Props = {
    open: boolean;
    assetName: string;
    canManage?: boolean;
    onCancel: () => void;
    onConfirm: () => void;
};

export const DeleteImageDialog: React.FC<Props> = ({ open, assetName, canManage = false, onCancel, onConfirm }) => {
    return (
        <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete image</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to delete “{assetName}”? This cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                {!canManage && (
                    <Alert className="mb-2" variant="destructive">
                        <AlertDescription>You don't have permission to delete images.</AlertDescription>
                    </Alert>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button variant="destructive" onClick={onConfirm} disabled={!canManage}>
                        Delete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
