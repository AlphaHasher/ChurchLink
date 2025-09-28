import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import DynamicPage from "@/shared/components/DynamicPage";

interface WebBuilderLayoutProps {
  children: React.ReactNode;
  type: "header" | "footer";
}

const WebBuilderLayout: React.FC<WebBuilderLayoutProps> = ({ children, type }) => {
  const [activeTab, setActiveTab] = useState("edit");

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
            {children}
          </div>
        </TabsContent>

        <TabsContent value="preview" className="mt-0">
          <div className="text-center py-8 text-gray-500">
            <p className="mb-4">Preview of root page with {type} applied:</p>
            <div className="border rounded-lg overflow-hidden max-w-4xl mx-auto">
              <DynamicPage
                isPreviewMode={true}
                previewSlug="home"
                showPreviewHeader={false}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WebBuilderLayout;
