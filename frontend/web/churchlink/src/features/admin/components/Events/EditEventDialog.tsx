import { useState, useEffect } from "react"
import { Button } from "@/shared/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/components/ui/Dialog"
import { Loader2, Pencil } from "lucide-react"
import { ChurchEvent } from "@/shared/types/ChurchEvent"
import { EventTextInputs } from "./EventTextInputs"
import { EventDatePicker } from "./EventDatePicker"
import { EventPersonType } from "./EventPersonType"
import { EventRSVPSelection } from "./EventRSVPSelection"
import { EventMinistryDropdown } from "./EventMinistryDropdown"
import { EventImageSelector } from "./EventImageSelector"
import { handleEventEdit } from "@/helpers/EventsHelper"
import { EventManagementOptions } from "./EventManagementOptions"
import { MyPermsRequest } from "@/shared/types/MyPermsRequest"
import { getMyPermissions } from "@/helpers/UserHelper"

interface EditEventDialogProps {
    event: ChurchEvent
    onSave: () => Promise<void>
}

const requestOptions: MyPermsRequest = {
    user_assignable_roles: true,
    event_editor_roles: true,
    user_role_ids: true,
}

export function EditEventDialog({ event: originalEvent, onSave }: EditEventDialogProps) {
    const [event, setEvent] = useState<ChurchEvent>(originalEvent)
    const [isOpen, setIsOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [rolesEnabled, setRolesEnabled] = useState(false)
    const [checkingPerms, setCheckingPerms] = useState(false)
    const [roleList, setRoleList] = useState<any[]>([]);

    useEffect(() => {
        if (isOpen) setEvent(originalEvent)
    }, [originalEvent, isOpen])

    const handleDialogClose = () => {
        setEvent(originalEvent)
        setIsOpen(false)
        setRolesEnabled(false)
    }

    const handleSaveChanges = async () => {
        setSaving(true)
        try {
            await handleEventEdit(event)
            await onSave()
            handleDialogClose()
        } catch (err: any) {
            console.error("Failed to edit event:", err)
            alert(err?.message || "Something went wrong.")
        }
        setSaving(false)
    }


    const handleTextInputChange = (field: keyof ChurchEvent, value: string) => {
        setEvent({ ...event, [field]: value })
    }

    const handleDialogOpen = async () => {
        setCheckingPerms(true);
        try {
            const result = await getMyPermissions(requestOptions);
            const user_roles = result?.user_role_ids || [];

            if (result?.success) {
                const available_roles = result?.user_assignable_roles
                setRoleList(available_roles)
                if (result?.perms.admin || result?.perms.event_management) {
                    setIsOpen(true)
                    setRolesEnabled(true)
                } else if (available_roles.length > 0) {
                    const hasPermission = event.roles.some(roleId => user_roles.includes(roleId))

                    if (hasPermission) {
                        setIsOpen(true)
                        setRolesEnabled(true)
                    } else {
                        alert("You do not have one of the necessary permission roles associated with this event! This requirement can only be circumvented if you are an Administrator or Event Manager")
                    }
                } else {
                    alert("There are no permission roles with the Event Editor permission! Please create at least one such role to edit events")
                }
            } else {
                alert(result?.msg || "You don't have permission to edit events.")
            }
        } catch (err) {
            alert("An error occurred while checking your permissions.")
            console.error(err)
        }
        setCheckingPerms(false)
    };

    return (
        <>
            {/* Physical Manifestation of the Dialog, the Button that opens it */}
            <Button
                variant="ghost"
                size="sm"
                onClick={handleDialogOpen}
                disabled={checkingPerms}
            >
                {checkingPerms ? (
                    <>
                        <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    </>
                ) : (
                    <Pencil className="h-4 w-4" />
                )}
            </Button>

            <Dialog open={isOpen} onOpenChange={handleDialogClose}>
                <DialogContent className="sm:max-w-[100vh] max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-800 text-black dark:text-white border border-gray-200 dark:border-gray-600">
                    <DialogHeader>
                        <DialogTitle className="text-black dark:text-white">Edit Event</DialogTitle>
                        <div className="pt-6">
                            <DialogDescription className="text-muted-foreground dark:text-muted-foreground/80">
                                Make changes to the event details. Click "Save changes" when done.
                            </DialogDescription>
                        </div>
                    </DialogHeader>
                    <div className="grid gap-4 py-4 bg-white dark:bg-gray-800">
                        <EventTextInputs
                            name={event.name}
                            ru_name={event.ru_name}
                            description={event.description}
                            ru_description={event.ru_description}
                            location={event.location}
                            onChange={handleTextInputChange}
                        />
                        <EventImageSelector
                            value={event.image_url}
                            onChange={(url) => setEvent({ ...event, image_url: url })}
                        />
                        <EventDatePicker
                            date={event.date}
                            recurring={event.recurring}
                            onDateChange={(d) => setEvent({ ...event, date: d })}
                            onRecurrenceChange={(val) =>
                                setEvent({ ...event, recurring: val as ChurchEvent["recurring"] })
                            }
                        />
                        <EventMinistryDropdown
                            selected={event.ministry}
                            ministries={[
                                "Youth", "Children", "Women", "Men", "Family",
                                "Worship", "Outreach", "Bible Study", "Young Adults", "Seniors"
                            ]}
                            onChange={(updated) =>
                                setEvent((prev) => ({ ...prev, ministry: updated }))
                            }
                        />
                        <EventPersonType
                            min_age={event.min_age}
                            max_age={event.max_age}
                            gender={event.gender as "all" | "male" | "female"}
                            onChange={(field, value) =>
                                setEvent({
                                    ...event,
                                    [field]: typeof value === "number" && isNaN(value) ? undefined : value,
                                })
                            }
                        />
                        <EventRSVPSelection
                            rsvp={event.rsvp}
                            price={event.price}
                            spots={event.spots}
                            onChange={(field, value) =>
                                setEvent((prev) => ({
                                    ...prev,
                                    [field]: typeof value === "number" && isNaN(value) ? 0 : value,
                                }))
                            }
                        />

                        <EventManagementOptions
                            event={event}
                            setEvent={setEvent}
                            rawRoles={roleList}
                            roleSwitchEnabled={rolesEnabled}
                        />
                    </div>

                    <DialogFooter className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-600">
                        <Button type="button" onClick={handleDialogClose} disabled={saving} className="dark:bg-gray-700 dark:border-gray-600 dark:text-white">Cancel</Button>
                        <Button type="button" onClick={handleSaveChanges} disabled={saving} className="dark:bg-blue-600 dark:border-blue-500 dark:text-white">
                            {saving ? (
                                <>
                                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                                    Saving...
                                </>
                            ) : (
                                "Save changes"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}