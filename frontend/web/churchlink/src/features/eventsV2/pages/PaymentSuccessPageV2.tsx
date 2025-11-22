import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
    CheckCircle,
    XCircle,
    Loader2,
    ArrowLeft,
    Users,
    Calendar,
    DollarSign,
    Receipt,
    MapPin,
    Church,
    Download,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Separator } from "@/shared/components/ui/separator";

import { useFetchEventInstanceDetails } from "@/helpers/EventUserHelper";
import { capturePaidRegistration } from "@/helpers/EventRegistrationHelper";
import { money as fmtMoney, fmtDateTime } from "@/helpers/RegistrationPaymentModalLogic";
import { getPublicUrl } from "@/helpers/MediaInteraction";
import EventTicketCard from "@/features/eventsV2/components/EventTicketCard";
import { useAuth } from "@/features/auth/hooks/auth-context";
import { fetchMinistries, buildMinistryNameMap } from "@/helpers/MinistriesHelper";
import type { Ministry } from "@/shared/types/Ministry";

import type {
    EventDetailsResponse,
    RegistrationDetails,
    PaymentDetails,
    UserFacingEvent,
} from "@/shared/types/Event";
import { useLocalize } from "@/shared/utils/localizationUtils";
import { useLanguage } from "@/provider/LanguageProvider";

// ----- storage keys -----
const pendingFinalKey = (instanceId: string, orderId: string) => `paypal-final:${instanceId}:${orderId}`;
const captureGuardKey = (instanceId: string, orderId: string) => `paypal-captured:${instanceId}:${orderId}`;
const summaryKey = (instanceId: string, orderId: string) => `paypal-summary:${instanceId}:${orderId}`;
const detailsMapKey = (instanceId: string, orderId: string) => `paypal-detailsmap:${instanceId}:${orderId}`;

type PageState = "loading" | "success" | "error" | "missing";

// details_map structure coming back from backend
type DetailsMapEntry = {
    first_name: string | null;
    last_name: string | null;
    date_of_birth?: string | null;
    gender?: "M" | "F" | null;
};
type DetailsMap = Record<string, DetailsMapEntry>;

// ------- utilities -------
const fullName = (d?: DetailsMapEntry | null, fallback?: string) => {
    if (!d) return fallback ?? "Unknown";
    const parts = [d.first_name, d.last_name].filter(Boolean).join(" ").trim();
    return parts || fallback || "Unknown";
};
const asNumber = (n: unknown): number => {
    const f = typeof n === "number" ? n : typeof n === "string" ? parseFloat(n) : 0;
    return isFinite(f) ? f : 0;
};

type LineItem = {
    id: "SELF" | string;
    label: string;
    price: number; // positive value; refunds shown as negative only in the receipt rendering
    method: string | null;
    complete: boolean;
    txn?: string | null;
    line?: string | null;
};

function getPaymentFor(id: "SELF" | string, reg: RegistrationDetails | null | undefined): PaymentDetails | null {
    if (!reg) return null;
    if (id === "SELF") return reg.self_payment_details ?? null;
    return reg.family_payment_details?.[id] ?? null;
}

function refundableRemainingFromPaymentDetails(pd: PaymentDetails | null | undefined): number {
    if (!pd) return 0;

    const base =
        typeof pd.refundable_amount === "number"
            ? pd.refundable_amount
            : typeof pd.price === "number"
                ? pd.price
                : 0;

    const already =
        typeof pd.amount_refunded === "number" && !Number.isNaN(pd.amount_refunded)
            ? pd.amount_refunded
            : 0;

    const remaining = base - already;
    if (!Number.isFinite(remaining)) return 0;
    return remaining > 0 ? remaining : 0;
}

// Prefer names; fall back to raw id if we truly don't have a map entry
const nameFor = (id: "SELF" | string, detailsMap: DetailsMap | null) =>
    id === "SELF" ? fullName(detailsMap?.SELF, "You (Self)") : fullName(detailsMap?.[id], id);

/**
 * Build charge/refund line items scoped strictly to THIS order:
 * - charges from AFTER for ids we ADDED now
 * - refunds from BEFORE for ids we REMOVED now (paypal only)
 */
