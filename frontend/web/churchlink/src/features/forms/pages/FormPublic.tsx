import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/api/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { PreviewRendererClient } from "@/features/admin/components/Forms/PreviewRendererClient";
import { useBuilderStore } from "@/features/admin/components/Forms/store";

export default function FormPublic() {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setSchema = useBuilderStore((s) => s.setSchema);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const resp = await api.get(`/v1/forms/slug/${slug}`);
        if (!mounted) return;
        const form = resp.data;
        if (!form) {
          setError("Form not found");
          setLoading(false);
          return;
        }
        // set schema into builder store for rendering
        setSchema({ title: form.title, description: form.description, folder: form.folder, data: Array.isArray(form.data) ? form.data : (form.data?.data || []) });
        setLoading(false);
      } catch (err: any) {
        console.error("Failed to load public form", err);
        setError(err?.response?.data?.detail || "Failed to load form");
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [slug, setSchema]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-destructive">{error}</div>;

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Public Form</CardTitle>
        </CardHeader>
        <CardContent>
          <PreviewRendererClient slug={slug} />
        </CardContent>
      </Card>
    </div>
  );
}
