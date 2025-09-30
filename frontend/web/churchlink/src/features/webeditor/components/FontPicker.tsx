import React from "react";
import { PageV2 } from "@/shared/types/pageV2";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/shared/components/ui/command";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { GoogleFontOption } from "@/shared/constants/googleFonts";

interface FontPickerProps {
  page: PageV2 | null;
  setPage: React.Dispatch<React.SetStateAction<PageV2 | null>>;
  fontOptions: GoogleFontOption[];
  fontPopoverOpen: boolean;
  setFontPopoverOpen: (open: boolean) => void;
  fontSearch: string;
  setFontSearch: (search: string) => void;
  fontListLoading: boolean;
  isFontCssLoading: boolean;
  selectedFontId: string;
  fontButtonLabel: string;
  fontButtonDescription: string;
  customFontActive: boolean;
  filteredFonts: GoogleFontOption[];
  handleSelectFont: (fontId: string) => void;
  MAX_INITIAL_FONTS: number;
}

const FontPicker: React.FC<FontPickerProps> = ({
  page,
  setPage,
  fontOptions,
  fontPopoverOpen,
  setFontPopoverOpen,
  fontSearch,
  setFontSearch,
  fontListLoading,
  isFontCssLoading,
  selectedFontId,
  fontButtonLabel,
  fontButtonDescription,
  customFontActive,
  filteredFonts,
  handleSelectFont,
  MAX_INITIAL_FONTS,
}) => {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">Default Font</label>
      <div className="grid gap-2">
        <Popover open={fontPopoverOpen} onOpenChange={setFontPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={fontPopoverOpen}
              className="w-full justify-between"
            >
              <div className="flex flex-col text-left">
                <span className="text-sm font-medium leading-tight">{fontButtonLabel}</span>
                <span className="text-xs text-muted-foreground">{fontButtonDescription}</span>
              </div>
              <div className="flex items-center gap-2">
                {(fontListLoading || isFontCssLoading) && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                <ChevronsUpDown className="h-4 w-4 opacity-50" />
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[340px] p-0">
            <Command loop className="max-h-[500px] flex flex-col">
              <CommandInput value={fontSearch} onValueChange={setFontSearch} placeholder="Search fonts..." />
              <CommandList className="max-h-[450px] overflow-y-auto overflow-x-hidden">
                <CommandEmpty>
                  {fontListLoading ? "Loading fonts..." : "No fonts found."}
                </CommandEmpty>
                <CommandGroup heading="Quick options">
                  <CommandItem value="system" onSelect={() => handleSelectFont("system")}>
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedFontId === "system" ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="text-sm">System Default</span>
                      <span className="text-xs text-muted-foreground">Browser default stack</span>
                    </div>
                  </CommandItem>
                  <CommandItem value="custom" onSelect={() => handleSelectFont("custom")}>
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedFontId === "custom" ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="text-sm">Custom…</span>
                      <span className="text-xs text-muted-foreground">Provide a CSS font-family</span>
                    </div>
                  </CommandItem>
                </CommandGroup>
                {filteredFonts.length > 0 && (
                  <CommandGroup heading={`Google Fonts (${fontOptions.length})`}>
                    {filteredFonts.map((font) => (
                      <CommandItem
                        key={font.id}
                        value={font.id}
                        onSelect={() => handleSelectFont(font.id)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedFontId === font.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col">
                          <span className="text-sm">{font.label}</span>
                          <span className="text-xs text-muted-foreground">{font.fontFamily}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {customFontActive && (
          <Input
            placeholder="Custom font family (e.g. 'Acme', sans-serif)"
            value={page?.styleTokens?.defaultFontFamily ?? ""}
            onChange={(event) => {
              const { value } = event.target;
              setPage((prev) =>
                prev
                  ? {
                      ...prev,
                      styleTokens: {
                        ...(prev.styleTokens || {}),
                        defaultFontFamily: value,
                      },
                    }
                  : prev
              );
            }}
          />
        )}
      </div>
    </div>
  );
};

export default FontPicker;
