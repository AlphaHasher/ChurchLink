import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/components/ui/Dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';

type Props = {
    open: boolean;
    folderName: string;
    error?: string | null;
    canManage?: boolean;
    onOpenChange: (open: boolean) => void;
    onChangeName: (val: string) => void;
    onCancel: () => void;
    onCreate: () => void;
};

export const NewFolderDialog: React.FC<Props> = ({
    open, folderName, error, canManage = false, onOpenChange, onChangeName, onCancel, onCreate
}) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create a new folder</DialogTitle>
                    <DialogDescription>Folders help you organize media. Names must be unique within the same location.</DialogDescription>
                </DialogHeader>
                {error && (
                    <Alert className="mb-2"><AlertDescription>{error}</AlertDescription></Alert>
                )}
                {!canManage && (
                    <Alert className="mb-2" variant="destructive">
                        <AlertDescription>You don't have permission to create folders.</AlertDescription>
                    </Alert>
                )}
                <Input
                    autoFocus
                    placeholder="Folder name"
                    value={folderName}
                    onChange={(e) => onChangeName(e.target.value)}
                />
                <DialogFooter>
                    <Button variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button onClick={onCreate} disabled={!canManage}>Create</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
