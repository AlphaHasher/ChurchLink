import { useState, useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/shared/components/ui/Dialog';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

import { ChurchEvent } from "@/shared/types/ChurchEvent"
import { GenderOption } from "./EventPersonType"
import { EventTextInputs } from "./EventTextInputs"
import { EventDatePicker } from "./EventDatePicker"
import { EventPersonType } from "./EventPersonType"
import { EventRSVPSelection } from "./EventRSVPSelection"
import { EventMinistryDropdown } from "./EventMinistryDropdown"
import { EventImageSelector } from "./EventImageSelector"
import { EventPaymentSettings } from "./EventPaymentSettings"
import { handleEventCreation } from "@/helpers/EventsHelper"
import { getMyPermissions } from "@/helpers/UserHelper"
import { MyPermsRequest } from "@/shared/types/MyPermsRequest"
import { EventManagementOptions } from "./EventManagementOptions"

interface CreateEventProps {
    onSave: () => Promise<void>;
}

export function CreateEventDialog({ onSave }: CreateEventProps) {
    const initialEvent: ChurchEvent = {
        id: "",
        name: "",
        ru_name: "",
        description: "",
        ru_description: "",
        date: new Date(),
        location: "",
        price: 0,
        spots: 0,
        rsvp: false,
        recurring: "never" as const,
        ministry: [] as string[],
        min_age: 0,
        max_age: 100,
        gender: "all" as const,
        image_url: "",
        roles: [] as string[],
        published: true,
        // Payment processing fields
        payment_options: [],
        refund_policy: "",
    }

    const requestOptions: MyPermsRequest = {
        user_assignable_roles: true,
        event_editor_roles: true,
        user_role_ids: true,
    }

    const [event, setEvent] = useState<ChurchEvent>(initialEvent)
    const [isOpen, setIsOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [checkingPerms, setCheckingPerms] = useState(false)
    const [roleList, setRoleList] = useState<any[]>([]);

    useEffect(() => {
        if (isOpen) setEvent(initialEvent)
    }, [isOpen])

    const handleDialogClose = () => {
        setEvent(initialEvent)
        setIsOpen(false)
    }

    const handleSaveChanges = async () => {
        setSaving(true)
        try {
            // Validate payment options for paid events
            if (event.price > 0 && (!event.payment_options || event.payment_options.length === 0)) {
                alert("Paid events must have at least one payment option selected (PayPal or Pay at Door)")
                setSaving(false)
                return
            }
            
            await handleEventCreation(event)
            await onSave()
            handleDialogClose()
        } catch (err: any) {
            console.error("Failed to create event:", err)
            alert(err?.message || "Something went wrong.")
        }
        setSaving(false)
    }

    const handleDialogCloseChange = (open: boolean) => {
        if (!open) {
            handleDialogClose()
        }
        setIsOpen(open)
    }

    const handleTextInputChange = <K extends keyof ChurchEvent>(field: K, value: ChurchEvent[K]) => {
        setEvent({ ...event, [field]: value })
    }

    const handleArrayChange = <K extends 'ministry' | 'roles'>(field: K, value: string[]) => {
        setEvent({ ...event, [field]: value as ChurchEvent[K] })
    }

    return (
        <>
            {/* Physical Manifestation of the Dialog, the Button that opens it */}
            <Button
                variant="outline"
                className={cn(
                    "!bg-blue-500 text-white border border-blue-600 shadow-sm hover:bg-blue-600",
                    "dark:!bg-blue-600 dark:border-blue-500 dark:text-white dark:hover:bg-blue-700"
                )}
                onClick={async () => {
                    setCheckingPerms(true)
                    try {
                        const result = await getMyPermissions(requestOptions)

                        if (result?.success) {
                            if (result?.perms.admin || result?.perms.event_editing || result?.perms.event_management) {
                                const available_roles = result?.user_assignable_roles
                                setRoleList(available_roles)
                                if (result?.perms.admin || result?.perms.event_management) {
                                    setIsOpen(true)
                                } else if (available_roles.length > 0) {
                                    setIsOpen(true)
                                } else {
                                    alert("There are no permission roles with the Event Editor permission! Please create at least one such role to create events")
                                }

                            } else {
                                alert("You must be an Administrator, Event Editor, or Event Manager to create new events.")
                            }
                        } else {
                            alert(result?.msg || "You don't have permission to create new events.")
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
                        Checking...
                    </>
                ) : (
                    "Create New Event"
                )}
            </Button>

            <Dialog open={isOpen} onOpenChange={handleDialogCloseChange}>
                <DialogContent className={cn(
                    "sm:max-w-[100vh] max-h-[80vh] overflow-y-auto",
                    "bg-white dark:bg-gray-800 text-black dark:text-white",
                    "border border-gray-200 dark:border-gray-600"
                )}>
                    <DialogHeader>
                        <DialogTitle className="text-black dark:text-white">New Event</DialogTitle>
                        <div className="pt-6">
                            <DialogDescription className="text-muted-foreground dark:text-muted-foreground/80">
                                Create your new event by filling out the information below
                            </DialogDescription>
                        </div>
                    </DialogHeader>
                    <div className={cn(
                        "grid gap-4 py-4",
                        "bg-white dark:bg-gray-800"
                    )}>
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
                            onChange={(url) => handleTextInputChange('image_url' as keyof ChurchEvent, url)}
                        />
                        <EventDatePicker
                            date={event.date}
                            recurring={event.recurring}
                            onDateChange={(d) => handleTextInputChange('date' as keyof ChurchEvent, d)}
                            onRecurrenceChange={(val) => handleTextInputChange('recurring' as keyof ChurchEvent, val)}
                        />
                        <EventMinistryDropdown
                            selected={event.ministry}
                            ministries={[
                                "Youth", "Children", "Women", "Men", "Family",
                                "Worship", "Outreach", "Bible Study", "Young Adults", "Seniors"
                            ]}
                            onChange={(updated) => handleArrayChange('ministry', updated)}
                        />
                        <EventPersonType
                            min_age={event.min_age}
                            max_age={event.max_age}
                            gender={event.gender}
                            onChange={(field: "min_age" | "max_age" | "gender", value: number | GenderOption) => {
                                if (field === 'gender') {
                                    handleTextInputChange('gender' as keyof ChurchEvent, value)
                                } else {
                                    handleTextInputChange(field as keyof ChurchEvent, value as number)
                                }
                            }}
                        />
                        <EventRSVPSelection
                            rsvp={event.rsvp}
                            price={event.price}
                            spots={event.spots}
                            onChange={(field: "rsvp" | "price" | "spots", value: boolean | number) => {
                                if (field === 'rsvp') {
                                    handleTextInputChange('rsvp' as keyof ChurchEvent, value as boolean)
                                } else if (field === 'price') {
                                    handleTextInputChange('price' as keyof ChurchEvent, value as number)
                                } else {
                                    handleTextInputChange('spots' as keyof ChurchEvent, value as number)
                                }
                            }}
                        />

                        <EventPaymentSettings
                            payment_options={event.payment_options}
                            refund_policy={event.refund_policy}
                            price={event.price}
                            onChange={(field, value) => {
                                console.log('CreateEventDialog onChange:', { field, value })
                                setEvent((prev) => {
                                    const updated = {
                                        ...prev,
                                        [field]: value,
                                    }
                                    console.log('Updated event state:', updated)
                                    return updated
                                })
                            }}
                        />

                        <EventManagementOptions
                            event={event}
                            setEvent={setEvent}
                            rawRoles={roleList}
                            roleSwitchEnabled={true}
                        />
                    </div>
                    <DialogFooter className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-600">
                        <Button type="button" onClick={handleDialogClose} variant="outline" disabled={saving} className="dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                            Cancel
                        </Button>
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
