import { useCallback, useState } from 'react';
import api from '@/api/api';

export interface TranslationResult {
  [textIndex: string]: {
    [locale: string]: string;
  };
}

export function useFormTranslator() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const translateForm = useCallback(
    async (formId: string, destLanguages?: string[]): Promise<TranslationResult | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.post(`/v1/forms/${formId}/translate`, {
          dest_languages: destLanguages,
        });
        return response.data?.translations || null;
      } catch (err: any) {
        setError(err?.response?.data?.detail || err?.message || 'Failed to translate form');
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { translateForm, loading, error };
}
