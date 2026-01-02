import { useMemo } from "react";
import { Render } from "@measured/puck";
import { config as baseConfig, type PuckData } from "../config";
import { useCustomTemplates } from "../hooks/useCustomTemplates";
import { buildConfigWithTemplates } from "../config/buildConfigWithTemplates";
import { useLanguage } from "@/provider/LanguageProvider";
import { localizeComponentData } from "../utils/languageUtils";

interface PuckPageRendererProps {
  data: PuckData;
}

export function PuckPageRenderer({ data }: PuckPageRendererProps) {
  const { templates, loading } = useCustomTemplates();
  const { locale } = useLanguage(); // Get user's account language from LanguageProvider

  // Build dynamic config with templates - memoized to avoid recreating on every render
  const dynamicConfig = useMemo(() => {
    if (loading || templates.length === 0) {
      return baseConfig;
    }
    return buildConfigWithTemplates(templates);
  }, [templates, loading]);

  // Get browser language as fallback
  const browserLang = navigator.language?.split("-")[0] || "en";
  const defaultLang = (data.root.props?.defaultLanguage as string) || "en";

  // Transform data using smart fallback logic
  const localizedData = useMemo(() => {
    return localizeComponentData(data, locale || browserLang, browserLang, defaultLang);
  }, [data, locale, browserLang, defaultLang]);

  // Show loading state while templates load
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Get page margins from root props
  const pageMargins = ((localizedData.root.props as { pageMargins?: string })?.pageMargins) || "none";

  // Margin classes - only applied in preview/live mode
  const marginClasses: Record<string, string> = {
    none: "",
    small:  "md:mx-6   lg:mx-16  xl:mx-32  2xl:mx-48",
    medium: "md:mx-12  lg:mx-32  xl:mx-48  2xl:mx-64",
    large:  "md:mx-20  lg:mx-48  xl:mx-64  2xl:mx-80",
    xl:     "md:mx-32  lg:mx-64  xl:mx-80  2xl:mx-96",
  };


  return (
    <div className={marginClasses[pageMargins]}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Render config={dynamicConfig as any} data={localizedData as any} />
    </div>
  );
}
