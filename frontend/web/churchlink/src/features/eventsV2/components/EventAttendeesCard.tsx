import React, { Fragment, useMemo } from "react";
import { CheckCircle2, Circle, AlertCircle, XCircle, Mars, Venus } from "lucide-react";
import { AddPersonDialog } from "@/features/users/components/Profile/AddPersonDialog";
import { useLocalize } from "@/shared/utils/localizationUtils";
import { useLanguage } from "@/provider/LanguageProvider";

export type Gender = "M" | "F" | null;

export type AttendeeRow = {
    id: string;                  // "SELF" or family _id
    displayName: string;         // includes "(You)" suffix when isSelf
    gender: Gender;              // 'M' | 'F' | null
    dateOfBirth: string | null;  // ISO date string (not Date) for consistency
    isSelf: boolean;
    personPayload: {
        id: string;
        first_name: string | null;
        last_name: string | null;
        date_of_birth: string | null;
        gender: Gender;
    };
};

type Props = {
    title?: string;

    rows: AttendeeRow[];

    // snapshot at modal open
    initialSelfRegistered: boolean;
    initialFamilyRegistered: Set<string>;

    // current selection state (controlled by parent)
    selfSelected: boolean;
    onToggleSelf: (val: boolean) => void;
    selectedFamilyIds: string[];
    onChangeFamily: (ids: string[]) => void;

    disabledReasonFor?: (row: AttendeeRow) => string | null;
    personReasonsFor?: (row: AttendeeRow) => string[] | null;

    onEditPerson?: (row: AttendeeRow) => void;
    onDeletePerson?: (row: AttendeeRow) => void;
    onAddFamilyMember?: () => void;

    // per-row payment info for **currently registered** people
    paymentInfoFor?: (
        row: AttendeeRow
    ) =>
        | {
            option: "free" | "door" | "paypal" | null;
            price: number | null;
            complete: boolean | null;

            refundableRemaining?: number | null; // how much could still be auto-refunded
            totalRefunded?: number | null;       // how much has already been refunded
        }
        | null;
};

function Chip({
    children,
    className = "",
    title,
}: {
    children: React.ReactNode;
    className?: string;
    title?: string;
}) {
    return (
        <span
            title={title}
            className={
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
                className
            }
            style={{ lineHeight: 1.2 }}
        >
            {children}
        </span>
    );
}

// Gender chip: icon + label; blue for Male, pink for Female
function GenderBadge({ gender }: { gender: Gender }) {
    const localize = useLocalize();
    if (gender === "M") {
        return (
            <Chip className="bg-blue-50 text-blue-700">
                <Mars className="mr-1 h-3.5 w-3.5" />
                {localize("Male")}
            </Chip>
        );
    }
    if (gender === "F") {
        return (
            <Chip className="bg-pink-50 text-pink-700">
                <Venus className="mr-1 h-3.5 w-3.5" />
                {localize("Female")}
            </Chip>
        );
    }
    return <Chip className="bg-gray-100 text-gray-700">—</Chip>;
}

// Payment chips: method/price stay muted; status is green/red with icons.
// For PayPal lines, show refund details:
//  - "$X.XX partially refunded" when some money has come back
//  - "$Y.YY refundable" for the remaining auto-refund allowance
function PaymentBadges({
    info,
}: {
    info:
    | {
        option: "free" | "door" | "paypal" | null;
        price: number | null;
        complete: boolean | null;
        refundableRemaining?: number | null;
        totalRefunded?: number | null;
    }
    | null
    | undefined;
}) {
    if (!info) return null;
    const localize = useLocalize();
    const lang = useLanguage().locale;

    let free: string;
    if (lang === "en") {
        free = "Free";
    }
    else {
        free = localize("Free of cost");
    }

    const { option, price, complete, refundableRemaining, totalRefunded } = info;

    const isPayPal = option === "paypal";

    const refunded =
        typeof totalRefunded === "number" && !Number.isNaN(totalRefunded) && totalRefunded > 0
            ? totalRefunded
            : 0;

    const hasRefunds = isPayPal && refunded > 0;

    const refundableValue =
        typeof refundableRemaining === "number" && Number.isFinite(refundableRemaining)
            ? refundableRemaining
            : null;

    const showRefundable = isPayPal && refundableValue !== null;

    return (
        <div className="flex flex-wrap gap-1">
            {option && (
                <Chip className="bg-gray-100 text-gray-700" title={localize("Chosen payment method")}>
                    {option === "paypal" ? localize("Paid online") : option === "door" ? localize("Pay at door") : free}
                </Chip>
            )}

            {typeof price === "number" && (
                <Chip className="bg-gray-100 text-gray-700" title={localize("Unit price at registration")}>
                    ${price.toFixed(2)}
                </Chip>
            )}

            {hasRefunds && (
                <Chip
                    className="bg-amber-50 text-amber-800"
                    title={localize("Amount already refunded for this attendee")}
                >
                    ${refunded.toFixed(2)}{" "}
                    {showRefundable && refundableValue && refundableValue > 0
                        ? localize("partially refunded")
                        : localize("refunded")}
                </Chip>
            )}

            {showRefundable && (
                <Chip
                    className="bg-emerald-50 text-emerald-700"
                    title={localize("Maximum amount that can still be automatically refunded for this attendee")}
                >
                    ${Math.max(refundableValue ?? 0, 0).toFixed(2)} {localize("refundable")}
                </Chip>
            )}

            {typeof complete === "boolean" && (
                <Chip
                    className={
                        complete
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-700"
                    }
                    title={localize("Payment status")}
                >
                    {complete ? (
                        <>
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                            {localize("Complete")}
                        </>
                    ) : (
                        <>
                            <XCircle className="mr-1 h-3.5 w-3.5" />
                            {localize("Not Paid")}
                        </>
                    )}
                </Chip>
            )}
        </div>
    );
}

