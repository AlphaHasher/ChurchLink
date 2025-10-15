export type GoogleFontOption = {
  id: string;
  label: string;
  fontFamily: string;
  fallback: "sans-serif" | "serif" | "monospace";
  cssUrl: string;
};

export type WebfontsResponse = {
  items: Array<{
    family: string;
    category: "sans-serif" | "serif" | "display" | "handwriting" | "monospace";
    variants: string[];
  }>;
};

const categoryFallback = (category: string): GoogleFontOption["fallback"] =>
  category === "serif" ? "serif" : category === "monospace" ? "monospace" : "sans-serif";

const css2Url = (family: string, variants: string[]) => {
  const weights = Array.from(
    new Set(
      variants
        .map((v) => v.replace("regular", "400"))
        .map((v) => parseInt(v, 10))
        .filter((n) => !Number.isNaN(n))
    )
  ).sort((a, b) => a - b);

  const familyParam =
    weights.length > 0
      ? `${encodeURIComponent(family)}:wght@${weights.join(";")}`
      : encodeURIComponent(family);

  return `https://fonts.googleapis.com/css2?family=${familyParam}&display=swap`;
};

export async function fetchGoogleFonts(apiKey: string): Promise<GoogleFontOption[]> {
  const res = await fetch(
    `https://www.googleapis.com/webfonts/v1/webfonts?key=${apiKey}&sort=popularity`
  );
  if (!res.ok) throw new Error(`Fonts API error: ${res.status}`);
  const data: WebfontsResponse = await res.json();

  return data.items.map((item) => {
    const id = item.family.toLowerCase().replace(/\s+/g, "");
    const fallback = categoryFallback(item.category);
    const fontFamily = `'${item.family}', ${fallback}`;
    return {
      id,
      label: item.family,
      fontFamily,
      fallback,
      cssUrl: css2Url(item.family, item.variants),
    } satisfies GoogleFontOption;
  });
}

export const DEFAULT_GOOGLE_FONTS: GoogleFontOption[] = [
  {
    id: "inter",
    label: "Inter",
    fontFamily: "'Inter', sans-serif",
    fallback: "sans-serif",
    cssUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap",
  },
  {
    id: "roboto",
    label: "Roboto",
    fontFamily: "'Roboto', sans-serif",
    fallback: "sans-serif",
    cssUrl: "https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap",
  },
  {
    id: "opensans",
    label: "Open Sans",
    fontFamily: "'Open Sans', sans-serif",
    fallback: "sans-serif",
    cssUrl: "https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;600;700&display=swap",
  },
  {
    id: "montserrat",
    label: "Montserrat",
    fontFamily: "'Montserrat', sans-serif",
    fallback: "sans-serif",
    cssUrl: "https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap",
  },
  {
    id: "poppins",
    label: "Poppins",
    fontFamily: "'Poppins', sans-serif",
    fallback: "sans-serif",
    cssUrl: "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap",
  },
  {
    id: "lato",
    label: "Lato",
    fontFamily: "'Lato', sans-serif",
    fallback: "sans-serif",
    cssUrl: "https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&display=swap",
  },
  {
    id: "nunito",
    label: "Nunito",
    fontFamily: "'Nunito', sans-serif",
    fallback: "sans-serif",
    cssUrl: "https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;600;700&display=swap",
  },
  {
    id: "raleway",
    label: "Raleway",
    fontFamily: "'Raleway', sans-serif",
    fallback: "sans-serif",
    cssUrl: "https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700&display=swap",
  },
  {
    id: "lora",
    label: "Lora",
    fontFamily: "'Lora', serif",
    fallback: "serif",
    cssUrl: "https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&display=swap",
  },
  {
    id: "playfair",
    label: "Playfair Display",
    fontFamily: "'Playfair Display', serif",
    fallback: "serif",
    cssUrl: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap",
  },
  {
    id: "merriweather",
    label: "Merriweather",
    fontFamily: "'Merriweather', serif",
    fallback: "serif",
    cssUrl: "https://fonts.googleapis.com/css2?family=Merriweather:wght@300;400;700&display=swap",
  },
  {
    id: "oswald",
    label: "Oswald",
    fontFamily: "'Oswald', sans-serif",
    fallback: "sans-serif",
    cssUrl: "https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600&display=swap",
  },
];

let cachedFonts: GoogleFontOption[] | null = null;
let pendingFonts: Promise<GoogleFontOption[]> | null = null;

const selectFallbackList = (): GoogleFontOption[] => [...DEFAULT_GOOGLE_FONTS];

export async function loadGoogleFonts(): Promise<GoogleFontOption[]> {
  if (cachedFonts) return cachedFonts;
  if (pendingFonts) return pendingFonts;

  pendingFonts = (async () => {
    // Try loading from cache first
    try {
      const { getCachedFontList } = await import("@/lib/FontCache");
      const cached = await getCachedFontList();
      if (cached && cached.length > 0) {
        cachedFonts = cached as GoogleFontOption[];
        return cachedFonts;
      }
    } catch (err) {
      console.warn("Failed to load font list from cache", err);
    }

    const apiKey = import.meta.env.VITE_FONTS_API_KEY as string | undefined;
    if (!apiKey) {
      cachedFonts = selectFallbackList();
      return cachedFonts;
    }

    try {
      const fonts = await fetchGoogleFonts(apiKey);
      if (!fonts || fonts.length === 0) {
        cachedFonts = selectFallbackList();
      } else {
        cachedFonts = fonts;
        // Cache the font list for future use
        try {
          const { cacheFontList } = await import("@/lib/FontCache");
          await cacheFontList(fonts);
        } catch {
          // ignore cache write errors
        }
      }
      return cachedFonts;
    } catch (error) {
      console.error("Failed to fetch Google Fonts list; falling back to defaults", error);
      cachedFonts = selectFallbackList();
      return cachedFonts;
    }
  })();

  pendingFonts.finally(() => {
    pendingFonts = null;
  });

  return pendingFonts;
}

export function getFontById(fonts: GoogleFontOption[], id?: string | null): GoogleFontOption | undefined {
  if (!id) return undefined;
  return fonts.find((f) => f.id === id);
}

export function getFontByFamily(fonts: GoogleFontOption[], family?: string | null): GoogleFontOption | undefined {
  if (!family) return undefined;
  return fonts.find((f) => f.fontFamily === family);
}

