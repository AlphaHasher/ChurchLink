import React from "react";
import { useParams } from "react-router-dom";
import DynamicPage from "@/shared/components/DynamicPage";

const AdminPagePreview: React.FC = () => {
  const { slug: encodedSlug } = useParams<{ slug: string }>();
  const slug = encodedSlug ? decodeURIComponent(encodedSlug) : undefined;

  return (
    <div className="min-h-screen">
      <DynamicPage
        isPreviewMode={true}
        previewSlug={slug}
      />
    </div>
  );
};

export default AdminPagePreview;