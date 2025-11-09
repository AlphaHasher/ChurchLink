import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import api from "@/api/api";
import NotFoundPage from "@/shared/components/NotFoundPage";
import InConstructionPage from "@/shared/components/InConstructionPage";
import { Skeleton } from "@/shared/components/ui/skeleton";
import DynamicPageV2Renderer from "@/shared/components/DynamicPageV2Renderer";
import { PageV2 } from "@/shared/types/pageV2";
import { useLanguage } from "@/provider/LanguageProvider";

export interface SectionSettings {
  showFilters?: boolean;
  eventName?: string | string[];
  lockedFilters?: { ministry?: string; ageRange?: string };
  title?: string;
  showTitle?: boolean;
}

export interface Section {
  id: string;
  type:
  | "text"
  | "image"
  | "video"
  | "hero"
  | "paypal"
  | "service-times"
  | "menu"
  | "contact-info"
  | "map"
  | "event";
  content: any;
  settings?: SectionSettings;
}

export interface Page {
  _id: string;
  title: string;
  slug?: string;
  content?: string;
  sections?: Section[];
  visible?: boolean;
}

export interface DynamicPageProps {
  isPreviewMode?: boolean;
  previewSlug?: string;
  showPreviewHeader?: boolean;
  onEditClick?: () => void;
  onBackClick?: () => void;
}

const DEFAULT_HOME_SLUG = "/";
const OPTIONAL_BASE = "pages";

const DynamicPage: React.FC<DynamicPageProps> = ({
  isPreviewMode = false,
  previewSlug,
  showPreviewHeader = false,
  onEditClick,
  onBackClick
}) => {
  const { slug: paramSlug } = useParams();
  const location = useLocation();
  const { locale: ctxLocale } = useLanguage();

  const slug = useMemo(() => {
    // If previewSlug is provided (preview mode), use it directly
    if (isPreviewMode && previewSlug) {
      return previewSlug;
    }

    let raw =
      (paramSlug as string | undefined) ??
      location.pathname.replace(/^\/+/, "");

    if (raw?.startsWith(`${OPTIONAL_BASE}/`)) raw = raw.slice(OPTIONAL_BASE.length + 1);

    raw = raw?.replace(/\/+$/, "");

    if (!raw || raw === "") return DEFAULT_HOME_SLUG;
    if (raw === "home") return "/";

    return raw;
  }, [paramSlug, location.pathname, isPreviewMode, previewSlug]);

  const [pageData, setPageData] = useState<Page | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<boolean>(false);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    setNotFound(false);
    setPageData(null);

    (async () => {
      try {
        // Respect staging query param anywhere in the app (not only when isPreviewMode is true)
        const searchParams = new URLSearchParams(location.search);
        const useStaging = (searchParams.get("staging") === "1" || searchParams.get("staging") === "true");
        const url = useStaging
          ? `/v1/pages/staging/${encodeURIComponent(slug)}`
          : (isPreviewMode
              ? `/v1/pages/preview/${encodeURIComponent(slug)}`
              : `/v1/pages/slug/${encodeURIComponent(slug)}`);
        console.log("DynamicPage: Fetching from:", url);
        const res = await api.get(url, {
          signal: ctrl.signal,
        });
        setPageData(res.data);
      } catch (e: any) {
        if (ctrl.signal.aborted) return;
        const status = e?.response?.status;
        if (status === 404) setNotFound(true);
        else setError("Failed to load page.");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [slug, isPreviewMode]);

  // In preview mode, don't check visibility; in public mode, check visibility
  const isEffectivelyPreview =
    isPreviewMode ||
    (new URLSearchParams(location.search).get("staging") === "1" ||
      new URLSearchParams(location.search).get("staging") === "true") ||
    (new URLSearchParams(location.search).get("preview") === "true");

  // Add preview class to body for CSS targeting (must be before any early returns to keep hook order stable)
  React.useEffect(() => {
    if (isEffectivelyPreview) {
      document.body.classList.add("preview-content");
    } else {
      document.body.classList.remove("preview-content");
    }
  }, [isEffectivelyPreview]);

  if (loading) return (
    <div className="container mx-auto px-4 py-6">
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
  if (error) return <div className="text-center text-red-500">{error}</div>;
  if (notFound || !pageData) return <NotFoundPage />;

  if (!isEffectivelyPreview && pageData.visible === false) return <InConstructionPage />;

  console.log("DynamicPage: Rendering page:", pageData);
  console.log("DynamicPage: Page sections:", pageData.sections);

  const searchParams = new URLSearchParams(location.search);
  const localeParam = searchParams.get('locale') || undefined;
  return (
    <DynamicPageV2Renderer
      page={pageData as unknown as PageV2}
      activeLocale={localeParam || ctxLocale}
      defaultLocale={(pageData as any)?.defaultLocale}
    />
  );
};

export default DynamicPage;
