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
                name="web_builder_management"
                label="Web Builder Management"
                description="This option grants the user the ability to manage the header and footer of the site, the basic navigational layout, and web builder features."
                value={permissions.web_builder_management}
                onChange={handleChange("web_builder_management")}
                disabled={!editor_permissions.admin && !editor_permissions.web_builder_management}
            />
            <RadioToggler
                name="mobile_ui_management"
                label="Mobile UI Management"
                description="This option grants the user the ability to manage mobile-specific user interface features and configurations."
                value={permissions.mobile_ui_management}
                onChange={handleChange("mobile_ui_management")}
                disabled={!editor_permissions.admin && !editor_permissions.mobile_ui_management}
            />
            <RadioToggler
                name="event_editing"
                label="Event Editor"
                description="This option grants the user the ability to create, edit, delete, and manage events."
                value={permissions.event_editing}
                onChange={handleChange("event_editing")}
                disabled={!editor_permissions.admin && !editor_permissions.event_editing}
            />
            <RadioToggler
                name="sermon_editing"
                label="Sermon Editor"
                description="This option grants the user the ability to create, edit, and manage sermons across the site."
                value={permissions.sermon_editing}
                onChange={handleChange("sermon_editing")}
                disabled={!editor_permissions.admin && !editor_permissions.sermon_editing}
            />
            <RadioToggler
                name="bulletin_editing"
                label="Bulletin Editor"
                description="This option grants the user the ability to create, edit, and manage bulletins across the site."
                value={permissions.bulletin_editing}
                onChange={handleChange("bulletin_editing")}
                disabled={!editor_permissions.admin && !editor_permissions.bulletin_editing}
            />
            <RadioToggler
                name="media_management"
                label="Media Management"
                description="This option grants the user the ability to add or remove media from the site"
                value={permissions.media_management}
                onChange={handleChange("media_management")}
                disabled={!editor_permissions.admin && !editor_permissions.media_management}
            />
            <RadioToggler
                name="finance"
                label="Finance Manager"
                description="This option grants the user the ability to manage financial settings including PayPal credentials, view donation reports, and configure payment requirements for events."
                value={permissions.finance}
                onChange={handleChange("finance")}
                disabled={!editor_permissions.admin && !editor_permissions.finance}
            />
            <RadioToggler
                name="ministries_management"
                label="Ministries Manager"
                description="This option grants the user the ability to create and manage ministry categorizations that can be applied to events, forms, sermons, and other content."
                value={permissions.ministries_management}
                onChange={handleChange("ministries_management")}
                disabled={!editor_permissions.admin && !editor_permissions.ministries_management}
            />
            <RadioToggler
                name="forms_management"
                label="Forms Manager"
                description="This option grants the user the ability to build forms, collect submissions, and manage form-related functionality."
                value={permissions.forms_management}
                onChange={handleChange("forms_management")}
                disabled={!editor_permissions.admin && !editor_permissions.forms_management}
            />
            <RadioToggler
                name="bible_plan_management"
                label="Bible Plan Manager"
                description="This option grants the user the ability to create, edit, and publish Bible reading plans for the community."
                value={permissions.bible_plan_management}
                onChange={handleChange("bible_plan_management")}
                disabled={!editor_permissions.admin && !editor_permissions.bible_plan_management}
            />
            <RadioToggler
                name="notification_management"
                label="Notification Manager"
                description="This option grants the user the ability to send and manage notifications and announcements to users."
                value={permissions.notification_management}
                onChange={handleChange("notification_management")}
                disabled={!editor_permissions.admin && !editor_permissions.notification_management}
            />

        </div>
    )
}