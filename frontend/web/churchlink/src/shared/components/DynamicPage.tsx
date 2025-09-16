import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from "@/api/api";
import HeroSection from "@/features/admin/components/WebBuilder/sections/HeroSection";
import PaypalSection from "@/features/admin/components/WebBuilder/sections/PaypalSection";
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
  type: "text" | "image" | "video" | "hero" | "paypal" | "service-times" | "menu" | "contact-info" | "map" | "event";
  content: any; // use any to handle complex objects like hero
  settings?: SectionSettings;
}

export interface Page {
  _id: string;
  title: string;
  slug?: string;
  content?: string;
  sections?: Section[];
  visible?: boolean; // added visibility property to Page
}

const DynamicPage: React.FC = () => {
  const location = useLocation();
  const slug = location.pathname === "/" ? "home" : location.pathname.replace(/^\/+/, "");

  const [pageData, setPageData] = useState<Page | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setError('Invalid slug');
      setLoading(false);
      return;
    }

    const fetchPageData = async () => {
      try {
        const response = await api.get(`/pages/${slug}`);
        setPageData(response.data);
      } catch {
        // setError('Error fetching page data');
        return <NotFoundPage />;
      } finally {
        setLoading(false);
      }
    };
    fetchPageData();
  }, [slug]);

  if (loading) return <div className="text-center">Loading...</div>;
  if (error) return <div className="text-center text-red-500">{error}</div>;
  if (!pageData) return <NotFoundPage />;
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
                  <img
                    src={section.content}
                    alt="Section"
                    className="w-full object-cover"
                  />
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
                  ></iframe>
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
          ))}
        </>
      ) : (
        <p>No content available.</p>
      )}
    </Layout>
  );
};

export default DynamicPage;