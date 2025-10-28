import api from "@/api/api";
import { toast } from "react-toastify";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/components/ui/Dialog";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Node, SectionV2 } from "@/shared/types/pageV2";
import { useLanguage } from "@/provider/LanguageProvider";

export type LanguageOption = { code: string; name: string };

export interface HeaderItem {
  title: string;
  titles?: Record<string, string>;
  items?: any[];
}

export interface FooterSection {
  title: string;
  titles?: Record<string, string>;
  items: Array<{ title: string; titles?: Record<string, string>; }>;
  visible?: boolean;
}

export async function fetchAvailableLanguages(): Promise<LanguageOption[]> {
  try {
    const res = await api.get('/v1/translator/languages');
    return (res?.data?.languages || []) as LanguageOption[];
  } catch {
    return [];
  }
}

export function getEnglishLabel(obj: any): string {
  const titles = obj?.titles as Record<string, string> | undefined;
  const t = titles?.en;
  const base = typeof obj?.title === 'string' ? String(obj.title) : '';
  return (t && t.trim()) ? t : base;
}

type TitleNode = {
  title?: string;
  titles?: Record<string, string>;
  items?: TitleNode[];
};

export function collectTitles(nodes: TitleNode[] = []): string[] {
  const unique = new Set<string>();
  const walk = (entries: TitleNode[] = []) => {
    for (const entry of entries) {
      if (!entry) continue;
      const label = getEnglishLabel(entry);
      if (label) unique.add(label);
      if (Array.isArray(entry.items) && entry.items.length) {
        walk(entry.items as TitleNode[]);
      }
    }
  };
  walk(nodes);
  return Array.from(unique);
}

export function collectTranslatablePairs(sectionsInput: SectionV2[]): Array<{ id: string; key: 'html' | 'label' | 'alt'; value: string }> {
  const pairs: Array<{ id: string; key: 'html' | 'label' | 'alt'; value: string }> = [];
  const walk = (nodes: Node[]) => {
    for (const n of nodes) {
      const t = (n as any).type;
      if (t === 'text') {
        const v = String(((n as any).props?.html ?? '') as string);
        if (v && v.trim()) pairs.push({ id: (n as any).id, key: 'html', value: v });
      } else if (t === 'button') {
        const v = String(((n as any).props?.label ?? '') as string);
        if (v && v.trim()) pairs.push({ id: (n as any).id, key: 'label', value: v });
      } else if (t === 'image') {
        const v = String(((n as any).props?.alt ?? '') as string);
        if (v && v.trim()) pairs.push({ id: (n as any).id, key: 'alt', value: v });
      }
      if ((n as any).children && (n as any).children.length) walk((n as any).children);
    }
  };
  for (const s of sectionsInput) walk((s.children || []) as any);
  return pairs;
}

export async function translateStrings(items: string[], dest_languages: string[], src = 'en'): Promise<Record<string, Record<string, string>>> {
  try {
    const res = await api.post('/v1/translator/translate-multi', { items, dest_languages, src });
    return res?.data?.translations || {};
  } catch {
    return {};
  }
}

export async function translateMissingStrings(
  strings: string[],
  locale: string,
  existing: Record<string, string> = {},
  src = 'en'
): Promise<Record<string, string>> {
  if (!locale || locale === src) {
    return existing;
  }

  const normalized = strings.filter(Boolean);
  const missing = normalized.filter((value) => !existing[value]);
  if (!missing.length) {
    return existing;
  }

  const batch = await translateStrings(missing, [locale], src);
  const next = { ...existing } as Record<string, string>;

  for (const value of missing) {
    const translated = batch?.[value]?.[locale];
    if (translated && translated.trim()) {
      next[value] = translated;
    }
  }

  return Object.keys(next).length ? next : existing;
}


