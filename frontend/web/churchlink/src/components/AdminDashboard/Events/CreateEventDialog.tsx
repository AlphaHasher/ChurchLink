import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/Dialog"
import { Loader2 } from "lucide-react"

import { ChurchEvent } from "@/types/ChurchEvent"
import { EventTextInputs } from "./EventTextInputs"
import { EventDatePicker } from "./EventDatePicker"
import { EventPersonType } from "./EventPersonType"
import { EventRSVPSelection } from "./EventRSVPSelection"
import { EventMinistryDropdown } from "./EventMinistryDropdown"
import { EventImageSelector } from "./EventImageSelector"
import { handleEventCreation } from "@/helpers/EventsHelper"

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
        recurring: "never",
        ministry: [],
        min_age: 0,
        max_age: 100,
        gender: "all",
        image_url: "",
        thumbnail_url: "",
    }

    const [event, setEvent] = useState<ChurchEvent>(initialEvent)
    const [isOpen, setIsOpen] = useState(false)
    const [saving, setSaving] = useState(false)

    const handleDialogClose = () => {
        setEvent(initialEvent)
        setIsOpen(false)
    }

    const handleSaveChanges = async () => {
        setSaving(true)
        try {
            await handleEventCreation(event)
            await onSave()
            handleDialogClose()
        } catch (err) {
            console.error("❌ Failed to process event:", err)
        }
        setSaving(false)
    }

    const handleDialogCloseChange = (open: boolean) => {
        if (!open) {
            handleDialogClose()
        }
        setIsOpen(open)
    }

    const handleTextInputChange = (field: keyof ChurchEvent, value: string) => {
        setEvent({ ...event, [field]: value })
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleDialogCloseChange}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    className="!bg-blue-500 text-white border border-blue-600 shadow-sm hover:bg-blue-600"
                    onClick={() => setIsOpen(true)}
                >
                    Create New Event
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[100vh] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>New Event</DialogTitle>
                    <div className="pt-6">
                        <DialogDescription>
                            Create your new event by filling out the information below
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
                            setEvent({ ...event, recurring: val as "never" | "weekly" | "monthly" | "yearly" })
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
    )
}
