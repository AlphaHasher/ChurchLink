import api from "@/api/api";
import { toast } from "react-toastify";
import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/components/ui/Dialog";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Node, SectionV2 } from "@/shared/types/pageV2";

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

export function collectHeaderTitles(items: HeaderItem[]): string[] {
  const set = new Set<string>();
  for (const it of items) {
    set.add(getEnglishLabel(it));
    if ('items' in it && Array.isArray(it.items)) {
      for (const sub of it.items) set.add(getEnglishLabel(sub));
    }
  }
  return Array.from(set);
}

export function collectFooterTitles(sections: FooterSection[]): string[] {
  const set = new Set<string>();
  for (const sec of sections) {
    set.add(getEnglishLabel(sec));
    for (const it of sec.items) set.add(getEnglishLabel(it));
  }
  return Array.from(set);
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

export async function ensureHeaderLocale(items: HeaderItem[], code: string): Promise<void> {
  if (!code || code === 'en') return;
  const needs = [];
  for (const it of items) {
    const titles = it.titles as Record<string, string> | undefined;
    if (!titles || !titles[code]) needs.push({ kind: 'top', item: it });
    if ('items' in it && Array.isArray(it.items)) {
      for (const sub of it.items) {
        const st = sub.titles as Record<string, string> | undefined;
        if (!st || !st[code]) needs.push({ kind: 'sub', item: sub });
      }
    }
  }
  if (!needs.length) return;
  const srcStrings = Array.from(new Set(needs.map(n => getEnglishLabel(n.item)).filter(Boolean)));
  if (!srcStrings.length) return;
  const translations = await translateStrings(srcStrings, [code], 'en');
  for (const it of items) {
    const updated: any = { title: it.title };
    const baseEn = getEnglishLabel(it);
    const translated = translations[baseEn]?.[code];
    const currentTitles = it.titles || {};
    const nextTitles = { ...currentTitles };
    if (translated && !nextTitles[code]) nextTitles[code] = translated;
    if ('items' in it && Array.isArray(it.items)) {
      const nextItems = it.items.map((sub: any) => {
        const en = getEnglishLabel(sub);
        const tr = translations[en]?.[code];
        const st = sub.titles || {};
        const nst = { ...st };
        if (tr && !nst[code]) nst[code] = tr;
        return { ...sub, titles: nst };
      });
      updated.items = nextItems;
    }
    updated.titles = nextTitles;
    if (Object.keys(nextTitles).length > Object.keys(currentTitles).length) {
      await api.put(`/v1/header/items/edit/${encodeURIComponent(it.title)}`, updated);
    }
  }
}

export async function ensureFooterLocale(sections: FooterSection[], code: string): Promise<void> {
  if (!code || code === 'en') return;
  const needs = [];
  for (const sec of sections) {
    const st = sec.titles as Record<string, string> | undefined;
    if (!st || !st[code]) needs.push(sec);
    for (const it of sec.items) {
      const t = it.titles as Record<string, string> | undefined;
      if (!t || !t[code]) needs.push(it);
    }
  }
  if (!needs.length) return;
  const srcStrings = Array.from(new Set(needs.map(n => getEnglishLabel(n)).filter(Boolean)));
  if (!srcStrings.length) return;
  const translations = await translateStrings(srcStrings, [code], 'en');
  for (const sec of sections) {
    const secEn = getEnglishLabel(sec);
    const secTr = translations[secEn]?.[code];
    const secTitles = { ... (sec.titles || {}) };
    if (secTr && !secTitles[code]) secTitles[code] = secTr;
    const nextItems = sec.items.map((it: any) => {
      const ien = getEnglishLabel(it);
      const itr = translations[ien]?.[code];
      const itTitles = { ... (it.titles || {}) };
      if (itr && !itTitles[code]) itTitles[code] = itr;
      return { ...it, titles: itTitles };
    });
    const updated = { title: sec.title, titles: secTitles, items: nextItems, visible: sec.visible !== false };
    await api.put(`/v1/footer/items/edit/${encodeURIComponent(sec.title)}`, updated);
  }
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
  addSiteLocale: (code: string) => void;
  refreshSiteLocales: () => void;
  onAddLocale: (code: string) => Promise<void>;
}

export function AddLocaleDialog({ open, onOpenChange, siteLocales, addSiteLocale, refreshSiteLocales, onAddLocale }: AddLocaleDialogProps) {
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
                    try {
                      await onAddLocale(l.code);
                      addSiteLocale(l.code);
                      refreshSiteLocales();
                      setLocaleSearch("");
                    } catch (e) {
                      toast.error('Failed to add locale');
                    }
                    onOpenChange(false);
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


export async function seedGlobalTranslations(code: string, componentType: 'header' | 'footer') {
  try {
    if (componentType === 'header') {
      const fitems = await api.get('/v1/footer/items').then(r => r.data.items || []);
      const fstrings = collectFooterTitles(fitems);
      if (fstrings.length) await translateStrings(fstrings, [code], 'en');
    } else {
      const hitems = await api.get('/v1/header/items').then(r => r.data.items || []);
      const hstrings = collectHeaderTitles(hitems);
      if (hstrings.length) await translateStrings(hstrings, [code], 'en');
    }
  } catch (e) {
    console.error('Global seeding failed', e);
  }
}

