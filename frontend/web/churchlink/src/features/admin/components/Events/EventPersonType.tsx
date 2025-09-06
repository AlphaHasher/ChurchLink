import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group"

type GenderOption = "all" | "male" | "female"

interface EventPersonTypeProps {
    min_age?: number
    max_age?: number
    gender?: GenderOption
    onChange?: (field: "min_age" | "max_age" | "gender", value: number | GenderOption) => void
}

export function EventPersonType({
    min_age,
    max_age,
    gender = "all",
    onChange = () => { },
}: EventPersonTypeProps) {
    return (
        <div className="grid gap-4">
            <div className="flex gap-4">
                <div className="flex-1">
                    <Label htmlFor="min_age">Select Minimum Age</Label>
                    <Input
                        id="min_age"
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={min_age ?? ""}
                        placeholder="Optional"
                        min={0}
                        max={100}
                        onChange={(e) => {
                            const val = e.target.value
                            if (val === "") return onChange("min_age", NaN)
                            const parsed = parseInt(val)
                            if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
                                onChange("min_age", parsed)
                            }
                        }}
                    />
                </div>
                <div className="flex-1">
                    <Label htmlFor="max_age">Select Maximum Age</Label>
                    <Input
                        id="max_age"
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={max_age ?? ""}
                        placeholder="Optional"
                        min={0}
                        max={100}
                        onChange={(e) => {
                            const val = e.target.value
                            if (val === "") return onChange("max_age", NaN)
                            const parsed = parseInt(val)
                            if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
                                onChange("max_age", parsed)
                            }
                        }}
                    />
                </div>
            </div>
            <div>
                <Label className="mb-2 block">Select Gender Allowed for Signup</Label>
                <RadioGroup
                    value={gender}
                    onValueChange={(val) => onChange("gender", val as GenderOption)}
                    className="flex flex-wrap gap-4"
                >
                    {["all", "male", "female"].map((g) => (
                        <div key={g} className="flex items-center space-x-2">
                            <RadioGroupItem
                                value={g}
                                id={g}
                                className="!bg-white !text-black border border-gray-300 data-[state=checked]:!bg-blue-500 data-[state=checked]:!text-white"
                            />
                            <Label htmlFor={g} className="capitalize !text-black text-sm">
                                {g}
                            </Label>
                        </div>
                    ))}
                </RadioGroup>
            </div>
        </div>
    )
}
