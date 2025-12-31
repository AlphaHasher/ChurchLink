import { useState, useEffect, useCallback, useRef } from "react";
import api from "@/api/api";
import type { PuckData } from "../config";
import { initialData } from "../config";

interface UsePuckPageOptions {
  autoSaveDelay?: number;
}

interface UsePuckPageReturn {
  data: PuckData;
  loading: boolean;
  error: string | null;
  saving: boolean;
  saveStatus: "idle" | "saving" | "saved" | "error";
  isPublished: boolean;
  save: (data: PuckData) => Promise<void>;
  publish: () => Promise<void>;
}

export function usePuckPage(
  slug: string,
  options: UsePuckPageOptions = {}
): UsePuckPageReturn {
  const { autoSaveDelay = 800 } = options;

  const [data, setData] = useState<PuckData>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isPublished, setIsPublished] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestDataRef = useRef<PuckData>(data);

  // Load page data on mount
  useEffect(() => {
    let cancelled = false;

    const loadPage = async () => {
      setLoading(true);
      setError(null);

      try {
        // Try to load staging version first
        const response = await api.get(`/v1/pages/staging/${encodeURIComponent(slug)}`);
        if (!cancelled) {
          // Check if this is Puck format data
          const pageData = response.data;
          if (pageData.puckData) {
            setData(pageData.puckData);
          } else if (pageData.content && Array.isArray(pageData.content)) {
            // Already Puck format
            setData(pageData);
          } else {
            // New page or legacy format - start fresh
            setData({
              ...initialData,
              root: {
                props: {
                  title: pageData.title || "New Page",
                },
              },
            });
          }
          setIsPublished(pageData.visible === true);
        }
      } catch (err: any) {
        if (cancelled) return;

        if (err.response?.status === 404) {
          // New page - use initial data
          setData({
            ...initialData,
            root: {
              props: {
                title: slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " "),
              },
            },
          });
        } else {
          setError("Failed to load page");
          console.error("Error loading page:", err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPage();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Debounced save function
  const save = useCallback(
    async (newData: PuckData) => {
      latestDataRef.current = newData;
      setData(newData);

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set up debounced save
      saveTimeoutRef.current = setTimeout(async () => {
        setSaving(true);
        setSaveStatus("saving");

        try {
          await api.put(`/v1/pages/staging/${encodeURIComponent(slug)}`, {
            title: latestDataRef.current.root.props?.title || slug,
            puckData: latestDataRef.current,
            format: "puck",
          });

          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
        } catch (err) {
          console.error("Error saving page:", err);
          setSaveStatus("error");
          setTimeout(() => setSaveStatus("idle"), 3000);
        } finally {
          setSaving(false);
        }
      }, autoSaveDelay);
    },
    [slug, autoSaveDelay]
  );

  // Publish function
  const publish = useCallback(async () => {
    try {
      // Save first to ensure latest changes are persisted
      await api.put(`/v1/pages/staging/${encodeURIComponent(slug)}`, {
        title: latestDataRef.current.root.props?.title || slug,
        puckData: latestDataRef.current,
        format: "puck",
      });

      // Then publish
      await api.post(`/v1/pages/publish/${encodeURIComponent(slug)}`);
      setIsPublished(true);
    } catch (err) {
      console.error("Error publishing page:", err);
      throw err;
    }
  }, [slug]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    data,
    loading,
    error,
    saving,
    saveStatus,
    isPublished,
    save,
    publish,
  };
}
