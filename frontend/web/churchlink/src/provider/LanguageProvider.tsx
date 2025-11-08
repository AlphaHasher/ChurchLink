import api from "@/api/api";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type LanguageOption = { code: string; name: string };

type LanguageContextValue = {
    locale: string;
    setLocale: (code: string) => void;
    languages: LanguageOption[];
    loading: boolean;
    siteLocales: string[];
	addSiteLocale: (code: string) => void;
	refreshSiteLocales: () => void;
};

const LOCAL_STORAGE_KEY = "preferredLocale";

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [locale, setLocaleState] = useState<string>(() => {
        if (typeof window === "undefined") return "en";
        return window.localStorage.getItem(LOCAL_STORAGE_KEY) || "en";
    });
    const [languages, setLanguages] = useState<LanguageOption[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [siteLocales, setSiteLocales] = useState<string[]>([]);

	const loadSiteLocales = useCallback(async () => {
		try {
			const encodedHome = encodeURIComponent('/');
			const res = await api.get(`/v1/pages/slug/${encodedHome}`);
			const page = res?.data || {};
			const dl = String(page?.defaultLocale || 'en');
			const set = new Set<string>();
			if (dl) set.add(dl);
			const pageLocales: string[] = Array.isArray(page?.locales) ? page.locales : [];
			for (const l of pageLocales) if (l) set.add(String(l));
			const sections: any[] = Array.isArray(page?.sections) ? page.sections : [];
			const findFirstWithI18n = (nodes?: any[]): Record<string, any> | null => {
				if (!nodes) return null;
				for (const n of nodes) {
					const i18n = (n as any)?.i18n;
					if (i18n && typeof i18n === 'object' && Object.keys(i18n).length) return i18n as Record<string, any>;
					const child = findFirstWithI18n((n as any)?.children || []);
					if (child) return child;
				}
				return null;
			};
			for (const s of sections) {
				const i18n = findFirstWithI18n((s as any)?.children || []);
				if (i18n) {
					for (const key of Object.keys(i18n)) if (key) set.add(String(key));
					break;
				}
			}
			const result = Array.from(set);
			result.sort((a, b) => (a === dl ? -1 : b === dl ? 1 : a.localeCompare(b)));
			setSiteLocales(result.length ? result : ['en']);
		} catch (_) {
			setSiteLocales(['en']);
		}
	}, []);

    // Fetch available languages once
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                setLoading(true);
                const res = await api.get("/v1/translator/languages");
                const langs = ((res?.data?.languages as LanguageOption[]) || []).slice();
                langs.sort((a, b) => a.name.localeCompare(b.name));
                if (!alive) return;
                setLanguages(langs);
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, []);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			if (cancelled) return;
			await loadSiteLocales();
		})();
		return () => { cancelled = true; };
	}, [loadSiteLocales]);

    const setLocale = useCallback(async (code: string) => {
        setLocaleState(code);
        try {
            window.localStorage.setItem(LOCAL_STORAGE_KEY, code);
            window.dispatchEvent(new CustomEvent("preferred-locale-changed", { detail: { locale: code } }));

            // NEW: Persist to backend
            await api.patch("/v1/users/update-language", { language: code });
        } catch (err) {
            console.error("Failed to persist language preference", err);
        }
    }, []);

    // Stay in sync if anything else updates the locale
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail as { locale?: string } | undefined;
            if (detail?.locale && typeof detail.locale === "string") {
                setLocaleState(detail.locale);
            } else {
                const ls = window.localStorage.getItem(LOCAL_STORAGE_KEY);
                if (ls) setLocaleState(ls);
            }
        };
        window.addEventListener("preferred-locale-changed", handler as EventListener);
        return () => window.removeEventListener("preferred-locale-changed", handler as EventListener);
    }, []);

	const addSiteLocale = useCallback((code: string) => {
		if (!code) return;
		setSiteLocales((prev) => {
			const base = (prev && prev.length) ? prev : ['en'];
			const set = new Set<string>(base);
			set.add(code);
			return Array.from(set);
		});
	}, []);

	const refreshSiteLocales = useCallback(() => {
		void loadSiteLocales();
	}, [loadSiteLocales]);

	const value: LanguageContextValue = useMemo(() => ({ locale, setLocale, languages, loading, siteLocales, addSiteLocale, refreshSiteLocales }), [locale, setLocale, languages, loading, siteLocales, addSiteLocale, refreshSiteLocales]);

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
};

export function useLanguage(): LanguageContextValue {
    const ctx = useContext(LanguageContext);
    if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
    return ctx;
}

export default LanguageProvider;