export function ensurePageLocale(sections: SectionV2[], code: string, translations: Record<string, Record<string, string>>): SectionV2[] {
  return sections.map((section) => {
    const walkApply = (nodes: Node[]): Node[] => nodes.map((n: any) => {
      let updated = n;
      const t = n.type;
      if (t === 'text') {
        const base = String(n.props?.html ?? '');
        const tr = translations[base]?.[code];
        if (tr && tr.trim()) {
          const prevI18n = updated.i18n || {};
          const prevFor = prevI18n[code] || {};
          if (prevFor.html == null) {
            updated = { ...updated, i18n: { ...prevI18n, [code]: { ...prevFor, html: tr } } };
          }
        }
      } else if (t === 'button') {
        const base = String(n.props?.label ?? '');
        const tr = translations[base]?.[code];
        if (tr && tr.trim()) {
          const prevI18n = updated.i18n || {};
          const prevFor = prevI18n[code] || {};
          if (prevFor.label == null) {
            updated = { ...updated, i18n: { ...prevI18n, [code]: { ...prevFor, label: tr } } };
          }
        }
      } else if (t === 'image') {
        const base = String(n.props?.alt ?? '');
        const tr = translations[base]?.[code];
        if (tr && tr.trim()) {
          const prevI18n = updated.i18n || {};
          const prevFor = prevI18n[code] || {};
          if (prevFor.alt == null) {
            updated = { ...updated, i18n: { ...prevI18n, [code]: { ...prevFor, alt: tr } } };
          }
        }
      }
      if (n.children && n.children.length) {
        const nextChildren = walkApply(n.children);
        if (nextChildren !== n.children) {
          updated = { ...updated, children: nextChildren };
        }
      }
      return updated;
    });
    return { ...section, children: walkApply(section.children || []) };
  });
}

export interface AddLocaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteLocales: string[];
  onAddLocale: (code: string) => Promise<void>;
}

