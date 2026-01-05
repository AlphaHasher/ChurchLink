import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import api from "@/api/api";

interface GoogleFont {
  family: string;
  variants: string[];
  category: string;
}

// Font value format: "FontFamily:weight:style" e.g. "Roboto:700:italic" or just "Roboto"
interface FontFamilyFieldProps {
  value: string;
  onChange: (value: string) => void;
}

// Global cache to avoid re-fetching
let cachedFonts: GoogleFont[] | null = null;
let fetchPromise: Promise<void> | null = null;

// Parse font value into parts
function parseFontValue(value: string): { family: string; weight: string; style: string } {
  if (!value) return { family: "", weight: "400", style: "normal" };
  const parts = value.split(":");
  return {
    family: parts[0] || "",
    weight: parts[1] || "400",
    style: parts[2] || "normal",
  };
}

// Build font value from parts
function buildFontValue(family: string, weight: string, style: string): string {
  if (!family) return "";
  // Only include weight/style if not default
  if (weight === "400" && style === "normal") return family;
  if (style === "normal") return `${family}:${weight}`;
  return `${family}:${weight}:${style}`;
}

// Convert Google Font variant to weight and style
function parseVariant(variant: string): { weight: string; style: string } {
  if (variant === "regular") return { weight: "400", style: "normal" };
  if (variant === "italic") return { weight: "400", style: "italic" };

  const isItalic = variant.includes("italic");
  const weight = variant.replace("italic", "") || "400";
  return { weight, style: isItalic ? "italic" : "normal" };
}

// Get available weights for a font
function getAvailableWeights(font: GoogleFont | undefined): string[] {
  if (!font) return ["400"];
  const weights = new Set<string>();
  font.variants.forEach(v => {
    const { weight } = parseVariant(v);
    weights.add(weight);
  });
  return Array.from(weights).sort((a, b) => parseInt(a) - parseInt(b));
}

// Check if font has italic variant for given weight
function hasItalic(font: GoogleFont | undefined, weight: string): boolean {
  if (!font) return false;
  return font.variants.some(v => {
    const parsed = parseVariant(v);
    return parsed.weight === weight && parsed.style === "italic";
  });
}

const weightLabels: Record<string, string> = {
  "100": "Thin",
  "200": "Extra Light",
  "300": "Light",
  "400": "Regular",
  "500": "Medium",
  "600": "Semi Bold",
  "700": "Bold",
  "800": "Extra Bold",
  "900": "Black",
};

export function FontFamilyField({ value, onChange }: FontFamilyFieldProps) {
  const [fonts, setFonts] = useState<GoogleFont[]>(cachedFonts || []);
  const [loading, setLoading] = useState(!cachedFonts);
  const [searchQuery, setSearchQuery] = useState("");

  const { family, weight, style } = parseFontValue(value);

  useEffect(() => {
    if (cachedFonts) return;

    if (!fetchPromise) {
      fetchPromise = api.get("/v1/fonts/google-fonts")
        .then(res => {
          const fonts = res.data.fonts || [];
          cachedFonts = fonts;
          setFonts(fonts);
          setLoading(false);
        })
        .catch(err => {
          console.error("Failed to load fonts:", err);
          setLoading(false);
        });
    } else {
      fetchPromise.then(() => {
        setFonts(cachedFonts || []);
        setLoading(false);
      });
    }
  }, []);

  const filteredFonts = searchQuery
    ? fonts.filter(font =>
        font.family.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : fonts;

  const selectedFont = fonts.find(f => f.family === family);
  const availableWeights = getAvailableWeights(selectedFont);
  const canBeItalic = hasItalic(selectedFont, weight);

  const handleFamilyChange = (newFamily: string) => {
    if (newFamily === "default") {
      onChange("");
    } else {
      // Reset to default weight/style when changing font
      onChange(newFamily);
    }
  };

  const handleWeightChange = (newWeight: string) => {
    // Check if italic is available for new weight
    const newStyle = hasItalic(selectedFont, newWeight) ? style : "normal";
    onChange(buildFontValue(family, newWeight, newStyle));
  };

  const handleStyleChange = (newStyle: string) => {
    onChange(buildFontValue(family, weight, newStyle));
  };

  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="Search fonts..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full px-3 py-2 text-sm border rounded-md"
        disabled={loading}
      />
      <Select value={family || "default"} onValueChange={handleFamilyChange} disabled={loading}>
        <SelectTrigger>
          <SelectValue placeholder={loading ? "Loading fonts..." : "Select font"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">Default (System)</SelectItem>
          {filteredFonts.map(font => (
            <SelectItem key={font.family} value={font.family}>
              {font.family}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {family && (
        <div className="flex gap-2">
          <Select value={weight} onValueChange={handleWeightChange}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Weight" />
            </SelectTrigger>
            <SelectContent>
              {availableWeights.map(w => (
                <SelectItem key={w} value={w}>
                  {weightLabels[w] || w}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={style} onValueChange={handleStyleChange} disabled={!canBeItalic}>
            <SelectTrigger className="w-24">
              <SelectValue placeholder="Style" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              {canBeItalic && <SelectItem value="italic">Italic</SelectItem>}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
