import { useEffect, useState } from "react"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger
} from "@/shared/components/ui/dropdown-menu"
import { Button } from "@/shared/components/ui/button"
import { ChevronDown } from "lucide-react"
import { Switch } from "@/shared/components/ui/switch"
import { Label } from "@/shared/components/ui/label"
import { cn } from "@/lib/utils"

import { ChurchEvent } from "@/shared/types/ChurchEvent"
import { AccountPermissions } from "@/shared/types/AccountPermissions"
import { processFetchedPermData, roleIdListToRoleStringList, roleStringListToRoleIdList } from "@/helpers/DataFunctions"


interface EventManagementOptionsProps {
    event: ChurchEvent;
    setEvent: (e: ChurchEvent) => void;
    rawRoles: any[];
    roleSwitchEnabled: boolean;
}

export function EventManagementOptions({ event, setEvent, rawRoles, roleSwitchEnabled }: EventManagementOptionsProps) {
    const [rolePerms, setRolePerms] = useState<AccountPermissions[]>([])
    const [selectedRoleNames, setSelectedRoleNames] = useState<string[]>([])

    useEffect(() => {
        const perms = processFetchedPermData(rawRoles)
        setRolePerms(perms)
        const selectedNames = roleIdListToRoleStringList(perms, event.roles)
        setSelectedRoleNames(selectedNames)
    }, [rawRoles, event.roles])

    const handleCheckboxClick = (e: React.MouseEvent, roleName: string) => {
        e.preventDefault()
        let updatedNames: string[]
        if (selectedRoleNames.includes(roleName)) {
            updatedNames = selectedRoleNames.filter(r => r !== roleName)
        } else {
            updatedNames = [...selectedRoleNames, roleName]
        }
        const updatedIds = roleStringListToRoleIdList(rolePerms, updatedNames)
        setSelectedRoleNames(updatedNames)
        setEvent({ ...event, roles: updatedIds })
    }

    const handlePublishedToggle = (value: boolean) => {
        setEvent({ ...event, published: value })
    }

    return (
        <div className="flex gap-8 items-end py-2">
            {/* Role Selection Dropdown */}
            <div className="flex flex-col gap-2">
                <Label className={cn(
                    "font-semibold",
                    "text-black dark:text-white"
                )}>
                    {roleSwitchEnabled ? `Assign Roles to Event` : `Assign Roles to Event (Not Admin/Event Manager)`}  :
                </Label>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        {roleSwitchEnabled ? (
                            <Button 
                                variant="outline" 
                                className={cn(
                                    "!bg-white dark:!bg-gray-800 flex items-center gap-2",
                                    "text-black dark:text-white border border-gray-300 dark:border-gray-600",
                                    "shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                                )}
                            >
                                {selectedRoleNames.length > 0
                                    ? `${selectedRoleNames.length} selected`
                                    : "Set Roles"} 
                                <ChevronDown className={cn(
                                    "ml-2 h-4 w-4 shrink-0 opacity-50",
                                    "text-black dark:text-white"
                                )} />
                            </Button>
                        ) : (
                            <Button 
                                variant="outline" 
                                className={cn(
                                    "!bg-white dark:!bg-gray-800 flex items-center gap-2",
                                    "text-black dark:text-white border border-gray-300 dark:border-gray-600",
                                    "shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                                )} 
                                disabled
                            >
                                {selectedRoleNames.length > 0
                                    ? `${selectedRoleNames.length} selected`
                                    : "Set Roles"} 
                                <ChevronDown className={cn(
                                    "ml-2 h-4 w-4 shrink-0 opacity-50",
                                    "text-black dark:text-white"
                                )} />
                            </Button>
                        )}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent 
                        align="start"
                        className={cn(
                            "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600",
                            "text-black dark:text-white"
                        )}
                    >
                        {rolePerms.map((perm) => (
                            <DropdownMenuCheckboxItem
                                key={perm._id}
                                checked={selectedRoleNames.includes(perm.name)}
                                onClick={(e) => handleCheckboxClick(e, perm.name)}
                                className={cn(
                                    "text-black dark:text-white",
                                    "data-[state=checked]:bg-blue-500 data-[state=checked]:text-white",
                                    "focus:bg-gray-100 dark:focus:bg-gray-700",
                                    "hover:bg-gray-50 dark:hover:bg-gray-700"
                                )}
                            >
                                {perm.name}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Published Toggle */}
            <div className="flex flex-col gap-2">
                <Label 
                    htmlFor="published" 
                    className={cn(
                        "text-sm",
                        "text-black dark:text-white"
                    )}
                >
                    Published
                </Label>
                <div className="flex items-center space-x-2">
                    <Switch
                        id="published"
                        checked={event.published}
                        onCheckedChange={handlePublishedToggle}
                        className={cn(
                            "bg-gray-300 dark:bg-gray-700 data-[state=checked]:bg-blue-500 dark:data-[state=checked]:bg-blue-500",
                            "ring-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                            "data-[state=checked]:text-primary-foreground"
                        )}
                    />
                    <span className={cn(
                        "text-sm",
                        "text-black dark:text-white"
                    )}>
                        {event.published ? "Yes" : "No"}
                    </span>
                </div>
            </div>
        </div>
    )
}