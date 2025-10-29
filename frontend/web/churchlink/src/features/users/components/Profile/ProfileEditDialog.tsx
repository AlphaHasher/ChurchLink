import * as React from "react";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle, DialogTrigger,
} from "@/shared/components/ui/Dialog";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Input } from "@/shared/components/ui/input";
import { PersonInfo, PersonInfoInput, Gender } from "./PersonInfoInput";
import { useLocalize } from "@/shared/utils/localizationUtils";

import { updateProfileInfo } from "@/helpers/UserHelper";
import { ProfileInfo as ApiPersonalInfo } from "@/shared/types/ProfileInfo";

type ProfileEditDialogProps = {
    email: string;
    membership: boolean;
    initialPerson: PersonInfo;
    onUpdated?: (p: ApiPersonalInfo) => void;
    className?: string;
};

export const ProfileEditDialog: React.FC<ProfileEditDialogProps> = ({
    email,
    membership,
    initialPerson,
    onUpdated,
    className,
}) => {
    const [open, setOpen] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [person, setPerson] = React.useState<PersonInfo>(initialPerson);
    const localize = useLocalize();

    React.useEffect(() => setPerson(initialPerson), [initialPerson]);

    const toApiPayload = (p: PersonInfo): ApiPersonalInfo => {
        const yyyy = parseInt(p.dob.yyyy || "0", 10);
        const mm = parseInt(p.dob.mm || "0", 10);
        const dd = parseInt(p.dob.dd || "0", 10);
        const valid = yyyy > 0 && mm > 0 && dd > 0;

        return {
            first_name: p.firstName,
            last_name: p.lastName,
            email,
            membership,
            birthday: valid ? new Date(yyyy, mm - 1, dd) : null,
            gender: (p.gender as Gender) || null,
        };
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const res = await updateProfileInfo(toApiPayload(person));
            if (!res.success || !res.profile) {
                alert(res.msg || "Failed to update profile info.");
                return;
            }
            onUpdated?.(res.profile);
            setOpen(false);
        } catch (e) {
            console.error(e);
            alert("Failed to update profile info.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="w-full bg-blue-600 text-white hover:bg-blue-700">
                    {localize("Update My Information")}
                </Button>
            </DialogTrigger>

            <DialogContent className={["sm:max-w-lg", className].filter(Boolean).join(" ")}>
                <DialogHeader>
                    <DialogTitle>{localize("Update information")}</DialogTitle>
                    <DialogDescription>
                        {localize("Make changes to your profile details. Your email is read-only.")}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email Used</Label>
                        <Input id="email" value={email} disabled />
                        <p className="text-sm text-muted-foreground">
                            Your account’s email cannot be readily changed like the rest of your information{" "}
                            <a href="#" className="underline underline-offset-4 hover:no-underline">
                                For assistance in changing your email, please click here
                            </a>.
                        </p>
                    </div>

                    <PersonInfoInput value={person} onChange={setPerson} idPrefix="self" />
                </div>

                <DialogFooter>
                    <Button type="button" onClick={handleSave} disabled={saving}>
                        {saving ? localize("Saving...") : localize("Save changes")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};