import { useState, useEffect } from "react";
import { Button } from "@/shared/components/ui/button";
import { Loader2 } from "lucide-react";
import { MultiSelect, MultiSelectOption } from "@/shared/components/ui/multi-select";
import api from "@/api/api";

interface LocaleSelectorProps {
  supportedLocales: string[];
  customLocales?: Set<string>; // Keep for backward compatibility but no longer used
  onAddLocale: (locale: string) => void;
  onRemoveLocale: (locale: string) => void;
  onRequestTranslations: () => Promise<void>;
  isTranslating: boolean;
  translationError?: string | null;
}

interface LanguageOption {
  code: string;
  name: string;
}

export function LocaleSelector({
  supportedLocales,
  onAddLocale,
  onRemoveLocale,
  onRequestTranslations,
  isTranslating,
  translationError,
}: LocaleSelectorProps) {
  const [availableLanguages, setAvailableLanguages] = useState<MultiSelectOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load available languages from backend
  useEffect(() => {
    const loadLanguages = async () => {
      setIsLoading(true);
      try {
        const response = await api.get<{ languages: LanguageOption[] }>('/v1/translator/languages');
        const languages = response.data.languages
          .filter(lang => lang.code !== 'en') // Exclude English as it's the default
          .map(lang => ({
            label: `${lang.name} (${lang.code})`,
            value: lang.code,
          }))
          .sort((a, b) => a.label.localeCompare(b.label));
        setAvailableLanguages(languages);
      } catch (error) {
        console.error('Failed to load languages:', error);
        // Fallback to empty array - user can still manually type codes if needed
        setAvailableLanguages([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadLanguages();
  }, []);

  const handleLanguageSelect = (selectedCodes: string[]) => {
    // Find newly added locales
    const newLocales = selectedCodes.filter(code => !supportedLocales.includes(code));
    newLocales.forEach(code => onAddLocale(code));

    // Find removed locales
    const removedLocales = supportedLocales.filter(code => !selectedCodes.includes(code));
    removedLocales.forEach(code => onRemoveLocale(code));
  };

  return (
    <div className="flex items-center gap-3">
      <div className="text-sm text-muted-foreground whitespace-nowrap">Supported locales:</div>

      {/* Multi-select dropdown for managing locales */}
      <MultiSelect
        options={availableLanguages}
        onValueChange={handleLanguageSelect}
        defaultValue={supportedLocales}
        placeholder={isLoading ? "Loading languages..." : "Select languages..."}
        searchable={true}
        disabled={isLoading}
        className="flex-1 min-w-0"
        popoverClassName="w-auto"
        variant="default"
        maxCount={3}
        animation={0}
        animationConfig={{
          badgeAnimation: "none",
          popoverAnimation: "none",
          optionHoverAnimation: "none",
          duration: 0,
          delay: 0
        }}
        emptyIndicator={
          <div className="text-center text-sm text-muted-foreground py-4">
            No languages found
          </div>
        }
      />

      {/* Request translations button */}
      {supportedLocales.length > 0 && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRequestTranslations}
          disabled={isTranslating}
          title="Generate translations for all locales"
        >
          {isTranslating ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Translating...
            </>
          ) : (
            'Translate'
          )}
        </Button>
      )}

      {translationError && (
        <div className="text-xs text-destructive">{translationError}</div>
      )}
    </div>
  );
}
