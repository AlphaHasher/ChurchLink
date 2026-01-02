import { createContext, useContext, useState, useMemo, type ReactNode } from "react";
import type { Data as PuckData, ComponentData } from "@measured/puck";

interface PuckLanguageContextType {
  previewLanguage: string;
  setPreviewLanguage: (lang: string) => void;
  availableLanguages: string[]; // Languages that have translations on this page
}

const PuckLanguageContext = createContext<PuckLanguageContextType | null>(null);

interface PuckLanguageProviderProps {
  children: ReactNode;
  data: PuckData;
}

export function PuckLanguageProvider({ children, data }: PuckLanguageProviderProps) {
  const defaultLanguage = ((data.root.props as { defaultLanguage?: string })?.defaultLanguage) || "en";
  const [previewLanguage, setPreviewLanguage] = useState<string>(defaultLanguage);

  // Scan all components to find languages with translations
  const availableLanguages = useMemo(() => {
    const languages = new Set<string>([defaultLanguage]);

    function scanComponent(component: ComponentData) {
      // Check if component has translations
      if (component.props.translations) {
        Object.keys(component.props.translations).forEach((lang) => languages.add(lang));
      }

      // Recursively scan children (for GroupBlock and slots)
      if (Array.isArray(component.props.children)) {
        component.props.children.forEach(scanComponent);
      }
    }

    data.content.forEach(scanComponent);

    return Array.from(languages).sort();
  }, [data, defaultLanguage]);

  return (
    <PuckLanguageContext.Provider value={{ previewLanguage, setPreviewLanguage, availableLanguages }}>
      {children}
    </PuckLanguageContext.Provider>
  );
}

export function usePuckLanguage() {
  const context = useContext(PuckLanguageContext);
  if (!context) {
    throw new Error("usePuckLanguage must be used within PuckLanguageProvider");
  }
  return context;
}
