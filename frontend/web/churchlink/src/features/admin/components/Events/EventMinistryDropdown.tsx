import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu"
import { Button } from "@/shared/components/ui/button"
import { ChevronDown } from "lucide-react"
import { Label } from "@/shared/components/ui/label"
import { cn } from "@/lib/utils"

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
            <Label className="text-sm font-medium text-black dark:text-white">Select Ministries</Label>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        className={cn(
                            "w-[300px] justify-between",
                            "bg-white dark:bg-gray-800 text-black dark:text-white",
                            "border border-gray-300 dark:border-gray-600 shadow-sm",
                            "hover:bg-gray-50 dark:hover:bg-gray-700"
                        )}
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
                    className={cn(
                        "max-h-64 overflow-y-auto w-[300px]",
                        "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600",
                        "text-black dark:text-white"
                    )}
                >
                    {ministries.map((ministry) => (
                        <DropdownMenuCheckboxItem
                            key={ministry}
                            checked={selected.includes(ministry)}
                            onCheckedChange={() => toggle(ministry)}
                            onSelect={(e) => e.preventDefault()}
                            className={cn(
                                "capitalize",
                                "focus:bg-gray-100 dark:focus:bg-gray-700",
                                "text-black dark:text-white"
                            )}
                        >
                            {ministry}
                        </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}
