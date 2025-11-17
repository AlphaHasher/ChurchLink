import { useState, useEffect } from "react";
import { Button } from "@/shared/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/components/ui/Dialog";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";

import { ChurchSermon } from "@/shared/types/ChurchSermon";
import { updateSermon, deleteSermon } from "@/features/sermons/api/sermonsApi";
import { getMyPermissions } from "@/helpers/UserHelper";
import { MyPermsRequest } from '@/shared/types/MyPermsRequest';
import { EventMinistryDropdown } from '@/features/admin/components/Events/EventMinistryDropdown';
import { fetchMinistriesAsStringArray } from "@/helpers/MinistriesHelper";
import { getApiErrorMessage } from "@/helpers/ApiErrorHelper";

interface EditSermonProps {
    sermon: ChurchSermon;
    onSave: () => Promise<void>;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function EditSermonDialog({ sermon: initialSermon, onSave, open: externalOpen, onOpenChange }: EditSermonProps) {
    const [sermon, setSermon] = useState<ChurchSermon>(initialSermon);

    const [isOpen, setIsOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [checkingPerms, setCheckingPerms] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [ministries, setMinistries] = useState<string[]>([]);

    // Use external open state if provided, otherwise use internal state
    const dialogOpen = externalOpen !== undefined ? externalOpen : isOpen;
    const setDialogOpen = (open: boolean) => {
        if (onOpenChange) {
            onOpenChange(open);
        } else {
            setIsOpen(open);
        }
    };

    useEffect(() => {
        if (dialogOpen) {
            fetchMinistriesAsStringArray().then(setMinistries)
        }
    }, [dialogOpen])

    const handleDialogClose = () => {
        setSermon(initialSermon);
        setDeleteConfirmOpen(false);
        setDeleting(false);
        setDialogOpen(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = { ...sermon, date_posted: sermon.date_posted ? sermon.date_posted.toISOString() : null };
            await updateSermon(sermon.id, payload);
            await onSave();
            handleDialogClose();
        } catch (err) {
            console.error("Failed to update sermon:", err);
            const errorMessage = getApiErrorMessage(err, "Failed to update sermon");
            alert(errorMessage);
        }
        setSaving(false);
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await deleteSermon(sermon.id);
            await onSave();
            setDeleteConfirmOpen(false);
            handleDialogClose();
        } catch (err) {
            console.error("Failed to delete sermon:", err);
            const errorMessage = getApiErrorMessage(err, "Failed to delete sermon");
            alert(errorMessage);
        }
        setDeleting(false);
    };

    const handleDialogOpen = async () => {
        setCheckingPerms(true);
        try {
            const requestOptions: MyPermsRequest = { user_assignable_roles: false, event_editor_roles: true, user_role_ids: false };
            const result = await getMyPermissions(requestOptions);
            if (result?.success) {
                if (result?.perms?.admin || result?.perms?.sermon_editing) {
                    setDialogOpen(true);
                } else {
                    alert("You must have the Sermon Editor permission to edit sermons.");
                }
            } else {
                alert(result?.msg || "Permission check failed.");
            }
        } catch (err) {
            console.error(err);
            alert("Error checking permissions.");
        }
        setCheckingPerms(false);
    };

    return (
        <>
            {!externalOpen && <Button size="sm" variant="ghost" onClick={handleDialogOpen} disabled={checkingPerms}>Edit</Button>}
            <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleDialogClose(); }}>
                <DialogContent className="sm:max-w-[100vh] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Sermon</DialogTitle>
                        <div className="pt-6">
                            <DialogDescription>Edit the sermon fields below.</DialogDescription>
                        </div>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <label className="flex flex-col">
                            <span className="text-sm font-medium">Title</span>
                            <input className="border p-2 rounded" value={sermon.title} onChange={(e) => setSermon({ ...sermon, title: e.target.value })} />
                        </label>

                        <label className="flex flex-col">
                            <span className="text-sm font-medium">Description</span>
                            <textarea className="border p-2 rounded" value={sermon.description} onChange={(e) => setSermon({ ...sermon, description: e.target.value })} />
                        </label>

                        <label className="flex flex-col">
                            <span className="text-sm font-medium">Speaker</span>
                            <input className="border p-2 rounded" value={sermon.speaker} onChange={(e) => setSermon({ ...sermon, speaker: e.target.value })} />
                        </label>

                        <label className="flex flex-col">
                            <span className="text-sm font-medium">Ministry</span>
                            <EventMinistryDropdown
                                selected={sermon.ministry ?? []}
                                onChange={(next: string[]) => setSermon({ ...sermon, ministry: next })}
                                ministries={ministries}
                            />
                        </label>

                        <label className="flex flex-col">
                            <span className="text-sm font-medium">YouTube URL</span>
                            <input className="border p-2 rounded" value={sermon.youtube_url} onChange={(e) => setSermon({ ...sermon, youtube_url: e.target.value })} />
                        </label>

                        <label className="flex flex-col">
                            <span className="text-sm font-medium">Date Posted</span>
                            <input
                                type="date"
                                className="border p-2 rounded"
                                value={sermon.date_posted ? new Date(sermon.date_posted).toISOString().slice(0, 10) : ''}
                                onChange={(e) => setSermon({
                                    ...sermon,
                                    date_posted: e.target.value ? new Date(e.target.value) : new Date(),
                                })}
                            />
                        </label>

                        <label className="flex items-center space-x-2">
                            <input type="checkbox" checked={sermon.published} onChange={(e) => setSermon({ ...sermon, published: e.target.checked })} />
                            <span className="text-sm">Published</span>
                        </label>
                    </div>

                    {/* Deleted explanatory Danger zone block; Delete action moved to dialog footer */}

                    <AlertDialog open={deleteConfirmOpen} onOpenChange={(next) => {
                        if (!next && !deleting) {
                            setDeleteConfirmOpen(false);
                        }
                    }}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete sermon</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Are you sure you want to delete "{sermon.title}"? This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={handleDelete}
                                    disabled={deleting}
                                >
                                    {deleting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Deleting...
                                        </>
                                    ) : (
                                        'Delete permanently'
                                    )}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setDeleteConfirmOpen(false)}
                                    disabled={deleting}
                                >
                                    Cancel
                                </Button>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="destructive"
                            disabled={saving || deleting}
                            onClick={() => setDeleteConfirmOpen(true)}
                        >
                            Delete sermon
                        </Button>
                        <Button type="button" onClick={handleDialogClose} disabled={saving}>Cancel</Button>
                        <Button type="button" onClick={handleSave} disabled={saving}>{saving ? <><Loader2 className="animate-spin mr-2 h-4 w-4" />Saving...</> : 'Save changes'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

export default EditSermonDialog;
