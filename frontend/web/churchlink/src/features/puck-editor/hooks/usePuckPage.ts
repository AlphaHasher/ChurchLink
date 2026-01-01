import { useState, useEffect, useCallback, useRef } from "react";
import api from "@/api/api";
import type { PuckData } from "../config";
import { initialData } from "../config";

interface UsePuckPageReturn {
  data: PuckData;
  loading: boolean;
  error: string | null;
  publishing: boolean;
  isPublished: boolean;
  updateData: (data: PuckData) => void;
  publish: () => Promise<void>;
}

export function usePuckPage(slug: string): UsePuckPageReturn {
  const [data, setData] = useState<PuckData>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [isPublished, setIsPublished] = useState(false);

  const latestDataRef = useRef<PuckData>(data);

  // Load page data on mount
  useEffect(() => {
    let cancelled = false;

    const loadPage = async () => {
      setLoading(true);
      setError(null);

      try {
        // Load the live/published page
        const response = await api.get(`/v1/pages/preview/${encodeURIComponent(slug)}`);
        if (!cancelled) {
          const pageData = response.data;
          if (pageData.puckData) {
            setData(pageData.puckData);
            latestDataRef.current = pageData.puckData;
          } else if (pageData.content && Array.isArray(pageData.content)) {
            setData(pageData);
            latestDataRef.current = pageData;
          } else {
            const newData = {
              ...initialData,
              root: {
                props: {
                  title: pageData.title || "New Page",
                },
              },
            };
            setData(newData);
            latestDataRef.current = newData;
          }
          setIsPublished(pageData.visible === true);
        }
      } catch (err: unknown) {
        if (cancelled) return;

        const axiosErr = err as { response?: { status?: number } };
        if (axiosErr.response?.status === 404) {
          // New page - use initial data
          const newData = {
            ...initialData,
            root: {
              props: {
                title: slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " "),
              },
            },
          };
          setData(newData);
          latestDataRef.current = newData;
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

  // Update data locally only (no server save)
  const updateData = useCallback((newData: PuckData) => {
    latestDataRef.current = newData;
    setData(newData);
  }, []);

  // Publish function - saves directly to live pages
  const publish = useCallback(async () => {
    setPublishing(true);
    try {
      await api.post(`/v1/pages/publish/${encodeURIComponent(slug)}`, {
        title: latestDataRef.current.root.props?.title || slug,
        puckData: latestDataRef.current,
        format: "puck",
      });
      setIsPublished(true);
    } catch (err) {
      console.error("Error publishing page:", err);
      throw err;
    } finally {
      setPublishing(false);
    }
  }, [slug]);

  return {
    data,
    loading,
    error,
    publishing,
    isPublished,
    updateData,
    publish,
  };
}
