import { useState, useEffect } from "react";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/components/ui/Dialog";
import { Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

import { ChurchBulletin, AttachmentItem } from "@/shared/types/ChurchBulletin";
import { MyPermsRequest } from '@/shared/types/MyPermsRequest';
import { createBulletin } from "@/features/bulletins/api/bulletinsApi";
import { getMyPermissions } from "@/helpers/UserHelper";
import { EventMinistryDropdown } from '@/features/admin/components/Events/EventMinistryDropdown';
import { fetchMinistries } from "@/helpers/EventsHelper";
import { AccountPermissions } from '@/shared/types/AccountPermissions';
import { getApiErrorMessage } from "@/helpers/ApiErrorHelper";
import { BulletinImageSelector } from "./BulletinImageSelector";

interface CreateBulletinProps {
    onSave: () => Promise<void>;
    permissions: AccountPermissions | null;
}

export function CreateBulletinDialog({ onSave }: CreateBulletinProps) {
    const initial: Partial<ChurchBulletin> = {
        headline: "",
        body: "",
        publish_date: new Date(),
        expire_at: undefined,
        published: false,
        pinned: false,
        ministries: [],
        roles: [],
        attachments: [],
        ru_headline: "",
        ru_body: "",
        image_id: undefined,
    };

    const [bulletin, setBulletin] = useState<Partial<ChurchBulletin>>(initial);
    const [isOpen, setIsOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [checkingPerms, setCheckingPerms] = useState(false);
    const [ministries, setMinistries] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen) {
            fetchMinistries().then(setMinistries)
        }
    }, [isOpen])

    const handleDialogClose = () => {
        setBulletin(initial);
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
            await createBulletin(payload);
            await onSave();
            handleDialogClose();
        } catch (err) {
            console.error("Failed to create bulletin:", err);
            const errorMessage = getApiErrorMessage(err, "Failed to create bulletin");
            alert(errorMessage);
        }
        setSaving(false);
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
                    alert("You must have the Bulletin Editor permission to create bulletins.");
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
            <Button
                variant="outline"
                className={cn(
                    "!bg-blue-500 text-white border border-blue-600 shadow-sm hover:bg-blue-600",
                    "dark:!bg-blue-600 dark:border-blue-500 dark:text-white dark:hover:bg-blue-700"
                )}
                onClick={handleDialogOpen}
                disabled={checkingPerms}
            >
                {checkingPerms ? (
                    <>
                        <Loader2 className="animate-spin mr-2 h-4 w-4" />
                        Checking...
                    </>
                ) : (
                    "Create New Announcement"
                )}
            </Button>

            <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleDialogClose(); }}>
                <DialogContent className={cn(
                    "sm:max-w-[100vh] max-h-[80vh] overflow-y-auto",
                    "bg-white dark:bg-gray-800 text-black dark:text-white",
                    "border border-gray-200 dark:border-gray-600"
                )}>
                    <DialogHeader>
                        <DialogTitle className="text-black dark:text-white">New Bulletin Announcement</DialogTitle>
                        <div className="pt-6">
                            <DialogDescription className="text-muted-foreground dark:text-muted-foreground/80">
                                Create a new bulletin announcement with an optional image from the media library
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    <div className={cn(
                        "grid gap-4 py-4",
                        "bg-white dark:bg-gray-800"
                    )}>
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

                        {/* Image Selector */}
                        <BulletinImageSelector
                            value={bulletin.image_id ?? null}
                            onChange={(imageId) => setBulletin({ ...bulletin, image_id: imageId ?? undefined })}
                            label="Announcement Image"
                            helperText="Select an optional image to display with this announcement. The image will appear as a thumbnail in the bulletin list."
                        />

                        <div>
                            <EventMinistryDropdown
                                selected={bulletin.ministries ?? []}
                                onChange={(next: string[]) => setBulletin({ ...bulletin, ministries: next })}
                                ministries={ministries}
                            />
                        </div>

                        <label className="flex flex-col">
                            <span className="text-sm font-medium">Publish Date *</span>
                            <input
                                type="date"
                                className="border p-2 rounded"
                                value={bulletin.publish_date ? bulletin.publish_date.toISOString().slice(0,10) : ''}
                                onChange={(e) => setBulletin({ ...bulletin, publish_date: e.target.value ? new Date(e.target.value) : new Date() })}
                            />
                        </label>

                        <label className="flex flex-col">
                            <span className="text-sm font-medium">Expiration Date (optional)</span>
                            <input
                                type="date"
                                className="border p-2 rounded"
                                value={bulletin.expire_at ? bulletin.expire_at.toISOString().slice(0,10) : ''}
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

                    <DialogFooter>
                        <Button type="button" onClick={handleDialogClose} disabled={saving}>Cancel</Button>
                        <Button type="button" onClick={handleSave} disabled={saving}>
                            {saving ? (<><Loader2 className="animate-spin mr-2 h-4 w-4" />Saving...</>) : ("Save changes")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

export default CreateBulletinDialog;
