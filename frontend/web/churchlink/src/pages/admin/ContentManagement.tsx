import { useState } from "react";

const ContentManagement = () => {
  const [content, setContent] = useState("");
  const handleSave = () => console.log("Content saved:", content);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Content Management (CMS Strapi goes here)</h1>
      <textarea
        className="w-full p-2 border"
        rows={6}
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <button className="bg-blue-500 text-white px-4 py-2 rounded mt-2" onClick={handleSave}>
        Save Content
      </button>
    </div>
  );
};

export default ContentManagement;