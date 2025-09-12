import { useState, useEffect } from "react"
import { Button } from "@/shared/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/components/ui/dialog"
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
    user_assignable_roles: false,
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

    return (
        <>
            {/* Physical Manifestation of the Dialog, the Button that opens it */}
            <Button
                variant="outline"
                className="!bg-white text-black border shadow-sm hover:bg-blue-600"
                onClick={async () => {
                    setCheckingPerms(true)
                    try {
                        const result = await getMyPermissions(requestOptions)

                        if (result?.success) {
                            if (result?.perms.admin || result?.perms.event_editing || result?.perms.event_management) {
                                const available_roles = result?.event_editor_roles
                                const user_roles = result?.user_role_ids
                                setRoleList(available_roles)
                                if (available_roles.length > 0) {
                                    if (result?.perms.admin || result?.perms.event_management) {
                                        setIsOpen(true)
                                        setRolesEnabled(true)
                                    }
                                    else {
                                        const hasPermission = event.roles.some(roleId => user_roles.includes(roleId))

                                        if (hasPermission) {
                                            setIsOpen(true)
                                        } else {
                                            alert("You do not have one of the necessary permission roles associated with this event! This requirement can only be circumvented if you are an Administrator or Event Manager")
                                        }
                                    }
                                }
                                else {
                                    alert("There are no permission roles with the Event Editor permission! Please create at least one such role to edit events")
                                }

                            }
                            else {
                                alert("You must be an Administrator, Event Editor, or Event Manager to edit events.")
                            }
                        }
                        else {
                            alert(result?.msg || "You don't have permission to edit events.")
                        }
                    } catch (err) {
                        alert("An error occurred while checking your permissions.")
                        console.error(err)
                    }
                    setCheckingPerms(false)
                }}
                disabled={checkingPerms}
            >
                {checkingPerms ? (
                    <>
                        <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    </>
                ) : (
                    <Pencil />
                )}
            </Button>

            <Dialog open={isOpen} onOpenChange={handleDialogClose}>
                <DialogContent className="sm:max-w-[100vh] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Event</DialogTitle>
                        <div className="pt-6">
                            <DialogDescription>
                                Make changes to the event details. Click "Save changes" when done.
                            </DialogDescription>
                        </div>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
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

                    <DialogFooter>
                        <Button type="button" onClick={handleDialogClose} disabled={saving}>Cancel</Button>
                        <Button type="button" onClick={handleSaveChanges} disabled={saving}>
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