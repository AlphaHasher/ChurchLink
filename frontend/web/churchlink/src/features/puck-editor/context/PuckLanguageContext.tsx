import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from "react";
import type { Data as PuckData } from "@puckeditor/core";
import { createUsePuck } from "@puckeditor/core";

// Selector-based hooks for performance - separate hooks for each primitive value
const useDefaultLang = createUsePuck();
const useSupportedLangs = createUsePuck();
const usePreviewLang = createUsePuck();
const useDispatch = createUsePuck();
const useData = createUsePuck();
const usePreviewLangSafe = createUsePuck();

// Default constant to avoid new array references
const DEFAULT_LANGUAGES = ["en"];

interface PuckLanguageContextType {
  previewLanguage: string;
  setPreviewLanguage: (lang: string) => void;
  availableLanguages: string[];
}

const PuckLanguageContext = createContext<PuckLanguageContextType | null>(null);

interface PuckLanguageProviderProps {
  children: ReactNode;
  data: PuckData;
  // Optional overrides for controlled mode (e.g., preview mode)
  previewLanguageOverride?: string;
  onPreviewLanguageChange?: (lang: string) => void;
}

// Provider for contexts outside Puck (e.g., preview mode)
export function PuckLanguageProvider({
  children,
  data,
  previewLanguageOverride,
  onPreviewLanguageChange,
}: PuckLanguageProviderProps) {
  const rootProps = data.root.props as {
    defaultLanguage?: string;
    supportedLanguages?: string[];
    _previewLanguage?: string;
  };
  const defaultLanguage = rootProps?.defaultLanguage || "en";
  const supportedLanguages = rootProps?.supportedLanguages || ["en"];

  // Internal state for uncontrolled mode
  const [internalLanguage, setInternalLanguage] = useState<string>(
    rootProps?._previewLanguage || defaultLanguage
  );

  // Use override if provided (controlled mode), otherwise use internal state
  const previewLanguage = previewLanguageOverride ?? internalLanguage;
  const setPreviewLanguage = onPreviewLanguageChange ?? setInternalLanguage;

  const availableLanguages = useMemo(() => {
    return supportedLanguages.length > 0 ? [...supportedLanguages].sort() : [defaultLanguage];
  }, [supportedLanguages, defaultLanguage]);

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

// Hook for use inside Puck components - reads from Puck's root props
export function usePuckLanguageFromPuck() {
  // Separate hooks for each value - primitives are stable
  const defaultLanguage = useDefaultLang(
    (s) => (s.appState.data.root.props as { defaultLanguage?: string })?.defaultLanguage || "en"
  );
  const supportedLanguages = useSupportedLangs(
    (s) => (s.appState.data.root.props as { supportedLanguages?: string[] })?.supportedLanguages || null
  );
  const previewLanguage = usePreviewLang((s) => {
    const props = s.appState.data.root.props as { _previewLanguage?: string; defaultLanguage?: string };
    return props?._previewLanguage || props?.defaultLanguage || "en";
  });
  const dispatch = useDispatch((s) => s.dispatch);
  const data = useData((s) => s.appState.data);

  const availableLanguages = useMemo(() => {
    const langs = supportedLanguages || DEFAULT_LANGUAGES;
    return langs.length > 0 ? [...langs].sort() : [defaultLanguage];
  }, [supportedLanguages, defaultLanguage]);

  const setPreviewLanguage = useCallback((lang: string) => {
    dispatch({
      type: "setData",
      data: {
        ...data,
        root: {
          ...data.root,
          props: {
            ...data.root.props,
            _previewLanguage: lang,
          } as typeof data.root.props,
        },
      },
    });
  }, [dispatch, data]);

  return { previewLanguage, setPreviewLanguage, availableLanguages };
}

// Safe hook for components - tries Puck first, then context, then defaults
export function usePreviewLanguageSafe(): string {
  // Try to get from Puck's internal state (works inside Puck components)
  // Uses selector for performance - returns primitive string for stability
  try {
    const previewLang = usePreviewLangSafe((s) => {
      const rootProps = s.appState.data.root.props as {
        defaultLanguage?: string;
        _previewLanguage?: string;
      };
      return rootProps?._previewLanguage || rootProps?.defaultLanguage || "en";
    });
    return previewLang;
  } catch {
    // Not inside Puck - try context (preview mode)
    try {
      const { previewLanguage } = usePuckLanguage();
      return previewLanguage;
    } catch {
      return "en";
    }
  }
}
