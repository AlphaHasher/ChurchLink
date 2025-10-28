import { motion } from "framer-motion";
import { Card, CardHeader, CardContent, CardFooter } from "@/shared/components/ui/card";
import { Separator } from "@/shared/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { useLanguage } from "@/provider/LanguageProvider";
import { useLocalize } from "@/shared/utils/localizationUtils";
import { useMemo, useState, useRef, useEffect } from "react";

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
        const localize = useLocalize();
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
    const [langOpen, setLangOpen] = useState(false);
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const filteredLanguages = useMemo(() => {
        const q = langQuery.trim().toLowerCase();
        const allowed = new Set<string>((siteLocales && siteLocales.length ? siteLocales : ["en"]).map((c) => String(c)));
        const base = languages.filter((l) => allowed.has(l.code));
        if (!q) return base;
        return base.filter(l => l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q));
    }, [languages, langQuery, siteLocales]);

    // When dropdown opens, autofocus the search input and keep it focused
    useEffect(() => {
        if (!langOpen) return;
        requestAnimationFrame(() => {
            searchInputRef.current?.focus();
            requestAnimationFrame(() => searchInputRef.current?.focus());
        });
    }, [langOpen]);

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
                            <OverviewRow label={localize("Account email")} value={email} />
                            <Separator />
                            <OverviewRow label={localize("Account name")} value={displayName} />
                            <Separator />
                            <OverviewRow label={localize("Church Member")} value={membership ? localize("Yes") : localize("No")} />
                            <Separator />
                            <OverviewRow label={localize("DOB")} value={dob} />
                            <Separator />
                            <OverviewRow label={localize("Gender")} value={genderDisplay ? localize(genderDisplay) : genderDisplay} />
                            <Separator />
                            <OverviewRow
                                label={localize("Language")}
                                value={
                                    <Select value={selectedLang} onValueChange={handleLanguageChange} disabled={langLoading} onOpenChange={(o) => {
                                        setLangOpen(o);
                                        if (o) {
                                            setLangQuery("");
                                        }
                                    }}>
                                        <SelectTrigger className="w-full max-w-[240px]" aria-label={localize("Select language")}>
                                            <SelectValue placeholder={langLoading ? localize("Loading...") : localize("Select language")} />
                                        </SelectTrigger>
                                        <SelectContent
                                            className="max-h-60"
                                            onKeyDownCapture={(e) => {
                                                const target = e.target as HTMLElement | null;
                                                if (target && target.tagName === 'INPUT') {
                                                    e.stopPropagation();
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                const target = e.target as HTMLElement | null;
                                                if (target && target.tagName === 'INPUT') {
                                                    e.stopPropagation();
                                                }
                                            }}
                                            onCloseAutoFocus={(e) => {
                                                e.preventDefault();
                                            }}
                                        >
                                            <div className="sticky top-0 z-10 bg-popover p-1">
                                                <input
                                                    ref={searchInputRef}
                                                    value={langQuery}
                                                    onChange={(e) => {
                                                        setLangQuery(e.target.value);
                                                        requestAnimationFrame(() => searchInputRef.current?.focus());
                                                    }}
                                                    placeholder={localize("Search language...")}
                                                    className="w-full h-8 rounded-md border px-2 text-sm"
                                                    onKeyDownCapture={(e) => e.stopPropagation()}
                                                    onKeyDown={(e) => e.stopPropagation()}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    onPointerDown={(e) => e.stopPropagation()}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onBlur={() => {
                                                        if (langOpen) {
                                                            requestAnimationFrame(() => searchInputRef.current?.focus());
                                                        }
                                                    }}
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
