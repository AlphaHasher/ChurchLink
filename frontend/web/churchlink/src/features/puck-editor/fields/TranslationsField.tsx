import { usePuck } from "@measured/puck";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/components/ui/collapsible";
import { ChevronDown, X } from "lucide-react";
import { LANGUAGES, type TranslationMap } from "../utils/languageUtils";

interface TranslationsFieldProps {
  value: TranslationMap;
  onChange: (value: TranslationMap) => void;
  translatableFields: Array<{ name: string; type?: "text" | "textarea"; label: string }>;
}

export function TranslationsField({
  value = {},
  onChange,
  translatableFields,
}: TranslationsFieldProps) {
  const { appState } = usePuck();
  const supportedLanguages = (appState.data.root.props?.supportedLanguages as string[]) || ["en"];
  const defaultLanguage = (appState.data.root.props?.defaultLanguage as string) || "en";

  // Filter out default language (translations are for non-default languages only)
  const translatableLanguages = supportedLanguages.filter((lang) => lang !== defaultLanguage);

  const handleFieldChange = (locale: string, fieldName: string, fieldValue: string) => {
    const updatedTranslations = { ...value };

    if (!updatedTranslations[locale]) {
      updatedTranslations[locale] = {};
    }

    updatedTranslations[locale][fieldName] = fieldValue;
    onChange(updatedTranslations);
  };

  const handleRemoveLanguage = (locale: string) => {
    const updatedTranslations = { ...value };
    delete updatedTranslations[locale];
    onChange(updatedTranslations);
  };

  if (translatableLanguages.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No additional languages configured. Add supported languages in the page settings.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground mb-2">
        Add translations for non-default languages. Leave blank to use smart fallback.
      </div>

      {translatableLanguages.map((locale) => {
        const languageName = LANGUAGES[locale] || locale;
        const hasTranslations = value[locale] && Object.values(value[locale]).some((v) => v?.trim());

        return (
          <Collapsible key={locale} className="border rounded-md">
            <div className="flex items-center justify-between px-3 py-2">
              <CollapsibleTrigger className="flex items-center gap-2 flex-1 text-left hover:bg-accent rounded-sm px-2 py-1">
                <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 data-[state=open]:rotate-180" />
                <span className="font-normal">
                  {languageName} ({locale})
                </span>
                {hasTranslations && (
                  <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                    Has translations
                  </span>
                )}
              </CollapsibleTrigger>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveLanguage(locale)}
                className="h-8 w-8 p-0"
                title={`Remove ${languageName} translations`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <CollapsibleContent className="px-3 pb-3 space-y-3">
              {translatableFields.map((field) => {
                const fieldValue = value[locale]?.[field.name] || "";
                const InputComponent = field.type === "textarea" ? Textarea : Input;

                return (
                  <div key={field.name} className="space-y-1">
                    <label className="text-sm font-medium">{field.label}</label>
                    <InputComponent
                      value={fieldValue}
                      onChange={(e) => handleFieldChange(locale, field.name, e.target.value)}
                      placeholder={`Enter ${field.label.toLowerCase()} in ${languageName}`}
                      className="w-full"
                    />
                  </div>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
