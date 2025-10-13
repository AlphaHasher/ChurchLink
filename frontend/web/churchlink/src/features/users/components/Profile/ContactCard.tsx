import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardHeader, CardContent, CardFooter } from "@/shared/components/ui/card";
import { Separator } from "@/shared/components/ui/separator";
import type { AddressSchema } from "@/shared/types/ProfileInfo";

type ContactCardProps = {
    phone: string | null;
    address: AddressSchema | null;
    className?: string;
    footer?: React.ReactNode;
};

export const ContactCard: React.FC<ContactCardProps> = ({
    phone,
    address,
    className,
    footer,
}) => {
    const phoneDisplay = (phone ?? "").trim() || "—";

    const addressLines = formatAddress(address);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
        >
            <Card className={["w-96 shadow-lg", className].filter(Boolean).join(" ")}>
                <CardHeader className="flex flex-col items-center">
                    <h2 className="px-4 text-center text-xl font-semibold break-words">
                        Contact Information
                    </h2>
                    <p className="text-center">If you wish, provide us with details we may contact you with.</p>
                </CardHeader>

                <CardContent>
                    <div
                        className="rounded-md border bg-muted/30 text-muted-foreground"
                        aria-disabled="true"
                    >
                        <dl className="cursor-not-allowed">
                            <OverviewRow label="Phone" value={phoneDisplay} />
                            <Separator />
                            <OverviewRow label="Address" value={addressLines[0]} />
                            <Separator />
                            <OverviewRow label="City / State" value={addressLines[1]} />
                            <Separator />
                            <OverviewRow label="Country / Postal" value={addressLines[2]} />
                        </dl>
                    </div>
                </CardContent>

                {footer ? <CardFooter className="justify-center">{footer}</CardFooter> : null}
            </Card>
        </motion.div>
    );
};

function OverviewRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="grid grid-cols-3 items-center gap-3 p-3">
            <dt className="col-span-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
                {label}
            </dt>
            <dd className="col-span-2 min-w-0 whitespace-normal break-all text-sm text-muted-foreground">
                {value || "—"}
            </dd>
        </div>
    );
}

function formatAddress(addr?: AddressSchema | null): [string, string, string] {
    if (!addr) return ["—", "—", "—"];
    const l1 = [addr.address, addr.suite].filter(Boolean).join(", ") || "—";
    const l2 = [addr.city, addr.state].filter(Boolean).join(", ") || "—";
    const l3 = [addr.country, addr.postal_code].filter(Boolean).join(" ").trim() || "—";
    return [l1, l2, l3];
}
