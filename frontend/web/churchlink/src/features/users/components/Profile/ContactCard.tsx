import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardHeader, CardContent, CardFooter } from "@/shared/components/ui/card";
import { Separator } from "@/shared/components/ui/separator";
import type { AddressSchema } from "@/shared/types/ProfileInfo";
import { useLocalize, TranslationFunction } from "@/shared/utils/localizationUtils";

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
    const localize = useLocalize();
    const phoneDisplay = (phone ?? "").trim() || localize("—");

    const addressLines = formatAddress(address, localize);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
        >
            <Card className={["w-96 shadow-lg", className].filter(Boolean).join(" ")}>
                <CardHeader className="flex flex-col items-center">
                    <h2 className="px-4 text-center text-xl font-semibold break-words">
                        {localize("Contact Information")}
                    </h2>
                    <p className="text-center">{localize("If you wish, provide us with details we may contact you with.")}</p>
                </CardHeader>

                <CardContent>
                    <div
                        className="rounded-md border bg-muted/30 text-muted-foreground"
                        aria-disabled="true"
                    >
                        <dl className="cursor-not-allowed">
                            <OverviewRow label={localize("Phone")} value={phoneDisplay} />
                            <Separator />
                            <OverviewRow label={localize("Address")} value={addressLines[0]} />
                            <Separator />
                            <OverviewRow label={localize("City / State")} value={addressLines[1]} />
                            <Separator />
                            <OverviewRow label={localize("Country / Postal")} value={addressLines[2]} />
                        </dl>
                    </div>
                </CardContent>

                {footer ? <CardFooter className="justify-center pt-4">{footer}</CardFooter> : null}
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
                {value}
            </dd>
        </div>
    );
}

function formatAddress(addr: AddressSchema | null | undefined, localize: TranslationFunction): [string, string, string] {
    const fallback = localize("—");
    if (!addr) return [fallback, fallback, fallback];
    const l1 = [addr.address, addr.suite].filter(Boolean).join(", ") || fallback;
    const l2 = [addr.city, addr.state].filter(Boolean).join(", ") || fallback;
    const l3 = [addr.country, addr.postal_code].filter(Boolean).join(" ").trim() || fallback;
    return [l1, l2, l3];
}
