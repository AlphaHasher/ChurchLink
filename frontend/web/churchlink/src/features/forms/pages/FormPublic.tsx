import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/api/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { PreviewRendererClient } from "@/features/admin/components/Forms/PreviewRendererClient";
import { useBuilderStore } from "@/features/admin/components/Forms/store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";

export default function FormPublic() {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setSchema = useBuilderStore((s) => s.setSchema);
  const schema = useBuilderStore((s) => s.schema);
  const activeLocale = useBuilderStore((s) => s.activeLocale);
  const setActiveLocale = useBuilderStore((s) => s.setActiveLocale);

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
        setSchema({
          title: form.title,
          description: form.description,
          folder: form.folder,
          defaultLocale: form.defaultLocale || 'en',
          locales: form.locales || [],
          data: Array.isArray(form.data) ? form.data : (form.data?.data || []),
        });
        setLoading(false);
      } catch (err: any) {
        console.error("Failed to load public form", err);
        setError(err?.response?.data?.detail || "Failed to load form");
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [slug, setSchema]);

  const availableLocales = useMemo(() => {
    const set = new Set<string>();
    const dl = (schema as any)?.defaultLocale || 'en';
    if (dl) set.add(dl);
    for (const l of ((schema as any)?.locales || [])) set.add(l);
    for (const f of ((schema as any)?.data || [])) {
      const i18n = (f as any)?.i18n as Record<string, any> | undefined;
      if (i18n) for (const k of Object.keys(i18n)) set.add(k);
      if ((f as any)?.options) {
        for (const o of (f as any).options) {
          const oi = o?.i18n as Record<string, any> | undefined;
          if (oi) for (const k of Object.keys(oi)) set.add(k);
        }
      }
    }
    return Array.from(set);
  }, [schema]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-destructive">{error}</div>;

  return (
    <div className="py-6">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
        <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Public Form</CardTitle>
            <Select value={activeLocale} onValueChange={(v) => setActiveLocale(v)}>
              <SelectTrigger className="h-8 w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {availableLocales.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <PreviewRendererClient slug={slug} />
        </CardContent>
        </Card>
      </div>
    </div>
  );
}
