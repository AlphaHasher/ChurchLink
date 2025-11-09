import { useState } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
import { Edit, Loader2 } from "lucide-react";

import { ServiceBulletin } from "@/shared/types/ChurchBulletin";
import { 
    updateService, 
    deleteService 
} from "@/features/bulletins/api/bulletinsApi";
import { getMyPermissions } from "@/helpers/UserHelper";
import { MyPermsRequest } from '@/shared/types/MyPermsRequest';
import { AccountPermissions } from '@/shared/types/AccountPermissions';
import { Switch } from "@/shared/components/ui/switch";

interface EditServiceDialogProps {
    service: ServiceBulletin;
    onSave: () => Promise<void>;
    permissions: AccountPermissions | null;
}

export function EditServiceDialog({ 
    service: initialService, 
    onSave,
}: EditServiceDialogProps) {
    const [service, setService] = useState<ServiceBulletin>(initialService);
    
    const [isOpen, setIsOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [checkingPerms, setCheckingPerms] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleDialogClose = () => {
        setService(initialService);
        setDeleteConfirmOpen(false);
        setDeleting(false);
        setIsOpen(false);
    };

    const handleSave = async () => {
        if (!service.title?.trim()) {
            toast.error("Title is required");
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
                published: service.published ?? false,
                visibility_mode: service.visibility_mode || 'specific_weeks',
            };

            console.log(`[Service Update] Updating service "${service.title}" (ID: ${service.id}) at ${new Date().toISOString()}`);
            await updateService(service.id, payload);
            console.log(`[Service Update] Successfully updated service "${service.title}"`);
            toast.success("Service updated successfully");
            await onSave();
            handleDialogClose();
        } catch (err) {
            console.error("[Service Update Error]", err);
            toast.error("Failed to update service. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            console.log(`[Service Delete] Deleting service "${service.title}" (ID: ${service.id}) at ${new Date().toISOString()}`);
            await deleteService(service.id);
            console.log(`[Service Delete] Successfully deleted service "${service.title}"`);
            toast.success("Service deleted successfully");
            await onSave();
            setDeleteConfirmOpen(false);
            handleDialogClose();
        } catch (err) {
            console.error("[Service Delete Error]", err);
            toast.error("Failed to delete service. Please try again.");
        } finally {
            setDeleting(false);
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
                    // Reset service state to latest initialService data
                    setService(initialService);
                    setIsOpen(true);
                    console.log(`[Service Edit] Permission check passed for service "${initialService.title}" at ${new Date().toISOString()}`);
                } else {
                    toast.error("You must have the Bulletin Editor permission to edit services.");
                }
            } else {
                toast.error(result?.msg || "Permission check failed.");
            }
        } catch (err) {
            console.error("[Service Edit Permission Error]", err);
            toast.error("Error checking permissions. Please try again.");
        } finally {
            setCheckingPerms(false);
        }
    };

    return (
        <>
            <Button
                size="sm"
                variant="outline"
                onClick={handleDialogOpen}
                disabled={checkingPerms}
                className="h-8 px-3"
                title="Edit Service"
            >
                {checkingPerms ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <Edit className="h-4 w-4" />
                )}
            </Button>

            <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleDialogClose(); }}>
                <DialogContent
                    className={cn(
                        "sm:max-w-[700px] max-h-[80vh] overflow-y-auto",
                        "bg-white dark:bg-gray-800 text-black dark:text-white",
                        "border border-gray-200 dark:border-gray-600"
                    )}
                >
                    <DialogHeader className="space-y-2">
                        <DialogTitle className="text-black dark:text-white">Edit Service</DialogTitle>
                        <DialogDescription className="text-muted-foreground dark:text-muted-foreground/80">
                            Update service information below.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="mb-4 flex flex-wrap items-center justify-end gap-3 border-b border-gray-200 pb-4 dark:border-gray-700">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleDialogClose}
                            disabled={saving || deleting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() => setDeleteConfirmOpen(true)}
                            disabled={saving || deleting}
                        >
                            Delete
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={saving || deleting}
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                                    Saving...
                                </>
                            ) : (
                                'Save changes'
                            )}
                        </Button>
                    </div>

                    <div className={cn(
                        "grid gap-4 py-4",
                        "bg-white dark:bg-gray-800"
                    )}>
                        <div className="rounded border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-800/60">
                            <div className="flex flex-wrap items-center gap-6">
                                <div className="flex flex-col">
                                    <Label htmlFor="edit-service-published" className="mb-1 text-sm">Published</Label>
                                    <div className="flex items-center gap-2">
                                        <Switch
                                            id="edit-service-published"
                                            checked={Boolean(service.published)}
                                            onCheckedChange={(checked) => setService({ ...service, published: checked })}
                                            className="!bg-gray-300 data-[state=checked]:!bg-blue-500 !ring-0 !outline-none"
                                        />
                                        <span className="text-sm">{service.published ? "Yes" : "No"}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="text-xs text-gray-500 grid grid-cols-2 gap-2">
                            <div>Created: {service.created_at ? new Date(service.created_at).toLocaleString() : 'N/A'}</div>
                            <div>Updated: {service.updated_at ? new Date(service.updated_at).toLocaleString() : 'N/A'}</div>
                        </div>

                        <label className="flex flex-col">
                            <span className="text-sm font-medium">Title *</span>
                            <input 
                                className="border p-2 rounded" 
                                placeholder="Title"
                                value={service.title} 
                                onChange={(e) => setService({ ...service, title: e.target.value })} 
                            />
                        </label>

                        <label className="flex flex-col">
                            <span className="text-sm font-medium">Day of Week *</span>
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
                            <span className="text-sm font-medium">Time of Day *</span>
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
                            <span className="text-sm font-medium">Visibility Mode *</span>
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
                                <span className="text-sm font-medium">Display Week *</span>
                                <input 
                                    type="date" 
                                    className="border p-2 rounded" 
                                    value={service.display_week ? 
                                        new Date(service.display_week).toISOString().slice(0, 10) 
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
                            <span className="text-sm font-medium">Description</span>
                            <textarea 
                                className="border p-2 rounded" 
                                rows={3}
                                placeholder="Description"
                                value={service.description || ''} 
                                onChange={(e) => setService({ ...service, description: e.target.value })} 
                            />
                        </label>

                        <label className="flex flex-col">
                            <span className="text-sm font-medium">Timeline Notes</span>
                            <textarea 
                                className="border p-2 rounded font-mono text-sm" 
                                rows={8}
                                placeholder="Timeline Notes"
                                value={service.timeline_notes || ''} 
                                onChange={(e) => setService({ ...service, timeline_notes: e.target.value })} 
                            />
                            <span className="text-xs text-gray-500 mt-1">
                                Timeline
                            </span>
                        </label>

                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete service "{service.title}"? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <Button 
                            variant="outline" 
                            onClick={() => setDeleteConfirmOpen(false)}
                            disabled={deleting}
                        >
                            Cancel
                        </Button>
                        <Button 
                            variant="destructive" 
                            onClick={handleDelete}
                            disabled={deleting}
                        >
                            {deleting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                            Delete
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

export default EditServiceDialog;
