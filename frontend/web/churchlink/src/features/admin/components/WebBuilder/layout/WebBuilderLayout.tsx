import React, { useState } from "react";
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

interface WebBuilderLayoutProps {
  children: React.ReactNode;
  type: "header" | "footer";
  headerData?: HeaderItem[];
  footerData?: FooterSection[];
  onHeaderDataChange?: (data: HeaderItem[]) => void;
  onFooterDataChange?: (data: FooterSection[]) => void;
}

const WebBuilderLayout: React.FC<WebBuilderLayoutProps> = ({
  children,
  type,
  headerData: initialHeaderData,
  footerData: initialFooterData,
  onHeaderDataChange,
  onFooterDataChange
}) => {
  const [activeTab, setActiveTab] = useState("edit");
  const [currentHeaderData, setCurrentHeaderData] = useState<HeaderItem[] | undefined>(initialHeaderData);
  const [currentFooterData, setCurrentFooterData] = useState<FooterSection[] | undefined>(initialFooterData);

  const handleHeaderDataChange = (data: HeaderItem[]) => {
    setCurrentHeaderData(data);
    onHeaderDataChange?.(data);
  };

  const handleFooterDataChange = (data: FooterSection[]) => {
    setCurrentFooterData(data);
    onFooterDataChange?.(data);
  };

  return (
    <div className="min-h-screen">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="border-b bg-white">
          <div className="container mx-auto px-4">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="edit">Edit {type === "header" ? "Header" : "Footer"}</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="edit" className="mt-0">
          <div className="container mx-auto px-4 py-6">
            {React.Children.map(children, (child) => {
              if (React.isValidElement(child)) {
                return React.cloneElement(child, {
                  onHeaderDataChange: type === "header" ? handleHeaderDataChange : undefined,
                  onFooterDataChange: type === "footer" ? handleFooterDataChange : undefined,
                } as any);
              }
              return child;
            })}
          </div>
        </TabsContent>

        <TabsContent value="preview" className="mt-0">
          <div className="text-center py-4 text-gray-500">
            <p className="mb-2">Preview of root page with {type} applied:</p>
            <div className="border rounded-lg overflow-hidden bg-white">
              {/* Header - use current edited data when editing header, otherwise fetch from API */}
              <NavBar headerData={type === "header" ? currentHeaderData : undefined} />

              {/* Page Content */}
              <DynamicPage
                isPreviewMode={true}
                previewSlug="home"
                showPreviewHeader={false}
              />

              {/* Footer - use current edited data when editing footer, otherwise fetch from API */}
              <Footer footerData={type === "footer" ? currentFooterData : undefined} />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WebBuilderLayout;
