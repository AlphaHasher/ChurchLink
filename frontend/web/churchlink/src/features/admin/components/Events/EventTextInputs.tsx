import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"

type EditableField = "name" | "ru_name" | "description" | "ru_description" | "location"

interface EventTextInputsProps {
    name?: string
    ru_name?: string
    description?: string
    ru_description?: string
    location?: string
    onChange?: (field: EditableField, value: string) => void
}

export function EventTextInputs({
    name = "",
    ru_name = "",
    description = "",
    ru_description = "",
    location = "",
    onChange = () => { },
}: EventTextInputsProps) {
    return (
        <div className="grid gap-4">
            <div className="flex gap-4">
                <div className="flex-1">
                    <Label htmlFor="name">Event Title</Label>
                    <small className="text-gray-500 text-xs block mb-1">Enter the title for your Event</small>
                    <Input
                        id="name"
                        value={name}
                        onChange={(e) => onChange("name", e.target.value)}
                    />
                </div>
                <div className="flex-1">
                    <Label htmlFor="ru_name">Event Title (Ru)</Label>
                    <small className="text-gray-500 text-xs block mb-1">Enter the Russian title for your Event</small>
                    <Input
                        id="ru_name"
                        value={ru_name}
                        onChange={(e) => onChange("ru_name", e.target.value)}
                    />
                </div>
            </div>
            <div className="flex gap-4">
                <div className="flex-1">
                    <Label htmlFor="description">Description</Label>
                    <small className="text-gray-500 text-xs block mb-1">Enter the description for your Event</small>
                    <textarea
                        id="description"
                        value={description}
                        onChange={(e) => onChange("description", e.target.value)}
                        className="w-full border border-gray-300 rounded-md p-2 text-sm min-h-[100px] resize-vertical"
                    />
                </div>
                <div className="flex-1">
                    <Label htmlFor="ru_description">Description (Ru)</Label>
                    <small className="text-gray-500 text-xs block mb-1">Enter the Russian description</small>
                    <textarea
                        id="ru_description"
                        value={ru_description}
                        onChange={(e) => onChange("ru_description", e.target.value)}
                        className="w-full border border-gray-300 rounded-md p-2 text-sm min-h-[100px] resize-vertical"
                    />
                </div>
            </div>
            <div className="flex gap-4">
                <div className="flex-1">
                    <Label htmlFor="location">Location</Label>
                    <small className="text-gray-500 text-xs block mb-1">Enter the location infromation for your Event</small>
                    <textarea
                        id="location"
                        value={location}
                        onChange={(e) => onChange("location", e.target.value)}
                        className="w-full border border-gray-300 rounded-md p-2 text-sm min-h-[100px] resize-vertical"
                    />
                </div>
            </div>
        </div>
    )
}
