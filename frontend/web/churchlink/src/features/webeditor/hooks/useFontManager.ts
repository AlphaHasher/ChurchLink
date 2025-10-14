import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageV2 } from "@/shared/types/pageV2";
import { DEFAULT_GOOGLE_FONTS, GoogleFontOption, getFontByFamily, getFontById, loadGoogleFonts } from "@/shared/constants/googleFonts";
import { cacheFontCss, getCachedFontCss } from "@/lib/FontCache";

const MAX_INITIAL_FONTS = 50;

export function useFontManager(page: PageV2 | null, setPage: React.Dispatch<React.SetStateAction<PageV2 | null>>) {
  const [loadingFontIds, setLoadingFontIds] = useState<Record<string, boolean>>({});
  const [customFontActive, setCustomFontActive] = useState(false);
  const [fontOptions, setFontOptions] = useState<GoogleFontOption[]>(DEFAULT_GOOGLE_FONTS);
  const [fontPopoverOpen, setFontPopoverOpen] = useState(false);
  const [fontSearch, setFontSearch] = useState("");
  const [fontListLoading, setFontListLoading] = useState(false);
  const loadingFontIdsRef = useRef<Record<string, boolean>>({});

  const selectedFont = useMemo(() => {
    return getFontByFamily(fontOptions, page?.styleTokens?.defaultFontFamily ?? undefined);
  }, [fontOptions, page?.styleTokens?.defaultFontFamily]);

  const selectedFontId = customFontActive ? "custom" : selectedFont?.id ?? "system";

  const fontButtonLabel = customFontActive
    ? page?.styleTokens?.defaultFontFamily || "Custom font family"
    : selectedFont?.label || "System Default";

  const fontButtonDescription = customFontActive
    ? "Custom CSS family"
    : selectedFont?.fontFamily || "Browser default stack";

  const isFontCssLoading = Object.keys(loadingFontIds).length > 0;

  const filteredFonts = useMemo(() => {
    if (!fontOptions.length) return [];
    
    const searchLower = fontSearch.toLowerCase();
    const filtered = fontOptions.filter((font) =>
      font.label.toLowerCase().includes(searchLower)
    );
    
    return fontSearch ? filtered : filtered.slice(0, MAX_INITIAL_FONTS);
  }, [fontOptions, fontSearch]);

  const applyFontCss = useCallback((cssKey: string, css: string) => {
    let style = document.getElementById(cssKey) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = cssKey;
      document.head.appendChild(style);
    }
    style.textContent = css;
  }, []);

  const ensureFontLoaded = useCallback(async (fontId: string): Promise<void> => {
    if (!fontId) return;

    const fontMeta = getFontById(fontOptions, fontId);
    if (!fontMeta) return;

    const cssKey = `google-font-${fontId}`;
    if (loadingFontIdsRef.current[cssKey]) return;

    try {
      const cached = await getCachedFontCss(cssKey);
      if (cached) {
        applyFontCss(cssKey, cached);
        return;
      }

      setLoadingFontIds((prev) => ({ ...prev, [cssKey]: true }));
      loadingFontIdsRef.current = { ...loadingFontIdsRef.current, [cssKey]: true };
      const resp = await fetch(fontMeta.cssUrl);
      if (!resp.ok) return;
      const css = await resp.text();
      applyFontCss(cssKey, css);
      await cacheFontCss(cssKey, css);
    } catch {
      // ignore font fetch errors
    } finally {
      setLoadingFontIds((prev) => {
        const copy = { ...prev };
        delete copy[cssKey];
        loadingFontIdsRef.current = copy;
        return copy;
      });
    }
  }, [fontOptions, applyFontCss]);

  const handleSelectFont = useCallback(
    (fontId: string) => {
      setFontPopoverOpen(false);
      setFontSearch("");

      setPage((prev) => {
        if (!prev) return prev;

        const { defaultFontFamily: _currentFamily, defaultFontFallback: _removedFallback, ...otherTokens } = prev.styleTokens || {};

        if (!fontId || fontId === "system") {
          setCustomFontActive(false);
          return {
            ...prev,
            styleTokens: Object.keys(otherTokens).length ? otherTokens : undefined,
          } as PageV2;
        }

        if (fontId === "custom") {
          setCustomFontActive(true);
          return {
            ...prev,
            styleTokens: {
              ...otherTokens,
              defaultFontFamily: prev.styleTokens?.defaultFontFamily ?? "",
            },
          } as PageV2;
        }

        const fontMeta = getFontById(fontOptions, fontId);
        if (!fontMeta) return prev;

        ensureFontLoaded(fontMeta.id).catch(() => {});
        setCustomFontActive(false);

        return {
          ...prev,
          styleTokens: {
            ...otherTokens,
            defaultFontFamily: fontMeta.fontFamily,
          },
        } as PageV2;
      });
    },
    [ensureFontLoaded, fontOptions, setPage]
  );

  // Load fonts on mount
  useEffect(() => {
    const loadFonts = async () => {
      setFontListLoading(true);
      try {
        const fonts = await loadGoogleFonts();
        setFontOptions(fonts);
      } catch (error) {
        console.error("Failed to load Google Fonts list", error);
        setFontOptions(DEFAULT_GOOGLE_FONTS);
      } finally {
        setFontListLoading(false);
      }
    };

    loadFonts().catch(() => {});
  }, []);

  // Ensure current font is loaded
  useEffect(() => {
    const currentFamily = page?.styleTokens?.defaultFontFamily ?? "";
    const match = getFontByFamily(fontOptions, currentFamily || undefined);
    setCustomFontActive(match ? false : Boolean(currentFamily));
    if (match) ensureFontLoaded(match.id).catch(() => {});
  }, [page?.styleTokens?.defaultFontFamily, fontOptions, ensureFontLoaded]);

  return {
    fontOptions,
    fontPopoverOpen,
    setFontPopoverOpen,
    fontSearch,
    setFontSearch,
    fontListLoading,
    isFontCssLoading,
    selectedFont,
    selectedFontId,
    fontButtonLabel,
    fontButtonDescription,
    customFontActive,
    filteredFonts,
    handleSelectFont,
    MAX_INITIAL_FONTS,
  };
}
