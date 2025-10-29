import * as React from "react";
import { Info, MessageSquareText, Loader2, ShieldAlert } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/shared/components/ui/Dialog";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Button } from "@/shared/components/ui/button";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Separator } from "@/shared/components/ui/separator";

import { createMembershipRequest } from "@/helpers/MembershipHelper";
import type { MembershipDetails } from "@/shared/types/MembershipRequests";
import { useLocalize } from "@/shared/utils/localizationUtils";

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    details: MembershipDetails;
    resubmission: boolean;
    onSubmitted?: () => void;
};

export default function MembershipRequestDialog({
    open,
    onOpenChange,
    details,
    resubmission,
    onSubmitted,
}: Props) {
    const localize = useLocalize();
    const [message, setMessage] = React.useState<string>("");
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!open) return;
        const prevMsg = details?.pending_request?.message ?? "";
        setMessage(prevMsg);
        setError(null);
    }, [open, details]);

    const pr = details?.pending_request ?? null;
    const resolved = pr?.resolved === true;
    const deniedReason = pr?.reason;
    const muted = pr?.muted === true;

    const hasResponseBlock = resolved === true;
    const reasonText =
        deniedReason && deniedReason.trim().length > 0
            ? deniedReason
            : localize("No denial reason was given.");

    const title = resubmission ? localize("Re-Submit Membership Request") : localize("Submit Membership Request");
    const submitLabel = resubmission ? localize("Re-Submit Request") : localize("Submit Request");

    const onSubmit = async () => {
        try {
            setSubmitting(true);
            setError(null);
            const trimmed = message.trim();
            const payload = trimmed.length ? trimmed : undefined;

            const result = await createMembershipRequest(payload);
            if (result?.success) {
                onOpenChange(false);
                onSubmitted?.();
            } else {
                setError(result?.msg || "Request failed. Please try again.");
            }
        } catch (e) {
            setError("Something went wrong. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <MessageSquareText className="h-5 w-5" />
                        {title}
                    </DialogTitle>
                    <DialogDescription>
                        {muted
                            ? localize("You can read the prior decision below, but cannot submit a new request.")
                            : resubmission
                                ? localize("Update your request with an optional message before sending it again.")
                                : localize("Optionally include a short message to accompany your request.")}
                    </DialogDescription>
                </DialogHeader>

                {muted && (
                    <Alert className="mb-3 border-amber-500/30 bg-amber-500/10">
                        <AlertDescription className="flex items-start gap-2">
                            <ShieldAlert className="h-4 w-4 mt-[2px] text-amber-600" />
                            <span>{localize("You have been prohibited from making future membership requests.")}</span>
                        </AlertDescription>
                    </Alert>
                )}

                {hasResponseBlock && (
                    <>
                        <div className="rounded-md border border-muted-foreground/20 bg-muted/40 p-3">
                            <div className="flex items-start gap-2">
                                <Info className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                <div className="space-y-1">
                                    <p className="text-sm font-medium">{localize("Previous reviewer response")}</p>
                                    <p className="text-sm text-muted-foreground">{reasonText}</p>
                                </div>
                            </div>
                        </div>
                        <Separator className="my-3" />
                    </>
                )}

                {error && (
                    <Alert variant="destructive" className="mb-3">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                <div className="grid gap-2">
                    <Label htmlFor="mr-message">{localize("Optional message")}</Label>
                    <Textarea
                        id="mr-message"
                        placeholder={
                            resubmission
                                ? localize("Optionally explain why you’re re-submitting…")
                                : localize("Optional message to accompany your request…")
                        }
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={6}
                        disabled={muted}
                    />
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
                        {localize("Close")}
                    </Button>
                    <Button onClick={onSubmit} disabled={submitting || muted}>
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {submitLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
