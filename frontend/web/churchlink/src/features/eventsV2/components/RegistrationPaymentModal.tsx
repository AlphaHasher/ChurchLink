import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/shared/components/ui/Dialog";

import {
    Users,
    CheckCircle2,
    AlertTriangle,
    Shield,
    Clock,
    Loader2,
    Calendar,
    Repeat2,
    Mars,
    Venus,
    IdCard,
    CreditCard,
    DoorOpen,
    Wallet,
    ChevronLeft,
    DollarSign,
} from "lucide-react";

import type {
    UserFacingEvent,
    EventPaymentOption,
    EventRecurrence,
    RegistrationChangeResponse,
} from "@/shared/types/Event";

import EventAttendeesCard from "@/features/eventsV2/components/EventAttendeesCard";

import {
    useRegistrationPaymentModalLogic,
    fmtDateTime,
    money,
} from "@/helpers/RegistrationPaymentModalLogic";

import ApplyDiscountCodes from "@/features/eventsV2/components/ApplyDiscountCodes";

import { useLocalize } from "@/shared/utils/localizationUtils";
import { useLanguage } from "@/provider/LanguageProvider";

type PaymentMethod = "free" | "door" | "paypal";

type Props = {
    inline?: boolean;
    onBack?: () => void;

    open?: boolean;
    onOpenChange?: (open: boolean) => void;

    instanceId: string;
    event: UserFacingEvent;

    allowedPaymentOptions?: EventPaymentOption[];

    onSuccess?: (method: PaymentMethod, resp?: RegistrationChangeResponse) => void;
    onError?: (msg: string) => void;
};

