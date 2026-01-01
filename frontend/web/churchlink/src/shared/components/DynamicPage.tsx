import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import api from "@/api/api";
import NotFoundPage from "@/shared/components/NotFoundPage";
import InConstructionPage from "@/shared/components/InConstructionPage";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { PuckPageRenderer } from "@/features/puck-editor/components/PuckPageRenderer";
import { PageV2 } from "@/shared/types/pageV2";

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
}

const DEFAULT_HOME_SLUG = "/";
const OPTIONAL_BASE = "pages";

const DynamicPage: React.FC<DynamicPageProps> = ({
  isPreviewMode = false,
  previewSlug
}) => {
  const { slug: paramSlug } = useParams();
  const location = useLocation();

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

  const [pageData, setPageData] = useState<PageV2 | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<boolean>(false);

  // Update document title when page loads
  useEffect(() => {
    if (pageData?.title) {
      document.title = pageData.title;
      // Store the page title and slug in localStorage for instant loading on next visit
      try {
        localStorage.setItem('last_page_title', pageData.title);
        localStorage.setItem('last_page_slug', slug);
      } catch (e) {
        // Ignore storage errors
      }
    } else {
      // No page title, clear stored page info and fallback to website config
      try {
        localStorage.removeItem('last_page_title');
        localStorage.removeItem('last_page_slug');
      } catch (e) {
        // Ignore storage errors
      }

      // Fallback to cached website config title
      try {
        const cached = localStorage.getItem('website_config');
        if (cached) {
          const config = JSON.parse(cached);
          if (config.title) {
            document.title = config.title;
          }
        }
      } catch (e) {
        // Ignore errors, keep default title
      }
    }
  }, [pageData?.title, slug]);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    setNotFound(false);
    setPageData(null);

    (async () => {
      try {
        const url = isPreviewMode
          ? `/v1/pages/preview/${encodeURIComponent(slug)}`
          : `/v1/pages/slug/${encodeURIComponent(slug)}`;
        console.log("DynamicPage: Fetching from:", url);
        const res = await api.get(url, {
          signal: ctrl.signal,
        });
        setPageData(res.data);
      } catch (e: unknown) {
        if (ctrl.signal.aborted) return;
        const axiosErr = e as { response?: { status?: number } };
        const status = axiosErr?.response?.status;
        if (status === 404) setNotFound(true);
        else setError("Failed to load page.");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [slug, isPreviewMode]);

  const isEffectivelyPreview =
    isPreviewMode ||
    new URLSearchParams(location.search).get("preview") === "true";

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

  // Only Puck-formatted pages are supported
  if (pageData.format === "puck" && pageData.puckData) {
    return <PuckPageRenderer data={pageData.puckData as import("@/features/puck-editor/config").PuckData} />;
  }

  // Page exists but is not in Puck format - show not found
  return <NotFoundPage />;
};

export default DynamicPage;
