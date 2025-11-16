import { useState } from "react";
import { XCircle } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from "@/shared/components/ui/Dialog";
import { Button } from "@/shared/components/ui/button";
import type { TransactionSummary } from "@/shared/types/Transactions";
import { cancelDonationSubscription } from "@/helpers/DonationHelper";
import { useLocalize } from "@/shared/utils/localizationUtils";
import { useLanguage } from "@/provider/LanguageProvider";

type Props = {
    tx: TransactionSummary;
    onAfterCancel?: () => void;
};

export default function CancelDonationSubscriptionUserDialog({ tx, onAfterCancel }: Props) {
    const localize = useLocalize();

    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [ok, setOk] = useState<boolean | null>(null);

    const kind = tx.kind as string;
    const isDonationPlan = kind === "donation_subscription";
    const subscriptionId = tx.paypal_subscription_id || null;

    const statusUpper = (tx.status || "").toString().toUpperCase();
    const isActive = statusUpper === "ACTIVE";

    // Only render for ACTIVE donation plan rows with a subscription id
    if (!isDonationPlan || !subscriptionId || !isActive) {
        return null;
    }

    const resetAndClose = () => {
        setOpen(false);
        setBusy(false);
        setMsg(null);
        setOk(null);
    };

    const handleCancel = async () => {
        setBusy(true);
        setMsg(null);
        setOk(null);

        try {
            const res = await cancelDonationSubscription({
                subscription_id: subscriptionId,
            });

            setMsg(
                localize(res.msg ??
                    "Your donation plan has been cancelled. PayPal will no longer attempt future charges."),
            );
            const success = !!res.success;
            setOk(success);

            if (success) {
                if (onAfterCancel) {
                    onAfterCancel();
                }
                resetAndClose();
            }
        } catch (err) {
            console.error(
                "[CancelDonationSubscriptionUserDialog] handleCancel error",
                err,
            );
            setMsg(localize("Unexpected error cancelling this subscription."));
            setOk(false);
        } finally {
            setBusy(false);
        }
    };

    const lang = useLanguage().locale;

    let close: string;
    if (lang === "en") {
        close = "Close";
    }
    else {
        close = localize("Close Dialog");
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => (next ? setOpen(true) : resetAndClose())}
        >
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                    type="button"
                    title={localize("Cancel this donation plan")}
                    aria-label={localize("Cancel this donation plan")}
                >
                    <XCircle className="h-4 w-4" />
                    <span className="sr-only">{localize("Cancel donation plan")}</span>
                </Button>
            </DialogTrigger>

            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{localize("Cancel donation plan")}</DialogTitle>
                    <DialogDescription>
                        {localize("This will cancel your recurring donation plan. PayPal will no longer attempt future charges for this subscription.")}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-2 text-sm text-muted-foreground">
                    <div>
                        <span className="font-medium text-foreground">
                            {localize("PayPal subscription ID:")}
                        </span>{" "}
                        {subscriptionId}
                    </div>
                    <p className="mt-2">
                        {localize("Existing successful payments will remain on record. This does not retroactively refund past charges; it simply prevents new ones from being created.")}
                    </p>
                </div>

                {msg && (
                    <div
                        className={`mt-3 rounded-md border px-3 py-2 text-sm ${ok
                            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                            : "border-red-200 bg-red-50 text-red-900"
                            }`}
                    >
                        {msg}
                    </div>
                )}

                <div className="mt-4 flex justify-between gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={resetAndClose}
                        disabled={busy}
                    >
                        {close}
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={handleCancel}
                        disabled={busy}
                    >
                        {busy ? localize("Cancelling...") : localize("Confirm cancel")}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