function buildScopedItems(params: {
    addedIds: Array<"SELF" | string>;
    removedIds: Array<"SELF" | string>;
    before: RegistrationDetails | null | undefined;
    after: RegistrationDetails | null | undefined;
    detailsMap: DetailsMap | null;
}): { charges: LineItem[]; refunds: LineItem[] } {
    const { addedIds, removedIds, before, after, detailsMap } = params;

    const charges: LineItem[] = [];
    for (const id of addedIds) {
        const pd = getPaymentFor(id, after);
        if (!pd) continue;
        const price = asNumber(pd.price);
        charges.push({
            id,
            label: nameFor(id, detailsMap),
            price,
            method: (pd.payment_type as string) ?? null,
            complete: Boolean(pd.payment_complete),
            txn: (pd as any)?.transaction_id ?? null,
            line: (pd as any)?.line_id ?? null,
        });
    }

    const refunds: LineItem[] = [];
    for (const id of removedIds) {
        const pd = getPaymentFor(id, before);
        if (!pd) continue;

        const method = (pd.payment_type as string) ?? null;
        if (method !== "paypal") continue; // instant refunds only when PayPal handled it

        const refundAmount = refundableRemainingFromPaymentDetails(pd);
        if (refundAmount <= 0) continue;

        refunds.push({
            id,
            label: nameFor(id, detailsMap),
            price: refundAmount, // what we actually auto-refund
            method,
            complete: true,
            txn: (pd as any)?.transaction_id ?? null,
            line: (pd as any)?.line_id ?? null,
        });
    }

    return { charges, refunds };
}

