import { Label } from "@/shared/components/ui/label"
import { Input } from "@/shared/components/ui/input"
import { Switch } from "@/shared/components/ui/switch"

interface EventRSVPSelectionProps {
    rsvp: boolean
    price?: number
    spots?: number
    onChange?: (field: "rsvp" | "price" | "spots", value: boolean | number) => void
}

export function EventRSVPSelection({
    rsvp,
    price,
    spots,
    onChange = () => { },
}: EventRSVPSelectionProps) {
    const handleRSVPChange = (checked: boolean) => {
        onChange("rsvp", checked)
        if (!checked) {
            onChange("price", 0)
            onChange("spots", 0)
        }
    }

    return (
        <div className="flex gap-6 items-start flex-wrap">
            {/* RSVP Toggle */}
            <div className="flex flex-col">
                <Label htmlFor="rsvp" className="mb-1 text-sm">
                    RSVP Required?
                </Label>
                <div className="flex items-center space-x-2">
                    <Switch
                        id="rsvp"
                        checked={rsvp}
                        onCheckedChange={handleRSVPChange}
                        className="!bg-gray-300 data-[state=checked]:!bg-blue-500 !ring-0 !outline-none"
                    />
                    <span className="text-sm">{rsvp ? "Yes" : "No"}</span>
                </div>
            </div>

            {/* Price Input */}
            <div className="flex flex-col">
                <Label htmlFor="price" className="mb-1 text-sm">
                    Price ($)
                </Label>
                <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min={0}
                    value={rsvp ? price ?? "" : ""}
                    placeholder="0.00"
                    disabled={!rsvp}
                    onChange={(e) => {
                        const val = e.target.value
                        const parsed = parseFloat(val)
                        if (!isNaN(parsed) && /^\d*(\.\d{0,2})?$/.test(val)) {
                            onChange("price", parsed)
                        }
                    }}
                />
            </div>

            {/* Seats Input */}
            <div className="flex flex-col">
                <Label htmlFor="spots" className="mb-1 text-sm">
                    Seats Available
                </Label>
                <Input
                    id="spots"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={rsvp ? spots ?? "" : ""}
                    disabled={!rsvp}
                    onChange={(e) => {
                        const val = e.target.value
                        const parsed = parseInt(val)
                        if (!isNaN(parsed)) {
                            onChange("spots", parsed)
                        }
                    }}
                />
            </div>
        </div>
    )
}
