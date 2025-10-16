import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/components/ui/Dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';

type Props = {
    open: boolean;
    currentName: string;
    canManage?: boolean;
    onOpenChange: (open: boolean) => void;
    onCancel: () => void;
    onConfirm: (newName: string) => void;
};

export const RenameFolderDialog: React.FC<Props> = ({
    open, currentName, canManage = false, onOpenChange, onCancel, onConfirm
}) => {
    const [name, setName] = React.useState(currentName);
    React.useEffect(() => setName(currentName), [currentName]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Rename folder</DialogTitle>
                    <DialogDescription>Choose a new name. It must be unique within this location.</DialogDescription>
                </DialogHeader>
                {!canManage && (
                    <Alert className="mb-2" variant="destructive">
                        <AlertDescription>You don't have permission to rename folders.</AlertDescription>
                    </Alert>
                )}
                <Input value={name} onChange={(e) => setName(e.target.value)} />
                <DialogFooter>
                    <Button variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button onClick={() => onConfirm(name)} disabled={!canManage}>Rename</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
