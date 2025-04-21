import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from "@/lib/auth-context";
import HeroSection from "@/components/AdminDashboard/WebBuilder/sections/HeroSection";
import ServiceTimesSection from "@/components/AdminDashboard/WebBuilder/sections/ServiceTimesSection";
import MenuSection from "@/components/AdminDashboard/WebBuilder/sections/MenuSection";
import ContactInfoSection from "@/components/AdminDashboard/WebBuilder/sections/ContactInfoSection";
import MapSection from "@/components/AdminDashboard/WebBuilder/sections/MapSection";
import Footer from "@/components/Main/Footer";
import NotFoundPage from "@/pages/NotFoundPage";
import InConstructionPage from "@/pages/InConstructionPage";
import PrivNavBar from "@/components/PrivNavBar.tsx";
import PubNavBar from "@/components/PubNavBar.tsx";

export interface Section {
  id: string;
  type: "text" | "image" | "video" | "hero" | "service-times" | "menu" | "contact-info" | "map";
  content: any; // use any to handle complex objects like hero
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
  const user = useAuth();

  useEffect(() => {
    if (!slug) {
      setError('Invalid slug');
      setLoading(false);
      return;
    }

    const fetchPageData = async () => {
      try {
        const response = await fetch(`/api/pages/${slug}`);
        if (!response.ok) throw new Error('Failed to fetch data');
        const data = await response.json();
        setPageData(data);
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
    <>
      {user ? <PrivNavBar/> : <PubNavBar/>}
      <>
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

              {section.type === "service-times" && <ServiceTimesSection data={section.content} isEditing={false} />}

              {section.type === "menu" && (
                <MenuSection data={section.content} isEditing={false} />
              )}

              {section.type === "contact-info" && <ContactInfoSection data={section.content} isEditing={false} />}

              {section.type === "map" && (
                <MapSection data={section.content} isEditing={false} />
              )}
            </React.Fragment>
          ))}
        </>
      ) : (
        <p>No content available.</p>
      )}
      </>
      <Footer/>
    </>
  );
};

export default DynamicPage;