export default function EventAttendeesCard(props: Props) {
    const localize = useLocalize();
    const {
        title = localize("Choose Attendees"),
        rows,
        initialSelfRegistered,
        initialFamilyRegistered,
        selfSelected,
        onToggleSelf,
        selectedFamilyIds,
        onChangeFamily,
        disabledReasonFor,
        personReasonsFor,
        onAddFamilyMember,
        paymentInfoFor,
    } = props;



    // split by initial registration snapshot
    const initialGroups = useMemo(() => {
        const reg: AttendeeRow[] = [];
        const unreg: AttendeeRow[] = [];
        for (const r of rows) {
            const wasRegistered = r.isSelf
                ? initialSelfRegistered
                : initialFamilyRegistered.has(r.id);
            (wasRegistered ? reg : unreg).push(r);
        }
        return { registered: reg, unregistered: unreg };
    }, [rows, initialSelfRegistered, initialFamilyRegistered]);

    const isRowSelected = (r: AttendeeRow): boolean =>
        r.isSelf ? selfSelected : selectedFamilyIds.includes(r.id);

    const toggleRow = (r: AttendeeRow) => {
        const reason = disabledReasonFor?.(r) ?? null;
        if (reason) return;
        if (r.isSelf) {
            onToggleSelf(!selfSelected);
        } else {
            if (selectedFamilyIds.includes(r.id)) {
                onChangeFamily(selectedFamilyIds.filter((id) => id !== r.id));
            } else {
                onChangeFamily([...selectedFamilyIds, r.id]);
            }
        }
    };

    const renderRow = (r: AttendeeRow, currentlyRegistered: boolean) => {
        const disabledReason = disabledReasonFor?.(r) ?? null;
        const extraReasons = personReasonsFor?.(r) ?? null;
        const selected = isRowSelected(r);

        return (
            <div
                key={r.id}
                className={
                    "flex flex-col gap-2 rounded-lg border p-3 transition " +
                    (disabledReason ? "opacity-60" : "hover:bg-gray-50")
                }
            >
                <div className="flex items-center gap-3">
                    {/* radio/checkbox */}
                    <button
                        type="button"
                        aria-label={selected ? "unselect" : "select"}
                        onClick={() => toggleRow(r)}
                        disabled={!!disabledReason}
                        className={
                            "h-5 w-5 rounded-full border flex items-center justify-center " +
                            (selected ? "bg-blue-600 border-blue-600" : "bg-white border-gray-300")
                        }
                        title={disabledReason ?? undefined}
                    >
                        {selected ? <CheckCircle2 size={16} color="#fff" /> : <Circle size={16} />}
                    </button>

                    {/* main column */}
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="truncate font-medium">{r.displayName}</div>

                            {/* payment badges only for currently registered people */}
                            {currentlyRegistered && <PaymentBadges info={paymentInfoFor?.(r)} />}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                            <GenderBadge gender={r.gender} />

                            {/* Age & DOB (legacy parity) */}
                            <Chip className="bg-gray-100 text-gray-700">
                                {localize("Day of Birth:")} {r.dateOfBirth ? new Date(r.dateOfBirth).toLocaleDateString() : "—"}
                            </Chip>

                            {/* ineligible hint */}
                            {disabledReason && (
                                <Chip className="bg-gray-100 text-gray-700" title={disabledReason}>
                                    <AlertCircle className="mr-1 inline-block" size={12} />
                                    {localize("Not Eligible")}
                                </Chip>
                            )}
                        </div>

                        {extraReasons && extraReasons.length > 0 && (
                            <ul className="mt-1 list-disc pl-5 text-xs text-gray-600">
                                {extraReasons.map((m, i) => (
                                    <li key={i}>{localize(m)}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="rounded-xl border p-4">
            <div className="mb-3 text-lg font-semibold">{title}</div>

            {/* Registered */}
            {initialGroups.registered.length > 0 && (
                <Fragment>
                    <div className="mb-2 text-sm font-semibold text-gray-700">
                        {localize("Registered Attendees")}
                    </div>
                    <div className="mb-4 space-y-2">
                        {initialGroups.registered.map((r) => renderRow(r, true))}
                    </div>
                </Fragment>
            )}

            {/* Unregistered */}
            <div className="mb-2 text-sm font-semibold text-gray-700">{localize("Not Registered")}</div>
            <div className="space-y-2">
                {initialGroups.unregistered.map((r) => renderRow(r, false))}
            </div>

            {onAddFamilyMember && (
                <div className="mt-4 flex justify-end">
                    <AddPersonDialog onCreated={onAddFamilyMember} />
                </div>
            )}
        </div>
    );
}
