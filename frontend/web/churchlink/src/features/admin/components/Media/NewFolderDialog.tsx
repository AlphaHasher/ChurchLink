import React from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/Dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';

export const NewFolderDialog: React.FC<{
    open: boolean;
    folderName: string;
    error: string | null;
    onOpenChange: (open: boolean) => void;
    onChangeName: (name: string) => void;
    onCancel: () => void;
    onCreate: () => void;
}> = ({ open, folderName, error, onOpenChange, onChangeName, onCancel, onCreate }) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Create New Folder</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
                <div>
                    <Label htmlFor="folderName">Folder Name</Label>
                    <Input id="folderName" value={folderName} onChange={(e) => onChangeName(e.target.value)} placeholder="Enter folder name" />
                </div>
                {error && (
                    <Alert className="text-destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={onCancel}>
                    Cancel
                </Button>
                <Button onClick={onCreate}>Create</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
);
