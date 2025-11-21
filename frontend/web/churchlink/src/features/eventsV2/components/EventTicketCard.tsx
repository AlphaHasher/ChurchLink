import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { QrCode, Download } from "lucide-react";
import * as QRCode from "qrcode";
import { getPublicUrl } from "@/helpers/MediaInteraction";
import { useFetchEventInstanceDetails } from "@/helpers/EventUserHelper";
import { useLocalize } from "@/shared/utils/localizationUtils";

type InstanceLike = {
    id: string;                 // instance id
    event_id: string;           // parent event id
    default_title?: string | null;
    date?: string | null;
    end_date?: string | null;
    location_address?: string | null;
    default_location_info?: string | null;
    image_id?: string | null;
    event_registrations?: {
        self_registered?: boolean;
        family_registered?: string[] | null;
    } | null;
};

type Props = {
    instance: InstanceLike;
    userId: string;
};

const fmtDateTime = (iso?: string | null) => {
    if (!iso) return "";
    try {
        return new Date(iso).toLocaleString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    } catch {
        return iso || "";
    }
};

export default function EventTicketCard({ instance, userId }: Props) {
    const localize = useLocalize();
    // Build deep link (not displayed)
    const rawHost = import.meta.env.VITE_WEB_DOMAIN?.trim();
    const fallbackOrigin = typeof window !== "undefined" ? window.location.origin : "";
    const baseUrl = rawHost && rawHost.length > 0 ? rawHost : fallbackOrigin;
    const adminUrl = useMemo(
        () =>
            `${baseUrl}/admin/events/${encodeURIComponent(instance.event_id)}/instance_details/${encodeURIComponent(
                instance.id
            )}/user_registrations/${encodeURIComponent(userId)}`,
        [baseUrl, instance.event_id, instance.id, userId]
    );

    // Compact card: QR only + explainer
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [pdfBusy, setPdfBusy] = useState(false);

    // Registrant count (no names)
    const [registrantCount, setRegistrantCount] = useState<number>(0);
    const { fetchEventInstanceDetails } = useFetchEventInstanceDetails();

    useEffect(() => {
        // seed from instance payload if available
        const regs = instance.event_registrations;
        const seedCount =
            (regs?.self_registered ? 1 : 0) +
            (Array.isArray(regs?.family_registered) ? regs!.family_registered!.length : 0);
        if (seedCount > 0) setRegistrantCount(seedCount);

        // best-effort fetch if we didn't have it
        if (seedCount === 0) {
            (async () => {
                try {
                    const resp = await fetchEventInstanceDetails(instance.id);
                    const r = resp?.event_details?.event_registrations;
                    const c =
                        (r?.self_registered ? 1 : 0) +
                        (Array.isArray(r?.family_registered) ? r!.family_registered!.length : 0);
                    if (c > 0) setRegistrantCount(c);
                } catch {
                    /* ignore; card remains minimal */
                }
            })();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [instance.id]);

    // Render QR
    useEffect(() => {
        if (typeof window === "undefined") return;
        (async () => {
            try {
                if (!canvasRef.current) return;
                await QRCode.toCanvas(canvasRef.current, adminUrl, {
                    width: 224,
                    margin: 1,
                    errorCorrectionLevel: "M",
                });
            } catch {
                // ignore
            }
        })();
    }, [adminUrl]);

    // --- PDF generation (with banner like the payment receipt) ---
    const onDownloadPdf = async () => {
        setPdfBusy(true);
        try {
            const { jsPDF } = await import("jspdf");

            const title = instance.default_title || "Event";
            const start = fmtDateTime(instance.date);
            const end = fmtDateTime(instance.end_date);
            const location = instance.location_address || instance.default_location_info || "";
            const heroUrl = instance.image_id ? getPublicUrl(instance.image_id) : null;

            const mmToPx300 = (mm: number) => Math.max(1, Math.round((mm / 25.4) * 300));

            async function makeCoverBannerFromUrl(
                url: string,
                targetWmm: number,
                targetHmm: number
            ): Promise<{ dataUrl: string; format: "JPEG" | "PNG" } | null> {
                try {
                    // Fetch as a blob to avoid CORS-tainting the canvas
                    const res = await fetch(url, { cache: "no-store" });
                    if (!res.ok) return null;
                    const blob = await res.blob();
                    const format: "JPEG" | "PNG" = blob.type.includes("png") ? "PNG" : "JPEG";

                    // Create a bitmap from the blob (fast + no layout)
                    let bmp: ImageBitmap | null = null;
                    try {
                        bmp = await createImageBitmap(blob);
                    } catch {
                        // Fallback to <img src=blobURL>
                        const blobUrl = URL.createObjectURL(blob);
                        await new Promise<void>((resolve, reject) => {
                            const img = new Image();
                            img.onload = () => { bmp = (img as any); resolve(); };
                            img.onerror = reject;
                            img.src = blobUrl;
                        }).finally(() => {
                            // revoke later in case of the fallback
                            setTimeout(() => URL.revokeObjectURL((bmp as any)?.src ?? ""), 0);
                        });
                    }
                    if (!bmp) return null;

                    const iw = (bmp as any).width ?? (bmp as any).naturalWidth;
                    const ih = (bmp as any).height ?? (bmp as any).naturalHeight;
                    if (!iw || !ih) return null;

                    const cw = mmToPx300(targetWmm);
                    const ch = mmToPx300(targetHmm);
                    const scale = Math.max(cw / iw, ch / ih);
                    const dw = Math.round(iw * scale);
                    const dh = Math.round(ih * scale);
                    const dx = Math.round((cw - dw) / 2);
                    const dy = Math.round((ch - dh) / 2);

                    const canvas = document.createElement("canvas");
                    canvas.width = cw; canvas.height = ch;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) return null;
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = "high";
                    // drawImage works with ImageBitmap or HTMLImageElement
                    ctx.drawImage(bmp as any, dx, dy, dw, dh);

                    const mime = format === "PNG" ? "image/png" : "image/jpeg";
                    const dataUrl = canvas.toDataURL(mime, 0.92);
                    return { dataUrl, format };
                } catch {
                    return null;
                }
            }

            const doc = new jsPDF("p", "mm", "a4");
            const pageW = doc.internal.pageSize.getWidth();
            const marginL = 14, marginR = 14, marginT = 14
            const contentW = pageW - marginL - marginR;
            let y = marginT;

            const bannerH = 38;
            if (heroUrl) {
                const banner = await makeCoverBannerFromUrl(heroUrl, contentW, bannerH);
                if (banner) {
                    doc.addImage(banner.dataUrl, banner.format, marginL, y, contentW, bannerH, undefined, "SLOW");
                    y += bannerH + 6;
                    doc.setDrawColor(210);
                    doc.line(marginL, y, pageW - marginR, y);
                    y += 6;
                }
            }

            // Header + details
            doc.setFontSize(18);
            doc.text(title, marginL, y); y += 8;

            doc.setFontSize(11);
            if (start) { doc.text(`Start: ${start}`, marginL, y); y += 6; }
            if (end) { doc.text(`End:   ${end}`, marginL, y); y += 6; }
            if (location) { doc.text(`Location: ${location}`, marginL, y); y += 8; }

            // QR from canvas
            const qrDataUrl = (() => {
                const c = canvasRef.current;
                try { return c ? c.toDataURL("image/png") : null; } catch { return null; }
            })();
            if (qrDataUrl) {
                doc.addImage(qrDataUrl, "PNG", marginL, y, 60, 60);
            }

            // Explainer + registrant count
            const rightX = marginL + 60 + 8;
            const blurb =
                "Present this ticket at check-in. Scanning the QR shows the event administrator your account’s registrations for this event. You do not need a code per registrant.";
            doc.setFontSize(10);
            doc.text(blurb, rightX, y + 2, { maxWidth: pageW - marginR - rightX });
            y += 60 + 8;

            doc.setFontSize(11);
            doc.text(
                `Registrants: ${Math.max(0, registrantCount)} (Code will remain valid even if registrants added/dropped)`,
                marginL,
                y
            );

            const base = (title || "event")
                .normalize("NFKD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-zA-Z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "")
                .toLowerCase()
                || "event";

            doc.save(`${base}-ticket.pdf`);
        } finally {
            setPdfBusy(false);
        }
    };

    return (
        <Card className="p-4">
            <div className="flex items-center gap-2 mb-3 font-semibold">
                <QrCode className="h-4 w-4 text-muted-foreground" />
                {localize("Ticket")}
            </div>

            <div className="space-y-3">
                <div className="flex justify-center">
                    <canvas
                        ref={canvasRef}
                        width={224}
                        height={224}
                        className="rounded-md border sm:w-[224px] sm:h-[224px] w-[192px] h-[192px]"
                    />
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed">
                    {localize("This QR code can be scanned to show an event administrator all of the registrations on your account. You do not need a code per registrant—this single code is valid for all of your registrants.")}
                </p>

                <div className="text-xs text-muted-foreground">
                    {localize("Registrants")}: <span className="font-medium text-foreground">{Math.max(0, registrantCount)}</span>{" "}
                    <span className="text-muted-foreground">({localize("Code will remain valid even if registrants added/dropped")})</span>
                </div>

                <Button onClick={onDownloadPdf} disabled={pdfBusy} className="w-full gap-2">
                    <Download className="h-4 w-4" />
                    {pdfBusy ? localize("Preparing…") : localize("Download PDF")}
                </Button>
            </div>
        </Card>
    );
}
