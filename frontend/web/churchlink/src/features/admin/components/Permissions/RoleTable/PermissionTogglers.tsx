import { Label } from "@/shared/components/ui/label"
import { AccountPermissions, PermMask } from "@/shared/types/AccountPermissions"

type RadioTogglerProps = {
    name: string
    label: string
    description: string
    value: boolean
    onChange: (value: boolean) => void
    disabled?: boolean
}

const RadioToggler = ({ name, label, description, value, onChange, disabled = false }: RadioTogglerProps) => {
    return (
        <div className={`grid gap-2 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <Label htmlFor={name}>{label}</Label>
            <small className="text-gray-500 text-xs">{description}</small>

            <div className="flex space-x-4">
                <label className="flex items-center">
                    <input
                        type="radio"
                        name={name}
                        checked={value === true}
                        onChange={() => !disabled && onChange(true)}
                        className="mr-2"
                        disabled={disabled}
                    />
                    Yes
                </label>
                <label className="flex items-center">
                    <input
                        type="radio"
                        name={name}
                        checked={value === false}
                        onChange={() => !disabled && onChange(false)}
                        className="mr-2"
                        disabled={disabled}
                    />
                    No
                </label>
            </div>
        </div>
    )
}

type PermissionTogglersProps = {
    permissions: AccountPermissions
    editor_permissions: PermMask
    onChange: (updatedPermissions: AccountPermissions) => void
}

export const PermissionTogglers = ({ permissions, editor_permissions, onChange }: PermissionTogglersProps) => {
    const handleChange = (key: keyof AccountPermissions) => (value: boolean) => {
        onChange({ ...permissions, [key]: value })  // Update the permission value while keeping other values intact
    }

    return (
        <div className="grid gap-4 py-4">
            <RadioToggler
                name="admin"
                label="Administrator Privileges"
                description="This option grants the user complete site access, without any restriction. This permission level is the only one that can modify admin-level and permissions manager-level roles. This is the highest level of permissions, and roles other than the default Administrator role are not allowed to have it."
                value={permissions.admin}
                onChange={handleChange("admin")}
                disabled={true}
            />
            <RadioToggler
                name="permissions_management"
                label="Permissions Management"
                description="This option grants the user the ability to manage permission roles and assign them to users. This role cannot modify roles that contain Permissions Management or Admin privilleges for safety of preventing overwriting your own permissions. Users with this role can only modify permissions they explicitly have, i.e., you can only assign Event Management if you yourself have the Event Management perm."
                value={permissions.permissions_management}
                onChange={handleChange("permissions_management")}
                disabled={!editor_permissions.admin}
            />
            <RadioToggler
                name="layout_management"
                label="Site Layout Manager"
                description="This option grants the user the ability to manage the header and footer of the site, the basic navigational layout."
                value={permissions.layout_management}
                onChange={handleChange("layout_management")}
                disabled={!editor_permissions.admin && !editor_permissions.layout_management}
            />
            <RadioToggler
                name="event_editing"
                label="Event Editor"
                description="This option grants the user the ability to create or edit events. In addition, this role becomes accessible as being able to be assigned for Events role-based access."
                value={permissions.event_editing}
                onChange={handleChange("event_editing")}
                disabled={!editor_permissions.admin && !editor_permissions.event_editing}
            />
            <RadioToggler
                name="event_management"
                label="Event Moderator"
                description="This option grants the user the ability to manage all events, regardless of specific permission tags. An Event Editor role is still necessary for event creation, but this lets the user manage them all."
                value={permissions.event_management}
                onChange={handleChange("event_management")}
                disabled={!editor_permissions.admin && !editor_permissions.event_management}
            />
            <RadioToggler
                name="media_management"
                label="Media Management"
                description="This option grants the user the ability to add or remove media from the site"
                value={permissions.media_management}
                onChange={handleChange("media_management")}
                disabled={!editor_permissions.admin && !editor_permissions.media_management}
            />

        </div>
    )
}