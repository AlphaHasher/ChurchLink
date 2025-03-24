import { Label } from "@/components/ui/label"
import { AccountPermissions } from "@/types/AccountPermissions"

type RadioTogglerProps = {
    name: string
    label: string
    description: string
    value: boolean
    onChange: (value: boolean) => void
}

const RadioToggler = ({ name, label, description, value, onChange }: RadioTogglerProps) => {
    return (
        <div className="grid gap-2">
            <Label htmlFor={name}>{label}</Label>
            <small className="text-gray-500 text-xs">{description}</small>

            <div className="flex space-x-4">
                <label className="flex items-center">
                    <input
                        type="radio"
                        name={name}
                        checked={value === true}
                        onChange={() => onChange(true)}
                        className="mr-2"
                    />
                    Yes
                </label>
                <label className="flex items-center">
                    <input
                        type="radio"
                        name={name}
                        checked={value === false}
                        onChange={() => onChange(false)}
                        className="mr-2"
                    />
                    No
                </label>
            </div>
        </div>
    )
}

type PermissionTogglersProps = {
    permissions: AccountPermissions
    onChange: (updatedPermissions: AccountPermissions) => void
}

export const PermissionTogglers = ({ permissions, onChange }: PermissionTogglersProps) => {
    const handleChange = (key: keyof AccountPermissions) => (value: boolean) => {
        onChange({ ...permissions, [key]: value })  // Update the permission value while keeping other values intact
    }

    return (
        <div className="grid gap-4 py-4">
            <RadioToggler
                name="isAdmin"
                label="Administrator Privileges"
                description="This option grants the user complete site access, without any restriction"
                value={permissions.isAdmin}
                onChange={handleChange("isAdmin")}
            />
            <RadioToggler
                name="manageWholeSite"
                label="Site Management"
                description="This option grants the user the ability to change the core layout of the site, more than just static pages and events"
                value={permissions.manageWholeSite}
                onChange={handleChange("manageWholeSite")}
            />
            <RadioToggler
                name="editAllEvents"
                label="Event Moderator"
                description="This option grants the user the ability to manage all events, regardless of specific permission tags"
                value={permissions.editAllEvents}
                onChange={handleChange("editAllEvents")}
            />
            <RadioToggler
                name="editAllPages"
                label="Page Moderator"
                description="This option grants the user the ability to manage all pages (but not the core site layout), regardless of specific permission tags"
                value={permissions.editAllPages}
                onChange={handleChange("editAllPages")}
            />
            <RadioToggler
                name="accessFinances"
                label="Financial Access"
                description="This option grants the user the ability to access financial information and pages"
                value={permissions.accessFinances}
                onChange={handleChange("accessFinances")}
            />
            <RadioToggler
                name="manageNotifications"
                label="Notification Management"
                description="This option grants the user the ability to manage push notifications sent to mobile"
                value={permissions.manageNotifications}
                onChange={handleChange("manageNotifications")}
            />
            <RadioToggler
                name="manageMediaContent"
                label="Media Management"
                description="This option grants the user the ability to add or remove media from the site"
                value={permissions.manageMediaContent}
                onChange={handleChange("manageMediaContent")}
            />
            <RadioToggler
                name="manageBiblePlan"
                label="Bible Plan Management"
                description="This option grants the user the ability to edit the church Bible Reading Plan"
                value={permissions.manageBiblePlan}
                onChange={handleChange("manageBiblePlan")}
            />
            <RadioToggler
                name="manageUserPermissions"
                label="Manage User Permissions"
                description="This option grants the user the ability to create and edit permissions, and grant permissions to users. This user can only bestow permissions they themselves have access to."
                value={permissions.manageUserPermissions}
                onChange={handleChange("manageUserPermissions")}
            />
        </div>
    )
}