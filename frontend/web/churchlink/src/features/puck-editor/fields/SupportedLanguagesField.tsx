import { useState, useMemo } from "react";
import { usePuck } from "@measured/puck";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { Badge } from "@/shared/components/ui/badge";
import { Check, X, Plus, AlertCircle } from "lucide-react";
import { LANGUAGES, getLanguagesInUse } from "../utils/languageUtils";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";

interface SupportedLanguagesFieldProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export function SupportedLanguagesField({
  value = ["en"],
  onChange,
}: SupportedLanguagesFieldProps) {
  const { appState } = usePuck();
  const defaultLanguage = (appState.data.root.props?.defaultLanguage as string) || "en";
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Get languages that are actually being used in translations
  const languagesInUse = useMemo(() => {
    return getLanguagesInUse(appState.data);
  }, [appState.data]);

  // Filter languages based on search
  const filteredLanguages = Object.entries(LANGUAGES).filter(
    ([code, name]) =>
      name.toLowerCase().includes(search.toLowerCase()) ||
      code.toLowerCase().includes(search.toLowerCase())
  );

  const isLanguageRemovable = (languageCode: string): boolean => {
    // Cannot remove default language
    if (languageCode === defaultLanguage) {
      return false;
    }
    // Cannot remove if language has translations in use
    if (languagesInUse.includes(languageCode)) {
      return false;
    }
    return true;
  };

  const handleToggleLanguage = (languageCode: string) => {
    // Prevent removing if not removable
    if (value.includes(languageCode) && !isLanguageRemovable(languageCode)) {
      return;
    }

    if (value.includes(languageCode)) {
      onChange(value.filter((code) => code !== languageCode));
    } else {
      onChange([...value, languageCode]);
    }
  };

  const handleRemoveLanguage = (languageCode: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // Prevent removing if not removable
    if (!isLanguageRemovable(languageCode)) {
      return;
    }

    onChange(value.filter((code) => code !== languageCode));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map((languageCode) => {
          const languageName = LANGUAGES[languageCode] || languageCode;
          const isDefault = languageCode === defaultLanguage;
          const isInUse = languagesInUse.includes(languageCode);
          const removable = isLanguageRemovable(languageCode);

          return (
            <TooltipProvider key={languageCode}>
              <Badge variant="secondary" className="gap-1">
                {languageName} ({languageCode})
                {isDefault && <span className="text-xs">(default)</span>}
                {isInUse && !isDefault && (
                  <span className="text-xs text-muted-foreground">(in use)</span>
                )}
                {!removable ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="ml-1 cursor-not-allowed opacity-50">
                        <AlertCircle className="h-3 w-3" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {isDefault
                          ? "Cannot remove default language"
                          : "Remove all translations in this language first"}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <button
                    onClick={(e) => handleRemoveLanguage(languageCode, e)}
                    className="ml-1 hover:bg-destructive/20 rounded-full"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            </TooltipProvider>
          );
        })}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Language
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <div className="p-2">
            <Input
              placeholder="Search languages..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {filteredLanguages.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                No languages found
              </div>
            ) : (
              <div className="p-1">
                {filteredLanguages.map(([code, name]) => {
                  const isSelected = value.includes(code);
                  const isDefault = code === defaultLanguage;

                  return (
                    <button
                      key={code}
                      onClick={() => handleToggleLanguage(code)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent",
                        isSelected && "bg-accent"
                      )}
                    >
                      <div
                        className={cn(
                          "h-4 w-4 border rounded-sm flex items-center justify-center",
                          isSelected && "bg-primary border-primary"
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <span className="flex-1 text-left">
                        {name} ({code})
                      </span>
                      {isDefault && (
                        <span className="text-xs text-muted-foreground">default</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <div className="text-xs text-muted-foreground space-y-1">
        <p>The default language ({LANGUAGES[defaultLanguage]}) cannot be removed.</p>
        {languagesInUse.length > 0 && (
          <p>
            Languages with active translations cannot be removed. Remove translations first.
          </p>
        )}
      </div>
    </div>
  );
}
