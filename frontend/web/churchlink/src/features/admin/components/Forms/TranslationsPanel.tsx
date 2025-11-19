import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { useBuilderStore } from "./store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import type { AnyField, SelectField } from "./types";
import { useFieldTranslator } from "./useFieldTranslator";
import { Languages, Loader2 } from "lucide-react";
import { useState } from "react";

interface TranslationsPanelProps {
  field: AnyField;
}

export function TranslationsPanel({ field }: TranslationsPanelProps) {
  const supportedLocales = useBuilderStore((s) => s.schema.supported_locales || []);
  const translations = useBuilderStore((s) => s.translations);
  const setTranslations = useBuilderStore((s) => s.setTranslations);
  const clearCustomLocales = useBuilderStore((s) => s.clearCustomLocales);
  const { translateField, loading: translating } = useFieldTranslator();
  const [error, setError] = useState<string | null>(null);

  if (!supportedLocales || supportedLocales.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No supported locales configured. Add locales above to enable translations.
      </div>
    );
  }

  const fieldTrans = translations[field.id] || {};
  const sel = field as SelectField;
  const hasOptions = field.type === "select" || field.type === "radio";

  const getTranslation = (locale: string, property: string): string => {
    return (fieldTrans[locale] as any)?.[property] ?? "";
  };

  const setTranslation = (locale: string, property: string, value: string) => {
    setTranslations(field.id, locale, property, value);
  };

  const handleTranslateLocale = async (locale: string) => {
    setError(null);
    const result = await translateField(field, [locale]);
    if (result === null) {
      setError('Failed to translate. Please try again.');
      return;
    }
    if (result[locale]) {
      Object.keys(result[locale]).forEach(property => {
        setTranslation(locale, property, result[locale][property]);
      });
      clearCustomLocales([locale]);
    }
  };

  const handleTranslateAll = async () => {
    setError(null);
    const result = await translateField(field, supportedLocales);
    if (result != null) {
      // Apply all translations to store
      supportedLocales.forEach(locale => {
        if (result[locale]) {
          Object.keys(result[locale]).forEach(property => {
            setTranslation(locale, property, result[locale][property]);
          });
        }
      });
      // Remove all from custom locales since they're now auto-translated
      clearCustomLocales(supportedLocales);
    } else {
      setError('Failed to translate. Please try again.');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Translations</div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleTranslateAll}
          disabled={Object.values(translating).some(Boolean)}
          title="Generate translations for all locales for this field"
        >
          {Object.values(translating).some(Boolean) ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Translating...
            </>
          ) : (
            <>
              <Languages className="mr-1 h-3 w-3" />
              Translate All
            </>
          )}
        </Button>
      </div>

      {/* Auto-generated notice for price fields */}
      {field.type === 'price' && (
        <div className="text-xs text-muted-foreground bg-muted border rounded p-2">
          ℹ️ Payment method translations are automatically generated when new locales are added.
        </div>
      )}

      {error && (
        <div className="text-xs text-destructive">{error}</div>
      )}

      <Tabs defaultValue={supportedLocales[0] || "es"} className="w-full">
        <TabsList className="w-full justify-start bg-muted">
          {supportedLocales.map((locale) => (
            <TabsTrigger key={locale} value={locale} className="capitalize">
              {locale}
            </TabsTrigger>
          ))}
        </TabsList>

        {supportedLocales.map((locale) => (
          <TabsContent key={locale} value={locale} className="space-y-3">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium capitalize">{locale} Translation</div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleTranslateLocale(locale)}
                    disabled={translating[locale]}
                    title={`Generate ${locale} translation for this field`}
                  >
                    {translating[locale] ? (
                      <>
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        Translating...
                      </>
                    ) : (
                      <>
                        <Languages className="mr-1 h-3 w-3" />
                        Translate
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Label translation */}
                {field.type !== 'static' && (
                  <div className="space-y-1">
                    <Label className="text-xs">Label ({locale})</Label>
                    <Input
                      placeholder={`Enter ${locale} label`}
                      value={getTranslation(locale, "label")}
                      onChange={(e) => setTranslation(locale, "label", e.target.value)}
                      className="text-sm"
                    />
                  </div>
                )}

                {/* Placeholder translation (for text inputs) */}
                {(field.type === "text" ||
                  field.type === "email" ||
                  field.type === "url" ||
                  field.type === "tel" ||
                  field.type === "textarea" ||
                  field.type === "number") && (
                  <div className="space-y-1">
                    <Label className="text-xs">Placeholder ({locale})</Label>
                    <Input
                      placeholder={`Enter ${locale} placeholder`}
                      value={getTranslation(locale, "placeholder")}
                      onChange={(e) => setTranslation(locale, "placeholder", e.target.value)}
                      className="text-sm"
                    />
                  </div>
                )}

                {/* Content translation (for static text) */}
                {field.type === "static" && (
                  <div className="space-y-1">
                    <Label className="text-xs">Content ({locale})</Label>
                    <Input
                      placeholder={`Enter ${locale} content`}
                      value={getTranslation(locale, "content")}
                      onChange={(e) => setTranslation(locale, "content", e.target.value)}
                      className="text-sm"
                    />
                  </div>
                )}

                {/* Option translations (for select/radio) */}
                {hasOptions && sel.options && sel.options.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs">Options ({locale})</Label>
                    <div className="space-y-2">
                      {sel.options.map((option, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="text-xs text-muted-foreground">{option.label}</div>
                          <Input
                            placeholder={`Enter ${locale} translation for "${option.label}"`}
                            value={getTranslation(locale, `option_${idx}`)}
                            onChange={(e) => setTranslation(locale, `option_${idx}`, e.target.value)}
                            className="text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Payment method text translations */}
                {field.type === "price" && (
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">PayPal Required Title</Label>
                      <Input
                        placeholder="PayPal Payment Required"
                        value={getTranslation(locale, "paypal_required")}
                        onChange={(e) => setTranslation(locale, "paypal_required", e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">PayPal Description</Label>
                      <Textarea
                        placeholder="This form requires payment through PayPal..."
                        value={getTranslation(locale, "paypal_description")}
                        onChange={(e) => setTranslation(locale, "paypal_description", e.target.value)}
                        className="text-sm"
                        rows={2}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">PayPal Option</Label>
                      <Input
                        placeholder="Pay with PayPal"
                        value={getTranslation(locale, "paypal_option")}
                        onChange={(e) => setTranslation(locale, "paypal_option", e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">PayPal Hint</Label>
                      <Input
                        placeholder="(Secure online payment)"
                        value={getTranslation(locale, "paypal_hint")}
                        onChange={(e) => setTranslation(locale, "paypal_hint", e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">In-Person Required Title</Label>
                      <Input
                        placeholder="In-Person Payment Required"
                        value={getTranslation(locale, "inperson_required")}
                        onChange={(e) => setTranslation(locale, "inperson_required", e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">In-Person Description</Label>
                      <Textarea
                        placeholder="This payment will be collected in-person..."
                        value={getTranslation(locale, "inperson_description")}
                        onChange={(e) => setTranslation(locale, "inperson_description", e.target.value)}
                        className="text-sm"
                        rows={2}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">In-Person Option</Label>
                      <Input
                        placeholder="Pay In-Person"
                        value={getTranslation(locale, "inperson_option")}
                        onChange={(e) => setTranslation(locale, "inperson_option", e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">In-Person Hint</Label>
                      <Input
                        placeholder="(Pay at location)"
                        value={getTranslation(locale, "inperson_hint")}
                        onChange={(e) => setTranslation(locale, "inperson_hint", e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Choose Method Text</Label>
                      <Input
                        placeholder="Choose Payment Method:"
                        value={getTranslation(locale, "choose_method")}
                        onChange={(e) => setTranslation(locale, "choose_method", e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">No Methods Warning</Label>
                      <Input
                        placeholder="No payment methods configured"
                        value={getTranslation(locale, "no_methods")}
                        onChange={(e) => setTranslation(locale, "no_methods", e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
