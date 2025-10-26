import { motion } from "framer-motion";
import { Card, CardHeader, CardContent, CardFooter } from "@/shared/components/ui/card";
import { Separator } from "@/shared/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { useLanguage } from "@/provider/LanguageProvider";
import { useMemo, useState } from "react";

type ProfileCardProps = {
    firstName: string;
    lastName: string;
    email: string;
    membership: boolean;
    birthday?: Date | null;
    gender?: string | null;
    className?: string;
    footer?: React.ReactNode;
};

export const ProfileCard: React.FC<ProfileCardProps> = ({
    firstName,
    lastName,
    email,
    membership,
    birthday,
    gender,
    className,
    footer,
}) => {
    const displayName = `${firstName} ${lastName}`.trim();

    const dob = birthday
        ? birthday.toLocaleDateString(undefined, {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        })
        : "—";

    const genderDisplay = gender ?? "—";

    const initials = getInitials(firstName, lastName);

    // Language selector state
    const { locale: selectedLang, setLocale: handleLanguageChange, languages, loading: langLoading, siteLocales } = useLanguage();
    const [langQuery, setLangQuery] = useState("");
    const filteredLanguages = useMemo(() => {
        const q = langQuery.trim().toLowerCase();
        const allowed = new Set<string>((siteLocales && siteLocales.length ? siteLocales : ["en"]).map((c) => String(c)));
        const base = languages.filter((l) => allowed.has(l.code));
        if (!q) return base;
        return base.filter(l => l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q));
    }, [languages, langQuery, siteLocales]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
        >
            <Card className={["w-96 shadow-lg", className].filter(Boolean).join(" ")}>
                <CardHeader className="flex flex-col items-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-300 text-3xl font-bold text-gray-700">
                        {initials}
                    </div>
                    <h2 className="px-4 text-center text-xl font-semibold break-words">
                        {displayName}
                    </h2>
                </CardHeader>

                <CardContent>
                    <div
                        className="rounded-md border bg-muted/30 text-muted-foreground"
                        aria-disabled="true"
                    >
                        <dl className="cursor-not-allowed">
                            <OverviewRow label="Account email" value={email} />
                            <Separator />
                            <OverviewRow label="Account name" value={displayName} />
                            <Separator />
                            <OverviewRow label="Church Member" value={membership ? "Yes" : "No"} />
                            <Separator />
                            <OverviewRow label="DOB" value={dob} />
                            <Separator />
                            <OverviewRow label="Gender" value={genderDisplay} />
                            <Separator />
                            <OverviewRow
                                label="Language"
                                value={
                                    <Select value={selectedLang} onValueChange={handleLanguageChange} disabled={langLoading} onOpenChange={(o) => { if (o) setLangQuery(""); }}>
                                        <SelectTrigger className="w-full max-w-[240px]" aria-label="Select language">
                                            <SelectValue placeholder={langLoading ? "Loading..." : "Select language"} />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-60">
                                            <div className="sticky top-0 z-10 bg-popover p-1">
                                                <input
                                                    value={langQuery}
                                                    onChange={(e) => setLangQuery(e.target.value)}
                                                    placeholder="Search language..."
                                                    className="w-full h-8 rounded-md border px-2 text-sm"
                                                    onKeyDown={(e) => e.stopPropagation()}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                            {filteredLanguages.map((l) => (
                                                <SelectItem key={l.code} value={l.code}>
                                                    <span className="font-medium">{l.name}</span>
                                                    <span className="text-xs text-muted-foreground"> ({l.code})</span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                }
                            />
                        </dl>
                    </div>
                </CardContent>

                {footer ? <CardFooter className="justify-center">{footer}</CardFooter> : null}
            </Card>
        </motion.div>
    );
};

function OverviewRow({ label, value }: { label: string; value: React.ReactNode }) {
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

function getInitials(first: string, last: string) {
    const f = first?.trim()?.[0] ?? "";
    const l = last?.trim()?.[0] ?? "";
    return (f + l).toUpperCase();
}
