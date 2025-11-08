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

import { ServiceBulletin } from "@/shared/types/ChurchBulletin";
import { MyPermsRequest } from '@/shared/types/MyPermsRequest';
import { createService } from "@/features/bulletins/api/bulletinsApi";
import { getMyPermissions } from "@/helpers/UserHelper";
import { AccountPermissions } from '@/shared/types/AccountPermissions';
import { getApiErrorMessage } from "@/helpers/ApiErrorHelper";

interface CreateServiceDialogProps {
    onSave: () => Promise<void>;
    permissions: AccountPermissions | null;
}

export function CreateServiceDialog({ onSave }: CreateServiceDialogProps) {
    const initial: Partial<ServiceBulletin> = {
        title: "",
        day_of_week: "Sunday",
        time_of_day: "10:00",
        description: "",
        timeline_notes: "",
        display_week: new Date(),
        order: 0,
        published: false,
        visibility_mode: 'specific_weeks',
        ru_title: "",
        ru_description: "",
        ru_timeline_notes: "",
    };

    const [service, setService] = useState<Partial<ServiceBulletin>>(initial);
    const [isOpen, setIsOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [checkingPerms, setCheckingPerms] = useState(false);

    const handleDialogClose = () => {
        setService(initial);
        setIsOpen(false);
    };

    const handleSave = async () => {
        if (!service.title?.trim()) {
            alert("Title is required");
            return;
        }

        setSaving(true);
        try {
            const payload = {
                title: service.title,
                day_of_week: service.day_of_week || "Sunday",
                time_of_day: service.time_of_day || "10:00",
                description: service.description || "",
                timeline_notes: service.timeline_notes || "",
                display_week: service.display_week ? service.display_week.toISOString() : new Date().toISOString(),
                order: service.order || 0,
                published: service.published ?? false,
                visibility_mode: service.visibility_mode || 'specific_weeks',
                ru_title: service.ru_title || "",
                ru_description: service.ru_description || "",
                ru_timeline_notes: service.ru_timeline_notes || "",
            };

            console.log(`[Service Create] Attempting to create service "${payload.title}" at ${new Date().toISOString()}`);
            await createService(payload);
            console.log(`[Service Create] Successfully created service "${payload.title}"`);
            await onSave();
            handleDialogClose();
        } catch (err) {
            console.error("[Service Create Error]", err);
            const errorMessage = getApiErrorMessage(err, "Failed to create service");
            alert(errorMessage);
        } finally {
            setSaving(false);
        }
    };

    const handleDialogOpen = async () => {
        setCheckingPerms(true);
        try {
            const requestOptions: MyPermsRequest = { 
                user_assignable_roles: false, 
                event_editor_roles: false, 
                user_role_ids: false 
            };
            const result = await getMyPermissions(requestOptions);
            if (result?.success) {
                if (result?.perms?.admin || result?.perms?.bulletin_editing) {
                    setIsOpen(true);
                    console.log(`[Service Create] Permission check passed at ${new Date().toISOString()}`);
                } else {
                    alert("You must have the Bulletin Editor permission to create services.");
                }
            } else {
                alert(result?.msg || "Permission check failed.");
            }
        } catch (err) {
            console.error("[Service Create Permission Error]", err);
            alert("Error checking permissions.");
        } finally {
            setCheckingPerms(false);
        }
    };

    return (
        <>
            <Button
                variant="outline"
                className="!bg-blue-500 text-white border border-blue-600 shadow-sm hover:bg-blue-600"
                onClick={handleDialogOpen}
                disabled={checkingPerms}
            >
                {checkingPerms ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : "Create Service"}
            </Button>

            <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleDialogClose(); }}>
                <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>New Service</DialogTitle>
                        <DialogDescription className="pt-4">
                            Create a new service for the bulletin timeline.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <label className="flex flex-col">
                            <span className="text-sm font-medium mb-1">Title *</span>
                            <input 
                                className="border p-2 rounded" 
                                placeholder="Title"
                                value={service.title} 
                                onChange={(e) => setService({ ...service, title: e.target.value })} 
                            />
                        </label>

                        <label className="flex flex-col">
                            <span className="text-sm font-medium text-gray-600 mb-1">Title (RU)</span>
                            <input 
                                className="border p-2 rounded" 
                                placeholder="Title (RU)"
                                value={service.ru_title || ''} 
                                onChange={(e) => setService({ ...service, ru_title: e.target.value })} 
                            />
                        </label>

                        <label className="flex flex-col">
                            <span className="text-sm font-medium mb-1">Day of Week *</span>
                            <select
                                className="border p-2 rounded" 
                                value={service.day_of_week || 'Sunday'}
                                onChange={(e) => setService({ ...service, day_of_week: e.target.value })} 
                            >
                                <option value="Monday">Monday</option>
                                <option value="Tuesday">Tuesday</option>
                                <option value="Wednesday">Wednesday</option>
                                <option value="Thursday">Thursday</option>
                                <option value="Friday">Friday</option>
                                <option value="Saturday">Saturday</option>
                                <option value="Sunday">Sunday</option>
                            </select>
                        </label>

                        <label className="flex flex-col">
                            <span className="text-sm font-medium mb-1">Time of Day *</span>
                            <input 
                                type="time"
                                className="border p-2 rounded" 
                                value={service.time_of_day || '10:00'} 
                                onChange={(e) => setService({ 
                                    ...service, 
                                    time_of_day: e.target.value 
                                })} 
                            />
                            <span className="text-xs text-gray-500 mt-1">
                                Recurring weekly service time
                            </span>
                        </label>

                        <label className="flex flex-col">
                            <span className="text-sm font-medium mb-1">Visibility Mode *</span>
                            <select 
                                className="border p-2 rounded" 
                                value={service.visibility_mode || 'always'}
                                onChange={(e) => setService({ 
                                    ...service, 
                                    visibility_mode: e.target.value as 'always' | 'specific_weeks'
                                })}
                            >
                                <option value="always">Always Show</option>
                                <option value="specific_weeks">Specific Week(s)</option>
                            </select>
                            <span className="text-xs text-gray-500 mt-1">
                                Control when this service appears in the bulletin
                            </span>
                        </label>

                        {service.visibility_mode === 'specific_weeks' && (
                            <label className="flex flex-col">
                                <span className="text-sm font-medium mb-1">Display Week *</span>
                                <input 
                                    type="date" 
                                    className="border p-2 rounded" 
                                    value={service.display_week ? 
                                        service.display_week.toISOString().slice(0, 10) 
                                        : ''
                                    } 
                                    onChange={(e) => setService({ 
                                        ...service, 
                                        display_week: e.target.value ? new Date(e.target.value) : new Date() 
                                    })} 
                                />
                                <span className="text-xs text-gray-500 mt-1">
                                    Will be normalized to Monday of the selected week
                                </span>
                            </label>
                        )}

                        <label className="flex flex-col">
                            <span className="text-sm font-medium mb-1">Description</span>
                            <textarea 
                                className="border p-2 rounded" 
                                rows={3}
                                placeholder="Description"
                                value={service.description} 
                                onChange={(e) => setService({ ...service, description: e.target.value })} 
                            />
                        </label>

                        <label className="flex flex-col">
                            <span className="text-sm font-medium text-gray-600 mb-1">Description (RU)</span>
                            <textarea 
                                className="border p-2 rounded" 
                                rows={3}
                                placeholder="Description (RU)"
                                value={service.ru_description || ''} 
                                onChange={(e) => setService({ ...service, ru_description: e.target.value })} 
                            />
                        </label>

                        <label className="flex flex-col">
                            <span className="text-sm font-medium mb-1">Timeline Notes</span>
                            <textarea 
                                className="border p-2 rounded font-mono text-sm" 
                                rows={8}
                                placeholder="Timeline Notes"
                                value={service.timeline_notes} 
                                onChange={(e) => setService({ ...service, timeline_notes: e.target.value })} 
                            />
                            <span className="text-xs text-gray-500 mt-1">
                                Timeline
                            </span>
                        </label>

                        <label className="flex flex-col">
                            <span className="text-sm font-medium text-gray-600 mb-1">Timeline Notes (RU)</span>
                            <textarea 
                                className="border p-2 rounded font-mono text-sm" 
                                rows={8}
                                placeholder="Timeline Notes (RU)"
                                value={service.ru_timeline_notes || ''} 
                                onChange={(e) => setService({ ...service, ru_timeline_notes: e.target.value })} 
                            />
                            <span className="text-xs text-gray-500 mt-1">
                                Timeline
                            </span>
                        </label>

                        <label className="flex flex-col">
                            <span className="text-sm font-medium mb-1">Order</span>
                            <input 
                                type="number"
                                min="0"
                                className="border p-2 rounded" 
                                value={service.order ?? 0} 
                                onChange={(e) => setService({ ...service, order: parseInt(e.target.value) || 0 })} 
                            />
                            <span className="text-xs text-gray-500 mt-1">
                                Lower numbers appear first (can also be reordered via drag-and-drop)
                            </span>
                        </label>

                        <label className="flex items-center space-x-2">
                            <input 
                                type="checkbox" 
                                checked={service.published ?? false} 
                                onChange={(e) => setService({ ...service, published: e.target.checked })} 
                            />
                            <span className="text-sm font-medium">Published</span>
                        </label>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={handleDialogClose} disabled={saving}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                            Create Service
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

export default CreateServiceDialog;
