import React, { useState } from "react";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import DynamicPage from "@/shared/components/DynamicPage";
import NavBar from "@/shared/components/NavBar";
import Footer from "@/shared/components/Footer";

// Define interfaces for header and footer data
interface HeaderLink {
  title: string;
  russian_title: string;
  url: string;
  visible?: boolean;
  type?: string;
}

interface HeaderDropdown {
  title: string;
  russian_title: string;
  items: HeaderLink[];
  visible?: boolean;
  type?: string;
}

type HeaderItem = HeaderLink | HeaderDropdown;

interface FooterItem {
  title: string;
  russian_title: string;
  url: string;
  visible?: boolean;
}

interface FooterSection {
  title: string;
  russian_title: string;
  items: FooterItem[];
  visible?: boolean;
}

interface PageSection {
  id: string;
  type: "text" | "image" | "video" | "hero" | "paypal" | "service-times" | "menu" | "contact-info" | "map" | "event";
  content: any;
  settings?: { showFilters?: boolean; eventName?: string | string[]; lockedFilters?: { ministry?: string; ageRange?: string }; title?: string; showTitle?: boolean };
}

interface WebBuilderLayoutProps {
  children: React.ReactNode;
  type: "header" | "footer" | "page";
  headerData?: HeaderItem[];
  footerData?: FooterSection[];
  pageData?: { slug: string; sections: PageSection[] };
  onHeaderDataChange?: (data: HeaderItem[]) => void;
  onFooterDataChange?: (data: FooterSection[]) => void;
  onPageDataChange?: (data: { sections: PageSection[] }) => void;
}

const WebBuilderLayout: React.FC<WebBuilderLayoutProps> = ({
  children,
  type,
  headerData: initialHeaderData,
  footerData: initialFooterData,
  pageData: initialPageData,
  onHeaderDataChange,
  onFooterDataChange,
  onPageDataChange
}) => {
  const [activeTab, setActiveTab] = useState("edit");
  const [currentHeaderData, setCurrentHeaderData] = useState<HeaderItem[] | undefined>(initialHeaderData);
  const [currentFooterData, setCurrentFooterData] = useState<FooterSection[] | undefined>(initialFooterData);
  const [currentPageData, setCurrentPageData] = useState<{ slug: string; sections: PageSection[] } | undefined>(initialPageData);
  const [useStagingPreview, setUseStagingPreview] = useState<boolean>(true);

  const handleHeaderDataChange = (data: HeaderItem[]) => {
    setCurrentHeaderData(data);
    onHeaderDataChange?.(data);
  };

  const handleFooterDataChange = (data: FooterSection[]) => {
    setCurrentFooterData(data);
    onFooterDataChange?.(data);
  };

  const handlePageDataChange = (data: { sections: PageSection[] }) => {
    if (currentPageData) {
      const updatedPageData = { ...currentPageData, ...data };
      setCurrentPageData(updatedPageData);
      onPageDataChange?.(data);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col min-h-0">
        <div className="bg-background">
          <div className="container mx-auto px-4">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="edit">Edit {type === "header" ? "Header" : type === "footer" ? "Footer" : "Page"}</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="edit" className="mt-0 flex-1 overflow-auto">
          <div className="container mx-auto px-4 py-6">
            {type === "page"
              ? children
              : React.Children.map(children, (child) => {
                  if (!React.isValidElement(child)) return child;
                  // Avoid passing unknown props to host elements or UI primitives that forward to DOM
                  const isHost = typeof child.type === 'string';
                  if (isHost) return child;
                  return React.cloneElement(child, {
                    onHeaderDataChange: type === "header" ? handleHeaderDataChange : undefined,
                    onFooterDataChange: type === "footer" ? handleFooterDataChange : undefined,
                    onPageDataChange: undefined,
                  } as any);
                })}
          </div>
        </TabsContent>

        <TabsContent value="preview" className="mt-0 flex-1 flex flex-col min-h-0">
          <div className="text-center py-4 text-gray-500 flex-shrink-0">
            <div className="container mx-auto px-4 flex items-center justify-between">
              <p className="mb-0">
                {type === "page"
                  ? `Preview of page: ${currentPageData?.slug || "unknown"}`
                  : `Preview of root page with ${type} applied:`
                }
              </p>
              {type === "page" && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Checkbox
                    checked={useStagingPreview}
                    onCheckedChange={(val) => setUseStagingPreview(Boolean(val))}
                  />
                  <span>Show staging</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 mx-4 mb-4 min-h-0 relative">
            {/* Full page preview via iframe to staging for pages; component render for header/footer */}
            {type === "page" ? (
              <>
                <div className="absolute inset-0 border rounded-lg overflow-hidden bg-background" />
                <iframe
                  title="page-preview"
                  key={`${currentPageData?.slug}-${useStagingPreview ? 'staging' : 'live'}`}
                  src={`/${(currentPageData?.slug && currentPageData.slug !== "/" ? currentPageData.slug.replace(/^\/+/, "") : "")}${useStagingPreview ? "?staging=1&" : "?"}preview=true`}
                  className="absolute inset-0 w-full h-full"
                  style={{
                    background: 'white',
                    border: 'none'
                  }}
                />
              </>
            ) : (
              <div className="absolute inset-0 border rounded-lg overflow-hidden bg-background flex flex-col min-h-0">
                <NavBar headerData={type === "header" ? currentHeaderData : undefined} />
                <div className="flex-1 overflow-auto">
                  <DynamicPage isPreviewMode={true} previewSlug="home" showPreviewHeader={false} />
                </div>
                <div className="shrink-0">
                  <Footer footerData={type === "footer" ? currentFooterData : undefined} />
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WebBuilderLayout;
