import { useState } from "react";
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
import { Loader2, Plus, X } from "lucide-react";

import { ChurchBulletin, AttachmentItem } from "@/shared/types/ChurchBulletin";
import { updateBulletin, deleteBulletin } from "@/features/bulletins/api/bulletinsApi";
import { getMyPermissions } from "@/helpers/UserHelper";
import { MyPermsRequest } from '@/shared/types/MyPermsRequest';
import { EventMinistryDropdown } from '@/features/admin/components/Events/EventMinistryDropdown';
import { AccountPermissions } from '@/shared/types/AccountPermissions';

interface EditBulletinProps {
    bulletin: ChurchBulletin;
    onSave: () => Promise<void>;
    permissions: AccountPermissions | null;
}

export function EditBulletinDialog({ bulletin: initialBulletin, onSave }: EditBulletinProps) {
    const [bulletin, setBulletin] = useState<ChurchBulletin>(initialBulletin);
    
    const [isOpen, setIsOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [checkingPerms, setCheckingPerms] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleDialogClose = () => {
        setBulletin(initialBulletin);
        setDeleteConfirmOpen(false);
        setDeleting(false);
        setIsOpen(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                ...bulletin,
                publish_date: bulletin.publish_date ? bulletin.publish_date.toISOString() : new Date().toISOString(),
                expire_at: bulletin.expire_at ? bulletin.expire_at.toISOString() : undefined,
            };
            await updateBulletin(bulletin.id, payload);
            await onSave();
            handleDialogClose();
        } catch (err) {
            console.error("Failed to update bulletin:", err);
            alert("Failed to update bulletin. See console for details.");
        }
        setSaving(false);
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await deleteBulletin(bulletin.id);
            await onSave();
            setDeleteConfirmOpen(false);
            handleDialogClose();
        } catch (err) {
            console.error("Failed to delete bulletin:", err);
            alert("Failed to delete bulletin. See console for details.");
        }
        setDeleting(false);
    };

    const handleDialogOpen = async () => {
        setCheckingPerms(true);
        try {
            const requestOptions: MyPermsRequest = { user_assignable_roles: false, event_editor_roles: false, user_role_ids: false };
            const result = await getMyPermissions(requestOptions);
            if (result?.success) {
                if (result?.perms?.admin || result?.perms?.bulletin_editing) {
                    setIsOpen(true);
                } else {
                    alert("You must have the Bulletin Editor permission to edit bulletins.");
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

    const addAttachment = () => {
        const newAttachment: AttachmentItem = { title: "", url: "" };
        setBulletin({ ...bulletin, attachments: [...(bulletin.attachments || []), newAttachment] });
    };

    const removeAttachment = (index: number) => {
        const updated = [...(bulletin.attachments || [])];
        updated.splice(index, 1);
        setBulletin({ ...bulletin, attachments: updated });
    };

    const updateAttachment = (index: number, field: keyof AttachmentItem, value: string) => {
        const updated = [...(bulletin.attachments || [])];
        updated[index] = { ...updated[index], [field]: value };
        setBulletin({ ...bulletin, attachments: updated });
    };

    return (
        <>
            <Button size="sm" variant="ghost" onClick={handleDialogOpen} disabled={checkingPerms}>Edit</Button>
            <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleDialogClose(); }}>
                <DialogContent className="sm:max-w-[100vh] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Bulletin</DialogTitle>
                        <div className="pt-6">
                            <DialogDescription>Edit the bulletin fields below.</DialogDescription>
                        </div>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="text-xs text-gray-500 grid grid-cols-2 gap-2">
                            <div>Created: {bulletin.created_at ? new Date(bulletin.created_at).toLocaleString() : 'N/A'}</div>
                            <div>Updated: {bulletin.updated_at ? new Date(bulletin.updated_at).toLocaleString() : 'N/A'}</div>
                        </div>

                        <label className="flex flex-col">
                            <span className="text-sm font-medium">Headline *</span>
                            <input 
                                className="border p-2 rounded"
                                placeholder="Headline"
                                value={bulletin.headline} 
                                onChange={(e) => setBulletin({ ...bulletin, headline: e.target.value })} 
                            />
                        </label>

                        <label className="flex flex-col">
                            <span className="text-sm font-medium text-gray-600">Headline (RU)</span>
                            <input 
                                className="border p-2 rounded"
                                placeholder="Headline (RU)"
                                value={bulletin.ru_headline || ''} 
                                onChange={(e) => setBulletin({ ...bulletin, ru_headline: e.target.value })} 
                            />
                        </label>

                        <label className="flex flex-col">
                            <span className="text-sm font-medium">Body *</span>
                            <textarea 
                                className="border p-2 rounded" 
                                rows={6}
                                placeholder="Body"
                                value={bulletin.body} 
                                onChange={(e) => setBulletin({ ...bulletin, body: e.target.value })} 
                            />
                        </label>

                        <label className="flex flex-col">
                            <span className="text-sm font-medium text-gray-600">Body (RU)</span>
                            <textarea 
                                className="border p-2 rounded" 
                                rows={6}
                                placeholder="Body (RU)"
                                value={bulletin.ru_body || ''} 
                                onChange={(e) => setBulletin({ ...bulletin, ru_body: e.target.value })} 
                            />
                        </label>

                        <div>
                            <EventMinistryDropdown
                                selected={bulletin.ministries ?? []}
                                onChange={(next: string[]) => setBulletin({ ...bulletin, ministries: next })}
                                ministries={[
                                    "Youth",
                                    "Children",
                                    "Women",
                                    "Men",
                                    "Family",
                                    "Worship",
                                    "Outreach",
                                    "Bible Study",
                                ]}
                            />
                        </div>

                        <label className="flex flex-col">
                            <span className="text-sm font-medium">Publish Date *</span>
                            <input 
                                type="date" 
                                className="border p-2 rounded" 
                                value={bulletin.publish_date ? new Date(bulletin.publish_date).toISOString().slice(0,10) : ''} 
                                onChange={(e) => setBulletin({ ...bulletin, publish_date: e.target.value ? new Date(e.target.value) : new Date() })} 
                            />
                        </label>

                        <label className="flex flex-col">
                            <span className="text-sm font-medium">Expiration Date (optional)</span>
                            <input 
                                type="date" 
                                className="border p-2 rounded" 
                                value={bulletin.expire_at ? new Date(bulletin.expire_at).toISOString().slice(0,10) : ''} 
                                onChange={(e) => setBulletin({ ...bulletin, expire_at: e.target.value ? new Date(e.target.value) : undefined })} 
                            />
                        </label>

                        <div className="border rounded p-4">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-sm font-medium">Attachments</span>
                                <Button type="button" size="sm" onClick={addAttachment}>
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add Attachment
                                </Button>
                            </div>
                            {(bulletin.attachments || []).map((att, idx) => (
                                <div key={idx} className="grid grid-cols-12 gap-2 mb-2">
                                    <input 
                                        className="border p-2 rounded col-span-4" 
                                        placeholder="Title" 
                                        value={att.title} 
                                        onChange={(e) => updateAttachment(idx, 'title', e.target.value)} 
                                    />
                                    <input 
                                        className="border p-2 rounded col-span-7" 
                                        placeholder="URL" 
                                        value={att.url} 
                                        onChange={(e) => updateAttachment(idx, 'url', e.target.value)} 
                                    />
                                    <Button 
                                        type="button" 
                                        size="sm" 
                                        variant="destructive" 
                                        className="col-span-1" 
                                        onClick={() => removeAttachment(idx)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                            {(bulletin.attachments || []).length === 0 && (
                                <p className="text-sm text-gray-500">No attachments added</p>
                            )}
                        </div>

                        <div className="flex gap-4">
                            <label className="flex items-center space-x-2">
                                <input 
                                    type="checkbox" 
                                    checked={bulletin.published || false} 
                                    onChange={(e) => setBulletin({ ...bulletin, published: e.target.checked })} 
                                />
                                <span className="text-sm">Published</span>
                            </label>

                            <label className="flex items-center space-x-2">
                                <input 
                                    type="checkbox" 
                                    checked={bulletin.pinned || false} 
                                    onChange={(e) => setBulletin({ ...bulletin, pinned: e.target.checked })} 
                                />
                                <span className="text-sm">Pinned</span>
                            </label>
                        </div>
                    </div>

                    <AlertDialog open={deleteConfirmOpen} onOpenChange={(next) => {
                        if (!next && !deleting) {
                            setDeleteConfirmOpen(false);
                        }
                    }}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete bulletin</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Are you sure you want to delete "{bulletin.headline}"? This action cannot be undone.
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
                            Delete bulletin
                        </Button>
                        <Button type="button" onClick={handleDialogClose} disabled={saving}>Cancel</Button>
                        <Button type="button" onClick={handleSave} disabled={saving}>
                            {saving ? <><Loader2 className="animate-spin mr-2 h-4 w-4" />Saving...</> : 'Save changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

export default EditBulletinDialog;
