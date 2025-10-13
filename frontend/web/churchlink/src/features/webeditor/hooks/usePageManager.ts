import { useEffect, useState } from "react";
import { PageV2, SectionV2 } from "@/shared/types/pageV2";
import api, { pageApi } from "@/api/api";
import { defaultSection } from "../utils/sectionHelpers";

export function usePageManager(slug: string) {
  const [page, setPage] = useState<PageV2 | null>(null);
  const [sections, setSections] = useState<SectionV2[]>([]);
  const [showHeader, setShowHeader] = useState(false);
  const [showFooter, setShowFooter] = useState(false);
  const [liveVisible, setLiveVisible] = useState<boolean | null>(null);
  const [publishState, setPublishState] = useState<"custom" | "processing" | "success" | "error">("custom");
  const [saveState, setSaveState] = useState<"custom" | "processing" | "success" | "error">("custom");
  const [livePage, setLivePage] = useState<PageV2 | null>(null);
  const [inSyncWithLive, setInSyncWithLive] = useState<boolean>(false);

  // Load staging or seed default
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const res = await pageApi.getStaging(slug);
        const data = res.data;
        const isV2 = data?.version === 2;
        const v2: PageV2 = isV2 ? data : { ...data, version: 2, sections: data?.sections || [] };
        if (mounted) {
          setPage(v2);
          setSections(v2.sections ?? []);
        }
      } catch (e: any) {
        // 404 → seed a draft
        const seeded: PageV2 = { 
          version: 2, 
          title: slug || "Untitled", 
          slug: slug || "/", 
          visible: true, 
          sections: [defaultSection()] 
        };
        setPage(seeded);
        setSections(seeded.sections);
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
    const { _id, created_at, updated_at, styleTokens, ...rest } = p as any;
    return {
      ...rest,
      // Normalize sections children order/fields if needed
      sections: (p.sections || []).map((s) => ({
        ...s,
        // strip any cached px layout
        children: (s.children || []).map((n: any) => ({
          ...n,
          layout: n.layout ? { units: { ...(n.layout.units || {}) } } : undefined,
        })),
      })),
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
    showHeader,
    setShowHeader,
    showFooter,
    setShowFooter,
    liveVisible,
    inSyncWithLive,
    saveState,
    publishState,
    publish,
  };
}