const PaymentSuccessPageV2: React.FC = () => {
    const localize = useLocalize();
    const lang = useLanguage().locale;

    const navigate = useNavigate();
    const { instanceId } = useParams<{ instanceId: string }>();
    const [params] = useSearchParams();
    const orderId = params.get("token") || params.get("order_id") || "";

    const { fetchEventInstanceDetails } = useFetchEventInstanceDetails();

    const [status, setStatus] = useState<PageState>("loading");
    const [message, setMessage] = useState<string>("");

    const [beforeResp, setBeforeResp] = useState<EventDetailsResponse | null>(null);
    const [afterResp, setAfterResp] = useState<EventDetailsResponse | null>(null);

    const [allMinistries, setAllMinistries] = useState<Ministry[]>([]);
    const ministryNameMap = useMemo(() => buildMinistryNameMap(allMinistries), [allMinistries]);

    // This is the authoritative "AFTER" registration used to build charges
    const [afterReg, setAfterReg] = useState<RegistrationDetails | null>(null);
    const [detailsMap, setDetailsMap] = useState<DetailsMap | null>(null);

    // ---------- idempotent capture lock (StrictMode-safe) ----------
    const ranOnceKey = useRef<string | null>(null);
    const lockOwnerRef = useRef<string | null>(null);

    const CAPTURE_LOCK_TTL_MS = 5 * 60 * 1000;
    const nowMs = () => Date.now();
    const makeToken = () => `${nowMs()}-${Math.random().toString(36).slice(2)}`;
    const readGuard = (k: string) => {
        try { return localStorage.getItem(k) || ""; } catch { return ""; }
    };
    const writeGuard = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { } };
    const removeGuard = (k: string) => { try { localStorage.removeItem(k); } catch { } };
    const isDone = (v: string) => v === "1";
    const isLock = (v: string) => v.startsWith("LOCK:");
    const lockAge = (v: string) => {
        if (!isLock(v)) return 0;
        const parts = v.split(":"); const ts = Number(parts[2] || 0);
        return ts ? nowMs() - ts : 0;
    };
    const tryAcquireLock = (k: string) => {
        const v = readGuard(k);
        if (isDone(v)) return false;
        if (isLock(v) && lockAge(v) < CAPTURE_LOCK_TTL_MS) return false;
        const token = makeToken();
        writeGuard(k, `LOCK:${token}:${nowMs()}`);
        lockOwnerRef.current = token;
        return true;
    };
    const releaseLock = (k: string, ok: boolean) => {
        const v = readGuard(k);
        const token = lockOwnerRef.current;
        const ours = isLock(v) && v.split(":")[1] === token;
        if (!ours) return;
        if (ok) writeGuard(k, "1"); else removeGuard(k);
    };
    const waitForDone = async (k: string, maxMs = 5000) => {
        const start = nowMs();
        while (nowMs() - start < maxMs) {
            if (isDone(readGuard(k))) return true;
            await new Promise((r) => setTimeout(r, 150));
        }
        return false;
    };

    // deltas for this order only (for the on-screen “Added/Removed” lists)
    const [addedIds, setAddedIds] = useState<Array<"SELF" | string>>([]);
    const [removedIds, setRemovedIds] = useState<Array<"SELF" | string>>([]);

    const { user } = useAuth();

    // ---------- core effect ----------
    useEffect(() => {
        const onceKey = instanceId && orderId ? `${instanceId}:${orderId}` : null;
        if (!onceKey || ranOnceKey.current === onceKey) return;

        const run = async () => {
            if (!instanceId) { setStatus("error"); setMessage(localize("Missing event instance.")); return; }
            if (!orderId) { setStatus("error"); setMessage(localize("Missing PayPal order id.")); return; }

            const storeKey = pendingFinalKey(instanceId, orderId);
            const rawPending = sessionStorage.getItem(storeKey);

            const guardK = captureGuardKey(instanceId, orderId);
            const guardVal = readGuard(guardK);
            const alreadyCaptured = isDone(guardVal);

            if (!rawPending && !alreadyCaptured) {
                setStatus("missing");
                setMessage(localize("We couldn't find your pending registration details. Please return to the event and try again."));
                return;
            }

            // Hydrate cached names ASAP so UI never flashes raw ids
            try {
                const cached = sessionStorage.getItem(detailsMapKey(instanceId, orderId));
                if (cached) setDetailsMap(JSON.parse(cached));
            } catch { }

            ranOnceKey.current = onceKey;
            setStatus("loading");

            // BEFORE snapshot (for refunds + delta calc)
            const before = await fetchEventInstanceDetails(instanceId);
            setBeforeResp(before);

            // parse pending
            let pendingDetails: RegistrationDetails | null = null;
            if (rawPending) {
                try { pendingDetails = JSON.parse(rawPending) as RegistrationDetails; }
                catch { setStatus("missing"); setMessage(localize("Corrupted pending registration details. Please try again.")); return; }
            }

            // ---- capture (with lock) ----
            let cap: any = null;
            if (!alreadyCaptured) {
                if (!pendingDetails) { setStatus("missing"); setMessage(localize("Missing pending registration details. Please try again.")); return; }

                const haveLock = tryAcquireLock(guardK);
                if (haveLock) {
                    try {
                        cap = await capturePaidRegistration(orderId, instanceId, pendingDetails);
                        if (!cap?.success) {
                            releaseLock(guardK, false);
                            setStatus("error"); setMessage(localize(cap?.msg || "Payment capture failed.")); return;
                        }

                        // persist names BEFORE flipping the lock to "done"
                        try {
                            if (cap?.details_map) {
                                sessionStorage.setItem(detailsMapKey(instanceId, orderId), JSON.stringify(cap.details_map));
                                setDetailsMap(cap.details_map as any);
                            }
                        } catch { }

                        releaseLock(guardK, true);
                        try { sessionStorage.removeItem(storeKey); } catch { }
                    } catch (e) {
                        releaseLock(guardK, false);
                        throw e;
                    }
                } else {
                    // Another mount/tab is capturing — wait for completion...
                    await waitForDone(guardK, 5000);
                    // ...then hydrate names written by the owner (bounded poll)
                    const start = Date.now();
                    while (Date.now() - start < 3000) {
                        try {
                            const cached = sessionStorage.getItem(detailsMapKey(instanceId, orderId));
                            if (cached) { setDetailsMap(JSON.parse(cached)); break; }
                        } catch { }
                        await new Promise((r) => setTimeout(r, 120));
                    }
                }
            }

            // ---- authoritative AFTER registration for CHARGES ----
            // Use capture's registration_details when provided; otherwise fetch fresh AFTER state.
            let regAfter: RegistrationDetails | null = cap?.registration_details ?? null;
            let after: EventDetailsResponse | null = null;

            if (regAfter) {
                // Build an AFTER response object based on BEFORE + cap payload (seats, regs)
                after = {
                    ...before,
                    event_details: before?.event_details
                        ? {
                            ...before.event_details,
                            event_registrations: regAfter,
                            seats_filled: typeof cap?.seats_filled === "number" ? cap.seats_filled : before.event_details.seats_filled,
                        }
                        : before?.event_details ?? null,
                };
            } else {
                // No registration_details in the capture payload — fetch fresh AFTER and take its regs
                const fresh = await fetchEventInstanceDetails(instanceId);
                after = fresh;
                regAfter = fresh?.event_details?.event_registrations ?? null;
            }

            setAfterResp(after || null);
            setAfterReg(regAfter);

            // Compute THIS-ORDER deltas using BEFORE vs PENDING (what changed in this order)
            if (pendingDetails) {
                const b = before?.event_details?.event_registrations ?? null;

                const bSelf = !!b?.self_registered;
                const aSelf = !!pendingDetails.self_registered;
                const bFam = new Set(b?.family_registered ?? []);
                const aFam = new Set(pendingDetails.family_registered ?? []);

                const added: Array<"SELF" | string> = [];
                const removed: Array<"SELF" | string> = [];

                if (!bSelf && aSelf) added.push("SELF");
                if (bSelf && !aSelf) removed.push("SELF");

                for (const id of aFam) if (!bFam.has(id)) added.push(id as string);
                for (const id of bFam) if (!aFam.has(id as string)) removed.push(id as string);

                setAddedIds(added);
                setRemovedIds(removed);

                try { sessionStorage.setItem(summaryKey(instanceId, orderId), JSON.stringify({ added, removed })); } catch { }
            }

            setStatus("success");
            setMessage(localize("Payment captured and registration updated."));
        };

        run().catch((e) => {
            console.error("[PaymentSuccessPageV2] error", e);
            setStatus("error");
            setMessage(localize("We couldn't finalize your registration."));
        });
    }, [instanceId, orderId, fetchEventInstanceDetails]);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const mins = await fetchMinistries();
                if (!alive) return;
                setAllMinistries(Array.isArray(mins) ? mins : []);
            } catch {
                setAllMinistries([]);
            }
        })();
        return () => { alive = false; };
    }, []);

    // derived event
    const afterEvent: UserFacingEvent | null = useMemo(
        () => afterResp?.event_details ?? beforeResp?.event_details ?? null,
        [afterResp, beforeResp]
    );
    const heroUrl = afterEvent?.image_id ? getPublicUrl(afterEvent.image_id) : null;
    const sharableHref = afterEvent?.id ? `/sharable_events/${encodeURIComponent(afterEvent.id)}` : "/events";

    // Scoped line items
    const { charges, refunds } = useMemo(
        () =>
            buildScopedItems({
                addedIds,
                removedIds,
                before: beforeResp?.event_details?.event_registrations ?? null,
                after: afterReg, // <- authoritative AFTER registrations
                detailsMap,
            }),
        [addedIds, removedIds, beforeResp, afterReg, detailsMap]
    );

    // Totals: sum what this order charged/refunded, period.
    const totalCharged = useMemo(
        () => charges.reduce((s, l) => s + Math.max(0, asNumber(l.price)), 0),
        [charges]
    );
    const totalRefunded = useMemo(
        () => refunds.reduce((s, l) => s + Math.max(0, asNumber(l.price)), 0),
        [refunds]
    );

    // ---------- receipt generation (high-quality banner, cover-fit, 300-DPI) ----------
    const handleDownloadReceipt = async () => {
        // Build rows from on-screen data
        const rows = [
            ...charges.map((c) => ({
                type: "Charge" as const,
                name: c.label,
                amount: Number(c.price) || 0,
                method: c.method || "—",
                txn: c.txn || "—",
                line: c.line || "—",
            })),
            ...refunds.map((r) => ({
                type: "Refund" as const,
                name: r.label,
                amount: -Math.abs(Number(r.price) || 0),
                method: r.method || "—",
                txn: r.txn || "—",
                line: r.line || "—",
            })),
        ];

        const eventTitle = afterEvent?.default_title || "Event";
        const eventDate = afterEvent?.date ? fmtDateTime(afterEvent.date) : "";
        const location = afterEvent?.default_location_info || "";

        // Helper: load an image and render into a canvas using cover-fit at 300-DPI
        const makeCoverBanner = async (
            url: string,
            targetWmm: number,
            targetHmm: number
        ): Promise<string | null> => {
            try {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.decoding = "async";
                img.loading = "eager";
                img.src = url;
                await img.decode();

                const iw = img.naturalWidth || img.width;
                const ih = img.naturalHeight || img.height;
                if (!iw || !ih) return null;

                // 300 DPI canvas sizing
                const mmToPx300 = (mm: number) => Math.max(1, Math.round((mm / 25.4) * 300));
                const cw = mmToPx300(targetWmm);
                const ch = mmToPx300(targetHmm);

                // cover-fit scale (no distortion)
                const scale = Math.max(cw / iw, ch / ih);
                const dw = Math.round(iw * scale);
                const dh = Math.round(ih * scale);
                const dx = Math.round((cw - dw) / 2);
                const dy = Math.round((ch - dh) / 2);

                const canvas = document.createElement("canvas");
                canvas.width = cw;
                canvas.height = ch;
                const ctx = canvas.getContext("2d");
                if (!ctx) return null;

                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = "high";
                // draw scaled image centered; canvas clips overflow (acts as crop)
                ctx.drawImage(img, dx, dy, dw, dh);

                // Use JPEG for photographic banners; good balance of quality/size
                return canvas.toDataURL("image/jpeg", 0.92);
            } catch {
                return null;
            }
        };

        try {
            const { jsPDF } = await import("jspdf");
            const doc = new jsPDF("p", "mm", "a4");

            // page metrics
            const pageW = doc.internal.pageSize.getWidth();
            const pageH = doc.internal.pageSize.getHeight();
            const marginL = 12, marginR = 12, marginT = 12, marginB = 14;
            const contentW = pageW - marginL - marginR;
            let y = marginT;

            // ---- Banner (cover-fit, 300-DPI) ----
            const bannerH = 35; // mm
            if (heroUrl) {
                const bannerDataUrl = await makeCoverBanner(heroUrl, contentW, bannerH);
                if (bannerDataUrl) {
                    doc.addImage(bannerDataUrl, "JPEG", marginL, y, contentW, bannerH, undefined, "SLOW");
                    y += bannerH + 6;
                    doc.setDrawColor(210);
                    doc.line(marginL, y, pageW - marginR, y);
                    y += 6;
                }
            }

            // Header
            doc.setFontSize(16);
            doc.text("Payment Receipt", marginL, y); y += 8;

            doc.setFontSize(11);
            doc.text(`Order ID: ${orderId}`, marginL, y); y += 6;
            doc.text(`Event: ${eventTitle}`, marginL, y); y += 6;
            if (eventDate) { doc.text(`Date: ${eventDate}`, marginL, y); y += 6; }
            if (location) { doc.text(`Location: ${location}`, marginL, y); y += 10; }

            // Table layout
            const gap = 2;
            const typeW = 18, amtW = 24, methW = 24, txnW = 48;
            const nameW = contentW - (typeW + amtW + methW + txnW);
            const colX = {
                type: marginL,
                name: marginL + typeW,
                amt: marginL + typeW + nameW,
                meth: marginL + typeW + nameW + amtW,
                txn: marginL + typeW + nameW + amtW + methW,
            };

            const ensureRoom = (needed: number) => {
                if (y + needed > pageH - marginB) {
                    doc.addPage(); y = marginT;
                    drawHeaderRow();
                }
            };
            const drawHeaderRow = () => {
                doc.setFontSize(10);
                doc.text("Type", colX.type, y);
                doc.text("Name", colX.name, y);
                doc.text("Amount", colX.amt, y);
                doc.text("Method", colX.meth, y);
                doc.text("Txn", colX.txn, y);
                y += 4; doc.setDrawColor(200);
                doc.line(marginL, y, pageW - marginR, y); y += 5;
            };
            const ellipsize = (text: string, maxW: number, base = 10, min = 7) => {
                for (let fs = base; fs >= min; fs--) {
                    doc.setFontSize(fs);
                    if (doc.getTextWidth(text) <= maxW) return { text, fs };
                }
                doc.setFontSize(min);
                const ell = "…";
                let out = text;
                while (out.length && doc.getTextWidth(out + ell) > maxW) out = out.slice(0, -1);
                return { text: out + ell, fs: min };
            };

            drawHeaderRow();

            const lineH = 6;
            for (const r of rows) {
                const nameFit = ellipsize(String(r.name), nameW - gap, 10, 8);
                const methFit = ellipsize(String(r.method), methW - gap, 10, 8);
                const txnFit = ellipsize(String(r.txn), txnW - gap, 10, 7);

                ensureRoom(lineH);
                doc.setFontSize(10);
                doc.text(r.type, colX.type, y);
                doc.setFontSize(nameFit.fs);
                doc.text(nameFit.text, colX.name, y);
                doc.setFontSize(10);
                doc.text(fmtMoney(r.amount), colX.amt + amtW - 1, y, { align: "right" });
                doc.setFontSize(methFit.fs);
                doc.text(methFit.text, colX.meth, y);
                doc.setFontSize(txnFit.fs);
                doc.text(txnFit.text, colX.txn, y);
                y += lineH;
            }

            // Totals
            const totalCharged = charges.reduce((s, l) => s + Math.max(0, Number(l.price) || 0), 0);
            const totalRefunded = refunds.reduce((s, l) => s + Math.max(0, Number(l.price) || 0), 0);

            ensureRoom(24);
            y += 4; doc.setDrawColor(200); doc.line(marginL, y, pageW - marginR, y); y += 6;
            doc.setFontSize(11);
            doc.text(`Total Charged: ${fmtMoney(totalCharged)}`, marginL, y); y += 6;
            doc.text(`Instant Refunds: ${fmtMoney(totalRefunded)}`, marginL, y); y += 6;
            doc.text(`Net Total: ${fmtMoney(totalCharged - totalRefunded)}`, marginL, y); y += 10;

            const note = "Note: Refunds shown reflect PayPal reversals executed with this order. Other savings (e.g., pay-at-door removals) may not appear.";
            ensureRoom(10); doc.setFontSize(9); doc.text(note, marginL, y, { maxWidth: contentW });

            doc.save(`receipt_${orderId || "order"}.pdf`);
        } catch {
            // Fallback: print-friendly window (so users can Save as PDF)
            const rowsHtml = rows.map(
                (r) =>
                    `<tr>
          <td>${r.type}</td>
          <td>${r.name}</td>
          <td style="text-align:right">${fmtMoney(r.amount)}</td>
          <td>${r.method}</td>
          <td>${r.txn}</td>
          <td>${r.line}</td>
        </tr>`
            ).join("");

            const w = window.open("", "_blank");
            if (!w) return;
            w.document.write(`
      <html>
        <head>
          <title>Receipt ${orderId}</title>
          <style>
            body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 24px; }
            h1 { margin: 0 0 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; table-layout: fixed; }
            th, td { border-bottom: 1px solid #ddd; padding: 6px 4px; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            th { text-align: left; background: #f9f9f9; }
            .col-type { width: 12%; }
            .col-name { width: 32%; }
            .col-amt  { width: 16%; text-align: right; }
            .col-meth { width: 18%; }
            .col-txn  { width: 22%; }
            .totals { margin-top: 12px; font-size: 13px; }
            .meta { margin: 8px 0 12px; }
          </style>
        </head>
        <body>
          <h1>Payment Receipt</h1>
          <div class="meta">Order ID: ${orderId}</div>
          <div class="meta">Event: ${eventTitle}</div>
          ${eventDate ? `<div class="meta">Date: ${eventDate}</div>` : ""}
          ${location ? `<div class="meta">Location: ${location}</div>` : ""}
          <table>
            <thead>
              <tr>
                <th class="col-type">Type</th>
                <th class="col-name">Name</th>
                <th class="col-amt">Amount</th>
                <th class="col-meth">Method</th>
                <th class="col-txn">Txn</th>
                <th>Line</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <div class="totals">
            <div>Total Charged: ${fmtMoney(charges.reduce((s, l) => s + Math.max(0, Number(l.price) || 0), 0))}</div>
            <div>Instant Refunds: ${fmtMoney(refunds.reduce((s, l) => s + Math.max(0, Number(l.price) || 0), 0))}</div>
            <div><strong>Net Total: ${fmtMoney(charges.reduce((s, l) => s + Math.max(0, Number(l.price) || 0), 0) - refunds.reduce((s, l) => s + Math.max(0, Number(l.price) || 0), 0))}</strong></div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
            w.document.close();
        }
    };

    let title: string;
    const isPreferredLang = afterEvent?.default_localization === lang;

    if (isPreferredLang) {
        if (afterEvent === null) {
            title = localize("Event");
        }
        else {
            title = afterEvent!.default_title
        }

    }
    else {
        if (afterEvent === null) {
            title = localize("Event");
        }
        else {
            title = localize(afterEvent!.default_title)
        }
    }


    // ---------- navigation ----------
    const backToSharable = () => navigate(sharableHref);
    const toMyEvents = () => navigate("/profile/my-events");

    // ---------- render ----------
    if (status === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Card className="max-w-md w-full">
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <Loader2 className="h-16 w-16 animate-spin text-blue-600 mx-auto mb-4" />
                            <h2 className="text-xl font-semibold text-gray-900 mb-2">{localize("Processing Payment")}</h2>
                            <p className="text-gray-600">{localize("Verifying your payment and applying your registration…")}</p>
                            <div className="mt-4 text-sm text-gray-500"><p>{localize("Order ID")}: {orderId}</p></div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (status === "error" || status === "missing") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Card className="max-w-lg w-full">
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <XCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">
                                {status === "missing" ? localize("Details Missing") : localize("Payment Processing Failed")}
                            </h2>
                            <Alert variant="destructive" className="mb-6 text-left">
                                <AlertDescription>{message}</AlertDescription>
                            </Alert>
                            <div className="space-y-3">
                                <Button onClick={backToSharable} variant="outline" className="w-full">
                                    <ArrowLeft className="h-4 w-4 mr-2" />
                                    {localize("Back to Event")}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-6xl mx-auto px-4 grid gap-6 lg:grid-cols-2">
                {/* LEFT: Success + Order Summary (scoped to this capture) */}
                <div className="space-y-6">
                    <Card className="border-green-200">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-green-700">
                                <CheckCircle className="h-6 w-6" />
                                {localize("Payment Successful")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">{localize("Payment Confirmed")}</Badge>
                            </div>

                            {/* Counts + Money */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 rounded-md bg-white border">
                                    <div className="text-xs text-gray-500 mb-1">{localize("Added")}</div>
                                    <div className="text-2xl font-semibold">{addedIds.length}</div>
                                </div>
                                <div className="p-3 rounded-md bg-white border">
                                    <div className="text-xs text-gray-500 mb-1">{localize("Removed")}</div>
                                    <div className="text-2xl font-semibold">{removedIds.length}</div>
                                </div>
                                <div className="p-3 rounded-md bg-white border">
                                    <div className="text-xs text-gray-500 mb-1">{localize("Total Charged")}</div>
                                    <div className="text-2xl font-semibold">{fmtMoney(totalCharged)}</div>
                                </div>
                                <div className="p-3 rounded-md bg-white border">
                                    <div className="text-xs text-gray-500 mb-1">{localize("Instant Refunds")}</div>
                                    <div className="text-2xl font-semibold">{fmtMoney(totalRefunded)}</div>
                                </div>
                            </div>

                            <Separator />

                            {/* Added/Removed lists (names from details_map) */}
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <div className="text-sm text-gray-600 mb-2">{localize("Added")}</div>
                                    {addedIds.length === 0 ? (
                                        <div className="text-sm text-muted-foreground">{localize("None")}</div>
                                    ) : (
                                        <ul className="text-sm space-y-1">
                                            {addedIds.map((id) => (
                                                <li key={`add-${id}`} className="flex items-center gap-2">
                                                    <Users className="h-3.5 w-3.5 text-emerald-600" />
                                                    <span>{nameFor(id, detailsMap)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <div>
                                    <div className="text-sm text-gray-600 mb-2">{localize("Removed (refunded if eligible)")}</div>
                                    {removedIds.length === 0 ? (
                                        <div className="text-sm text-muted-foreground">{localize("None")}</div>
                                    ) : (
                                        <ul className="text-sm space-y-1">
                                            {removedIds.map((id) => (
                                                <li key={`rem-${id}`} className="flex items-center gap-2">
                                                    <Users className="h-3.5 w-3.5 text-amber-600" />
                                                    <span>{nameFor(id, detailsMap)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>

                            <Separator />

                            {/* Payment Line Items — scoped to this order and broken down by txn/line */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Receipt className="h-4 w-4" />
                                    <span>{localize("This Order — Charges")}</span>
                                </div>
                                {charges.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">{localize("No charges for this order.")}</p>
                                ) : (
                                    charges.map((l) => (
                                        <div key={`ch-${l.id}-${l.txn ?? ""}-${l.line ?? ""}`} className="rounded-md bg-white border p-3">
                                            <div className="flex items-center justify-between">
                                                <div className="min-w-0">
                                                    <div className="font-medium truncate">{l.label}</div>
                                                    <div className="text-xs text-gray-500">
                                                        {l.method ? `${localize("Method")}: ${l.method}` : `${localize("Method")}: —`}
                                                        {l.txn ? ` • ${localize("Transaction ID")}: ${l.txn}` : ""}
                                                        {l.line ? ` • ${localize("Line ID")}: ${l.line}` : ""}
                                                    </div>
                                                </div>
                                                <div className="text-right text-gray-900">{localize("Charged")} {fmtMoney(asNumber(l.price))}</div>
                                            </div>
                                        </div>
                                    ))
                                )}

                                <div className="flex items-center gap-2 text-sm text-gray-600 pt-2">
                                    <Receipt className="h-4 w-4" />
                                    <span>{localize("This Order — Refunds")}</span>
                                </div>
                                {refunds.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">{localize("No instant refunds were issued.")}</p>
                                ) : (
                                    refunds.map((l) => (
                                        <div key={`rf-${l.id}-${l.txn ?? ""}-${l.line ?? ""}`} className="rounded-md bg-white border p-3">
                                            <div className="flex items-center justify-between">
                                                <div className="min-w-0">
                                                    <div className="font-medium truncate">{l.label}</div>
                                                    <div className="text-xs text-gray-500">
                                                        {l.method ? `${localize("Method")}: ${l.method}` : `${localize("Method")}: —`}
                                                        {l.txn ? ` • ${localize("Transaction ID")}: ${l.txn}` : ""}
                                                        {l.line ? ` • ${localize("Line ID")}: ${l.line}` : ""}
                                                    </div>
                                                </div>
                                                <div className="text-right text-amber-700">{localize("Refunded")} {fmtMoney(asNumber(l.price))}</div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="flex flex-wrap gap-3 pt-2">
                                <Button onClick={toMyEvents} className="flex items-center">
                                    <Users className="h-4 w-4 mr-2" />
                                    {localize("View My Events")}
                                </Button>
                                <Button onClick={backToSharable} variant="outline" className="flex items-center">
                                    <ArrowLeft className="h-4 w-4 mr-2" />
                                    {localize("Back to Event")}
                                </Button>
                                <Button onClick={handleDownloadReceipt} variant="outline" className="flex items-center ml-auto">
                                    <Download className="h-4 w-4 mr-2" />
                                    {localize("Download receipt")}
                                </Button>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                                {localize("You may access your ticket again anytime by viewing the event page")}
                            </p>

                            <Alert className="mt-3">
                                <AlertDescription className="text-xs">
                                    {localize("The refunds shown here reflect refunds made from PayPal directly. Savings gained from removing Pay-At-Door registrations will not be reflected here.")}
                                </AlertDescription>
                            </Alert>
                        </CardContent>
                    </Card>
                </div>

                {/* RIGHT: Event details + Ticket Card + Payment Info */}
                <div className="space-y-6">
                    {afterEvent && (
                        <Card className="overflow-hidden">
                            {heroUrl ? (
                                <img
                                    src={heroUrl}
                                    alt={title || localize("Event image")}
                                    className="block w-full h-auto object-cover max-h-64"
                                    loading="lazy"
                                    decoding="async"
                                />
                            ) : (
                                <div className="w-full h-40 bg-muted" />
                            )}

                            <CardHeader className="pb-0">
                                <CardTitle className="flex items-start justify-between gap-4 pt-4">
                                    <span className="font-semibold">{title}</span>
                                </CardTitle>
                            </CardHeader>

                            <CardContent className="space-y-3">
                                {afterEvent.ministries && afterEvent.ministries.length > 0 && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Church className="h-4 w-4" />
                                        <span>{afterEvent.ministries.map((id: string) => localize(ministryNameMap[id]) || id).join(" • ")}</span>
                                    </div>
                                )}

                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Calendar className="h-4 w-4" />
                                    <span>{localize(fmtDateTime(afterEvent.date))}</span>
                                </div>

                                {afterEvent.location_address && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <MapPin className="h-4 w-4" />
                                        <span className="truncate">{afterEvent.location_address}</span>
                                    </div>
                                )}

                                {typeof afterEvent.seats_filled === "number" &&
                                    typeof afterEvent.max_spots === "number" &&
                                    afterEvent.max_spots > 0 && (
                                        <div className="text-sm text-muted-foreground">
                                            {`${localize("Seats:")} `}<strong>{afterEvent.seats_filled}</strong> / {afterEvent.max_spots}
                                        </div>
                                    )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Ticket card — compact; uses instance + userId only */}
                    {afterEvent && user && (
                        <EventTicketCard instance={afterEvent} userId={user.uid} />
                    )}

                    {/* Payment Info — moved below the Event card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <DollarSign className="h-5 w-5" />
                                {localize("Payment Info")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex justify-between">
                                <span>{localize("Order ID:")}</span>
                                <span className="font-mono">{orderId}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>{localize("Method:")}</span>
                                <span>{localize("PayPal")}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default PaymentSuccessPageV2;
