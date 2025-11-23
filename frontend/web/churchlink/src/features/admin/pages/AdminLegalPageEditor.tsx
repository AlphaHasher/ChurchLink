// src/features/legal/LegalPageEditor.tsx
import React from "react";
import axios, { AxiosRequestConfig } from "axios";
import { getAuth } from "firebase/auth";
import ReactMarkdown from "react-markdown";

// If you have your own UI kit, swap these out:
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

type LegalSlug = "terms" | "privacy" | "refunds";

type AdminLegalResponse = {
  id: string;
  slug: LegalSlug | string;
  title: string;
  content_by_locale: Record<string, string>; // e.g., { en: "...md..." }
  updated_at: string;
  updated_by?: string | null;
};

type Props = {
  slug: LegalSlug;
  // Optional locale. If omitted, we’ll use "en".
  locale?: string;
};

async function authedRequest<T = any>(config: AxiosRequestConfig): Promise<T> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Not signed in");
  }
  const token = await user.getIdToken(); // fresh ID token
  const res = await axios({
    ...config,
    headers: {
      ...(config.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
  return res.data as T;
}

export default function LegalPageEditor({ slug, locale = "en" }: Props) {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [preview, setPreview] = React.useState(false);

  // Load current admin doc
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setError(null);
        setLoading(true);
        const data = await authedRequest<AdminLegalResponse>({
          method: "GET",
          url: `/api/v1/admin/legal/${slug}`,
        });
        if (!mounted) return;
        setTitle(data.title ?? slug.toUpperCase());
        setContent(data.content_by_locale?.[locale] ?? "");
      } catch (e: any) {
        setError(e?.message ?? "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [slug, locale]);

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      await authedRequest<AdminLegalResponse>({
        method: "PUT",
        url: `/api/v1/admin/legal/${slug}`,
        data: {
          title,
          content_by_locale: {
            [locale]: content,
          },
        },
      });
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="lp-title">Title</Label>
        <Input
          id="lp-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Terms & Conditions"
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Editing: <b>{slug}</b> ({locale})</div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={() => setPreview((v) => !v)}>
            {preview ? "Edit Markdown" : "Preview"}
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {!preview ? (
        <div className="grid gap-2">
          <Label htmlFor="lp-md">Content (Markdown)</Label>
          <Textarea
            id="lp-md"
            className="min-h-[320px]"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="# Heading\n\nYour policy text…"
          />
        </div>
      ) : (
        <div className="prose max-w-none rounded-md border p-4">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
