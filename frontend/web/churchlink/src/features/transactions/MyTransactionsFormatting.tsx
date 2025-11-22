// Shared formatting + badge helpers for MyTransactions views.

import type { TransactionKind, TransactionSummary } from "@/shared/types/Transactions";

export const SoftPill = ({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) => (
  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
    {children}
  </span>
);

// Human-readable type, with recurrence baked in for subscriptions
export function formatKindWithExtras(
  row: TransactionSummary | null | undefined,
): string {
  if (!row) return "";
  const { kind, extra } = row;
  const x = extra || {};

  if (kind === "donation_subscription") {
    const rawInterval =
      (x.interval as string | undefined) ||
      (x.meta && (x.meta.interval as string | undefined)) ||
      (x.meta && (x.meta.billing_cycle as string | undefined));

    if (!rawInterval) return "Donation Plan";

    const s = String(rawInterval).toLowerCase();
    let pretty = s;

    if (s.startsWith("week")) pretty = "Weekly";
    else if (s.startsWith("month")) pretty = "Monthly";
    else if (s.startsWith("year") || s.startsWith("annual")) pretty = "Yearly";
    else if (s === "day" || s.startsWith("daily")) pretty = "Daily";
    else pretty = s.charAt(0).toUpperCase() + s.slice(1);

    return `Donation Plan (${pretty})`;
  }

  if (kind === "donation_subscription_payment") {
    return "Donation Plan Payment";
  }

  switch (kind) {
    case "donation_one_time":
      return "Donation";
    case "event":
      return "Event Payment";
    case "form":
      return "Form Payment";
    default:
      return kind;
  }
}

// Unified status → label + tailwind class for pill
export function getStatusDisplay(
  statusRaw?: string | null,
  kind?: TransactionKind,
): { label: string; className: string } {
  if (!statusRaw) {
    return {
      label: "Unknown",
      className: "bg-slate-50 text-slate-700",
    };
  }

  const s = statusRaw.toString().toUpperCase();

  // Subscription "plan" statuses (the recurring donation itself)
  if (kind === "donation_subscription") {
    switch (s) {
      case "APPROVAL_PENDING":
        return {
          label: "Awaiting Approval",
          className: "bg-amber-50 text-amber-700",
        };
      case "ACTIVE":
        return {
          label: "Active",
          className: "bg-emerald-50 text-emerald-700",
        };
      case "SUSPENDED":
        return {
          label: "Suspended",
          className: "bg-amber-50 text-amber-700",
        };
      case "CANCELLED":
      case "CANCELED":
        return {
          label: "Cancelled",
          className: "bg-slate-50 text-slate-700",
        };
      case "EXPIRED":
        return {
          label: "Expired",
          className: "bg-slate-50 text-slate-700",
        };
    }
  }

  // One-off payments (including donation_subscription_payment)
  switch (s) {
    case "CAPTURED":
    case "COMPLETED": // PayPal subscription charge statuses
      return {
        label: "Paid",
        className: "bg-emerald-50 text-emerald-700",
      };
    case "FULLY_REFUNDED":
    case "REFUNDED":
      return {
        label: "Refunded",
        className: "bg-sky-50 text-sky-700",
      };
    case "PARTIALLY_REFUNDED":
      return {
        label: "Partially Refunded",
        className: "bg-amber-50 text-amber-700",
      };
    case "FAILED":
    case "DENIED":
      return {
        label: "Failed",
        className: "bg-rose-50 text-rose-700",
      };
    case "PENDING":
    case "CREATED":
      return {
        label: "Pending",
        className: "bg-amber-50 text-amber-700",
      };
    default:
      return {
        label: statusRaw,
        className: "bg-slate-50 text-slate-700",
      };
  }
}

// Status filter options for the UI.
// `statuses` are the raw backend status values we send to the API.
export type StatusFilterOption = {
  id: string;          // e.g. "all", "paid", "active"
  label: string;       // UI label
  statuses: string[];  // raw backend statuses
};

const PAYMENT_STATUS_OPTIONS: StatusFilterOption[] = [
  { id: "all", label: "All statuses", statuses: [] },

  // Funds successfully captured / completed
  {
    id: "paid",
    label: "Paid",
    statuses: [
      "captured",       // donations/forms/events
      "completed",      // PayPal sale state, lowercase
      "COMPLETED",      // PayPal sale state, uppercase
    ],
  },

  // Created / approved / still in flight
  {
    id: "pending",
    label: "Pending",
    statuses: [
      "created",
      "approved",
      "pending",
      "PENDING",
      "APPROVAL_PENDING",
    ],
  },

  // Failed / denied / voided
  {
    id: "failed",
    label: "Failed",
    statuses: [
      "failed",
      "denied",
      "DENIED",
      "voided",
      "VOIDED",
    ],
  },

  // Fully refunded (or “refunded” in simple ledgers)
  {
    id: "refunded",
    label: "Refunded",
    statuses: [
      "refunded",           // donation/form future flow
      "fully_refunded",     // event ledger
      "FULLY_REFUNDED",
      "REFUNDED",
    ],
  },

  // Partially refunded
  {
    id: "partially_refunded",
    label: "Partially Refunded",
    statuses: [
      "partially_refunded", // event ledger
      "PARTIALLY_REFUNDED",
    ],
  },
];

const PLAN_STATUS_OPTIONS: StatusFilterOption[] = [
  { id: "all", label: "All statuses", statuses: [] },
  {
    id: "approval_pending",
    label: "Awaiting Approval",
    statuses: ["APPROVAL_PENDING"],
  },
  {
    id: "active",
    label: "Active",
    statuses: ["ACTIVE"],
  },
  {
    id: "suspended",
    label: "Suspended",
    statuses: ["SUSPENDED"],
  },
  {
    id: "cancelled",
    label: "Cancelled",
    statuses: ["CANCELLED", "CANCELED"],
  },
  {
    id: "expired",
    label: "Expired",
    statuses: ["EXPIRED"],
  },
];

export function getStatusFilterOptionsForKind(
  kind: TransactionKind | "all",
): StatusFilterOption[] {
  if (kind === "donation_subscription") {
    return PLAN_STATUS_OPTIONS;
  }

  if (
    kind === "donation_one_time" ||
    kind === "donation_subscription_payment" ||
    kind === "event" ||
    kind === "form"
  ) {
    return PAYMENT_STATUS_OPTIONS;
  }

  // "all" kinds → union of both families, but keep a single "All statuses" entry
  return [
    PAYMENT_STATUS_OPTIONS[0],
    ...PAYMENT_STATUS_OPTIONS.slice(1),
    ...PLAN_STATUS_OPTIONS.slice(1),
  ];
}