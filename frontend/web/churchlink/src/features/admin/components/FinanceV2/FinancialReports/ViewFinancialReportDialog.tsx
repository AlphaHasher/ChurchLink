// ViewFinancialReportDialog.tsx
// Dialog to display the full contents of a financial report.

import { useMemo, useState } from "react";
import { BarChart3, Eye } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from "@/shared/components/ui/Dialog";

import { Button } from "@/shared/components/ui/button";
import { Separator } from "@/shared/components/ui/separator";
import { Label } from "@/shared/components/ui/label";
import { SoftPill } from "@/features/transactions/MyTransactionsFormatting";

import type {
    FinancialReport,
    FinancialReportCurrencyTotals,
} from "@/shared/types/FinancialReport";

function formatDateTime(iso?: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString();
}

function formatMoney(amount: number, currency: string): string {
    if (!Number.isFinite(amount)) return "-";
    try {
        return new Intl.NumberFormat(undefined, {
            style: "currency",
            currency: currency || "USD",
            maximumFractionDigits: 2,
        }).format(amount);
    } catch {
        return `${currency} ${amount.toFixed(2)}`;
    }
}

type Props = {
    report: FinancialReport;
};

export default function ViewFinancialReportDialog({ report }: Props) {
    const [open, setOpen] = useState(false);

    const {
        config,
        stats,
        created_at,
        created_by_uid,
        generation_ms,
        meta,
    } = report;

    const currencyTotals = stats?.totals_by_currency ?? {};
    const kindTotals = stats?.totals_by_kind ?? {};

    const subscriptionPlans = stats?.subscription_plans;
    const hasDonationSubscriptionInConfig =
        !!config?.kinds?.includes("donation_subscription");
    const showSubscriptionPlansSection =
        !!subscriptionPlans &&
        hasDonationSubscriptionInConfig &&
        (
            subscriptionPlans.total_created_or_activated > 0 ||
            subscriptionPlans.total_cancelled > 0 ||
            subscriptionPlans.total_created_or_activated_amount > 0 ||
            subscriptionPlans.total_cancelled_amount > 0 ||
            Math.abs(subscriptionPlans.total_net_amount_delta ?? 0) > 0 ||
            Object.keys(subscriptionPlans.by_interval || {}).length > 0
        );

    const generationSummary = useMemo(() => {
        if (!generation_ms || generation_ms <= 0) return "—";
        if (generation_ms < 1000) return `${generation_ms.toFixed(0)} ms`;
        const s = generation_ms / 1000;
        if (s < 60) return `${s.toFixed(2)} sec`;
        const m = Math.floor(s / 60);
        const rem = s - m * 60;
        return `${m}m ${rem.toFixed(0)}s`;
    }, [generation_ms]);

    const kindsLabel = useMemo(() => {
        if (!config?.kinds || !config.kinds.length) return "All kinds";
        return config.kinds.join(", ");
    }, [config?.kinds]);

    const statusesLabel = useMemo(() => {
        if (!config?.statuses || !config.statuses.length) return "All statuses";
        return config.statuses.join(", ");
    }, [config?.statuses]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                >
                    <Eye className="h-4 w-4" />
                    View
                </Button>
            </DialogTrigger>

            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto z-[999]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        {config?.name || "Untitled Financial Report"}
                    </DialogTitle>
                    <DialogDescription>
                        Generated on {formatDateTime(created_at)}{" "}
                        {created_by_uid && (
                            <>
                                {" "}
                                by <span className="font-mono">{created_by_uid}</span>
                            </>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                    {/* Summary */}
                    <section className="rounded-md border bg-muted/40 p-3">
                        {config?.description && (
                            <>
                                <p className="text-sm text-muted-foreground mb-3 whitespace-pre-wrap">
                                    {config.description}
                                </p>
                                <Separator className="my-2" />
                            </>
                        )}

                        <div className="grid gap-3 md:grid-cols-3">
                            <div>
                                <Label>Transactions included</Label>
                                <div className="mt-1 text-lg font-semibold">
                                    {stats?.total_transactions ?? 0}
                                </div>
                            </div>
                            <div>
                                <Label>Generation time</Label>
                                <div className="mt-1 text-sm">{generationSummary}</div>
                            </div>
                            <div>
                                <Label>Refund entries</Label>
                                <div className="mt-1 text-sm">
                                    {stats?.refunds?.total_refund_entries ?? 0} entries
                                </div>
                            </div>
                        </div>

                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                            <div>
                                <Label>Kinds</Label>
                                <div className="mt-1 text-xs text-muted-foreground">
                                    {kindsLabel}
                                </div>
                            </div>
                            <div>
                                <Label>Statuses</Label>
                                <div className="mt-1 text-xs text-muted-foreground">
                                    {statusesLabel}
                                </div>
                            </div>
                            <div>
                                <Label>Transaction date range</Label>
                                <div className="mt-1 text-xs text-muted-foreground">
                                    {config?.created_from
                                        ? formatDateTime(config.created_from)
                                        : "Any time"}{" "}
                                    →{" "}
                                    {config?.created_to
                                        ? formatDateTime(config.created_to)
                                        : "Any time"}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Totals by currency */}
                    <section className="rounded-md border bg-muted/40 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="text-sm font-semibold">
                                Totals by currency
                            </div>
                            <SoftPill className="bg-slate-50 text-slate-700">
                                {Object.keys(currencyTotals).length || 0} currencies
                            </SoftPill>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full text-xs md:text-sm">
                                <thead>
                                    <tr className="border-b text-xs uppercase text-muted-foreground">
                                        <th className="py-1 pr-3 text-left">Currency</th>
                                        <th className="py-1 pr-3 text-right">
                                            Gross total
                                        </th>
                                        <th className="py-1 pr-3 text-right">Fees</th>
                                        <th className="py-1 pr-3 text-right">
                                            Net before refunds
                                        </th>
                                        <th className="py-1 pr-3 text-right">
                                            Refunded
                                        </th>
                                        <th className="py-1 pr-3 text-right">
                                            Net after refunds
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.values(currencyTotals).length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={6}
                                                className="py-2 text-sm text-muted-foreground text-center"
                                            >
                                                No data for this report.
                                            </td>
                                        </tr>
                                    )}

                                    {Object.values(currencyTotals).map(
                                        (t: FinancialReportCurrencyTotals, idx) => (
                                            <tr
                                                key={t.currency + idx}
                                                className="border-b last:border-0"
                                            >
                                                <td className="py-1 pr-3 text-left font-mono">
                                                    {t.currency}
                                                </td>
                                                <td className="py-1 pr-3 text-right">
                                                    {formatMoney(
                                                        t.gross_total,
                                                        t.currency,
                                                    )}
                                                </td>
                                                <td className="py-1 pr-3 text-right">
                                                    {formatMoney(
                                                        t.fee_total,
                                                        t.currency,
                                                    )}
                                                </td>
                                                <td className="py-1 pr-3 text-right">
                                                    {formatMoney(
                                                        t.net_before_refunds_total,
                                                        t.currency,
                                                    )}
                                                </td>
                                                <td className="py-1 pr-3 text-right">
                                                    {formatMoney(
                                                        t.refunded_total,
                                                        t.currency,
                                                    )}
                                                </td>
                                                <td className="py-1 pr-3 text-right">
                                                    {formatMoney(
                                                        t.net_after_refunds_total,
                                                        t.currency,
                                                    )}
                                                </td>
                                            </tr>
                                        ),
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* Breakdown by kind */}
                    <section className="rounded-md border bg-muted/40 p-3 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-semibold">
                                Breakdown by kind &amp; currency
                            </div>
                            <SoftPill className="bg-slate-50 text-slate-700">
                                {Object.keys(kindTotals).length || 0} kinds
                            </SoftPill>
                        </div>

                        {Object.keys(kindTotals).length === 0 && (
                            <div className="text-sm text-muted-foreground">
                                No breakdown data recorded for this report.
                            </div>
                        )}

                        {Object.entries(kindTotals).map(([kind, perCurrency]) => (
                            <div
                                key={kind}
                                className="rounded-md border bg-background p-3"
                            >
                                <div className="mb-2 flex items-center justify-between gap-2">
                                    <div className="font-medium text-sm">{kind}</div>
                                    <SoftPill className="bg-slate-50 text-slate-700">
                                        {Object.keys(perCurrency).length} currencies
                                    </SoftPill>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-xs md:text-sm">
                                        <thead>
                                            <tr className="border-b text-xs uppercase text-muted-foreground">
                                                <th className="py-1 pr-3 text-left">
                                                    Currency
                                                </th>
                                                <th className="py-1 pr-3 text-right">
                                                    Gross
                                                </th>
                                                <th className="py-1 pr-3 text-right">
                                                    Fees
                                                </th>
                                                <th className="py-1 pr-3 text-right">
                                                    Net before refunds
                                                </th>
                                                <th className="py-1 pr-3 text-right">
                                                    Refunded
                                                </th>
                                                <th className="py-1 pr-3 text-right">
                                                    Net after refunds
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.values(perCurrency).map(
                                                (t: any, idx) => (
                                                    <tr
                                                        key={`${kind}-${t.currency}-${idx}`}
                                                        className="border-b last:border-0"
                                                    >
                                                        <td className="py-1 pr-3 text-left font-mono">
                                                            {t.currency}
                                                        </td>
                                                        <td className="py-1 pr-3 text-right">
                                                            {formatMoney(
                                                                t.gross_total,
                                                                t.currency,
                                                            )}
                                                        </td>
                                                        <td className="py-1 pr-3 text-right">
                                                            {formatMoney(
                                                                t.fee_total,
                                                                t.currency,
                                                            )}
                                                        </td>
                                                        <td className="py-1 pr-3 text-right">
                                                            {formatMoney(
                                                                t.net_before_refunds_total,
                                                                t.currency,
                                                            )}
                                                        </td>
                                                        <td className="py-1 pr-3 text-right">
                                                            {formatMoney(
                                                                t.refunded_total,
                                                                t.currency,
                                                            )}
                                                        </td>
                                                        <td className="py-1 pr-3 text-right">
                                                            {formatMoney(
                                                                t.net_after_refunds_total,
                                                                t.currency,
                                                            )}
                                                        </td>
                                                    </tr>
                                                ),
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </section>

                    {/* Recurring donation plans (subscription setup) */}
                    {showSubscriptionPlansSection && (
                        <section className="rounded-md border bg-muted/40 p-3 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-semibold">
                                    Donation plans (recurring)
                                </div>
                                <SoftPill className="bg-slate-50 text-slate-700">
                                    {subscriptionPlans?.total_net_active_delta ?? 0} plans /{" "}
                                    {formatMoney(
                                        subscriptionPlans?.total_net_amount_delta ?? 0,
                                        "USD",
                                    )}
                                </SoftPill>
                            </div>

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 text-sm">
                                <div className="rounded border bg-background/50 p-2">
                                    <div className="text-xs uppercase text-muted-foreground">
                                        Plans created / activated
                                    </div>
                                    <div className="text-lg font-semibold">
                                        {subscriptionPlans?.total_created_or_activated ?? 0}
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        Nominal amount:&nbsp;
                                        {formatMoney(
                                            subscriptionPlans?.total_created_or_activated_amount ??
                                            0,
                                            "USD",
                                        )}
                                    </div>
                                </div>
                                <div className="rounded border bg-background/50 p-2">
                                    <div className="text-xs uppercase text-muted-foreground">
                                        Plans cancelled
                                    </div>
                                    <div className="text-lg font-semibold">
                                        {subscriptionPlans?.total_cancelled ?? 0}
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        Nominal amount:&nbsp;
                                        {formatMoney(
                                            subscriptionPlans?.total_cancelled_amount ?? 0,
                                            "USD",
                                        )}
                                    </div>
                                </div>
                                <div className="rounded border bg-background/50 p-2">
                                    <div className="text-xs uppercase text-muted-foreground">
                                        Net change
                                    </div>
                                    <div className="text-lg font-semibold">
                                        {subscriptionPlans?.total_net_active_delta ?? 0}
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        Nominal amount:&nbsp;
                                        {formatMoney(
                                            subscriptionPlans?.total_net_amount_delta ?? 0,
                                            "USD",
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-2">
                                <div className="mb-1 text-xs font-semibold text-muted-foreground">
                                    By interval
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-xs md:text-sm">
                                        <thead>
                                            <tr className="border-b text-xs uppercase text-muted-foreground">
                                                <th className="py-1 pr-3 text-left">Interval</th>
                                                <th className="py-1 pr-3 text-right">
                                                    Created / activated
                                                </th>
                                                <th className="py-1 pr-3 text-right">
                                                    Created amount
                                                </th>
                                                <th className="py-1 pr-3 text-right">
                                                    Cancelled
                                                </th>
                                                <th className="py-1 pr-3 text-right">
                                                    Cancelled amount
                                                </th>
                                                <th className="py-1 pr-3 text-right">Net</th>
                                                <th className="py-1 pr-3 text-right">
                                                    Net amount
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                const byInterval =
                                                    subscriptionPlans?.by_interval || {};
                                                const order = ["WEEK", "MONTH", "YEAR"];
                                                const labelMap: Record<string, string> = {
                                                    WEEK: "Weekly",
                                                    MONTH: "Monthly",
                                                    YEAR: "Yearly",
                                                };

                                                const rows = order
                                                    .map((key) => byInterval[key])
                                                    .filter(Boolean);

                                                if (!rows.length) {
                                                    return (
                                                        <tr>
                                                            <td
                                                                colSpan={7}
                                                                className="py-2 text-sm text-muted-foreground text-center"
                                                            >
                                                                No subscription plan activity in
                                                                this window.
                                                            </td>
                                                        </tr>
                                                    );
                                                }

                                                return rows.map((row: any) => (
                                                    <tr
                                                        key={row.interval}
                                                        className="border-b last:border-0"
                                                    >
                                                        <td className="py-1 pr-3 text-left">
                                                            {labelMap[row.interval] ||
                                                                row.interval}
                                                        </td>
                                                        <td className="py-1 pr-3 text-right">
                                                            {row.created_or_activated_count}
                                                        </td>
                                                        <td className="py-1 pr-3 text-right">
                                                            {formatMoney(
                                                                row.created_or_activated_amount_total ??
                                                                0,
                                                                "USD",
                                                            )}
                                                        </td>
                                                        <td className="py-1 pr-3 text-right">
                                                            {row.cancelled_count}
                                                        </td>
                                                        <td className="py-1 pr-3 text-right">
                                                            {formatMoney(
                                                                row.cancelled_amount_total ?? 0,
                                                                "USD",
                                                            )}
                                                        </td>
                                                        <td className="py-1 pr-3 text-right">
                                                            {row.net_active_delta}
                                                        </td>
                                                        <td className="py-1 pr-3 text-right">
                                                            {formatMoney(
                                                                row.net_amount_delta ?? 0,
                                                                "USD",
                                                            )}
                                                        </td>
                                                    </tr>
                                                ));
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Refund requests summary – only if enabled in config */}
                    {config?.include_refund_requests && (
                        <section className="rounded-md border bg-muted/40 p-3">
                            <div className="mb-2 text-sm font-semibold">
                                Refund request summary
                            </div>
                            <div className="grid gap-2 md:grid-cols-4 text-sm">
                                <div>
                                    <Label>Total requests</Label>
                                    <div className="mt-1">
                                        {stats?.refund_requests?.total_requests ?? 0}
                                    </div>
                                </div>
                                <div>
                                    <Label>Responded</Label>
                                    <div className="mt-1">
                                        {stats?.refund_requests?.responded_count ?? 0}
                                    </div>
                                </div>
                                <div>
                                    <Label>Resolved</Label>
                                    <div className="mt-1">
                                        {stats?.refund_requests?.resolved_count ?? 0}
                                    </div>
                                </div>
                                <div>
                                    <Label>Unresolved</Label>
                                    <div className="mt-1">
                                        {stats?.refund_requests?.unresolved_count ?? 0}
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    {meta && Object.keys(meta).length > 0 && (
                        <section className="rounded-md border bg-muted/40 p-3">
                            <div className="mb-2 text-sm font-semibold">
                                Additional metadata
                            </div>
                            <pre className="max-h-64 overflow-y-auto rounded bg-background p-2 text-xs">
                                {JSON.stringify(meta, null, 2)}
                            </pre>
                        </section>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
