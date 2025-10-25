import api from '@/api/api';
import { useState, useCallback } from 'react';

export interface TranslationResult {
  [textIndex: string]: {
    [locale: string]: string;
  };
}

export function useFormTranslator() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const translateForm = useCallback(
    async (
      formId: string,
      destLanguages?: string[]
    ): Promise<TranslationResult | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await api.post(`/v1/forms/${formId}/translate`, {
          dest_languages: destLanguages,
        });

        if (response.data?.translations) {
          return response.data.translations;
        }
        return null;
      } catch (err: any) {
        const errorMsg =
          err?.response?.data?.detail ||
          err?.message ||
          'Failed to translate form';
        setError(errorMsg);
        console.error('Form translation error:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { translateForm, loading, error };
}
