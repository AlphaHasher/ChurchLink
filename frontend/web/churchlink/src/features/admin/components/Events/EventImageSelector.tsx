import { useState } from "react"
import { Label } from "@/shared/components/ui/label"
import MediaLibrary from "@/features/admin/pages/MediaLibrary"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/Dialog"
import { Button } from "@/shared/components/ui/button"
import { getAssetUrl } from "@/helpers/MediaInteraction"

interface AssetFile {
    filename: string
    url: string
    folder: string
}

interface EventImageSelectorProps {
    value?: string
    onChange: (url: string) => void
}

export function EventImageSelector({ value, onChange }: EventImageSelectorProps) {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [imageError, setImageError] = useState(false)

    const imageUrl = value ? getAssetUrl(value) : null

    const handleSelectImage = (asset: AssetFile) => {
        onChange(asset.filename)
        setIsModalOpen(false)
        setImageError(false)
    }

    return (
        <div className="flex flex-col gap-4">
            <Label className="text-sm font-medium">Event Image</Label>

            <Button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="w-full justify-start"
            >
                {imageUrl ? "Change Image" : "Select Image from Library"}
            </Button>

            <div className="mt-4">
                <Label className="text-sm">Selected Image Preview:</Label>
                {imageUrl ? (
                    <div className="relative mt-2">
                        <img
                            src={`${imageUrl}?thumbnail=true`}
                            alt="Selected event image"
                            className="rounded border w-48 h-32 object-cover"
                            onError={() => setImageError(true)}
                        />
                        {imageError && (
                            <div className="flex items-center justify-center w-48 h-32 rounded border bg-muted text-muted-foreground text-sm">
                                Image not found or failed to load
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center justify-center w-48 h-32 rounded border bg-muted text-muted-foreground text-sm">
                        No image selected
                    </div>
                )}
            </div>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-6xl max-h-[90vh] p-0">
                    <DialogHeader className="p-4 border-b">
                        <DialogTitle>Select Event Image</DialogTitle>
                    </DialogHeader>
                    <div className="p-4 overflow-auto max-h-[70vh]">
                        <MediaLibrary onSelect={handleSelectImage} selectionMode={true} />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}