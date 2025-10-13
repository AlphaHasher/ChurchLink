import * as React from "react";
import { CheckCircle2, XCircle, Info, Loader2, ChevronRight } from "lucide-react";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";

import { readMembershipDetails } from "@/helpers/MembershipHelper";
import type { MembershipDetails } from "@/shared/types/MembershipRequests";

type Props = {
    className?: string;
    onRequest: () => void;
    onResubmit: (prefill?: string) => void;
    onRead: (reason?: string, muted?: boolean) => void;
};

type PrimaryAction =
    | { kind: "none" }
    | { kind: "request" }
    | { kind: "resubmit"; prefill?: string }
    | { kind: "read"; reason?: string; muted?: boolean };

export default function MembershipCard({
    className,
    onRequest,
    onResubmit,
    onRead,
}: Props) {
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [details, setDetails] = React.useState<MembershipDetails | null>(null);

    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const d = await readMembershipDetails();
                if (!cancelled) setDetails(d);
            } catch {
                if (!cancelled) setError("Failed to load membership details.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const plan = React.useMemo(() => deriveUi(details), [details]);

    const handlePrimary = React.useCallback(() => {
        switch (plan.action.kind) {
            case "request":
                onRequest()
                break;
            case "resubmit":
                onResubmit(plan.action.prefill)
                break;
            case "read":
                onRead(plan.action.reason, plan.action.muted)
                break;
            case "none":
            default:
                break;
        }
    }, [onRequest, onResubmit, onRead, plan.action]);

    if (loading) {
        return (
            <Card className={className}>
                <CardHeader className="px-6 pt-6">
                    <CardTitle className="flex items-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        Loading membership…
                    </CardTitle>
                    <CardDescription>Just a second.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 px-6 pb-6">
                    <div className="h-5 w-40 rounded bg-muted/50" />
                    <div className="h-4 w-full rounded bg-muted/40" />
                    <div className="h-4 w-3/4 rounded bg-muted/40" />
                    <div className="h-12 w-48 rounded-xl bg-muted/50" />
                </CardContent>
            </Card>
        );
    }

    if (error || !details) {
        return (
            <Card className={className}>
                <CardHeader className="px-6 pt-6">
                    <CardTitle>Membership</CardTitle>
                    <CardDescription>We couldn’t load your membership info.</CardDescription>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                    <Alert variant="destructive">
                        <AlertDescription>{error ?? "Unknown error."}</AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    const isMember = !!details.membership;
    const Icon = isMember ? CheckCircle2 : XCircle;
    const title = isMember ? "Official Member" : "Not a Member";
    const subtitle = isMember
        ? "You are an official church member and will receive benefits exclusive to members such as:"
        : "You’re not currently registered as an official church member. You are missing out on benefits exclusive to members such as:";

    const iconColor = isMember ? "text-emerald-600" : "text-rose-600";
    const buttonVariant = plan.action.kind === "read" ? "secondary" : "default";


    const perks = [
        "Lower members-only event prices",
        "Access to members-only events",
        "Other benefits that are undefined",
    ];


    return (
        <Card className={className}>
            <CardHeader className="px-6 pt-6">
                <div className="flex items-start gap-3">
                    <div className="rounded-full bg-muted p-2 ring-1 ring-border">
                        <Icon className={`h-6 w-6 ${iconColor}`} />
                    </div>
                    <div className="flex-1">
                        <CardTitle className="text-xl font-extrabold">{title}</CardTitle>
                        <CardDescription className="mt-1">{subtitle}</CardDescription>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-5 px-6 pb-6">
                <div className="space-y-2">
                    {perks.map((p, i) => (
                        <div key={i} className="flex items-start gap-2">
                            <ChevronRight className="mt-[2px] h-4 w-4 text-muted-foreground" />
                            <p className="text-sm">{p}</p>
                        </div>
                    ))}
                </div>

                {plan.message && (
                    <Alert className="border-muted-foreground/20 bg-muted/40">
                        <Info className="h-4 w-4" />
                        <AlertDescription className="mt-1">{plan.message}</AlertDescription>
                    </Alert>
                )}

                {plan.buttonLabel && plan.action.kind !== "none" && (
                    <div className="flex justify-center">
                        <Button
                            size="lg"
                            className="h-12 rounded-xl px-6"
                            variant={buttonVariant as any}
                            onClick={handlePrimary}
                        >
                            {plan.buttonLabel}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function deriveUi(details: MembershipDetails | null): {
    message: string | null;
    buttonLabel: string | null;
    action: PrimaryAction;
} {
    if (!details) return { message: null, buttonLabel: null, action: { kind: "none" } };
    const pr = details.pending_request ?? null;

    if (details.membership === true) {
        return { message: null, buttonLabel: null, action: { kind: "none" } };
    }

    if (pr && pr.muted === true) {
        if (pr.resolved === true && pr.approved === false) {
            return {
                message: "You have been prohibited from making future membership requests.",
                buttonLabel: "Read Request",
                action: { kind: "read", reason: pr.reason ?? undefined, muted: true },
            };
        }
        return {
            message: "You have been prohibited from making future membership requests.",
            buttonLabel: null,
            action: { kind: "none" },
        };
    }

    if (!pr || pr.approved === true) {
        return {
            message: "You’re not a member yet. You can submit a membership request to get started.",
            buttonLabel: "Request Membership",
            action: { kind: "request" },
        };
    }

    if (pr.resolved === false) {
        return {
            message: "You already have a membership request pending review. If needed, you can re-submit it.",
            buttonLabel: "Re-Submit Request",
            action: { kind: "resubmit", prefill: pr.message ?? undefined },
        };
    }

    if (pr.resolved === true && pr.approved === false) {
        return {
            message: "Your previous membership request was denied. You can review the details below.",
            buttonLabel: "Read Request",
            action: { kind: "read", reason: pr.reason ?? undefined, muted: pr.muted ?? undefined },
        };
    }

    return { message: null, buttonLabel: null, action: { kind: "none" } };
}
