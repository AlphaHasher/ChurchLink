import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Spinner } from "@/shared/components/ui/spinner";
import { LanguageOption } from "@/shared/utils/localizationUtils";

interface LocaleSelectProps {
  value: string;
  locales: string[];
  languages?: LanguageOption[];
  onChange: (code: string) => void | Promise<void>;
  disabled?: boolean;
  isBusy?: boolean;
  triggerClassName?: string;
  busyLabel?: string;
}

const DEFAULT_TRIGGER_WIDTH = "w-[180px]";

const LocaleSelect: React.FC<LocaleSelectProps> = ({
  value,
  locales,
  languages = [],
  onChange,
  disabled = false,
  isBusy = false,
  triggerClassName = DEFAULT_TRIGGER_WIDTH,
  busyLabel = "Translating...",
}) => {
  const options = useMemo(() => {
    const seen = new Set<string>();
    return locales
      .filter((code) => {
        if (!code || seen.has(code)) return false;
        seen.add(code);
        return true;
      })
      .map((code) => {
        const match = languages.find((lang) => lang.code === code);
        const name = match?.name?.trim();
        return {
          code,
          label: name ? `${name} (${code})` : code.toUpperCase(),
        };
      });
  }, [locales, languages]);

  const selected = options.find((opt) => opt.code === value)?.label;

  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={disabled || isBusy || options.length === 0}
    >
      <SelectTrigger className={triggerClassName}>
        <SelectValue>
          {isBusy ? (
            <span className="flex items-center gap-2">
              <Spinner className="size-3" />
              {busyLabel}
            </span>
          ) : (
            selected || value
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.code} value={opt.code}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default LocaleSelect;
