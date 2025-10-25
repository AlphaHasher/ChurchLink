import { Palette } from "./Palette";
import { Canvas } from "./Canvas";
import { PreviewRendererClient } from "./PreviewRendererClient";
import { ErrorBoundary } from "./ErrorBoundary";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from '@/features/auth/hooks/auth-context';
import { useBuilderStore } from "./store";
import { FORM_WIDTH_VALUES, DEFAULT_FORM_WIDTH, normalizeFormWidth, collectAvailableLocales } from "./types";
import { getBoundsViolations } from "./validation";
import { Button } from "@/shared/components/ui/button";
import { EventMinistryDropdown } from "@/features/admin/components/Events/EventMinistryDropdown";
import { Calendar } from '@/shared/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { Calendar as CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { normalizeDateOnly } from '@/helpers/DateHelper'
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/Dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Save as SaveIcon, MoreHorizontal, Upload, Download, Trash, Maximize2, Minimize2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import api from '@/api/api';
import { useFormTranslator } from './useFormTranslator';
import { LocaleSelector } from './LocaleSelector';



export function BuilderShell() {
  const schema = useBuilderStore((s) => s.schema);
  const activeLocale = useBuilderStore((s) => s.activeLocale);
  const setActiveLocale = useBuilderStore((s) => s.setActiveLocale);
  const updateSchemaMeta = useBuilderStore((s) => s.updateSchemaMeta);
  const customLocales = useBuilderStore((s) => s.customLocales);
  const addCustomLocale = useBuilderStore((s) => s.addCustomLocale);
  const removeCustomLocale = useBuilderStore((s) => s.removeCustomLocale);
  const clearCustomLocales = useBuilderStore((s) => s.clearCustomLocales);
  const modifiedFields = useBuilderStore((s) => s.modifiedFields);
  const clearModifiedFields = useBuilderStore((s) => s.clearModifiedFields);
  const translations = useBuilderStore((s) => s.translations);
  const formWidth = normalizeFormWidth((schema as any)?.formWidth ?? (schema as any)?.form_width ?? DEFAULT_FORM_WIDTH);
  const availableLocales = useMemo(() => collectAvailableLocales(schema as any), [schema]);
  const setSchema = useBuilderStore((s) => s.setSchema);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const boundsViolations = useMemo(() => getBoundsViolations(schema as any), [schema]);
  const hasInvalidBounds = boundsViolations.length > 0;
  const firstViolation = boundsViolations[0];
  const invalidBoundsMessage = firstViolation
    ? `${firstViolation.fieldLabel || firstViolation.fieldName}: ${firstViolation.message}`
    : 'Resolve min/max conflicts before saving.';

  const [formName, setFormName] = useState((schema as any)?.title ?? "");
  const [description, setDescription] = useState((schema as any)?.description ?? "");
  const [ministries, setMinistries] = useState<string[]>((schema as any)?.ministries ?? []);
  const [expiresAt, setExpiresAt] = useState<string | null>((schema as any)?.expires_at ? (() => {
    try {
      const d = new Date((schema as any).expires_at);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch (e) { return null; }
  })() : null);
  const [availableMinistries, setAvailableMinistries] = useState<{ id: string; name: string }[]>([]);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info' | 'warning' | null; title?: string; message?: string } | null>(null);
  const [showNameConflictDialog, setShowNameConflictDialog] = useState(false);
  const [overrideTargetId, setOverrideTargetId] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [supportedLocales, setSupportedLocales] = useState<string[]>((schema as any)?.supported_locales ?? []);
  const lastSavedSnapshotRef = useRef<string>(JSON.stringify({ title: '', description: '', ministries: [], supported_locales: [], formWidth: DEFAULT_FORM_WIDTH, data: [] }));
  const { translateForm, loading: translating, error: translationError } = useFormTranslator();
  const loadTranslations = useBuilderStore((s) => s.loadTranslations);

  // Helper to extract translatable texts in same order as backend
  // onlyModified: if true, only extract from fields in modifiedFields set
  const extractTranslatableTexts = (formData: any[], onlyModified: boolean = false): { texts: string[], fieldMap: Array<{ fieldId: string, property: string, optionIdx?: number }> } => {
    const texts: string[] = [];
    const fieldMap: Array<{ fieldId: string, property: string, optionIdx?: number }> = [];
    
    for (const field of formData) {
      // Skip if onlyModified and this field isn't modified
      if (onlyModified && !modifiedFields.has(field.id)) {
        continue;
      }
      
      // Add label
      if (field.label) {
        texts.push(field.label);
        fieldMap.push({ fieldId: field.id, property: 'label' });
      }
      
      // Add placeholder
      if (field.placeholder) {
        texts.push(field.placeholder);
        fieldMap.push({ fieldId: field.id, property: 'placeholder' });
      }
      
      // Add helpText
      if (field.helpText) {
        texts.push(field.helpText);
        fieldMap.push({ fieldId: field.id, property: 'helpText' });
      }
      
      // Add option labels
      if (field.options) {
        field.options.forEach((option: any, idx: number) => {
          if (option.label) {
            texts.push(option.label);
            fieldMap.push({ fieldId: field.id, property: 'option', optionIdx: idx });
          }
        });
      }
      
      // Add content for static fields
      if (field.type === 'static' && field.content) {
        texts.push(field.content);
        fieldMap.push({ fieldId: field.id, property: 'content' });
      }
    }
    
    return { texts, fieldMap };
  };
  const widthOptions = FORM_WIDTH_VALUES.map((value) => ({ value, label: `${value}%` }));
  const handleFormWidthChange = (value: string) => {
    updateSchemaMeta({ formWidth: normalizeFormWidth(value) });
  };

  const getCurrentFormId = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('load');
  };

  useEffect(() => {
    if (status?.type === 'success') {
      const t = setTimeout(() => setStatus(null), 5000);
      return () => clearTimeout(t);
    }
  }, [status]);

  useEffect(() => {
    if (!previewExpanded) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [previewExpanded]);

  useEffect(() => {
    if (!previewExpanded) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewExpanded(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [previewExpanded]);

  const authCtx = useAuth();

  useEffect(() => {
    if (!authCtx.user) return;
    let mounted = true;
    const load = async () => {
      try {
        const resp = await api.get('/v1/ministries');
        if (!mounted) return;
        setAvailableMinistries(resp.data || []);
      } catch (err) {
        console.error('Failed to load ministries', err);
        setStatus({ type: 'error', title: 'Load failed', message: 'Could not load ministries' });
      }
    };
    load();
    return () => { mounted = false; };
  }, [authCtx.user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loadId = params.get('load');
    if (!loadId) return;
    let mounted = true;
    (async () => {
      try {
        setStatus({ type: 'info', title: 'Loading', message: 'Loading form...' });
        const resp = await api.get(`/v1/forms/${loadId}`);
        if (!mounted) return;
        const form = resp.data;
        if (form && form.data) {
          const dataArray = Array.isArray(form.data) ? form.data : (form.data?.data || []);
          const formWidthValue = normalizeFormWidth(form.formWidth ?? form.form_width ?? DEFAULT_FORM_WIDTH);
          setSchema({
            title: form.title || '',
            description: form.description || '',
            ministries: form.ministries || [],
            supported_locales: form.supported_locales || [],
            formWidth: formWidthValue,
            data: dataArray,
          } as any);
          setFormName(form.title || '');
          setDescription(form.description || '');
          setMinistries(form.ministries || []);
          setSupportedLocales(form.supported_locales || []);
          setExpiresAt(form.expires_at ? (() => {
            try {
              const d = new Date(form.expires_at);
              const pad = (n: number) => String(n).padStart(2, '0');
              return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
            } catch (e) { return null; }
          })() : null);
          setStatus(null);
          lastSavedSnapshotRef.current = JSON.stringify({ title: form.title || '', description: form.description || '', ministries: form.ministries || [], supported_locales: form.supported_locales || [], formWidth: formWidthValue, data: dataArray });
        }
      } catch (err) {
        console.error('Failed to load form', err);
        setStatus({ type: 'error', title: 'Failed to load form', message: 'Please try again.' });
      }
    })();
    return () => { mounted = false; };
  }, [setSchema]);

  // Handle New Form flow via ?new=1 param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const newFlag = params.get('new');
    if (!newFlag) return;
    const dataArray = (schema as any)?.data || [];
    const hasFields = Array.isArray(dataArray) && dataArray.length > 0;
    if (!hasFields) {
      // Nothing on canvas; no need to confirm
      resetToBlank();
      return;
    }
    const currentWidth = normalizeFormWidth((schema as any)?.formWidth ?? (schema as any)?.form_width ?? DEFAULT_FORM_WIDTH);
    const snapshot = JSON.stringify({ title: formName || '', description: description || '', ministries: ministries || [], supported_locales: supportedLocales, formWidth: currentWidth, data: dataArray });
    const isDirty = snapshot !== lastSavedSnapshotRef.current && snapshot !== JSON.stringify({ title: '', description: '', ministries: [], supported_locales: [], formWidth: DEFAULT_FORM_WIDTH, data: [] });
    if (isDirty) setShowDiscardDialog(true);
    else resetToBlank();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetToBlank = () => {
    const blank: any = { title: '', description: '', ministries: [], supported_locales: [], formWidth: DEFAULT_FORM_WIDTH, data: [] };
    setSchema(blank);
    setFormName('');
    setDescription('');
    setMinistries([]);
    setSupportedLocales([]);
    setExpiresAt(null);
    lastSavedSnapshotRef.current = JSON.stringify(blank);
  };

  // Track dirty state and expose it for manager page via localStorage
  useEffect(() => {
    const currentWidth = normalizeFormWidth((schema as any)?.formWidth ?? (schema as any)?.form_width ?? DEFAULT_FORM_WIDTH);
    const dataWithTranslations = ((schema as any)?.data || []).map((field: any) => {
      const fieldTranslations = translations[field.id];
      if (fieldTranslations && Object.keys(fieldTranslations).length > 0) {
        return { ...field, translations: fieldTranslations };
      }
      return field;
    });
    const snapshot = JSON.stringify({ title: formName || '', description: description || '', ministries: ministries || [], supported_locales: supportedLocales, formWidth: currentWidth, data: dataWithTranslations });
    const isDirtyNow = snapshot !== lastSavedSnapshotRef.current;
    try { localStorage.setItem('formBuilderDirty', isDirtyNow ? '1' : '0'); } catch { }
  }, [schema, formName, description, ministries, supportedLocales, translations]);

  const handleSave = async (): Promise<boolean> => {
    if (hasInvalidBounds) {
      setStatus({ type: 'error', title: 'Invalid field bounds', message: invalidBoundsMessage });
      return false;
    }
    // Persist name, ministries, description, and supported_locales into top-level schema so it stays with exported JSON
    const newSchema = { ...(schema || { data: [] }), title: formName, ministries, description, supported_locales: supportedLocales };
    setSchema(newSchema as any);

    if (!ministries || ministries.length === 0) {
      setStatus({ type: 'warning', title: 'Ministries required', message: 'Select at least one ministry before saving' });
      return false;
    }

    // Perform the actual save
    const currentFormId = getCurrentFormId();
    const normalizedWidth = normalizeFormWidth((schema as any)?.formWidth ?? (schema as any)?.form_width ?? DEFAULT_FORM_WIDTH);
    const cleanedData = ((schema as any)?.data || []);
    
    // Embed translations into each field for persistence
    const dataWithTranslations = cleanedData.map((field: any) => {
      const fieldTranslations = translations[field.id];
      if (fieldTranslations && Object.keys(fieldTranslations).length > 0) {
        return { ...field, translations: fieldTranslations };
      }
      return field;
    });

    try {
      setStatus({ type: 'info', title: 'Saving', message: 'Saving to server...' });
      const payload = {
        title: formName,
        description: description,
        ministries,
        supported_locales: supportedLocales,
        expires_at: expiresAt ? `${expiresAt}:00` : null,
        form_width: normalizedWidth,
        data: dataWithTranslations,
      };

      if (currentFormId) {
        // Update existing form
        await api.put(`/v1/forms/${currentFormId}`, { ...payload, visible: true });
        setStatus({ type: 'success', title: 'Updated', message: 'Form updated successfully' });
      } else {
        // Create new form - default to not visible
        await api.post('/v1/forms/', { ...payload, visible: false });
        setStatus({ type: 'success', title: 'Saved', message: 'Saved to server' });
      }

      const snapshotWidth = normalizeFormWidth((schema as any)?.formWidth ?? (schema as any)?.form_width ?? DEFAULT_FORM_WIDTH);
      lastSavedSnapshotRef.current = JSON.stringify({ title: formName, description, ministries, supported_locales: supportedLocales, formWidth: snapshotWidth, data: dataWithTranslations });
      return true;
    } catch (err: any) {
      console.error('Failed to save form to server', err);
      if (err?.response?.status === 409) {
        const payload = err.response?.data || err.response?.data?.detail || {};
        // If backend provided existing_id, prompt override
        const existingId = payload?.existing_id || payload?.existingId || (payload?.detail && payload.detail.existing_id) || null;
        setOverrideTargetId(existingId);
        setShowNameConflictDialog(true);
        setStatus(null);
      } else {
        setStatus({ type: 'error', title: 'Save failed', message: 'Failed to save to server' });
      }
      return false;
    }
  };

  const confirmOverride = async () => {
    if (!overrideTargetId) return;
    if (hasInvalidBounds) {
      setStatus({ type: 'error', title: 'Invalid field bounds', message: invalidBoundsMessage });
      return;
    }
    try {
      setStatus({ type: 'info', title: 'Overriding', message: 'Overriding existing form...' });
      const normalizedWidth = normalizeFormWidth((schema as any)?.formWidth ?? (schema as any)?.form_width ?? DEFAULT_FORM_WIDTH);
      const cleanedData = (((schema as any)?.data || []));
      
      // Embed translations into each field for persistence
      const dataWithTranslations = cleanedData.map((field: any) => {
        const fieldTranslations = translations[field.id];
        if (fieldTranslations && Object.keys(fieldTranslations).length > 0) {
          return { ...field, translations: fieldTranslations };
        }
        return field;
      });
      
      const updatePayload = {
        title: formName,
        description,
        ministries,
        supported_locales: supportedLocales,
        // Send local naive datetime string (no timezone conversion) so DB stores the selected local time
        expires_at: expiresAt ? `${expiresAt}:00` : null,
        visible: true,
        form_width: normalizedWidth,
        data: dataWithTranslations,
      };
      await api.put(`/v1/forms/${overrideTargetId}`, updatePayload);
      setStatus({ type: 'success', message: 'Form overridden' });
      const snapshotWidth = normalizeFormWidth((schema as any)?.formWidth ?? (schema as any)?.form_width ?? DEFAULT_FORM_WIDTH);
      lastSavedSnapshotRef.current = JSON.stringify({ title: formName, description, ministries, supported_locales: supportedLocales, formWidth: snapshotWidth, data: dataWithTranslations });
      // Refresh ministries list just in case
      const ministriesResp = await api.get('/v1/ministries');
      setAvailableMinistries(ministriesResp.data || []);
    } catch (err) {
      console.error('Failed to override form', err);
      setStatus({ type: 'error', title: 'Override failed', message: 'Could not override form' });
    } finally {
      setShowNameConflictDialog(false);
      setOverrideTargetId(null);
    }
  };

  const onExport = () => {
    const exportObj: any = {
      title: formName || (schema as any)?.title || 'Untitled Form',
      description: description || (schema as any)?.description || '',
      ministries: (schema as any)?.ministries || [],
      supported_locales: supportedLocales,
      formWidth: normalizeFormWidth((schema as any)?.formWidth ?? (schema as any)?.form_width ?? DEFAULT_FORM_WIDTH),
      data: ((schema as any)?.data || []),
    };
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${formName || (schema as any)?.title || 'form'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImportClick = () => fileInputRef.current?.click();
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        // Only support the canonical shape: top-level `data` array
        if (parsed && Array.isArray(parsed.data)) {
          setSchema({
            title: parsed.title || '',
            description: parsed.description || '',
            ministries: parsed.ministries || [],
            supported_locales: parsed.supported_locales || [],
            formWidth: normalizeFormWidth(parsed.formWidth ?? parsed.form_width ?? DEFAULT_FORM_WIDTH),
            data: parsed.data,
          });
          if (parsed.title) setFormName(parsed.title);
          if (parsed.description) setDescription(parsed.description);
          if (parsed.ministries) setMinistries(parsed.ministries);
          if (parsed.supported_locales) setSupportedLocales(parsed.supported_locales);
          setStatus({ type: 'success', title: 'Imported', message: 'Form imported' });
        } else {
          setStatus({ type: 'error', title: 'Invalid JSON', message: 'Expected top-level "data" array' });
        }
      } catch (err) {
        console.error('Failed to parse imported file', err);
        setStatus({ type: 'error', title: 'Parse failed', message: 'Failed to parse JSON file' });
      }
    };
    reader.readAsText(file);
    e.currentTarget.value = "";
  };

  const previewOverlay = previewExpanded
    ? createPortal(
        <div className="fixed inset-0 z-[100] bg-background">
          <div className="absolute right-4 top-4 z-[110] flex items-center gap-2">
            {/* Width and locale selectors in overlay so changes are visible live when maximized */}
            <Select value={formWidth} onValueChange={handleFormWidthChange}>
              <SelectTrigger className="h-8 w-[120px]" aria-label="Form width">
                <SelectValue placeholder="Width" />
              </SelectTrigger>
              <SelectContent align="end" className="z-[200]">
                {widthOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={activeLocale} onValueChange={(v) => setActiveLocale(v)}>
              <SelectTrigger className="h-8 w-[120px]" aria-label="Preview locale">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" className="z-[200]">
                {availableLocales.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="rounded-full shadow-lg"
              onClick={() => setPreviewExpanded(false)}
              aria-label="Collapse preview"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex h-full w-full flex-col overflow-auto p-6">
            <div className="mx-auto w-full max-w-6xl">
              <ErrorBoundary>
                <PreviewRendererClient applyFormWidth={true} />
              </ErrorBoundary>
            </div>
            <div className="mx-auto w-full max-w-6xl">
              <ErrorBoundary>
                <PreviewRendererClient instanceId="expanded" />
              </ErrorBoundary>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <ErrorBoundary>
      <div className="p-2">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xl font-semibold">{formName || 'Untitled Form'}</div>
          </div>
          <div className="flex items-center gap-2">
            {/* Status Alert to the left of Save button */}
            {status?.type && !saveDialogOpen && !showNameConflictDialog && !showDiscardDialog && !showClearConfirm && (
              <div className="hidden md:block max-w-md">
                <Alert
                  variant={status.type === 'error' ? 'destructive' : status.type === 'success' ? 'success' : status.type === 'info' ? 'info' : 'warning'}
                  className="inline-flex items-start px-3 py-2"
                >
                  <span className="text-sm line-clamp-2">{status.message ?? status.title}</span>
                </Alert>
              </div>
            )}
            <Button variant="outline" onClick={() => setShowClearConfirm(true)} title="Clear form (start fresh)">
              <Trash className="h-4 w-4 mr-2" /> Clear
            </Button>
            <Button onClick={() => setSaveDialogOpen(true)} title={hasInvalidBounds ? invalidBoundsMessage : undefined}>
              <SaveIcon className="h-4 w-4 mr-2" /> Save
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline"><MoreHorizontal className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Form</DropdownMenuLabel>
                <DropdownMenuItem onClick={onImportClick}><Upload className="h-4 w-4 mr-2" /> Import JSON</DropdownMenuItem>
                <DropdownMenuItem onClick={onExport}><Download className="h-4 w-4 mr-2" /> Export JSON</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setSaveDialogOpen(true)}
                  disabled={hasInvalidBounds}
                  title={hasInvalidBounds ? invalidBoundsMessage : undefined}
                >
                  <SaveIcon className="h-4 w-4 mr-2" /> Save As...
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {/* Locale Selector */}
        <div className="mb-3 p-3 border rounded bg-muted/50">
          <LocaleSelector
            supportedLocales={supportedLocales}
            customLocales={customLocales}
            onAddLocale={(locale) => {
              if (!supportedLocales.includes(locale)) {
                const newLocales = [...supportedLocales, locale];
                setSupportedLocales(newLocales);
                // Automatically track as custom (manually entered) locale
                addCustomLocale(locale);
                // Immediately update schema so Inspector shows translation tabs
                updateSchemaMeta({ supported_locales: newLocales });
              }
            }}
            onRemoveLocale={(locale) => {
              const newLocales = supportedLocales.filter((l) => l !== locale);
              setSupportedLocales(newLocales);
              // Remove from custom locales set if present
              removeCustomLocale(locale);
              // Update schema to reflect removed locale
              updateSchemaMeta({ supported_locales: newLocales });
            }}
            onRequestTranslations={async () => {
              const formId = getCurrentFormId();
              if (!formId) {
                setStatus({ type: 'error', title: 'Error', message: 'Form must be saved before requesting translations' });
                return;
              }
              
              // Filter out custom locales from bulk translation
              const localesToTranslate = supportedLocales.filter(locale => !customLocales.has(locale));
              
              if (localesToTranslate.length === 0) {
                setStatus({ type: 'info', title: 'No locales to translate', message: 'All locales are marked as custom. Use the Inspector to translate individual fields.' });
                return;
              }
              
              // Map the translation results to field IDs (onlyModified = true for requirement #3)
              const formData = (schema as any)?.data || [];
              const { texts, fieldMap } = extractTranslatableTexts(formData, true);
              
              // Check if there are any modified fields to translate
              if (texts.length === 0) {
                setStatus({ type: 'info', title: 'No changes to translate', message: 'No fields have been modified since last translation.' });
                return;
              }
              
              const result = await translateForm(formId, localesToTranslate);
              if (result) {
                // Update schema with supported locales so Inspector can display translations
                updateSchemaMeta({ supported_locales: supportedLocales });
                
                const translationsMap: { [fieldId: string]: { [locale: string]: any } } = {};
                const translatedFieldIds = new Set<string>();
                
                // result.translations is { "0": { "es": "...", "ru": "..." }, "1": { ... } }
                Object.keys(result).forEach((indexStr) => {
                  const index = parseInt(indexStr, 10);
                  const mapping = fieldMap[index];
                  if (!mapping) return;
                  
                  const { fieldId, property, optionIdx } = mapping;
                  translatedFieldIds.add(fieldId);
                  
                  if (!translationsMap[fieldId]) {
                    translationsMap[fieldId] = {};
                  }
                  
                  // For each locale in the translation result
                  const translations = result[indexStr];
                  Object.keys(translations).forEach((locale) => {
                    if (!translationsMap[fieldId][locale]) {
                      translationsMap[fieldId][locale] = {};
                    }
                    
                    if (property === 'option' && optionIdx !== undefined) {
                      translationsMap[fieldId][locale][`option_${optionIdx}`] = translations[locale];
                    } else {
                      translationsMap[fieldId][locale][property] = translations[locale];
                    }
                  });
                });
                
                // Load translations into the store
                loadTranslations(translationsMap);
                
                // Clear modified fields that were just translated
                clearModifiedFields(Array.from(translatedFieldIds));
                
                // Remove translated locales from customLocales (they're now auto-translated)
                clearCustomLocales(localesToTranslate);
                
                setStatus({ type: 'success', title: 'Success', message: `Translations generated for ${localesToTranslate.join(', ')}. You can now modify them in the inspector.` });
              } else {
                setStatus({ type: 'error', title: 'Error', message: translationError || 'Failed to generate translations' });
              }
            }}
            isTranslating={translating}
            translationError={translationError}
          />
        </div>

        {/* Fallback status below header for smaller screens (hidden when dialog open) */}
        {status?.type && !saveDialogOpen && !showNameConflictDialog && !showDiscardDialog && !showClearConfirm && (
          <div className="md:hidden mb-2">
            <Alert
              variant={status.type === 'error' ? 'destructive' : status.type === 'success' ? 'success' : status.type === 'info' ? 'info' : 'warning'}
              className="inline-flex items-start px-3 py-2"
            >
              <span className="text-sm line-clamp-2">{status.message ?? status.title}</span>
            </Alert>
          </div>
        )}
        <input ref={fileInputRef} onChange={onFileChange} type="file" accept="application/json" className="hidden" />
      </div>
      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save form</DialogTitle>
          </DialogHeader>
          {status?.type && (
            <Alert
              variant={status.type === 'error' ? 'destructive' : status.type === 'success' ? 'success' : status.type === 'info' ? 'info' : 'warning'}
              className="h-10 inline-flex items-center px-3 py-1"
            >
              <span className="text-sm truncate">{status.message ?? status.title}</span>
            </Alert>
          )}
          {hasInvalidBounds && (
            <Alert variant="warning">
              <AlertTitle>Resolve field bounds</AlertTitle>
              <AlertDescription>
                <p className="mb-1">Fix the min/max conflicts below before saving:</p>
                <ul className="list-disc pl-5 space-y-1">
                  {boundsViolations.map((issue) => (
                    <li key={issue.fieldId}>
                      <span className="font-medium">{issue.fieldLabel || issue.fieldName}</span>: {issue.message}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          <div className="space-y-3">
            <Input placeholder="Name" value={formName} onChange={(e) => setFormName(e.target.value)} />
            <Input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
            {availableMinistries && availableMinistries.length > 0 ? (
              <EventMinistryDropdown
                selected={ministries}
                onChange={setMinistries}
                ministries={availableMinistries.map(m => m.name)}
              />
            ) : (
              <div className="space-y-2">
                <div className="text-sm font-medium">Ministries</div>
                <div className="text-sm text-muted-foreground">No ministries available. Create ministries from Admin &gt; Ministries first.</div>
              </div>
            )}
            <div>
              <div className="text-sm font-medium">Expiration (optional)</div>
              <div className="mt-1 flex gap-2 items-center">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start w-[150px] text-left">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {expiresAt ? (
                        (() => {
                          try {
                            const d = new Date(expiresAt);
                            return format(d, 'MMM do, yyyy');
                          } catch (e) { return <span className="text-sm text-muted-foreground">Pick a date</span>; }
                        })()
                      ) : <span className="text-sm text-muted-foreground">Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2">
                    <Calendar
                      mode="single"
                      selected={expiresAt ? normalizeDateOnly(expiresAt.split('T')[0]) : undefined}
                      onSelect={(d) => {
                        if (!d) return;
                        const pad = (n: number) => String(n).padStart(2, '0');
                        const year = d.getFullYear();
                        const month = d.getMonth() + 1;
                        const day = d.getDate();
                        const timePart = expiresAt ? (expiresAt.split('T')[1] ?? '00:00') : '00:00';
                        setExpiresAt(`${year}-${pad(month)}-${pad(day)}T${timePart}`);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <input
                  type="time"
                  value={expiresAt ? (expiresAt.split('T')[1] ?? '') : ''}
                  onChange={(e) => {
                    const t = e.target.value; // 'HH:MM'
                    if (!t) {
                      setExpiresAt(null);
                      return;
                    }
                    if (expiresAt) {
                      setExpiresAt(`${expiresAt.split('T')[0]}T${t}`);
                    } else {
                      const d = new Date();
                      const pad = (n: number) => String(n).padStart(2, '0');
                      setExpiresAt(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${t}`);
                    }
                  }}
                  className="rounded-md border px-2 py-1"
                />
                <Button variant="ghost" onClick={() => setExpiresAt(null)}>Clear</Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={hasInvalidBounds}
              onClick={async () => {
                const saved = await handleSave();
                if (saved) setSaveDialogOpen(false);
              }}
              title={hasInvalidBounds ? invalidBoundsMessage : undefined}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Override confirmation dialog (name conflict) */}
      <AlertDialog open={showNameConflictDialog} onOpenChange={(open) => { if (!open) { setShowNameConflictDialog(false); setOverrideTargetId(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Name conflict</AlertDialogTitle>
            <AlertDialogDescription>
              You already have a form named "{formName}". Do you want to override it?
            </AlertDialogDescription>
          </AlertDialogHeader>
          {status?.type && (
            <Alert
              variant={status.type === 'error' ? 'destructive' : status.type === 'success' ? 'success' : status.type === 'info' ? 'info' : 'warning'}
              className="h-10 inline-flex items-center px-3 py-1"
            >
              <span className="text-sm truncate">{status.message ?? status.title}</span>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowNameConflictDialog(false); setOverrideTargetId(null); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmOverride} className="bg-red-600 hover:bg-red-700">Override</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Discard new form changes confirmation */}
      <AlertDialog open={showDiscardDialog} onOpenChange={(open) => { if (!open) setShowDiscardDialog(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard current changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Do you want to discard them and start a new blank form?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDiscardDialog(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { resetToBlank(); setShowDiscardDialog(false); }} className="bg-red-600 hover:bg-red-700">Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Clear canvas confirmation */}
      <AlertDialog open={showClearConfirm} onOpenChange={(open) => { if (!open) setShowClearConfirm(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear form builder?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all fields and reset the form metadata. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowClearConfirm(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { resetToBlank(); setShowClearConfirm(false); }} className="bg-red-600 hover:bg-red-700">Clear</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="grid grid-cols-12 gap-4 p-4">
        <div className="col-span-12 md:col-span-2">
          <ErrorBoundary>
            <Palette />
          </ErrorBoundary>
        </div>
        <div className="col-span-12 md:col-span-6">
          <ErrorBoundary>
            <Canvas />
          </ErrorBoundary>
        </div>
        <div className="col-span-12 md:col-span-4">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Live Preview</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    onClick={() => { if (!hasInvalidBounds) setPreviewExpanded(true); }}
                    aria-label="Expand preview"
                    disabled={hasInvalidBounds}
                    title={hasInvalidBounds ? 'Fix min/max conflicts to enable expanded preview' : undefined}
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                  <Select value={formWidth} onValueChange={handleFormWidthChange}>
                    <SelectTrigger className="h-8 w-[120px]" aria-label="Form width">
                      <SelectValue placeholder="Width" />
                    </SelectTrigger>
                    <SelectContent align="end">
                      {widthOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={activeLocale} onValueChange={(v) => setActiveLocale(v)}>
                    <SelectTrigger className="h-8 w-[120px]" aria-label="Preview locale">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="end">
                      {availableLocales.map((l) => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ErrorBoundary>
                {hasInvalidBounds ? (
                  <Alert variant="warning">
                    <AlertTitle>Preview unavailable</AlertTitle>
                    <AlertDescription>
                      <p className="mb-2">Resolve the min/max conflicts below to restore the live preview:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        {boundsViolations.map((issue) => (
                          <li key={issue.fieldId}>
                            <span className="font-medium">{issue.fieldLabel || issue.fieldName}</span>: {issue.message}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 text-xs text-muted-foreground">The rest of the builder remains active so you can adjust values.</p>
                    </AlertDescription>
                  </Alert>
                ) : status?.message && typeof status.message === 'string' && status.message.toLowerCase().includes('load') ? (
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-8 w-full mt-2" />
                  </div>
                ) : (
                  <PreviewRendererClient instanceId="card" />
                )}
              </ErrorBoundary>
            </CardContent>
          </Card>
        </div>
      </div>
      {previewOverlay}
    </ErrorBoundary>
  );
}
