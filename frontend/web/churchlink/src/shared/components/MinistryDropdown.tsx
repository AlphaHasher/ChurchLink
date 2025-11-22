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

export interface MinistryOption {
    id: string
    name: string
}

export interface MinistryDropdownProps {
    selected: string[] // Array of ministry IDs
    onChange: (updated: string[]) => void // Returns array of ministry IDs
    ministries: MinistryOption[] // Array of {id, name} objects
    label?: string
}

export function MinistryDropdown({
    selected,
    onChange,
    ministries,
    label = "Select Ministries",
}: MinistryDropdownProps) {
    const toggle = (id: string) => {
        if (selected.includes(id)) {
            onChange(selected.filter((m) => m !== id))
        } else {
            onChange([...selected, id])
        }
    }

    return (
        <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium text-black dark:text-white">{label}</Label>
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
                        "max-h-64 overflow-y-auto w-[300px] z-[800]",
                        "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600",
                        "text-black dark:text-white"
                    )}
                >
                    {ministries.map((ministry) => (
                        <DropdownMenuCheckboxItem
                            key={ministry.id}
                            checked={selected.includes(ministry.id)}
                            onCheckedChange={() => toggle(ministry.id)}
                            onSelect={(e) => e.preventDefault()}
                            className={cn(
                                "capitalize",
                                "focus:bg-gray-100 dark:focus:bg-gray-700",
                                "text-black dark:text-white"
                            )}
                        >
                            {ministry.name}
                        </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}
