import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api from "@/api/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { PreviewRendererClient } from "@/features/admin/components/Forms/PreviewRendererClient";
import { useBuilderStore } from "@/features/admin/components/Forms/store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { useAuth } from "@/features/auth/hooks/auth-context";
import { Button } from "@/shared/components/ui/button";
import { buildLoginPath } from "@/router/paths";

export default function FormPublic() {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setSchema = useBuilderStore((s) => s.setSchema);
  const schema = useBuilderStore((s) => s.schema);
  const activeLocale = useBuilderStore((s) => s.activeLocale);
  const setActiveLocale = useBuilderStore((s) => s.setActiveLocale);
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        // If user is not logged in, don't call the protected endpoint yet
        if (!user) {
          setLoading(false);
          return;
        }
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
        const status = err?.response?.status as number | undefined;
        const detail = err?.response?.data?.detail;
        const detailStr = typeof detail === 'string' ? detail.toLowerCase() : '';
        // If not authenticated/forbidden, don't surface the error; show login prompt instead
        if (status === 401 || status === 403 || status === 419 || detailStr.includes('not authenticated') || detailStr.includes('unauthorized') || detailStr.includes('forbidden')) {
          setError(null);
          setLoading(false);
          return;
        }
        setError(err?.response?.data?.detail || "Failed to load form");
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [slug, setSchema, user]);

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
  // If an error occurred that isn't auth-related, show it
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
          {!user && (
            <div className="mb-6 rounded-md border border-muted p-4 bg-muted/30">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  You need to be logged in to submit this form.
                </div>
                <div>
                  <Button
                    onClick={() => {
                      const redirectTo = location.pathname + location.search;
                      navigate(buildLoginPath(redirectTo));
                    }}
                  >
                    Log in to continue
                  </Button>
                </div>
              </div>
            </div>
          )}
          {/* Render the form UI regardless so users can view it; submission can still be gated server-side */}
          <PreviewRendererClient slug={slug} />
        </CardContent>
        </Card>
      </div>
    </div>
  );
}
