import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import api from "@/api/api";
import HeroSection from "@/features/admin/components/WebBuilder/sections/HeroSection";
import ServiceTimesSection from "@/features/admin/components/WebBuilder/sections/ServiceTimesSection";
import MenuSection from "@/features/admin/components/WebBuilder/sections/MenuSection";
import ContactInfoSection from "@/features/admin/components/WebBuilder/sections/ContactInfoSection";
import EventSection from "@/features/admin/components/WebBuilder/sections/EventSection";
import MapSection from "@/features/admin/components/WebBuilder/sections/MapSection";
import NotFoundPage from "@/shared/components/NotFoundPage";
import InConstructionPage from "@/shared/components/InConstructionPage";
import Layout from "@/shared/layouts/Layout";

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

const DEFAULT_HOME_SLUG = "home";
const OPTIONAL_BASE = "pages";

const DynamicPage: React.FC = () => {
  const { slug: paramSlug } = useParams();
  const location = useLocation();

  const slug = useMemo(() => {
    let raw =
      (paramSlug as string | undefined) ??
      location.pathname.replace(/^\/+/, "");

    if (raw?.startsWith(`${OPTIONAL_BASE}/`)) raw = raw.slice(OPTIONAL_BASE.length + 1);

    raw = raw?.replace(/\/+$/, "");

    if (!raw || raw === "") return DEFAULT_HOME_SLUG;

    return raw;
  }, [paramSlug, location.pathname]);

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
        const res = await api.get(`/pages/${encodeURIComponent(slug)}`, {
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
  }, [slug]);

  if (loading) return <div className="text-center">Loading...</div>;
  if (error) return <div className="text-center text-red-500">{error}</div>;
  if (notFound || !pageData) return <NotFoundPage />;
  if (pageData.visible === false) return <InConstructionPage />;

  return (
    <Layout>
      {pageData.sections && pageData.sections.length > 0 ? (
        <>
          {pageData.sections.map((section) => (
            <React.Fragment key={section.id}>
              {section.type === "text" && <p>{section.content}</p>}

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
              {section.type === "service-times" && (
                <ServiceTimesSection data={section.content} isEditing={false} />
              )}
              {section.type === "menu" && <MenuSection data={section.content} isEditing={false} />}
              {section.type === "contact-info" && (
                <ContactInfoSection data={section.content} isEditing={false} />
              )}
              {section.type === "map" && <MapSection data={section.content} isEditing={false} />}
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
          ))}
        </>
      ) : (
        <p>No content available.</p>
      )}
    </Layout>
  );
};

export default DynamicPage;
