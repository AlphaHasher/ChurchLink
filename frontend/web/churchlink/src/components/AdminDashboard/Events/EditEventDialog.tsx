import { useState, useEffect } from "react"
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
import { Loader2, Pencil } from "lucide-react"
import { ChurchEvent } from "@/types/ChurchEvent"
import { EventTextInputs } from "./EventTextInputs"
import { EventDatePicker } from "./EventDatePicker"
import { EventPersonType } from "./EventPersonType"
import { EventRSVPSelection } from "./EventRSVPSelection"
import { EventMinistryDropdown } from "./EventMinistryDropdown"
import { EventImageSelector } from "./EventImageSelector"
import { handleEventEdit } from "@/helpers/EventsHelper"

interface EditEventDialogProps {
    event: ChurchEvent
    onSave: () => Promise<void>
}

export function EditEventDialog({ event: originalEvent, onSave }: EditEventDialogProps) {
    const [event, setEvent] = useState<ChurchEvent>(originalEvent)
    const [isOpen, setIsOpen] = useState(false)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (isOpen) setEvent(originalEvent)
    }, [originalEvent, isOpen])

    const handleDialogClose = () => {
        setEvent(originalEvent)
        setIsOpen(false)
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
        <Dialog open={isOpen} onOpenChange={(open) => setIsOpen(open)}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    className="!bg-white text-black border shadow-sm hover:bg-blue-600"
                    onClick={() => setIsOpen(true)}
                >
                    <Pencil />
                </Button>
            </DialogTrigger>
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