export function AddLocaleDialog({ open, onOpenChange, siteLocales, onAddLocale }: AddLocaleDialogProps) {
  const [localeOptions, setLocaleOptions] = useState<LanguageOption[]>([]);
  const [localeSearch, setLocaleSearch] = useState("");
  const [loadingLocales, setLoadingLocales] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingLocales(true);
        const langs = await fetchAvailableLanguages();
        if (!cancelled) setLocaleOptions(langs);
      } catch {
        if (!cancelled) setLocaleOptions([]);
      } finally {
        if (!cancelled) setLoadingLocales(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const filtered = useMemo(() => {
    let opts = localeOptions.filter(l => !siteLocales.includes(l.code));
    if (localeSearch.trim()) {
      const q = localeSearch.toLowerCase();
      opts = opts.filter(l => l.code.toLowerCase().includes(q) || l.name.toLowerCase().includes(q));
    }
    return opts;
  }, [localeOptions, siteLocales, localeSearch]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">+ Locale</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Locale</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Search locales (e.g., Spanish, es)"
            value={localeSearch}
            onChange={(e) => setLocaleSearch(e.target.value)}
          />
          <div className="max-h-80 overflow-auto border rounded">
            {loadingLocales ? (
              <div className="p-3 text-sm text-muted-foreground">Loading…</div>
            ) : (
              filtered.map((l) => (
                <button
                  key={l.code}
                  className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-accent border-b last:border-b-0"
                  onClick={async () => {
                    setLocaleSearch("");
                    onOpenChange(false);
                    try {
                      await onAddLocale(l.code);
                    } catch (e) {
                      toast.error('Failed to add locale');
                    }
                  }}
                >
                  <span>{l.name}</span>
                  <span className="text-muted-foreground">{l.code}</span>
                </button>
              ))
            )}
            {!loadingLocales && filtered.length === 0 && (
              <div className="p-3 text-sm text-muted-foreground">No locales available.</div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


export async function addLocaleToAllPages(code: string): Promise<void> {
  const pagesRes = await api.get("/v1/mod/pages?limit=1000");
  const pages = pagesRes?.data || [];

  for (const page of pages) {
    try {
      const currentLocales = page.locales || [page.defaultLocale || "en"];
      if (currentLocales.includes(code)) continue;

      const updatedLocales = [...currentLocales, code];
      await api.put(`/v1/mod/pages/${page._id}`, {
        locales: updatedLocales,
      });
    } catch (pageError) {
      console.error(`Failed to add locale to page ${page.slug}:`, pageError);
    }
  }
}

export type TranslationFunction = (text: string | null | undefined, options?: { context?: string; capitalize?: boolean }) => string;


//we need to add a batch delay to the translation requests so it just makes one request for all the translations at once
const BATCH_DELAY_MS = 100;
const translationCache: Record<string, Record<string, string>> = {};
const pendingByLocale: Record<string, Set<string>> = {};
const pendingTimers: Record<string, ReturnType<typeof setTimeout> | null> = {};
const inflightByLocale: Record<string, Promise<void> | null> = {};
const listeners = new Set<() => void>();

const notifyListeners = () => {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error("Localization listener failed", err);
    }
  });
};

function flushLocale(locale: string) {
  if (pendingTimers[locale] != null) {
    clearTimeout(pendingTimers[locale] as ReturnType<typeof setTimeout>);
    pendingTimers[locale] = null;
  }

  const pending = pendingByLocale[locale];
  if (!pending || pending.size === 0) {
    return;
  }

  const payload = Array.from(pending);
  pending.clear();

  const run = () =>
    translateStrings(payload, [locale])
      .then((translations) => {
        let updated = false;
        for (const text of payload) {
          const translated = translations?.[text]?.[locale];
          if (translated && translated.trim()) {
            const prev = translationCache[text] || {};
            if (prev[locale] !== translated) {
              translationCache[text] = { ...prev, [locale]: translated };
              updated = true;
            }
          }
        }
        if (updated) {
          notifyListeners();
        }
      })
      .catch((err) => {
        console.error("Failed to translate batch", err);
      })
      .finally(() => {
        inflightByLocale[locale] = null;
        if (pendingByLocale[locale] && pendingByLocale[locale].size > 0) {
          queueFlushForLocale(locale);
        }
      });

  inflightByLocale[locale] = inflightByLocale[locale]
    ? inflightByLocale[locale]!.then(() => run())
    : run();
}

function queueFlushForLocale(locale: string) {
  if (pendingTimers[locale] != null) {
    return;
  }
  pendingTimers[locale] = setTimeout(() => {
    flushLocale(locale);
  }, BATCH_DELAY_MS);
}

const queueTranslation = (text: string, locale: string) => {
  if (!text || !text.trim()) {
    return;
  }
  if (!locale || locale === "en") {
    return;
  }
  const existing = translationCache[text]?.[locale];
  if (existing != null) {
    return;
  }

  if (!pendingByLocale[locale]) {
    pendingByLocale[locale] = new Set();
  }

  pendingByLocale[locale]!.add(text);
  queueFlushForLocale(locale);
};

export function useLocalize(): TranslationFunction {
  const { locale } = useLanguage();
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const listener = () => {
      forceUpdate((n) => n + 1);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [locale]);

  useEffect(() => {
    forceUpdate((n) => n + 1);
  }, [locale]);

  const translate = useCallback<TranslationFunction>(
    (input, options) => {
      const base = (input ?? "").toString();
      if (!base.trim()) {
        return "";
      }
      if (!locale || locale === "en") {
        return maybePostProcess(base, options);
      }

      const cached = translationCache[base]?.[locale];
      if (cached != null) {
        return maybePostProcess(cached, options);
      }

      queueTranslation(base, locale);

      return maybePostProcess(base, options);
    },
    [locale]
  );

  return translate;
}

function maybePostProcess(text: string, options?: { context?: string; capitalize?: boolean }): string {
  let result = text;
  if (options?.capitalize) {
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }
  return result;
}

