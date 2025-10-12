import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api from "@/api/api";
import { Card, CardContent } from "@/shared/components/ui/card";
import { PreviewRendererClient } from "@/features/admin/components/Forms/PreviewRendererClient";
import { useBuilderStore } from "@/features/admin/components/Forms/store";
import { formWidthToClass, normalizeFormWidth, DEFAULT_FORM_WIDTH, collectAvailableLocales } from "@/features/admin/components/Forms/types";
import { useAuth } from "@/features/auth/hooks/auth-context";
import { Button } from "@/shared/components/ui/button";
import { buildLoginPath } from "@/router/paths";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";

type RawOption = string | { label?: string; value?: string; id?: string; [key: string]: any };

const normalizeOption = (opt: RawOption, index: number) => {
  if (typeof opt === "string") {
    return { label: opt, value: opt };
  }
  const fallback = `option${index + 1}`;
  const value = (opt?.value ?? opt?.id ?? opt?.label ?? fallback)?.toString() ?? fallback;
  const label = opt?.label ?? opt?.value ?? opt?.id ?? value;
  return { ...opt, label, value };
};

const normalizeFieldData = (raw: any) => {
  if (!raw || typeof raw !== "object") return raw;
  const field = { ...raw };
  if (field.type === "select" || field.type === "radio") {
    const source: RawOption[] = Array.isArray(field.options)
      ? field.options
      : Array.isArray((field as any).choices)
        ? (field as any).choices
        : [];
    field.options = source.map((opt, idx) => normalizeOption(opt, idx));
  }
  return field;
};

export default function FormPublic() {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setSchema = useBuilderStore((s) => s.setSchema);
  const schema = useBuilderStore((s) => s.schema);
  const activeLocale = useBuilderStore((s) => s.activeLocale);
  const setActiveLocale = useBuilderStore((s) => s.setActiveLocale);
  const formWidth = useBuilderStore((s) => normalizeFormWidth(s.schema.formWidth ?? DEFAULT_FORM_WIDTH));
  const formWidthClass = formWidthToClass(formWidth);
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const availableLocales = useMemo(() => collectAvailableLocales(schema), [schema]);

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
          setError("Form not found or it may have expired");
          setLoading(false);
          return;
        }
        const formWidthValue = normalizeFormWidth(form.formWidth ?? form.form_width ?? DEFAULT_FORM_WIDTH);
        // set schema into builder store for rendering
        const rawFields: any[] = Array.isArray(form.data) ? form.data : (form.data?.data || []);
        const normalizedFields = rawFields.map((f) => normalizeFieldData(f));
        setSchema({
          title: form.title,
          description: form.description,
          folder: form.folder,
          defaultLocale: form.defaultLocale || 'en',
          locales: form.locales || [],
          formWidth: formWidthValue,
          data: normalizedFields,
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
        if (detailStr.includes('expired')) {
          setError('This form has expired and is no longer accepting responses.');
        } else if (detailStr.includes('not available') || detailStr.includes('not visible')) {
          setError('This form is not available for public viewing.');
        } else if (detailStr.includes('not found')) {
          setError('Form not found.');
        } else {
          setError(err?.response?.data?.detail || "Failed to load form");
        }
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [slug, setSchema, user]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return (
    <div className="p-6">
      <div className={cn("mx-auto w-full", formWidthClass)}>
        <div className="rounded-md border border-border bg-muted/30 p-8 text-center flex flex-col items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12A9 9 0 1112 3a9 9 0 019 9z" />
            </svg>
          </span>
          <h2 className="text-xl font-semibold">Form unavailable</h2>
          <p className="text-destructive max-w-md">{error}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="py-6 bg-background min-h-screen">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className={cn("mx-auto w-full", formWidthClass)}>
          <Card className="w-full gap-0 py-4 sm:py-6 bg-transparent shadow-none">
            <CardContent className="px-4 sm:px-6 bg-transparent">
              {!user && (
                <div className="mb-6 rounded-md border border-muted bg-muted/30 p-4">
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
              {availableLocales.length > 1 && (
                <div className="mb-4 flex justify-end">
                  <Select value={activeLocale} onValueChange={(v) => setActiveLocale(v)}>
                    <SelectTrigger className="w-[160px]" aria-label="Select language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="end">
                      {availableLocales.map((locale) => (
                        <SelectItem key={locale} value={locale}>
                          {locale}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <PreviewRendererClient slug={slug} applyFormWidth={false} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
