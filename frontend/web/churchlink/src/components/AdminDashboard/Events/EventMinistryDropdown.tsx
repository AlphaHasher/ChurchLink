import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"
import { Label } from "@/components/ui/label"

interface EventMinistryDropdownProps {
    selected: string[]
    onChange: (updated: string[]) => void
    ministries: string[]
}

export function EventMinistryDropdown({
    selected,
    onChange,
    ministries,
}: EventMinistryDropdownProps) {
    const toggle = (value: string) => {
        if (selected.includes(value)) {
            onChange(selected.filter((m) => m !== value))
        } else {
            onChange([...selected, value])
        }
    }

    return (
        <div className="flex flex-col gap-2">
            <Label className="text-sm">Select Ministries</Label>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        className="w-[300px] justify-between !bg-white text-black border border-gray-300 shadow-sm hover:bg-gray-100"
                    >
                        {selected.length > 0
                            ? `${selected.length} selected`
                            : "Choose ministries"}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="start"
                    side="bottom"
                    sideOffset={4}
                    className="max-h-64 overflow-y-auto w-[300px]"
                >
                    {ministries.map((ministry) => (
                        <DropdownMenuCheckboxItem
                            key={ministry}
                            checked={selected.includes(ministry)}
                            onCheckedChange={() => toggle(ministry)}
                            onSelect={(e) => e.preventDefault()}
                            className="capitalize data-[state=checked]:!bg-blue-500 data-[state=checked]:!text-white focus:!bg-gray-100"
                        >
                            {ministry}
                        </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}
