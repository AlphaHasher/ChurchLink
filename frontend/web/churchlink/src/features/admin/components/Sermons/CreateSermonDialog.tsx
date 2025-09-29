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
import { Loader2 } from "lucide-react";

import { ChurchSermon } from "@/shared/types/ChurchSermon";
import { MyPermsRequest } from '@/shared/types/MyPermsRequest';
import { createSermon } from "@/features/sermons/api/sermonsApi";
import { getMyPermissions } from "@/helpers/UserHelper";
import { EventMinistryDropdown } from '@/features/admin/components/Events/EventMinistryDropdown';

interface CreateSermonProps {
    onSave: () => Promise<void>;
}

export function CreateSermonDialog({ onSave }: CreateSermonProps) {
    const initial: ChurchSermon = {
        id: "",
        title: "",
        description: "",
        speaker: "",
        ministry: [],
        roles: [],
        youtube_url: "",
        date_posted: new Date(),
        published: false,
        ru_title: "",
        ru_description: "",
        ru_speaker: "",
    };

    const [sermon, setSermon] = useState<ChurchSermon>(initial);
    const [isOpen, setIsOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [checkingPerms, setCheckingPerms] = useState(false);

    const handleDialogClose = () => {
        setSermon(initial);
        setIsOpen(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                ...sermon,
                date_posted: sermon.date_posted ? sermon.date_posted.toISOString() : null,
            };
            await createSermon(payload);
            await onSave();
            handleDialogClose();
        } catch (err) {
            console.error("Failed to create sermon:", err);
            alert("Failed to create sermon. See console for details.");
        }
        setSaving(false);
    };

    const handleDialogOpen = async () => {
        setCheckingPerms(true);
        try {
            const requestOptions: MyPermsRequest = { user_assignable_roles: false, event_editor_roles: true, user_role_ids: false };
            const result = await getMyPermissions(requestOptions);
            if (result?.success) {
                if (result?.perms?.admin || result?.perms?.sermon_editing) {
                    setIsOpen(true);
                } else {
                    alert("You must have the Sermon Editor permission to create sermons.");
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
            <Button
                variant="outline"
                className="!bg-blue-500 text-white border border-blue-600 shadow-sm hover:bg-blue-600"
                onClick={handleDialogOpen}
                disabled={checkingPerms}
            >
                {checkingPerms ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : "Create Sermon"}
            </Button>

            <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleDialogClose(); }}>
                <DialogContent className="sm:max-w-[100vh] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>New Sermon</DialogTitle>
                        <div className="pt-6">
                            <DialogDescription>Fill out the sermon details below.</DialogDescription>
                        </div>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <label className="flex flex-col">
                            <span className="text-sm font-medium">Title</span>
                            <input className="border p-2 rounded" value={sermon.title} onChange={(e) => setSermon({ ...sermon, title: e.target.value })} />
                        </label>

                        <label className="flex flex-col">
                            <span className="text-sm font-medium">Title (RU)</span>
                            <input className="border p-2 rounded" value={sermon.ru_title || ''} onChange={(e) => setSermon({ ...sermon, ru_title: e.target.value })} />
                        </label>

                        <label className="flex flex-col">
                            <span className="text-sm font-medium">Description</span>
                            <textarea className="border p-2 rounded" value={sermon.description} onChange={(e) => setSermon({ ...sermon, description: e.target.value })} />
                        </label>

                        <label className="flex flex-col">
                            <span className="text-sm font-medium">Description (RU)</span>
                            <textarea className="border p-2 rounded" value={sermon.ru_description || ''} onChange={(e) => setSermon({ ...sermon, ru_description: e.target.value })} />
                        </label>

                        <label className="flex flex-col">
                            <span className="text-sm font-medium">Speaker</span>
                            <input className="border p-2 rounded" value={sermon.speaker} onChange={(e) => setSermon({ ...sermon, speaker: e.target.value })} />
                        </label>

                        <label className="flex flex-col">
                            <span className="text-sm font-medium">Speaker (RU)</span>
                            <input className="border p-2 rounded" value={sermon.ru_speaker || ''} onChange={(e) => setSermon({ ...sermon, ru_speaker: e.target.value })} />
                        </label>

                        <div>
                            <EventMinistryDropdown
                                selected={sermon.ministry ?? []}
                                onChange={(next: string[]) => setSermon({ ...sermon, ministry: next })}
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
                            <span className="text-sm font-medium">YouTube URL</span>
                            <input className="border p-2 rounded" value={sermon.youtube_url} onChange={(e) => setSermon({ ...sermon, youtube_url: e.target.value })} />
                        </label>

                        <label className="flex flex-col">
                            <span className="text-sm font-medium">Date Posted</span>
                                            <input type="date" className="border p-2 rounded" value={sermon.date_posted ? sermon.date_posted.toISOString().slice(0,10) : ''} onChange={(e) => setSermon({ ...sermon, date_posted: e.target.value ? new Date(e.target.value) : new Date() })} />
                        </label>

                        <label className="flex items-center space-x-2">
                            <input type="checkbox" checked={sermon.published} onChange={(e) => setSermon({ ...sermon, published: e.target.checked })} />
                            <span className="text-sm">Published</span>
                        </label>
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

export default CreateSermonDialog;
