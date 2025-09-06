import * as React from "react";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type ProfileCardProps = {
    displayName?: string;
    email?: string;
    accountName?: string;
    dob?: string;
    gender?: string;
    className?: string;
    /** Optional footer content (e.g., action buttons) */
    footer?: React.ReactNode;
};

export const ProfileCard: React.FC<ProfileCardProps> = ({
    displayName = "Fake Name",
    email = "example@example.com",
    accountName = "First Last",
    dob = "1/1/2000",
    gender = "M",
    className,
    footer,
}) => {
    return (
        <Card className={["w-80 shadow-lg", className].filter(Boolean).join(" ")}>
            <CardHeader className="flex flex-col items-center">
                <div className="mb-4 h-24 w-24 rounded-full bg-gray-300" />
                <h2 className="text-xl font-semibold">{displayName}</h2>
            </CardHeader>

            <CardContent>
                <div
                    className="rounded-md border bg-muted/30 text-muted-foreground"
                    aria-disabled="true"
                >
                    <dl className="cursor-not-allowed">
                        <OverviewRow label="Account email" value={email} />
                        <Separator />
                        <OverviewRow label="Account name" value={accountName} />
                        <Separator />
                        <OverviewRow label="DOB" value={dob} />
                        <Separator />
                        <OverviewRow label="Gender" value={gender} />
                    </dl>
                </div>
            </CardContent>

            {footer ? <CardFooter className="justify-center">{footer}</CardFooter> : null}
        </Card>
    );
};

function OverviewRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="grid grid-cols-3 items-center gap-3 p-3">
            <dt className="col-span-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
                {label}
            </dt>
            <dd className="col-span-2 text-sm text-muted-foreground">{value}</dd>
        </div>
    );
}