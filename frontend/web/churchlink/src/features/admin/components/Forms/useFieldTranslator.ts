import { useCallback, useState } from 'react';
import api from '@/api/api';

export function useFieldTranslator() {
  const [loading, setLoading] = useState<{ [locale: string]: boolean }>({});
  const [error, setError] = useState<string | null>(null);

  const translateField = useCallback(
    async (
      fieldData: any,
      destLanguages: string[]
    ): Promise<{ [locale: string]: { label?: string; placeholder?: string; [key: string]: any } } | null> => {
      setLoading(prev => {
        const next = { ...prev };
        destLanguages.forEach(lang => next[lang] = true);
        return next;
      });
      setError(null);

      try {
        // Extract translatable texts from this specific field
        const texts: string[] = [];
        const textMap: Array<{ property: string; optionIdx?: number }> = [];

        if (fieldData.label) {
          texts.push(fieldData.label);
          textMap.push({ property: 'label' });
        }

        if (fieldData.placeholder) {
          texts.push(fieldData.placeholder);
          textMap.push({ property: 'placeholder' });
        }

        if (fieldData.helpText) {
          texts.push(fieldData.helpText);
          textMap.push({ property: 'helpText' });
        }

        if (fieldData.options) {
          fieldData.options.forEach((option: any, idx: number) => {
            if (option.label) {
              texts.push(option.label);
              textMap.push({ property: 'option', optionIdx: idx });
            }
          });
        }

        if (fieldData.type === 'static' && fieldData.content) {
          texts.push(fieldData.content);
          textMap.push({ property: 'content' });
        }

        // Add price field payment method texts
        if (fieldData.type === 'price') {
          const paymentTexts = [
            { key: 'paypal_required', default: 'PayPal Payment Required' },
            { key: 'paypal_description', default: 'This form requires payment through PayPal. You\'ll be redirected to PayPal to complete the payment when submitting.' },
            { key: 'paypal_option', default: 'Pay with PayPal' },
            { key: 'paypal_hint', default: '(Secure online payment)' },
            { key: 'inperson_required', default: 'In-Person Payment Required' },
            { key: 'inperson_description', default: 'This payment will be collected in-person at the event or location. You can submit the form now and complete payment when you arrive.' },
            { key: 'inperson_option', default: 'Pay In-Person' },
            { key: 'inperson_hint', default: '(Pay at location)' },
            { key: 'choose_method', default: 'Choose Payment Method:' },
            { key: 'no_methods', default: 'No payment methods configured' }
          ];

          paymentTexts.forEach(({ key, default: defaultText }) => {
            texts.push(defaultText);
            textMap.push({ property: key });
          });
        }

        if (texts.length === 0) {
          return {};
        }

        // Call the backend translator directly
        const response = await api.post('/v1/translator/translate-multi', {
          items: texts,
          src: 'en',
          dest_languages: destLanguages,
        });

        const translations = response.data?.translations || {};

        // Map translations back to field structure
        const result: { [locale: string]: any } = {};
        destLanguages.forEach(locale => {
          result[locale] = {};
        });

        texts.forEach((text, idx) => {
          const mapping = textMap[idx];
          const textTranslations = translations[text] || {};

          destLanguages.forEach(locale => {
            if (textTranslations[locale]) {
              if (mapping.property === 'option' && mapping.optionIdx !== undefined) {
                result[locale][`option_${mapping.optionIdx}`] = textTranslations[locale];
              } else {
                result[locale][mapping.property] = textTranslations[locale];
              }
            }
          });
        });

        return result;
      } catch (err: any) {
        setError(err?.response?.data?.detail || err?.message || 'Failed to translate field');
        return null;
      } finally {
        setLoading(prev => {
          const next = { ...prev };
          destLanguages.forEach(lang => next[lang] = false);
          return next;
        });
      }
    },
    []
  );

  return { translateField, loading, error };
}
