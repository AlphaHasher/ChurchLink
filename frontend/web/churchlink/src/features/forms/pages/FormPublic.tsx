import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api from "@/api/api";
import { Card, CardContent } from "@/shared/components/ui/card";
import { PreviewRendererClient } from "@/features/admin/components/Forms/PreviewRendererClient";
import { useBuilderStore } from "@/features/admin/components/Forms/store";
import { formWidthToClass, normalizeFormWidth, DEFAULT_FORM_WIDTH } from "@/features/admin/components/Forms/types";
import { useAuth } from "@/features/auth/hooks/auth-context";
import { Button } from "@/shared/components/ui/button";
import { buildLoginPath } from "@/router/paths";
import { cn } from "@/lib/utils";

export default function FormPublic() {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setSchema = useBuilderStore((s) => s.setSchema);
  const formWidth = useBuilderStore((s) => normalizeFormWidth(s.schema.formWidth ?? DEFAULT_FORM_WIDTH));
  const formWidthClass = formWidthToClass(formWidth);
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
        const formWidthValue = normalizeFormWidth(form.formWidth ?? form.form_width ?? DEFAULT_FORM_WIDTH);
        // set schema into builder store for rendering
        setSchema({
          title: form.title,
          description: form.description,
          folder: form.folder,
          defaultLocale: form.defaultLocale || 'en',
          locales: form.locales || [],
          formWidth: formWidthValue,
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

  if (loading) return <div className="p-6">Loading...</div>;
  // If an error occurred that isn't auth-related, show it
  if (error) return <div className="p-6 text-destructive">{error}</div>;

  return (
    <div className="py-6">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className={cn("mx-auto w-full", formWidthClass)}>
          <Card className="w-full gap-0 py-4 sm:py-6">
            <CardContent className="px-4 sm:px-6">
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
              <PreviewRendererClient slug={slug} applyFormWidth={false} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
