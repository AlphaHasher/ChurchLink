// DownloadFinancialReport.tsx
// Button that generates a structured PDF (multi-page if needed) for a financial report.

import { useState } from "react";
import { DownloadCloud } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import type {
    FinancialReport,
    FinancialReportCurrencyTotals,
} from "@/shared/types/FinancialReport";

type Props = {
    report: FinancialReport;
};

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

export default function DownloadFinancialReport({ report }: Props) {
    const [downloading, setDownloading] = useState(false);

    const handleDownload = async () => {
        if (downloading) return;
        setDownloading(true);

        try {
            const mod = await import("jspdf");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const JsPDF: any = mod.default || mod.jsPDF || mod;

            const doc = new JsPDF({
                unit: "pt",
                format: "a4",
            });

            const marginLeft = 48;
            const marginTop = 48;
            const contentWidth = doc.internal.pageSize.getWidth() - marginLeft * 2;
            const lineHeight = 14;
            const pageHeight = doc.internal.pageSize.getHeight();

            let y = marginTop;

            const ensurePageSpace = (needed: number = lineHeight) => {
                if (y + needed > pageHeight - marginTop) {
                    doc.addPage();
                    y = marginTop;
                }
            };

            const addBlank = (h: number = lineHeight) => {
                y += h;
                ensurePageSpace(0);
            };

            const addSectionHeader = (title: string) => {
                ensurePageSpace(lineHeight * 2);
                doc.setFontSize(12);
                doc.setFont("helvetica", "bold");
                doc.text(title, marginLeft, y);
                y += lineHeight / 2;
                doc.setDrawColor(180, 180, 180);
                doc.line(marginLeft, y, marginLeft + contentWidth, y);
                y += lineHeight / 2;
                doc.setFontSize(10);
                doc.setFont("helvetica", "normal");
            };

            const addParagraph = (text: string) => {
                if (!text.trim()) return;
                const lines = doc.splitTextToSize(text, contentWidth);
                lines.forEach((t: string) => {
                    ensurePageSpace(lineHeight);
                    doc.text(t, marginLeft, y);
                    y += lineHeight;
                });
            };

            const addLabelValue = (label: string, rawValue: string) => {
                const value = rawValue || "-";
                const labelText = `${label}:`;

                doc.setFont("helvetica", "bold");
                const labelWidth = doc.getTextWidth(labelText);
                const maxValueWidth = contentWidth - labelWidth - 8;

                const valueLines = doc.splitTextToSize(value, maxValueWidth);

                valueLines.forEach((vl: string, idx: number) => {
                    ensurePageSpace(lineHeight);
                    if (idx === 0) {
                        // First line prints the label
                        doc.text(labelText, marginLeft, y);
                    }
                    doc.setFont("helvetica", "normal");
                    doc.text(vl, marginLeft + labelWidth + 6, y);
                    y += lineHeight;
                });

                // slight extra breathing room between label/value rows
                y += 2;
            };

            type TableColumn = {
                header: string;
                width: number;
                align?: "left" | "right";
            };

            const addTable = (columns: TableColumn[], rows: string[][]) => {
                if (!rows.length) return;

                const paddingX = 2;
                const rowHeight = lineHeight * 1.1;

                const colX: number[] = [];
                let cursorX = marginLeft;
                columns.forEach((c) => {
                    colX.push(cursorX);
                    cursorX += c.width;
                });

                const drawRow = (isHeader: boolean, row: string[]) => {
                    ensurePageSpace(rowHeight);
                    doc.setFont("helvetica", isHeader ? "bold" : "normal");

                    columns.forEach((col, idx) => {
                        const text = row[idx] ?? "";
                        const xBase = colX[idx];
                        let tx = xBase + paddingX;

                        if (col.align === "right") {
                            const textWidth = doc.getTextWidth(text);
                            tx = xBase + col.width - paddingX - textWidth;
                        }

                        doc.text(text, tx, y);
                    });

                    y += rowHeight;
                    doc.setDrawColor(230, 230, 230);
                    doc.line(
                        marginLeft,
                        y - rowHeight + 3,
                        marginLeft + contentWidth,
                        y - rowHeight + 3,
                    );
                };

                // Header
                drawRow(true, columns.map((c) => c.header));
                y += 2;

                // Rows
                rows.forEach((r) => drawRow(false, r));
                y += lineHeight / 2;
            };

            const { config, stats, created_at, created_by_uid } = report;
            const currencyTotals = (stats?.totals_by_currency ?? {}) as Record<
                string,
                FinancialReportCurrencyTotals
            >;
            const kindTotals = stats?.totals_by_kind ?? {};
            const subscriptionPlans = stats?.subscription_plans;
            const hasDonationSubscriptionInConfig =
                !!config?.kinds?.includes("donation_subscription");

            //
            // Header
            //
            doc.setFont("helvetica", "bold");
            doc.setFontSize(18);
            doc.text(config?.name || "Financial Report", marginLeft, y);
            y += lineHeight * 1.5;

            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");

            const generatedLine =
                `Generated: ${formatDateTime(created_at)}` +
                (created_by_uid ? `  •  By: ${created_by_uid}` : "");
            addParagraph(generatedLine);

            addBlank(lineHeight / 2);

            //
            // Description
            //
            if (config?.description) {
                addParagraph(config.description);
                addBlank(lineHeight / 2);
            }

            //
            // Report parameters
            //
            addSectionHeader("Report Parameters");

            addLabelValue(
                "Transaction kinds",
                !config?.kinds || !config.kinds.length
                    ? "All kinds"
                    : config.kinds.join(", "),
            );
            addLabelValue(
                "Statuses",
                !config?.statuses || !config.statuses.length
                    ? "All statuses"
                    : config.statuses.join(", "),
            );
            addLabelValue(
                "Transactions from",
                config?.created_from ? formatDateTime(config.created_from) : "Any time",
            );
            addLabelValue(
                "Transactions to",
                config?.created_to ? formatDateTime(config.created_to) : "Any time",
            );
            addLabelValue(
                "Include refund requests",
                config?.include_refund_requests ? "Yes" : "No",
            );
            addLabelValue(
                "Breakdown by kind",
                config?.include_breakdown_by_kind ? "Yes" : "No",
            );
            addLabelValue(
                "Breakdown by currency",
                config?.include_breakdown_by_currency ? "Yes" : "No",
            );

            addBlank();

            //
            // Summary
            //
            addSectionHeader("Summary");

            addLabelValue(
                "Total transactions",
                String(stats?.total_transactions ?? 0),
            );
            addLabelValue(
                "Refund entries",
                String(stats?.refunds?.total_refund_entries ?? 0),
            );
            addLabelValue(
                "Total refunded amount",
                `${formatMoney(
                    stats?.refunds?.total_refunded_amount ?? 0,
                    "USD",
                )} (aggregate across currencies)`,
            );

            addBlank();

            //
            // Totals by currency
            //
            addSectionHeader("Totals by currency");

            if (Object.keys(currencyTotals).length === 0) {
                addParagraph("No currency totals available.");
            } else {
                const currencyRows: string[][] = Object.values(currencyTotals).map(
                    (t) => [
                        t.currency,
                        formatMoney(t.gross_total, t.currency),
                        formatMoney(t.fee_total, t.currency),
                        formatMoney(t.net_before_refunds_total, t.currency),
                        formatMoney(t.refunded_total, t.currency),
                        formatMoney(t.net_after_refunds_total, t.currency),
                    ],
                );

                addTable(
                    [
                        { header: "Currency", width: 60, align: "left" },
                        { header: "Gross", width: 90, align: "right" },
                        { header: "Fees", width: 80, align: "right" },
                        { header: "Net before refunds", width: 120, align: "right" },
                        { header: "Refunded", width: 80, align: "right" },
                        { header: "Net after refunds", width: 110, align: "right" },
                    ],
                    currencyRows,
                );
            }

            //
            // Breakdown by kind and currency
            //
            addSectionHeader("Breakdown by kind and currency");

            if (!config?.include_breakdown_by_kind) {
                addParagraph("Breakdown by kind was not included for this report.");
            } else if (Object.keys(kindTotals).length === 0) {
                addParagraph("No breakdown data recorded for this report.");
            } else {
                Object.entries(kindTotals).forEach(([kind, perCurrency]: any) => {
                    ensurePageSpace(lineHeight * 3);
                    doc.setFont("helvetica", "bold");
                    doc.text(`Kind: ${kind}`, marginLeft, y);
                    y += lineHeight;

                    const rows: string[][] = Object.values(perCurrency).map((t: any) => [
                        t.currency,
                        formatMoney(t.gross_total, t.currency),
                        formatMoney(t.fee_total, t.currency),
                        formatMoney(t.net_before_refunds_total, t.currency),
                        formatMoney(t.refunded_total, t.currency),
                        formatMoney(t.net_after_refunds_total, t.currency),
                    ]);

                    doc.setFont("helvetica", "normal");
                    addTable(
                        [
                            { header: "Currency", width: 60, align: "left" },
                            { header: "Gross", width: 90, align: "right" },
                            { header: "Fees", width: 80, align: "right" },
                            { header: "Net before refunds", width: 120, align: "right" },
                            { header: "Refunded", width: 80, align: "right" },
                            { header: "Net after refunds", width: 110, align: "right" },
                        ],
                        rows,
                    );
                });
            }

            //
            // Recurring donation plans (subscription setup)
            //
            if (
                hasDonationSubscriptionInConfig &&
                subscriptionPlans &&
                (
                    subscriptionPlans.total_created_or_activated > 0 ||
                    subscriptionPlans.total_cancelled > 0 ||
                    subscriptionPlans.total_created_or_activated_amount > 0 ||
                    subscriptionPlans.total_cancelled_amount > 0 ||
                    Math.abs(subscriptionPlans.total_net_amount_delta ?? 0) > 0 ||
                    Object.keys(subscriptionPlans.by_interval || {}).length > 0
                )
            ) {
                addSectionHeader("Recurring donation plans (subscription setup)");

                // Overall totals
                addLabelValue(
                    "Plans created / activated (count)",
                    String(subscriptionPlans.total_created_or_activated ?? 0),
                );
                addLabelValue(
                    "Plans created / activated (amount)",
                    formatMoney(
                        subscriptionPlans.total_created_or_activated_amount ?? 0,
                        "USD",
                    ),
                );
                addLabelValue(
                    "Plans cancelled (count)",
                    String(subscriptionPlans.total_cancelled ?? 0),
                );
                addLabelValue(
                    "Plans cancelled (amount)",
                    formatMoney(
                        subscriptionPlans.total_cancelled_amount ?? 0,
                        "USD",
                    ),
                );
                addLabelValue(
                    "Net change (count)",
                    String(subscriptionPlans.total_net_active_delta ?? 0),
                );
                addLabelValue(
                    "Net change (amount)",
                    formatMoney(
                        subscriptionPlans.total_net_amount_delta ?? 0,
                        "USD",
                    ),
                );

                addBlank();

                const byInterval = subscriptionPlans.by_interval || {};
                const order = ["WEEK", "MONTH", "YEAR"];
                const labelMap: Record<string, string> = {
                    WEEK: "Weekly",
                    MONTH: "Monthly",
                    YEAR: "Yearly",
                };

                const intervalRows: string[][] = order
                    .map((key) => byInterval[key])
                    .filter((row: any) => !!row)
                    .map((row: any) => [
                        labelMap[row.interval] || row.interval,
                        String(row.created_or_activated_count ?? 0),
                        formatMoney(
                            row.created_or_activated_amount_total ?? 0,
                            "USD",
                        ),
                        String(row.cancelled_count ?? 0),
                        formatMoney(row.cancelled_amount_total ?? 0, "USD"),
                        String(row.net_active_delta ?? 0),
                        formatMoney(row.net_amount_delta ?? 0, "USD"),
                    ]);

                if (intervalRows.length) {
                    addTable(
                        [
                            { header: "Interval", width: 80, align: "left" },
                            {
                                header: "Created / activated (count)",
                                width: 120,
                                align: "right",
                            },
                            {
                                header: "Created amount",
                                width: 100,
                                align: "right",
                            },
                            {
                                header: "Cancelled (count)",
                                width: 110,
                                align: "right",
                            },
                            {
                                header: "Cancelled amount",
                                width: 110,
                                align: "right",
                            },
                            { header: "Net (count)", width: 80, align: "right" },
                            { header: "Net amount", width: 100, align: "right" },
                        ],
                        intervalRows,
                    );
                } else {
                    addParagraph("No subscription plan activity in this window.");
                }
            }

            //
            // Refund request summary (only if included in config)
            //
            if (config?.include_refund_requests) {
                addSectionHeader("Refund request summary");

                const rr = stats?.refund_requests;
                if (!rr) {
                    addParagraph("No refund request data included.");
                } else {
                    addLabelValue("Total requests", String(rr.total_requests ?? 0));
                    addLabelValue("Responded", String(rr.responded_count ?? 0));
                    addLabelValue("Resolved", String(rr.resolved_count ?? 0));
                    addLabelValue("Unresolved", String(rr.unresolved_count ?? 0));
                }
            }

            //
            // Optional metadata block
            //
            if (report.meta && Object.keys(report.meta).length > 0) {
                addSectionHeader("Additional metadata");
                const metaStr = JSON.stringify(report.meta, null, 2);
                addParagraph(metaStr);
            }

            const filename =
                report.config?.name?.trim()
                    .replace(/[^a-z0-9_\-]+/gi, "_")
                    .slice(0, 64) || `financial-report-${report.id}`;

            doc.save(`${filename}.pdf`);
        } catch (err) {
            console.error("[DownloadFinancialReport] error generating PDF", err);
            window.alert(
                "Unable to generate PDF for this report. Check the browser console for details.",
            );
        } finally {
            setDownloading(false);
        }
    };

    return (
        <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            onClick={handleDownload}
            disabled={downloading}
        >
            <DownloadCloud className="h-4 w-4" />
            {downloading ? "Generating…" : "Download PDF"}
        </Button>
    );
}
