import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import axios from "axios";

export default function LegalPageEditor({ slug }: { slug: string }) {
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    axios.get(`/api/v1/admin/legal/${slug}`).then(res => {
      setTitle(res.data.title);
      setContent(res.data.content_by_locale.en || "");
    });
  }, [slug]);

  const handleSave = async () => {
    await axios.put(`/api/v1/admin/legal/${slug}`, {
      title,
      content_by_locale: { en: content },
    });
    alert("Saved!");
  };

  return (
    <div className="p-4">
      <h1>{title}</h1>
      <textarea
        className="w-full h-80 border p-2"
        value={content}
        onChange={e => setContent(e.target.value)}
      />
      <button onClick={() => setPreview(!preview)}>Toggle Preview</button>
      <button onClick={handleSave}>Save</button>
      {preview && (
        <div className="mt-4 border p-4">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}