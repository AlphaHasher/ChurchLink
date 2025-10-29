import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import PageList from "@/features/admin/components/WebBuilder/sub_pages/PageList";
import WebsiteSettings from "@/features/admin/components/WebBuilder/sub_pages/WebsiteSettings";

const WebBuilderPage = () => {
  const [activeTab, setActiveTab] = useState("pages");

  return (
    <div className="p-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Website Builder</h1>
        <p className="text-gray-600 mt-2">
          Manage your website pages, settings, and configuration
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pages">Pages</TabsTrigger>
          <TabsTrigger value="settings">Website Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="pages" className="mt-6">
          <PageList />
        </TabsContent>
        
        <TabsContent value="settings" className="mt-6">
          <WebsiteSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WebBuilderPage;
