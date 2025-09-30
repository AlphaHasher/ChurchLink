import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import DynamicPage from "@/shared/components/DynamicPage";

const AdminPagePreview: React.FC = () => {
  const { slug: encodedSlug } = useParams<{ slug: string }>();
  const slug = encodedSlug ? decodeURIComponent(encodedSlug) : undefined;
  const navigate = useNavigate();

  const handleEditClick = () => {
    if (slug) {
      navigate(`/admin/webbuilder/edit/${encodeURIComponent(slug)}`);
    }
  };

  const handleBackClick = () => {
    navigate('/admin/webbuilder');
  };

  return (
    <div className="min-h-screen">
      <DynamicPage
        isPreviewMode={true}
        previewSlug={slug}
        showPreviewHeader={true}
        onEditClick={handleEditClick}
        onBackClick={handleBackClick}
      />
    </div>
  );
};

export default AdminPagePreview;