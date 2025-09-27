// InitProfileDialog.tsx
import * as React from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/components/ui/Dialog";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Input } from "@/shared/components/ui/input";
import { PersonInfo, PersonInfoInput, Gender } from "./PersonInfoInput";

import { updateProfileInfo, getIsInit } from "@/helpers/UserHelper";
import { ProfileInfo as ApiPersonalInfo } from "@/shared/types/ProfileInfo";
import { useNavigate } from "react-router-dom";
import { auth, signOut } from "@/lib/firebase";

type InitProfileDialogProps = {
    email: string;
    onCompleted?: (p?: ApiPersonalInfo | null) => void;
    className?: string;
};

const EMPTY_PERSON: PersonInfo = {
    firstName: "",
    lastName: "",
    dob: { mm: "", dd: "", yyyy: "" },
    gender: "" as Gender,
};

const toApiPayload = (email: string, p: PersonInfo): ApiPersonalInfo => {
    const yyyy = parseInt(p.dob.yyyy || "0", 10);
    const mm = parseInt(p.dob.mm || "0", 10);
    const dd = parseInt(p.dob.dd || "0", 10);
    const valid = yyyy > 0 && mm > 0 && dd > 0;

    return {
        first_name: p.firstName || "",
        last_name: p.lastName || "",
        email,
        birthday: valid ? new Date(yyyy, mm - 1, dd) : null,
        gender: (p.gender as Gender) || null,
    };
};

export const InitProfileDialog: React.FC<InitProfileDialogProps> = ({
    email,
    onCompleted,
    className,
}) => {
    const [saving, setSaving] = React.useState(false);
    const [person, setPerson] = React.useState<PersonInfo>(EMPTY_PERSON);
    const navigate = useNavigate();

    const handleSave = async () => {
        try {
            setSaving(true);
            const payload = toApiPayload(email, person);
            const res = await updateProfileInfo(payload);

            const initRes = await getIsInit();
            const initNow = initRes['init'];
            if (initNow) {
                onCompleted?.(res.profile);
                navigate("/", { replace: true });
                return;
            }

            if (!res.success) {
                alert(res.msg || "Failed to update profile info.");
                return;
            }

        } catch (e) {
            console.error(e);
            alert("Failed to update profile info.");
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
    };

    return (
        <Dialog open onOpenChange={() => { }}>
            <DialogContent
                className={["sm:max-w-lg", className].filter(Boolean).join(" ")}
                onEscapeKeyDown={(e) => e.preventDefault()}
                onPointerDownOutside={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle>Initialize your profile</DialogTitle>
                    <DialogDescription>Enter your basic information to continue.</DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="init-email">Email</Label>
                        <Input id="init-email" value={email} disabled />
                    </div>

                    <PersonInfoInput value={person} onChange={setPerson} idPrefix="init-self" />
                </div>

                <DialogFooter className="flex gap-3">
                    <Button type="button" variant="secondary" onClick={handleLogout}>
                        Logout
                    </Button>
                    <Button type="button" onClick={handleSave} disabled={saving}>
                        {saving ? "Saving..." : "Save & Continue"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default InitProfileDialog;
