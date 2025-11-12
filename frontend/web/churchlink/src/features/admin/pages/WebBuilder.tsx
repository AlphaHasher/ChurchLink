import PageList from "@/features/admin/components/WebBuilder/sub_pages/PageList";

const WebBuilderPage = () => {
  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold">Website Builder</h1>
      <p className="text-gray-600 mt-2">
        Manage your website pages
      </p>
      <PageList />
    </div>
  );
};

export default WebBuilderPage;
