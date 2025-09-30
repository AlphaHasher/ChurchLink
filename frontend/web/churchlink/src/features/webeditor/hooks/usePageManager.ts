import { useEffect, useState } from "react";
import { PageV2, SectionV2 } from "@/shared/types/pageV2";
import { pageApi } from "@/api/api";
import { defaultSection } from "../utils/sectionHelpers";

export function usePageManager(slug: string) {
  const [page, setPage] = useState<PageV2 | null>(null);
  const [sections, setSections] = useState<SectionV2[]>([]);
  const [showHeader, setShowHeader] = useState(false);
  const [showFooter, setShowFooter] = useState(false);

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

  // Autosave staging
  useEffect(() => {
    if (!slug || !page) return;
    const t = setTimeout(() => {
      pageApi.saveStaging(slug, { ...page, slug, version: 2, sections });
    }, 1200);
    return () => clearTimeout(t);
  }, [slug, page, sections]);

  const publish = async () => {
    if (!slug) return;
    await pageApi.saveStaging(slug, { ...page, slug, version: 2, sections });
    await pageApi.publish(slug);
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
    publish,
  };
}
