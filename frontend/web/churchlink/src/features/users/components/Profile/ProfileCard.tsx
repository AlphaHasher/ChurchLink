import { motion } from "framer-motion";
import { Card, CardHeader, CardContent, CardFooter } from "@/shared/components/ui/card";
import { Separator } from "@/shared/components/ui/separator";
import { Button } from "@/shared/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/shared/components/ui/command";
import { ChevronsUpDown, Check } from "lucide-react";
import { localizationCodeToName } from "@/lib/LocalizationDicts";
import { useLanguage } from "@/provider/LanguageProvider";
import { useLocalize } from "@/shared/utils/localizationUtils";
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

    const { locale: selectedLang, setLocale: handleLanguageChange, languages, loading: langLoading } = useLanguage();
    const [langOpen, setLangOpen] = useState(false);
    //pinning common languages at the top of the list
    const pinnedCodes = useMemo(() => ["en", "ru", "es", "fr", "de", "pt", "zh", "ar"], []);
    const orderedLanguages = useMemo(() => {
        const byCode = new Map(languages.map((l) => [l.code, l] as const));
        const pinned = pinnedCodes
            .map((code) => byCode.get(code))
            .filter((v): v is NonNullable<typeof v> => Boolean(v));
        const pinnedSet = new Set(pinned.map((l) => l.code));
        const rest = languages.filter((l) => !pinnedSet.has(l.code));
        const labelFor = (code: string, fallbackName: string) => localizationCodeToName?.[code] || `${fallbackName} (${code})`;
        rest.sort((a, b) => labelFor(a.code, a.name).localeCompare(labelFor(b.code, b.name)));
        return [...pinned, ...rest];
    }, [languages, pinnedCodes]);
    const selectedLanguageLabel = useMemo(() => {
        const mapped = localizationCodeToName?.[selectedLang];
        if (mapped) return mapped;
        const m = languages.find((l) => l.code === selectedLang);
        return m ? `${m.name} (${m.code})` : selectedLang;
    }, [languages, selectedLang]);

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
                                    <Popover open={langOpen} onOpenChange={setLangOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={langOpen}
                                                className="w-full max-w-[280px] justify-between"
                                                disabled={langLoading}
                                                aria-label={localize("Select language")}
                                            >
                                                <span className="truncate">
                                                    {langLoading ? localize("Loading...") : (selectedLanguageLabel || localize("Select language"))}
                                                </span>
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent align="start" className="w-[300px] p-0">
                                            <Command loop>
                                                <CommandInput placeholder={localize("Search language...")} />
                                                <CommandList className="max-h-60 overflow-y-auto overflow-x-hidden">
                                                    <CommandEmpty>{localize("No language found.")}</CommandEmpty>
                                                    <CommandGroup>
                                                        {orderedLanguages.map((l) => {
                                                            const label = localizationCodeToName?.[l.code] || `${l.name} (${l.code})`;
                                                            return (
                                                                <CommandItem key={l.code} value={label} onSelect={() => { handleLanguageChange(l.code); setLangOpen(false); }}>
                                                                    <Check className={`mr-2 h-4 w-4 ${selectedLang === l.code ? "opacity-100" : "opacity-0"}`} />
                                                                    <span className="font-medium">{label}</span>
                                                                </CommandItem>
                                                            );
                                                        })}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
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
