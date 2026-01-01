import { useState, useEffect, useCallback } from "react";
import api from "@/api/api";

interface TemplateComponentData {
  type: string;
  props: Record<string, unknown>;
}

export interface CustomTemplate {
  _id: string;
  name: string;
  description?: string;
  puckData: {
    type: string;
    props: Record<string, unknown>;
    content?: TemplateComponentData[];
    zones?: Record<string, TemplateComponentData[]>;
  };
  created_at: string;
  updated_at: string;
  locked?: boolean;
}

interface UseCustomTemplatesReturn {
  templates: CustomTemplate[];
  loading: boolean;
  error: string | null;
  saveTemplate: (name: string, puckData: object, description?: string) => Promise<CustomTemplate>;
  updateTemplate: (id: string, updates: { name?: string; description?: string; locked?: boolean; puckData?: object }) => Promise<CustomTemplate>;
  duplicateTemplate: (id: string) => Promise<CustomTemplate>;
  toggleLock: (id: string, currentLocked: boolean) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useCustomTemplates(): UseCustomTemplatesReturn {
  const [templates, setTemplates] = useState<CustomTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get("/v1/page-components/");
      setTemplates(response.data);
    } catch (err: unknown) {
      console.error("Error fetching custom templates:", err);
      setError("Failed to load custom templates");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load templates on mount
  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const saveTemplate = useCallback(
    async (name: string, puckData: object, description?: string): Promise<CustomTemplate> => {
      try {
        const response = await api.post("/v1/page-components/", {
          name,
          description,
          puckData,
        });

        // Refetch to get the complete template data
        await fetchTemplates();

        return response.data;
      } catch (err: unknown) {
        console.error("Error saving template:", err);
        const axiosError = err as { response?: { data?: { detail?: string } } };
        const message = axiosError.response?.data?.detail || "Failed to save template";
        throw new Error(message);
      }
    },
    [fetchTemplates]
  );

  const updateTemplate = useCallback(
    async (id: string, updates: { name?: string; description?: string; locked?: boolean; puckData?: object }): Promise<CustomTemplate> => {
      try {
        const response = await api.put(`/v1/page-components/${id}`, updates);
        await fetchTemplates();
        return response.data;
      } catch (err: unknown) {
        console.error("Error updating template:", err);
        const axiosError = err as { response?: { data?: { detail?: string } } };
        const message = axiosError.response?.data?.detail || "Failed to update template";
        throw new Error(message);
      }
    },
    [fetchTemplates]
  );

  const duplicateTemplate = useCallback(
    async (id: string): Promise<CustomTemplate> => {
      try {
        const response = await api.post(`/v1/page-components/${id}/duplicate`);
        await fetchTemplates();
        return response.data;
      } catch (err: unknown) {
        console.error("Error duplicating template:", err);
        throw new Error("Failed to duplicate template");
      }
    },
    [fetchTemplates]
  );

  const toggleLock = useCallback(
    async (id: string, currentLocked: boolean): Promise<void> => {
      try {
        await api.put(`/v1/page-components/${id}`, { locked: !currentLocked });
        setTemplates((prev) =>
          prev.map((t) => (t._id === id ? { ...t, locked: !currentLocked } : t))
        );
      } catch (err: unknown) {
        console.error("Error toggling lock:", err);
        throw new Error("Failed to toggle lock");
      }
    },
    []
  );

  const deleteTemplate = useCallback(
    async (id: string): Promise<void> => {
      try {
        await api.delete(`/v1/page-components/${id}`);
        setTemplates((prev) => prev.filter((t) => t._id !== id));
      } catch (err: unknown) {
        console.error("Error deleting template:", err);
        throw new Error("Failed to delete template");
      }
    },
    []
  );

  return {
    templates,
    loading,
    error,
    saveTemplate,
    updateTemplate,
    duplicateTemplate,
    toggleLock,
    deleteTemplate,
    refetch: fetchTemplates,
  };
}
