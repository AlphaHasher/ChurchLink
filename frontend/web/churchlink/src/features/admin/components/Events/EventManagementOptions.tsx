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
                <Label className="font-semibold">{roleSwitchEnabled ? `Assign Roles to Event` : `Assign Roles to Event (Not Admin/Event Manager)`}  :</Label>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        {roleSwitchEnabled ? <Button variant="outline" className="!bg-white flex items-center gap-2">
                            {selectedRoleNames.length > 0
                                ? `${selectedRoleNames.length} selected`
                                : "Set Roles"} <ChevronDown />
                        </Button> : <Button variant="outline" className="!bg-white flex items-center gap-2" disabled>
                            {selectedRoleNames.length > 0
                                ? `${selectedRoleNames.length} selected`
                                : "Set Roles"} <ChevronDown />
                        </Button>}


                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        {rolePerms.map((perm) => (
                            <DropdownMenuCheckboxItem
                                key={perm._id}
                                checked={selectedRoleNames.includes(perm.name)}
                                onClick={(e) => handleCheckboxClick(e, perm.name)}
                            >
                                {perm.name}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Published Toggle */}
            <div className="flex flex-col gap-2">
                <Label htmlFor="published" className="text-sm">Published</Label>
                <div className="flex items-center space-x-2">
                    <Switch
                        id="published"
                        checked={event.published}
                        onCheckedChange={handlePublishedToggle}
                        className="!bg-gray-300 data-[state=checked]:!bg-blue-500 !ring-0 !outline-none"
                    />
                    <span className="text-sm">{event.published ? "Yes" : "No"}</span>
                </div>
            </div>
        </div>
    )
}