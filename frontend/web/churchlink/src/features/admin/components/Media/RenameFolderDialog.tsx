import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/Dialog';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';

export const RenameFolderDialog: React.FC<{
    open: boolean;
    currentName: string;
    onOpenChange: (open: boolean) => void;
    onCancel: () => void;
    onConfirm: (newName: string) => void;
}> = ({ open, currentName, onOpenChange, onCancel, onConfirm }) => {
    const [value, setValue] = useState(currentName);

    useEffect(() => {
        if (open) setValue(currentName);
    }, [open, currentName]);

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Rename Folder</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                    <Input
                        autoFocus
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder="New folder name"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                const v = value.trim();
                                if (v) onConfirm(v);
                            }
                        }}
                    />
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button
                        onClick={() => {
                            const v = value.trim();
                            if (v) onConfirm(v);
                        }}
                    >
                        Rename
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
