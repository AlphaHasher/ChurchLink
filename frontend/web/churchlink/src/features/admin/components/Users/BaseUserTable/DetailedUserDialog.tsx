import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/components/ui/Dialog";
import { Separator } from "@/shared/components/ui/separator";
import { Label } from "@/shared/components/ui/label";
import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import { User as UserIcon } from "lucide-react";

import { getDetailedUserInfo, patchDetailedUserInfo } from "@/helpers/UserHelper";
import type { DetailedUserInfo } from "@/shared/types/UserInfo";

import { PersonInfoInput, type PersonInfo, Gender } from "../../../../users/components/Profile/PersonInfoInput";

import { toProfileInfo, toContactInfo } from "../../../../../shared/types/ProfileInfo";

type AddressLocal = {
    address: string;
    suite: string;
    city: string;
    state: string;
    country: string;
    postal_code: string;
};

type ContactLocal = {
    phone: string;
    address: AddressLocal;
};

interface DetailedUserDialogProps {
    userId: string;
    onLoaded?: (info: DetailedUserInfo | null) => void;
    onSaved?: () => Promise<void> | void;
}

type DobParts = { mm: string; dd: string; yyyy: string };
const EMPTY_DOB: DobParts = { mm: "", dd: "", yyyy: "" };

function dateToDobParts(birthday: Date | string | null | undefined): DobParts {
    if (!birthday) return EMPTY_DOB;
    const d = birthday instanceof Date ? birthday : new Date(birthday);
    if (Number.isNaN(d.getTime())) return EMPTY_DOB;
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return { mm, dd, yyyy };
}

function dobPartsToISO(d: DobParts): string | null {
    if (!d.yyyy || !d.mm || !d.dd) return null;
    const js = new Date(Number(d.yyyy), Number(d.mm) - 1, Number(d.dd));
    if (Number.isNaN(js.getTime())) return null;
    return js.toISOString();
}

