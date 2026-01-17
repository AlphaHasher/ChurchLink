import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Globe } from "lucide-react";
import { LANGUAGES } from "../utils/languageUtils";

interface LanguageSelectorProps {
  value: string;
  onChange: (lang: string) => void;
  availableLanguages: string[];
  className?: string;
}

export function LanguageSelector({
  value,
  onChange,
  availableLanguages,
  className,
}: LanguageSelectorProps) {
  if (availableLanguages.length <= 1) {
    return null;
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className ?? "w-[180px] h-8"}>
        <Globe className="h-4 w-4 mr-2" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {availableLanguages.map((lang) => (
          <SelectItem key={lang} value={lang}>
            {LANGUAGES[lang] || lang} ({lang})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
