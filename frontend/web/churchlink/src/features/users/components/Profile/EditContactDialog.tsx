import * as React from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/shared/components/ui/Dialog";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Input } from "@/shared/components/ui/input";
import type { ContactInfo, AddressSchema } from "@/shared/types/ProfileInfo";
import { updateContactInfo } from "@/helpers/UserHelper";
import { useLocalize } from "@/shared/utils/localizationUtils";

type EditContactDialogProps = {
    initialContact: ContactInfo;
    onUpdated?: (c: ContactInfo) => void;
    className?: string;
    triggerLabel?: string;
};

export const EditContactDialog: React.FC<EditContactDialogProps> = ({
    initialContact,
    onUpdated,
    className,
    triggerLabel = "Update Contact Info",
}) => {
    const [open, setOpen] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const localize = useLocalize();

    const [phone, setPhone] = React.useState(safeStr(initialContact?.phone));
    const [address, setAddress] = React.useState<AddressSchema>({
        address: safeStr(initialContact?.address?.address),
        suite: safeStr(initialContact?.address?.suite),
        city: safeStr(initialContact?.address?.city),
        state: safeStr(initialContact?.address?.state),
        country: safeStr(initialContact?.address?.country),
        postal_code: safeStr(initialContact?.address?.postal_code),
    });

    React.useEffect(() => {
        setPhone(safeStr(initialContact?.phone));
        setAddress({
            address: safeStr(initialContact?.address?.address),
            suite: safeStr(initialContact?.address?.suite),
            city: safeStr(initialContact?.address?.city),
            state: safeStr(initialContact?.address?.state),
            country: safeStr(initialContact?.address?.country),
            postal_code: safeStr(initialContact?.address?.postal_code),
        });
    }, [initialContact]);

    const handleSave = async () => {
        try {
            setSaving(true);
            setError(null);

            const payload: ContactInfo = {
                phone: (phone || "").trim() || null,
                address: {
                    address: (address.address || "").trim() || null,
                    suite: (address.suite || "").trim() || null,
                    city: (address.city || "").trim() || null,
                    state: (address.state || "").trim() || null,
                    country: (address.country || "").trim() || null,
                    postal_code: (address.postal_code || "").trim() || null,
                },
            };

            const res = await updateContactInfo(payload);

            if (res.success && res.contact) {
                onUpdated?.(res.contact);
                setOpen(false);
            } else {
                setError(res.msg || "Failed to update contact info.");
            }
        } catch {
            setError("Failed to update contact info.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="w-full bg-blue-600 text-white hover:bg-blue-700">
                    {localize(triggerLabel)}
                </Button>
            </DialogTrigger>

            <DialogContent className={["sm:max-w-lg", className].filter(Boolean).join(" ")}>
                <DialogHeader>
                    <DialogTitle>{localize("Update Contact Information")}</DialogTitle>
                    <DialogDescription>
                        {localize("All fields are optional. If you wish, provide us information to contact you with.")}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Phone */}
                    <div className="space-y-2">
                        <Label htmlFor="contact-phone">{localize("Phone")}</Label>
                        <Input
                            id="contact-phone"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="(555) 555-1234"
                        />
                        <p className="text-sm text-muted-foreground">
                            {localize("Provide a number we may reach you. Phone numbers are not verified for validity.")}
                        </p>
                    </div>

                    {/* Address */}
                    <div className="space-y-2">
                        <Label>{localize("Mailing Address")}</Label>

                        <div className="space-y-3">
                            <div className="space-y-1">
                                <Label htmlFor="addr-line1" className="text-xs text-muted-foreground">
                                    {localize("Address line")}
                                </Label>
                                <Input
                                    id="addr-line1"
                                    value={address.address ?? ""}
                                    onChange={(e) => setAddress((a) => ({ ...a, address: e.target.value }))}
                                    placeholder="123 Main St"
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <div className="space-y-1 sm:col-span-1">
                                    <Label htmlFor="addr-suite" className="text-xs text-muted-foreground">
                                        {localize("Apt / Suite")}
                                    </Label>
                                    <Input
                                        id="addr-suite"
                                        value={address.suite ?? ""}
                                        onChange={(e) => setAddress((a) => ({ ...a, suite: e.target.value }))}
                                        placeholder="Apt 4B"
                                    />
                                </div>
                                <div className="space-y-1 sm:col-span-1">
                                    <Label htmlFor="addr-city" className="text-xs text-muted-foreground">
                                        {localize("City")}
                                    </Label>
                                    <Input
                                        id="addr-city"
                                        value={address.city ?? ""}
                                        onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
                                        placeholder="Springfield"
                                    />
                                </div>
                                <div className="space-y-1 sm:col-span-1">
                                    <Label htmlFor="addr-state" className="text-xs text-muted-foreground">
                                        {localize("State / Region")}
                                    </Label>
                                    <Input
                                        id="addr-state"
                                        value={address.state ?? ""}
                                        onChange={(e) => setAddress((a) => ({ ...a, state: e.target.value }))}
                                        placeholder="CA"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="space-y-1 sm:col-span-1">
                                    <Label htmlFor="addr-country" className="text-xs text-muted-foreground">
                                        {localize("Country")}
                                    </Label>
                                    <Input
                                        id="addr-country"
                                        value={address.country ?? ""}
                                        onChange={(e) => setAddress((a) => ({ ...a, country: e.target.value }))}
                                        placeholder="United States"
                                    />
                                </div>
                                <div className="space-y-1 sm:col-span-1">
                                    <Label htmlFor="addr-postal" className="text-xs text-muted-foreground">
                                        {localize("Postal code")}
                                    </Label>
                                    <Input
                                        id="addr-postal"
                                        value={address.postal_code ?? ""}
                                        onChange={(e) =>
                                            setAddress((a) => ({ ...a, postal_code: e.target.value }))
                                        }
                                        placeholder="94110"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {error ? (
                        <div className="text-sm text-red-600" role="alert">
                            {error}
                        </div>
                    ) : null}
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

function safeStr(s?: string | null): string {
    return (s ?? "").toString();
}
