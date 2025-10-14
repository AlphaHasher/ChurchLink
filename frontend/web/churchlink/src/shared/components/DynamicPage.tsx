import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import api from "@/api/api";
import HeroSection from "@/features/admin/components/WebBuilder/sections/HeroSection";
import PaypalSection from "@/features/admin/components/WebBuilder/sections/PaypalSection";
import ServiceTimesSection from "@/features/admin/components/WebBuilder/sections/ServiceTimesSection";
import MenuSection from "@/features/admin/components/WebBuilder/sections/MenuSection";
import ContactInfoSection from "@/features/admin/components/WebBuilder/sections/ContactInfoSection";
import EventSection from "@/features/admin/components/WebBuilder/sections/EventSection";
import MapSection from "@/features/admin/components/WebBuilder/sections/MapSection";
import TextSectionRenderer from "@/features/admin/components/WebBuilder/sections/TextSectionRenderer";
import NotFoundPage from "@/shared/components/NotFoundPage";
import InConstructionPage from "@/shared/components/InConstructionPage";
import { Skeleton } from "@/shared/components/ui/skeleton";
import DynamicPageV2Renderer from "@/shared/components/DynamicPageV2Renderer";
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

  // If this is a v2 page, render with the v2 renderer
  const maybeV2 = (pageData as any)?.version;
  if (maybeV2 === 2) {
    const searchParams = new URLSearchParams(location.search);
    const localeParam = searchParams.get('locale') || undefined;
    return (
      <DynamicPageV2Renderer page={pageData as unknown as PageV2} activeLocale={localeParam} defaultLocale={(pageData as any)?.defaultLocale}
      />
    );
  }

  return (
    <>
      {/* Preview Header */}
      {showPreviewHeader && (
        <div className="bg-yellow-100 border-b border-yellow-300 p-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="bg-yellow-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                PREVIEW MODE
              </span>
              <h1 className="text-lg font-semibold text-gray-800">
                {pageData.title} ({slug})
              </h1>
              <span className={`inline-block px-2 py-1 text-xs rounded-full font-medium ${pageData.visible ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                }`}>
                {pageData.visible ? "Visible" : "Hidden"}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {onEditClick && (
                <button
                  onClick={onEditClick}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  Edit
                </button>
              )}
              {onBackClick && (
                <button
                  onClick={onBackClick}
                  className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                >
                  Back to List
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Page Content */}
      {pageData.sections && pageData.sections.length > 0 ? (
        <>
          {pageData.sections.map((section) => {
            return (
              <React.Fragment key={section.id}>
                {section.type === "text" && (
                  <div className="container mx-auto px-4 py-6">
                    <TextSectionRenderer data={section.content} />
                  </div>
                )}

                {section.type === "image" && (
                  <div className="w-full">
                    <img src={section.content} alt="Section" className="w-full object-cover" />
                  </div>
                )}

                {section.type === "video" && (
                  <div className="aspect-w-16 aspect-h-9">
                    <iframe
                      src={section.content}
                      title="Embedded Video"
                      frameBorder="0"
                      allowFullScreen
                      className="w-full h-96"
                    />
                  </div>
                )}

                {section.type === "hero" && <HeroSection data={section.content} isEditing={false} />}

                {section.type === "paypal" && (
                  <PaypalSection
                    data={section.content}
                    isEditing={false}
                  />
                )}

                {section.type === "service-times" && <ServiceTimesSection data={section.content} isEditing={false} />}

                {section.type === "menu" && (
                  <MenuSection data={section.content} isEditing={false} />
                )}

                {section.type === "contact-info" && <ContactInfoSection data={section.content} isEditing={false} />}

                {section.type === "map" && (
                  <MapSection data={section.content} isEditing={false} />
                )}

                {section.type === "event" && (
                  <EventSection
                    showFilters={section.settings?.showFilters !== false}
                    eventName={section.settings?.eventName}
                    lockedFilters={section.settings?.lockedFilters}
                    title={section.settings?.title}
                    showTitle={section.settings?.showTitle !== false}
                  />
                )}
              </React.Fragment>
            );
          })}
        </>
      ) : (
        <div className="container mx-auto px-4 py-8 text-gray-500">No content available.</div>
      )}
    </>
  );
};

export default DynamicPage;
