import { useMemo, useEffect } from "react";
import { Render } from "@puckeditor/core";
import { config, type PuckData } from "../config";
import { useLanguage } from "@/provider/LanguageProvider";
import { localizeComponentData } from "../utils/languageUtils";
import { loadGoogleFont, extractFontsFromData } from "../utils/fontLoader";

interface PuckPageRendererProps {
  data: PuckData;
}

export function PuckPageRenderer({ data }: PuckPageRendererProps) {
  const { locale } = useLanguage(); // Get user's account language from LanguageProvider

  // Get browser language as fallback
  const browserLang = navigator.language?.split("-")[0] || "en";
  const defaultLang = (data.root.props?.defaultLanguage as string) || "en";

  // Transform data using smart fallback logic
  const localizedData = useMemo(() => {
    return localizeComponentData(data, locale || browserLang, browserLang, defaultLang);
  }, [data, locale, browserLang, defaultLang]);

  // Get page margins from root props
  const rootProps = localizedData.root.props as { pageMargins?: string; customPageMarginPx?: number };
  const pageMargins = rootProps?.pageMargins || "none";
  const customPageMarginPx = rootProps?.customPageMarginPx ?? 0;

  // Margin classes - only applied in preview/live mode
  const marginClasses: Record<string, string> = {
    none: "",
    small:  "md:mx-6   lg:mx-16  xl:mx-32  2xl:mx-48",
    medium: "md:mx-12  lg:mx-32  xl:mx-48  2xl:mx-64",
    large:  "md:mx-20  lg:mx-48  xl:mx-64  2xl:mx-80",
    xl:     "md:mx-32  lg:mx-64  xl:mx-80  2xl:mx-96",
  };

  // Apply custom margin if needed (use padding since margin doesn't work with full-width containers)
  const pageStyle = pageMargins === "custom" ? {
    paddingLeft: `${customPageMarginPx}px`,
    paddingRight: `${customPageMarginPx}px`,
  } : {};

  // Load all fonts used in page data
  useEffect(() => {
    const fonts = extractFontsFromData(localizedData);
    fonts.forEach(loadGoogleFont);
  }, [localizedData]);

  const marginClass = pageMargins !== "custom" ? marginClasses[pageMargins] : "";

  return (
    <div className={marginClass} style={pageStyle}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Render config={config as any} data={localizedData as any} />
    </div>
  );
}