export default function DetailedUserDialog({ userId, onLoaded, onSaved }: DetailedUserDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [info, setInfo] = useState<DetailedUserInfo | null>(null);

    const [membership, setMembership] = useState<boolean>(false);
    const [person, setPerson] = useState<PersonInfo>({
        firstName: "",
        lastName: "",
        dob: { mm: "", dd: "", yyyy: "" },
        gender: "",
    });
    const [contact, setContact] = useState<ContactLocal>({
        phone: "",
        address: {
            address: "",
            suite: "",
            city: "",
            state: "",
            country: "",
            postal_code: "",
        },
    });

    const seqRef = useRef(0);

    const email = useMemo(() => info?.profile.email ?? "", [info]);
    const emailVerified = useMemo(() => Boolean(info?.verified ?? false), [info]);

    const fullName = useMemo(() => {
        const fn = (person.firstName || "").trim();
        const ln = (person.lastName || "").trim();
        return `${fn} ${ln}`.trim() || "User";
    }, [person]);

    const open = () => setIsOpen(true);
    const close = () => {
        setIsOpen(false);
        setEditing(false);
    };
    const handleOpenChange = (open: boolean) => {
        if (!open) close();
        setIsOpen(open);
    };

    const hydrateFrom = (d: DetailedUserInfo) => {
        const mappedProfile = toProfileInfo(d.profile);
        const mappedContact = toContactInfo(d.contact);

        setInfo({
            ...d,
            profile: mappedProfile,
            contact: mappedContact,
        });

        const g: Gender =
            mappedProfile.gender === "M" ? "M" :
                mappedProfile.gender === "F" ? "F" : "";

        setPerson({
            firstName: mappedProfile.first_name ?? "",
            lastName: mappedProfile.last_name ?? "",
            dob: dateToDobParts(mappedProfile.birthday ?? null),
            gender: g,
        });

        setMembership(Boolean(mappedProfile.membership));

        setContact({
            phone: mappedContact.phone ?? "",
            address: {
                address: mappedContact.address.address ?? "",
                suite: mappedContact.address.suite ?? "",
                city: mappedContact.address.city ?? "",
                state: mappedContact.address.state ?? "",
                country: mappedContact.address.country ?? "",
                postal_code: mappedContact.address.postal_code ?? "",
            },
        });
    };

    const fetchDetails = useCallback(async () => {
        setLoading(true);
        setError(null);
        const mySeq = ++seqRef.current;
        try {
            const res = await getDetailedUserInfo(userId);
            if (mySeq !== seqRef.current) return;
            hydrateFrom(res);
            onLoaded?.(res);
        } catch {
            setError("Failed to load user details.");
            onLoaded?.(null);
        } finally {
            setLoading(false);
        }
    }, [userId, onLoaded]);

    useEffect(() => {
        if (isOpen) fetchDetails();
    }, [isOpen, fetchDetails]);

    const handleSave = async () => {
        if (!info) return;
        setSaving(true);

        var update_date = null;
        const isoBirthday = dobPartsToISO(person.dob);
        if (isoBirthday == null) {
            update_date = new Date();

        }
        else {
            update_date = new Date(isoBirthday)
        }

        const payload: DetailedUserInfo = {
            uid: info.uid,
            verified: info.verified,
            profile: {
                email: info.profile.email,
                membership,
                first_name: person.firstName ?? "",
                last_name: person.lastName ?? "",
                gender: (person.gender ?? null) as Gender | null,
                birthday: update_date,
            },
            contact: {
                phone: contact.phone ?? "",
                address: {
                    address: contact.address.address ?? "",
                    suite: contact.address.suite ?? "",
                    city: contact.address.city ?? "",
                    state: contact.address.state ?? "",
                    country: contact.address.country ?? "",
                    postal_code: contact.address.postal_code ?? "",
                },
            },
        };

        const result = await patchDetailedUserInfo(payload);
        setSaving(false);

        if (!result.success) {
            window.alert(result.msg || "Failed to update user.");
            return;
        }
        hydrateFrom(payload);
        close();
        if (onSaved) await onSaved();
    };

    return (
        <>
            <Button
                variant="outline"
                className="!bg-white text-black border shadow-sm hover:bg-blue-600"
                onClick={open}
                aria-label="View details"
                title="View details"
            >
                <UserIcon />
            </Button>

            <Dialog open={isOpen} onOpenChange={handleOpenChange}>
                <DialogContent className="sm:max-w-[100vh] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{fullName} Details</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-6 py-2">
                        <div className="flex items-center justify-between rounded-md border p-3">
                            <div className="space-y-0.5">
                                <div className="font-medium">Allow editing</div>
                                <p className="text-sm text-muted-foreground">
                                    Toggle to enable changes for membership, profile, and contact fields.
                                </p>
                            </div>
                            <Switch checked={editing} onCheckedChange={setEditing} />
                        </div>

                        <Separator />

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="uid">User ID</Label>
                                <Input id="uid" value={info?.uid ?? userId} disabled />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" value={email} disabled />
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <Label>Verified</Label>
                                <div className="flex h-10 items-center justify-between rounded-md border px-3">
                                    <span className="text-sm text-muted-foreground">Email verification</span>
                                    <Switch checked={emailVerified} disabled />
                                </div>
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-2">
                            <Label>Church Membership</Label>
                            <div className="flex h-10 items-center justify-between rounded-md border px-3">
                                <span className="text-sm text-muted-foreground">Member</span>
                                <Switch
                                    checked={membership}
                                    onCheckedChange={setMembership}
                                    disabled={!editing}
                                />
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-base">Profile</Label>
                                {!editing && <span className="text-xs text-muted-foreground">read-only</span>}
                            </div>
                            <PersonInfoInput
                                value={person}
                                onChange={setPerson}
                                disabled={!editing}
                                idPrefix="profile"
                            />
                        </div>

                        <Separator />

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-base">Contact information</Label>
                                {!editing && <span className="text-xs text-muted-foreground">read-only</span>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="contact-phone">Phone</Label>
                                <Input
                                    id="contact-phone"
                                    value={contact.phone}
                                    onChange={(e) =>
                                        setContact((c) => ({ ...c, phone: e.target.value }))
                                    }
                                    placeholder={editing ? "(555) 555-5555" : ""}
                                    disabled={!editing}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Mailing address</Label>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div className="space-y-1 sm:col-span-2">
                                        <Label htmlFor="addr-line1" className="text-xs text-muted-foreground">
                                            Address
                                        </Label>
                                        <Input
                                            id="addr-line1"
                                            value={contact.address.address}
                                            onChange={(e) =>
                                                setContact((c) => ({
                                                    ...c,
                                                    address: { ...c.address, address: e.target.value },
                                                }))
                                            }
                                            placeholder={editing ? "123 Main St" : ""}
                                            disabled={!editing}
                                        />
                                    </div>

                                    <div className="space-y-1 sm:col-span-2">
                                        <Label htmlFor="addr-line2" className="text-xs text-muted-foreground">
                                            Suite / Room
                                        </Label>
                                        <Input
                                            id="addr-line2"
                                            value={contact.address.suite}
                                            onChange={(e) =>
                                                setContact((c) => ({
                                                    ...c,
                                                    address: { ...c.address, suite: e.target.value },
                                                }))
                                            }
                                            placeholder={editing ? "Apt / Suite" : ""}
                                            disabled={!editing}
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <Label htmlFor="addr-city" className="text-xs text-muted-foreground">
                                            City
                                        </Label>
                                        <Input
                                            id="addr-city"
                                            value={contact.address.city}
                                            onChange={(e) =>
                                                setContact((c) => ({
                                                    ...c,
                                                    address: { ...c.address, city: e.target.value },
                                                }))
                                            }
                                            placeholder={editing ? "City" : ""}
                                            disabled={!editing}
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <Label htmlFor="addr-state" className="text-xs text-muted-foreground">
                                            State / Region
                                        </Label>
                                        <Input
                                            id="addr-state"
                                            value={contact.address.state}
                                            onChange={(e) =>
                                                setContact((c) => ({
                                                    ...c,
                                                    address: { ...c.address, state: e.target.value },
                                                }))
                                            }
                                            placeholder={editing ? "CA" : ""}
                                            disabled={!editing}
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <Label htmlFor="addr-country" className="text-xs text-muted-foreground">
                                            Country
                                        </Label>
                                        <Input
                                            id="addr-country"
                                            value={contact.address.country}
                                            onChange={(e) =>
                                                setContact((c) => ({
                                                    ...c,
                                                    address: { ...c.address, country: e.target.value },
                                                }))
                                            }
                                            placeholder={editing ? "United States" : ""}
                                            disabled={!editing}
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <Label htmlFor="addr-postal" className="text-xs text-muted-foreground">
                                            Postal code
                                        </Label>
                                        <Input
                                            id="addr-postal"
                                            value={contact.address.postal_code}
                                            onChange={(e) =>
                                                setContact((c) => ({
                                                    ...c,
                                                    address: { ...c.address, postal_code: e.target.value },
                                                }))
                                            }
                                            placeholder={editing ? "12345" : ""}
                                            disabled={!editing}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                                {error}
                            </div>
                        )}

                        {loading && !error && (
                            <div className="text-sm text-muted-foreground">Loading…</div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={close} disabled={saving || loading}>
                            Close
                        </Button>
                        <Button onClick={handleSave} disabled={!editing || saving || loading}>
                            {saving ? "Saving…" : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
