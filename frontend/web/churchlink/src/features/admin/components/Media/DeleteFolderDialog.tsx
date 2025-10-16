import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/components/ui/Dialog';
import { Button } from '@/shared/components/ui/button';
import { Switch } from '@/shared/components/ui/switch';
import { Label } from '@/shared/components/ui/label';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';

type Props = {
    open: boolean;
    folderName: string;
    canManage?: boolean;
    onOpenChange: (open: boolean) => void;
    onCancel: () => void;
    onConfirm: (opts: { delete_within: boolean }) => void;
};

export const DeleteFolderDialog: React.FC<Props> = ({
    open, folderName, canManage = false, onOpenChange, onCancel, onConfirm
}) => {
    const [deleteWithin, setDeleteWithin] = React.useState(false);

    React.useEffect(() => setDeleteWithin(false), [open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete “{folderName}”</DialogTitle>
                    <DialogDescription>
                        You can move its contents up one level or delete everything inside it.
                    </DialogDescription>
                </DialogHeader>
                {!canManage && (
                    <Alert className="mb-2" variant="destructive">
                        <AlertDescription>You don't have permission to delete folders.</AlertDescription>
                    </Alert>
                )}
                <div className="flex items-center gap-2">
                    <Switch id="deleteWithin" checked={deleteWithin} onCheckedChange={setDeleteWithin} />
                    <Label htmlFor="deleteWithin">Delete everything inside this folder</Label>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button variant="destructive" onClick={() => onConfirm({ delete_within: deleteWithin })} disabled={!canManage}>
                        Delete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
