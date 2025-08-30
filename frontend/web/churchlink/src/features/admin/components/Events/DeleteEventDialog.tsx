import { useState, useEffect } from "react"
import { Button } from "@/shared/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/shared/components/ui/Dialog"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { Trash, Loader2 } from "lucide-react"

import { ChurchEvent } from "@/shared/types/ChurchEvent"
import { deleteEvent } from "@/helpers/EventsHelper"

interface DeleteEventDialogProps {
    event: ChurchEvent
    onSave: () => Promise<void>
}

export function DeleteEventDialog({ event, onSave }: DeleteEventDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [userInput, setUserInput] = useState("")
    const [isDeleteEnabled, setIsDeleteEnabled] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    useEffect(() => {
        setUserInput("")
        setIsDeleteEnabled(false)
    }, [isOpen])

    const handleDialogClose = () => {
        setIsOpen(false)
        setUserInput("")
    }

    const handleDelete = async () => {
        if (userInput === event.name) {
            setIsDeleting(true)
            try {
                await deleteEvent(event.id)
                await onSave()
                handleDialogClose()
            }
            catch {
                alert("Failed to delete event!");
            }

            setIsDeleting(false)
        } else {
            alert("Names do not match. Please try again.")
        }
    }

    useEffect(() => {
        setIsDeleteEnabled(userInput === event.name)
    }, [userInput, event.name])

    return (
        <Dialog open={isOpen} onOpenChange={(open) => setIsOpen(open)}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    className="!bg-white text-red border shadow-sm !hover:bg-red-600"
                    onClick={() => setIsOpen(true)}
                >
                    <Trash />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[100vh] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Delete Event</DialogTitle>
                    <div className="pt-6">
                        <DialogDescription>
                            Are you absolutely sure you want to delete the event "
                            <strong>{event.name}</strong>"? This action cannot be undone. <br />
                            Please type the event name "<strong>{event.name}</strong>" to confirm.
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="delete-confirm">Deletion Confirmation</Label>
                        <small className="text-gray-500 text-xs">
                            Type the name "<strong>{event.name}</strong>" to confirm that you want to delete this event.
                        </small>
                        <Input
                            id="delete-confirm"
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button type="button" onClick={handleDialogClose} disabled={isDeleting}>
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        className="!bg-red-30"
                        onClick={handleDelete}
                        disabled={!isDeleteEnabled || isDeleting}
                    >
                        {isDeleting ? (
                            <>
                                <Loader2 className="animate-spin mr-2 h-4 w-4" />
                                Deleting...
                            </>
                        ) : (
                            "Confirm Delete"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}