export default function RegistrationPaymentModal({
    inline = false,
    onBack,
    open = false,
    onOpenChange,
    instanceId,
    event,
    allowedPaymentOptions,
    onSuccess,
    onError,
}: Props) {
    const L = useRegistrationPaymentModalLogic({
        inline,
        open,
        onOpenChange,
        instanceId,
        event,
        allowedPaymentOptions,
        onSuccess,
        onError,
    });

    const localize = useLocalize();
    const lang = useLanguage().locale;

    let freeMsg: string;
    let freeForMembers: string;
    let freeForAll: string;
    let free: string;
    let changeMsg: string;
    let netMsg: string;
    let netLater: string;
    let netTotal: string;
    let payAtDoor: string;
    let refundOnline: string;
    let lessAtDoor: string;
    let back: string;

    if (lang === "en") {
        freeMsg = "Free for members";
        free = "Free";
        freeForMembers = "This event is free for members.";
        freeForAll = "This event is free.";
        changeMsg = `You are changing ${L.addsCount} add(s) and ${L.removesCount} removal(s).`;
        netMsg = `NET now: ${L.signMoney(L.netOnlineNow)}`;
        netLater = `NET later: ${L.signMoney(L.netAtDoorLater)}`;
        netTotal = "NET now + NET later";
        payAtDoor = `You will pay ${money(L.payAtDoor)} at the door.`;
        refundOnline = `We’ll refund ${money(L.refundNow)} online.`;
        lessAtDoor = `You’ll pay ${money(L.creditAtDoor)} less at the door.`;
        back = "Back";
    }
    else {
        freeMsg = "No cost for members";
        free = "No cost";
        freeForMembers = "This event has no cost for members.";
        freeForAll = "This event has no cost.";
        changeMsg = `${localize("You are registering this amount of people:")} ${L.addsCount} ${localize("And you are unregistering this amount of people:")} ${L.removesCount}.`;
        netMsg = `${localize("NET payment charge now")}: ${L.signMoney(L.netOnlineNow)}`
        netLater = `${localize("NET payment charge later")}: ${L.signMoney(L.netAtDoorLater)}`
        netTotal = localize("NET payment charge in total");
        payAtDoor = `${localize("The amount you will pay at the door:")} ${money(L.payAtDoor)}.`;
        refundOnline = `${localize("The amount we’ll refund online:")} ${money(L.refundNow)}.`;
        lessAtDoor = `${localize("The amount you’ll pay less at the door:")} ${money(L.creditAtDoor)}.`;
        back = localize("Go Back");
    }

    const Content = (
        <div className="p-0">
            {inline && (
                <div className="top-0 z-10 px-3 py-2">
                    <Button variant="outline" size="sm" className="gap-1" onClick={onBack}>
                        <ChevronLeft className="h-4 w-4" />
                        {localize("Go back to Event Details")}
                    </Button>
                </div>
            )}

            <div className="p-5 md:p-6">
                <div className="mb-4">
                    <h2 className="text-xl font-semibold">{L.headerLabel}</h2>
                    <p className="text-sm text-muted-foreground">{localize("Choose who’s attending and how you’ll pay.")}</p>
                </div>

                {/* Event facts / status */}
                <Card className="mb-6 p-4">
                    <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <div className="font-medium">{localize("Event takes place on")}</div>
                                <div>{localize(fmtDateTime(event.date))}</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Repeat2 className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <div className="font-medium">{localize("Series")}</div>
                                <div>
                                    {(event.recurring as EventRecurrence) === "never"
                                        ? localize("One-time")
                                        : localize(`Repeats ${event.recurring}`)}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <div className="font-medium">{localize("Price")}</div>
                                {L.unitPrice === 0 ? (
                                    <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">
                                        {localize(freeMsg)}
                                    </Badge>
                                ) : L.baseEventPaid ? (
                                    <div className="font-semibold">{money(L.unitPrice)} {localize("per person")}</div>
                                ) : (
                                    <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">
                                        {localize(free)}
                                    </Badge>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {L.regPhase === "not_open_yet" ? (
                                <Clock className="h-4 w-4 text-rose-600" />
                            ) : L.regPhase === "deadline_passed" ? (
                                <AlertTriangle className="h-4 w-4 text-rose-600" />
                            ) : L.regPhase === "open" ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            ) : (
                                <Shield className="h-4 w-4 text-rose-600" />
                            )}
                            <div>
                                <div className="font-medium">{localize("Registration")}</div>
                                {L.regPhase === "closed" && <span className="text-rose-700">{localize("Closed")}</span>}
                                {L.regPhase === "not_open_yet" && <span className="text-rose-700">{localize("Not open yet")}</span>}
                                {L.regPhase === "deadline_passed" && (
                                    <span className="text-rose-700">{localize("Deadline passed")}</span>
                                )}
                                {L.regPhase === "open" && <span className="text-emerald-700">{localize("Open")}</span>}
                            </div>
                        </div>

                        {L.opensAt && (
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <div className="font-medium">{localize("Registration Opens")}</div>
                                    <div>{localize(fmtDateTime(event.registration_opens))}</div>
                                </div>
                            </div>
                        )}

                        {L.deadlineAt && (
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <div className="font-medium">{localize("Registration Deadline")}</div>
                                    <div>{localize(fmtDateTime(event.registration_deadline))}</div>
                                </div>
                            </div>
                        )}

                        {L.refundDeadlineAt && (
                            <div className="flex items-center gap-2 md:col-span-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <div className="font-medium">{localize("Automatic Refund Deadline")}</div>
                                    <div>{localize(fmtDateTime(L.refundDeadlineAt.toISOString()))}</div>
                                </div>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Allowed attendance */}
                <Card className="mb-6 p-4">
                    <div className="mb-2 flex items-center gap-2 font-semibold">
                        <IdCard className="h-4 w-4 text-muted-foreground" />
                        {localize("Who can attend")}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                        {event.members_only ? (
                            <Badge className="inline-flex items-center gap-1 border border-purple-200 bg-purple-50 text-purple-700">
                                <IdCard className="h-3.5 w-3.5" />
                                {localize("Members Only")}
                            </Badge>
                        ) : (
                            <Badge className="inline-flex items-center gap-1 border border-emerald-200 bg-emerald-50 text-emerald-700">
                                <Users className="h-3.5 w-3.5" />
                                {localize("Members & Non-Members")}
                            </Badge>
                        )}

                        {String((event.gender || "all")).toLowerCase() === "male" ? (
                            <Badge className="inline-flex items-center gap-1 border border-blue-200 bg-blue-50 text-blue-700">
                                <Mars className="h-3.5 w-3.5" />
                                {localize("Men Only")}
                            </Badge>
                        ) : String((event.gender || "all")).toLowerCase() === "female" ? (
                            <Badge className="inline-flex items-center gap-1 border border-pink-200 bg-pink-50 text-pink-700">
                                <Venus className="h-3.5 w-3.5" />
                                {localize("Women Only")}
                            </Badge>
                        ) : (
                            <Badge className="inline-flex items-center gap-1 border border-emerald-200 bg-emerald-50 text-emerald-700">
                                <Users className="h-3.5 w-3.5" />
                                {localize("Both Genders")}
                            </Badge>
                        )}

                        {typeof event.min_age !== "number" && typeof event.max_age !== "number" ? (
                            <Badge className="border border-slate-200 bg-slate-50 text-slate-700">{localize("All Ages")}</Badge>
                        ) : (
                            <Badge className="border border-slate-200 bg-slate-50 text-slate-700">
                                {typeof event.min_age === "number" && typeof event.max_age === "number"
                                    ? `${event.min_age}-${event.max_age} ${localize("Years Old")}`
                                    : typeof event.min_age === "number"
                                        ? `${event.min_age} ${localize("Years Old and Over")}`
                                        : `${event.max_age} ${localize("Years Old and Under")}`}
                            </Badge>
                        )}
                    </div>
                </Card>

                {/* Attendees */}
                {L.loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {localize("Loading your household…")}
                    </div>
                ) : L.loadErr ? (
                    <div className="text-sm text-rose-700">{L.loadErr}</div>
                ) : (
                    <EventAttendeesCard
                        rows={L.attendeeRows}
                        selfSelected={L.selfSelected}
                        onToggleSelf={L.setSelfSelected}
                        selectedFamilyIds={Object.keys(L.selectedFamily).filter((id) => L.selectedFamily[id])}
                        onChangeFamily={L.onChangeFamilyFromIds}
                        initialSelfRegistered={L.initialSelfRegistered}
                        initialFamilyRegistered={L.initialFamilyRegisteredSet}
                        disabledReasonFor={L.disabledReasonFor}
                        personReasonsFor={L.personReasonsFor}
                        onAddFamilyMember={L.refreshPeople}
                        paymentInfoFor={L.paymentInfoFor}
                    />
                )}

                {/* Payment method */}
                <div className="mt-6">
                    <div className="mb-2 font-semibold">Payment</div>
                    <Card className="p-4">
                        {!L.isPaidEvent ? (
                            <div className="flex items-center gap-2 text-sm">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                {L.baseEventPaid && L.unitPrice === 0
                                    ? localize(freeForMembers)
                                    : localize(freeForAll)}
                            </div>
                        ) : (
                            <>
                                {/* radios row */}
                                <div className="flex flex-col gap-3 text-sm sm:flex-row">
                                    {L.canUsePayPal && (
                                        <label className="inline-flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="method"
                                                className="h-4 w-4"
                                                checked={L.method === "paypal"}
                                                onChange={() => L.setMethod("paypal")}
                                            />
                                            <CreditCard className="h-4 w-4" />
                                            <span>{localize("Pay online")}</span>
                                        </label>
                                    )}
                                    {L.canUseDoor && (
                                        <label className="inline-flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="method"
                                                className="h-4 w-4"
                                                checked={L.method === "door"}
                                                onChange={() => L.setMethod("door")}
                                            />
                                            <DoorOpen className="h-4 w-4" />
                                            <span>{localize("Pay at door")}</span>
                                        </label>
                                    )}
                                    {!L.canUseDoor && !L.canUsePayPal && (
                                        <div className="inline-flex items-center gap-2 text-rose-700">
                                            <AlertTriangle className="h-4 w-4" />
                                            {localize("No payment methods available")}
                                        </div>
                                    )}
                                </div>

                                {/* WARNING message that will display if PayPal is a possible payment or refund method. */}
                                {L.showPayPalFeeWarning && (
                                    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                        <div className="flex gap-2">
                                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                            <div>
                                                <div className="font-semibold text-xs">
                                                    {localize("PayPal refunds do not include fees")}
                                                </div>
                                                <p className="mt-0.5 leading-snug">
                                                    {localize("If you pay online using PayPal and later unregister from this event, automatic refunds will return only the ticket amount. Any transaction fees charged by PayPal are non-refundable and will not be returned. This means if you register and then unregister from a $25 event, you may not receive the entire $25 back, and a small portion will be reserved to cover transaction fees.")}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </Card>
                </div>

                {/* Discount Codes Card */}
                <div className="mt-6">
                    <ApplyDiscountCodes
                        applying={L.discountApplying}
                        applied={L.discount}
                        error={L.discountErr}
                        onApply={L.applyDiscountCode}
                        onClear={L.clearDiscountCode}
                    />
                </div>



                {/* Summary */}
                <Card className="mt-6 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <DollarSign size={16} />
                        {localize("Summary")}
                    </div>

                    {!L.isPaidEvent ? (
                        <div className="text-sm text-gray-700">
                            {localize("This event is free.")}{" "}
                            {L.addsCount > 0 || L.removesCount > 0
                                ? changeMsg
                                : localize("No changes selected.")}
                        </div>
                    ) : (
                        <div className="space-y-3 text-sm text-gray-700">
                            <div className="flex items-center justify-between">
                                <span>{localize("Unit Price")}</span>
                                {/* Use effective unit price for the summary only */}
                                <span className="font-medium">{money(L.summaryUnitPrice)}</span>
                            </div>

                            {L.showOnlineNow && (
                                <div className="rounded-md bg-gray-50 p-3">
                                    <div className="mb-1 font-medium">{localize("Online (now)")}</div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700">
                                            + {localize("Pay now")}: {money(L.payNow)}
                                        </span>
                                        <span className="rounded bg-rose-50 px-2 py-0.5 text-rose-700">
                                            − {localize("Refund now")}: {money(L.refundNow)}
                                        </span>
                                        <span
                                            className={`ml-auto rounded px-2 py-0.5 font-semibold ${L.netOnlineNow >= 0
                                                ? "bg-emerald-50 text-emerald-700"
                                                : "bg-rose-50 text-rose-700"
                                                }`}
                                        >
                                            {netMsg}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {L.showDoorLater && (
                                <div className="rounded-md bg-slate-50 p-3">
                                    <div className="mb-1 font-medium">At the door (later)</div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700">
                                            + {localize("Pay at door")}: {money(L.payAtDoor)}
                                        </span>
                                        <span className="rounded bg-rose-50 px-2 py-0.5 text-rose-700">
                                            − {localize("Pay less at door")}: {money(L.creditAtDoor)}
                                        </span>
                                        <span
                                            className={`ml-auto rounded px-2 py-0.5 font-semibold ${L.netAtDoorLater >= 0
                                                ? "bg-emerald-50 text-emerald-700"
                                                : "bg-rose-50 text-rose-700"
                                                }`}
                                        >
                                            {netLater}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {L.showGrand && (
                                <div className="rounded-md border border-slate-200 bg-white p-3">
                                    <div className="mb-1 font-medium">{localize("Grand Total")}</div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-600">{netTotal}</span>
                                        <span
                                            className={`rounded px-2 py-0.5 font-semibold ${L.netOnlineNow + L.netAtDoorLater >= 0
                                                ? "bg-emerald-50 text-emerald-700"
                                                : "bg-rose-50 text-rose-700"
                                                }`}
                                        >
                                            {L.signMoney(L.netOnlineNow + L.netAtDoorLater)}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="text-xs text-gray-500">
                                {localize("“Online (now)” reflects immediate PayPal charges/refunds. “At the door (later)” reflects what will be settled in person based on each attendee’s original method. “Grand Total” reflects the sum of both of these, if you have changes in both payment types. You will be shown only the summaries relevant to your transaction.")}
                            </div>
                        </div>
                    )}
                </Card>

                {L.eventIsFull(event) && (
                    <div className="pb-5 px-1 sm:px-5">
                        <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                            <AlertTriangle className="h-4 w-4" />
                            {localize("Event is currently full.")}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="sticky bottom-0 z-20 mt-6 border-t bg-background/95 px-4 py-3 sm:px-6">
                    <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-xs text-muted-foreground">
                            {L.regPhase !== "open" ? (
                                L.removesCount > 0 && L.addsCount === 0
                                    ? localize("Registration is closed, but you can remove attendee(s).")
                                    : L.regPhase === "not_open_yet"
                                        ? localize("Registration hasn’t opened yet.")
                                        : L.regPhase === "deadline_passed"
                                            ? localize("Registration deadline has passed.")
                                            : localize("Registration is closed.")
                            ) : L.eventIsFull(event) && L.addsCount > 0 ? (
                                localize("Event is full — you can only remove attendees.")
                            ) : L.isPaidEvent && L.isPayPal && L.payNow > 0 ? (
                                `${localize("You’ll be redirected to PayPal to pay")} ${money(L.payNow)}.`
                            ) : L.isPaidEvent && L.isDoor && L.payAtDoor > 0 ? (
                                payAtDoor
                            ) : L.removesCount > 0 && L.refundNow > 0 ? (
                                refundOnline
                            ) : L.removesCount > 0 && L.creditAtDoor > 0 ? (
                                lessAtDoor
                            ) : (
                                localize("Click to add or remove event registrants.")
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                disabled={L.submitting}
                                onClick={() => {
                                    if (inline) {
                                        onBack?.();
                                    } else {
                                        onOpenChange?.(false);
                                    }
                                }}
                            >
                                {inline ? back : localize("Cancel")}
                            </Button>

                            <Button
                                onClick={L.handleSubmit}
                                disabled={
                                    L.submitting ||
                                    ((L.regPhase !== "open") && !(L.removesCount > 0 && L.addsCount === 0)) ||
                                    (L.eventIsFull(event) && L.addsCount > 0) ||
                                    L.attendeeRows.length === 0 || // defensive no-op if nothing loaded yet
                                    false /* keep exact behavior parity with isNoop via button label */
                                }
                            >
                                {(() => {
                                    if (L.regPhase !== "open") {
                                        if (L.removesCount > 0 && L.addsCount === 0) return localize("Process Changes");
                                        return localize("Registration Closed");
                                    }
                                    const noChanges =
                                        (L.addsCount === 0 && L.removesCount === 0);
                                    if (noChanges) return localize("No Changes");
                                    if (!L.isPaidEvent) return L.hasExistingReg ? localize("Save Registration") : localize("Register");
                                    if (L.isPayPal) return L.addsCount > 0 ? `${localize("Pay")} ${money(L.payNow)}` : localize("Process Changes");
                                    return localize("Process Changes");
                                })()}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    if (inline) return Content;

    return (
        <Dialog open={open!} onOpenChange={(v) => !L.submitting && onOpenChange?.(v)}>
            <DialogContent className="z-300 max-h-[82vh] w-[95vw] overflow-y-auto rounded-xl p-0 sm:max-w-[900px]">
                <DialogHeader className="sr-only">
                    <DialogTitle>{L.headerLabel}</DialogTitle>
                    <DialogDescription>{localize("Select attendees and payment")}</DialogDescription>
                </DialogHeader>
                {Content}
            </DialogContent>
        </Dialog>
    );
}
