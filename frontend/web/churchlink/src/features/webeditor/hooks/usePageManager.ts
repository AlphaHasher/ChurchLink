import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { PageV2, SectionV2 } from "@/shared/types/pageV2";
import api, { pageApi } from "@/api/api";
import { defaultSection } from "../utils/sectionHelpers";

export function usePageManager(slug: string) {
  const [page, setPage] = useState<PageV2 | null>(null);
  const [sections, setSections] = useState<SectionV2[]>([]);
  const [activeLocale, setActiveLocale] = useState<string>('en');
  const [showHeader, setShowHeader] = useState(false);
  const [showFooter, setShowFooter] = useState(false);
  const [liveVisible, setLiveVisible] = useState<boolean | null>(null);
  const [publishState, setPublishState] = useState<"custom" | "processing" | "success" | "error">("custom");
  const [saveState, setSaveState] = useState<"custom" | "processing" | "success" | "error">("custom");
  const [livePage, setLivePage] = useState<PageV2 | null>(null);
  const [inSyncWithLive, setInSyncWithLive] = useState<boolean>(false);
  const [translationError, setTranslationError] = useState<string | null>(null);

  const reportError = (
    error: any,
    context: { operation: string; destLanguages?: string[]; pageSlug?: string; activeLocale?: string }
  ) => {
      console.error(`[Translation] ${context.operation} failed`, { ...context, error });
  };

  // Load staging or seed default
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const res = await pageApi.getStaging(slug);
        const data = res.data;
        const isV2 = data?.version === 2;
        const v2: PageV2 = isV2 ? data : { ...data, version: 2, sections: data?.sections || [] };
        const defaultLocale = (v2 as any).defaultLocale || 'en';
        const locales = (v2 as any).locales || [defaultLocale];
        if (mounted) {
          setPage({ ...v2, defaultLocale, locales });
          setSections(v2.sections ?? []);
          setActiveLocale(defaultLocale);
        }
      } catch (e: any) {
        // 404 → seed a draft
        const seeded: PageV2 = { 
          version: 2, 
          title: slug || "Untitled", 
          slug: slug || "/", 
          visible: true, 
          sections: [defaultSection()],
          defaultLocale: 'en',
          locales: ['en']
        };
        setPage(seeded);
        setSections(seeded.sections);
        setActiveLocale('en');
      }
    };
    if (slug) run();
    return () => {
      mounted = false;
    };
  }, [slug]);

  // Fetch live page visibility for header indicator
  useEffect(() => {
    if (!slug) return;
    let mounted = true;
    (async () => {
      try {
        const res = await api.get(`/v1/pages/slug/${encodeURIComponent(slug)}`);
        if (!mounted) return;
        const visible = Boolean(res?.data?.visible ?? true);
        setLiveVisible(visible);
        // Coerce to v2 shape if needed
        const data = res?.data || null;
        const isV2 = data?.version === 2;
        const v2: PageV2 | null = data ? (isV2 ? data : { ...data, version: 2, sections: data?.sections || [] }) : null;
        setLivePage(v2);
      } catch (e) {
        // If not found or error, assume not visible
        if (!mounted) return;
        setLiveVisible(false);
        setLivePage(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [slug]);

  // Normalize a page for comparison with live (ignore volatile fields)
  const normalizeForCompare = (p: PageV2 | null): any => {
    if (!p) return null;
    const pickPage = (x: any) => ({
      version: 2,
      slug: x.slug,
      title: x.title,
      visible: x.visible !== false,
      sections: Array.isArray(x.sections) ? x.sections : [],
    });

    const cleanNode = (n: any): any => {
      const cleaned: any = {
        type: n.type,
      };
      if (n.props) {
        // Shallow copy props (exclude undefined)
        const pr: any = {};
        for (const k of Object.keys(n.props)) {
          const v = (n.props as any)[k];
          if (v !== undefined) pr[k] = v;
        }
        cleaned.props = pr;
      }
      // Keep only logical units for layout
      if (n.layout && n.layout.units) {
        cleaned.layout = { units: { ...n.layout.units } };
      }
      // Recurse children
      if (Array.isArray(n.children) && n.children.length) {
        cleaned.children = n.children.map((c: any) => cleanNode(c));
      }
      return cleaned;
    };

    const cleanSection = (s: any): any => ({
      kind: 'section',
      heightPercent: s.heightPercent ?? undefined,
      children: Array.isArray(s.children) ? s.children.map((n: any) => cleanNode(n)) : [],
    });

    const base = pickPage(p);
    return {
      ...base,
      sections: base.sections.map((s: any) => cleanSection(s)),
    };
  };

  // Compute in-sync when page/livePage change
  useEffect(() => {
    const staging = page ? { ...page, sections } : null;
    const a = normalizeForCompare(staging as any);
    const b = normalizeForCompare(livePage as any);
    try {
      setInSyncWithLive(JSON.stringify(a) === JSON.stringify(b));
    } catch {
      setInSyncWithLive(false);
    }
  }, [page, sections, livePage]);

  // Autosave staging with status
  useEffect(() => {
    if (!slug || !page) return;
    setSaveState((prev) => (prev === "processing" ? prev : "processing"));
    const t = setTimeout(async () => {
      try {
        await pageApi.saveStaging(slug, { ...page, slug, version: 2, sections });
        setSaveState("success");
        // Briefly show success then idle
        setTimeout(() => setSaveState("custom"), 900);
      } catch (e) {
        setSaveState("error");
        setTimeout(() => setSaveState("custom"), 1200);
      }
    }, 800);
    return () => clearTimeout(t);
  }, [slug, page, sections]);

  const publish = async () => {
    if (!slug) return;
    if (publishState !== "custom") return;
    try {
      setPublishState("processing");
      await pageApi.saveStaging(slug, { ...page, slug, version: 2, sections });
      await pageApi.publish(slug);
      try {
        const localesSet = new Set<string>();
        const dl = String((page as any)?.defaultLocale || 'en');
        if (dl) localesSet.add(dl);
        for (const l of ((page as any)?.locales || [])) if (l) localesSet.add(String(l));
        const dest = Array.from(localesSet).filter((l) => l && l !== dl);
        if (dest.length) {
          console.log(`[Translation] Translating header/footer to: ${dest.join(', ')}`);
          // Header
          try {
            const hres = await api.get('/v1/header/items');
            const hitems: any[] = (hres?.data?.items || []) as any[];
            const collectHeaderTitles = (items: any[]): string[] => {
              const set = new Set<string>();
              for (const it of items) {
                if (it?.title) set.add(String(it.title));
                if (Array.isArray((it as any)?.items)) {
                  for (const sub of (it as any).items) if (sub?.title) set.add(String(sub.title));
                }
              }
              return Array.from(set);
            };
            const items = collectHeaderTitles(hitems);
            if (items.length) {
              await api.post('/v1/translator/translate-multi', { items, dest_languages: dest, src: dl });
            }
          } catch (err: any) {
            reportError(err, {
              operation: 'Header translation',
              destLanguages: dest,
              pageSlug: slug,
              activeLocale,
            });
            setTranslationError('header');
            try { toast.error('Header translation failed'); } catch {}
          }
          // Footer
          try {
            const fres = await api.get('/v1/footer/items');
            const fitems: any[] = (fres?.data?.items || []) as any[];
            const collectFooterTitles = (sections: any[]): string[] => {
              const set = new Set<string>();
              for (const sec of sections) {
                if (sec?.title) set.add(String(sec.title));
                for (const it of (sec?.items || [])) if (it?.title) set.add(String(it.title));
              }
              return Array.from(set);
            };
            const items = collectFooterTitles(fitems);
            if (items.length) {
              await api.post('/v1/translator/translate-multi', { items, dest_languages: dest, src: dl });
            }
          } catch (err: any) {
            reportError(err, {
              operation: 'Footer translation',
              destLanguages: dest,
              pageSlug: slug,
              activeLocale,
            });
            setTranslationError('footer');
            try { toast.error('Footer translation failed'); } catch {}
          }
        }
      } catch (err: any) {
        reportError(err, {
          operation: 'Translation flow',
          pageSlug: slug,
          activeLocale,
        });
        if (!translationError) setTranslationError('general');
        try { toast.error('Some translations failed'); } catch {}
      }
      // Refresh live visibility after publish
      try {
        const res = await api.get(`/v1/pages/slug/${encodeURIComponent(slug)}`);
        const visible = Boolean(res?.data?.visible ?? true);
        setLiveVisible(visible);
        const data = res?.data || null;
        const isV2 = data?.version === 2;
        const v2: PageV2 | null = data ? (isV2 ? data : { ...data, version: 2, sections: data?.sections || [] }) : null;
        setLivePage(v2);
      } catch (_) {
        // ignore
      }
      setPublishState("success");
      setTimeout(() => setPublishState("custom"), 900);
    } catch (e) {
      setPublishState("error");
      setTimeout(() => setPublishState("custom"), 1200);
    }
  };

  return {
    page,
    setPage,
    sections,
    setSections,
    activeLocale,
    setActiveLocale,
    showHeader,
    setShowHeader,
    showFooter,
    setShowFooter,
    liveVisible,
    inSyncWithLive,
    saveState,
    publishState,
    publish,
    translationError,
    setTranslationError,
    // helpers for locales
    addLocale: (code: string) => {
      if (!code) return;
      setPage((prev) => {
        if (!prev) return prev;
        const prevLocales = prev.locales || [prev.defaultLocale || 'en'];
        if (prevLocales.includes(code)) return prev;
        return { ...prev, locales: [...prevLocales, code] } as PageV2;
      });
    },
    setDefaultLocale: (code: string) => {
      setPage((prev) => {
        if (!prev) return prev;
        const locales = prev.locales && prev.locales.length ? prev.locales : [prev.defaultLocale || 'en'];
        const nextLocales = locales.includes(code) ? locales : [...locales, code];
        return { ...prev, defaultLocale: code, locales: nextLocales } as PageV2;
      });
      setActiveLocale(code);
    },
  };
}
