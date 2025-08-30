import { Label } from "@/shared/components/ui/label"
import { AccountPermissions } from "@/shared/types/AccountPermissions"

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
                name="admin"
                label="Administrator Privileges"
                description="This option grants the user complete site access, without any restriction"
                value={permissions.admin}
                onChange={handleChange("admin")}
            />
            <RadioToggler
                name="website_management"
                label="Site Management"
                description="This option grants the user the ability to change the core layout of the site, more than just static pages and events"
                value={permissions.website_management}
                onChange={handleChange("website_management")}
            />
            <RadioToggler
                name="event_management"
                label="Event Moderator"
                description="This option grants the user the ability to manage all events, regardless of specific permission tags"
                value={permissions.event_management}
                onChange={handleChange("event_management")}
            />
            <RadioToggler
                name="page_management"
                label="Page Moderator"
                description="This option grants the user the ability to manage all pages (but not the core site layout), regardless of specific permission tags"
                value={permissions.page_management}
                onChange={handleChange("page_management")}
            />
            <RadioToggler
                name="finance"
                label="Financial Access"
                description="This option grants the user the ability to access financial information and pages"
                value={permissions.finance}
                onChange={handleChange("finance")}
            />
            <RadioToggler
                name="media_management"
                label="Media Management"
                description="This option grants the user the ability to add or remove media from the site"
                value={permissions.media_management}
                onChange={handleChange("media_management")}
            />
        </div>
    )
}