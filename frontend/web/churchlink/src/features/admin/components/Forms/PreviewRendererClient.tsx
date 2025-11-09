import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { schemaToZodObject } from "./schemaGen";
import { evaluateVisibility } from "./visibilityUtils";
import { FieldRenderer } from "./FieldRenderer";
import { useBuilderStore } from "./store";
import { Button } from "@/shared/components/ui/button";
import type { AnyField, DateField, SelectField } from "./types";
import { format } from "date-fns";
import api from '@/api/api';
import { useState, useEffect, useMemo } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { MailCheck, CreditCard } from 'lucide-react';
import { formWidthToClass } from "./types";
import { cn } from "@/lib/utils";
import { formPaymentApi } from "@/features/forms/api/formPaymentApi";
import { getBoundsViolations, getOptionViolations } from "./validation";
import PreviewUnavailableAlert from './PreviewUnavailableAlert';


export function PreviewRendererClient({ slug, instanceId, applyFormWidth = true }: { slug?: string, instanceId?: string, applyFormWidth?: boolean }) {
  const schema = useBuilderStore((s) => s.schema);
  const boundsViolations = useMemo(() => getBoundsViolations(schema), [schema]);
  const optionViolations = useMemo(() => !slug ? getOptionViolations(schema) : [], [schema, slug]);
  const zodSchema = schemaToZodObject(schema); // always create schema
  const form = useForm({ resolver: zodResolver(zodSchema), defaultValues: {} }); // always init form hook
  const formWidthClass = applyFormWidth ? formWidthToClass((schema as any)?.formWidth) : undefined;
  const values = form.watch();

  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<'paypal' | 'in-person' | null>(null);

  // Create a unique instance identifier for duplicate prevention
  const formInstanceId = useMemo(() => instanceId || `form_${Date.now()}_${Math.random()}`, [instanceId]);

  // Check if form requires payment when slug is available
  useEffect(() => {
    if (slug) {
      checkPaymentRequirement();

      // Try to restore form data from localStorage on page load
      const savedFormDataKey = `form_data_${slug}`;
      const savedFormData = localStorage.getItem(savedFormDataKey);

      if (savedFormData) {
        try {
          const parsedData = JSON.parse(savedFormData);
          // Remove timestamp from form data  
          const { _timestamp, ...formResponseData } = parsedData;
          console.log('Restoring form data on page load:', formResponseData);
          form.reset(formResponseData);
        } catch (e) {
          console.error('Failed to restore form data on page load:', e);
          localStorage.removeItem(savedFormDataKey);
        }
      }

      // Clean up old form data entries (older than 1 hour)
      try {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('form_data_')) {
            const item = localStorage.getItem(key);
            if (item) {
              try {
                const data = JSON.parse(item);
                if (data._timestamp && data._timestamp < oneHourAgo) {
                  localStorage.removeItem(key);
                  console.log('Cleaned up old form data:', key);
                }
              } catch (e) {
                // Remove malformed entries
                localStorage.removeItem(key);
              }
            }
          }
        }
      } catch (e) {
        console.error('Error cleaning up localStorage:', e);
      }
    }
  }, [slug, form]);

  const checkPaymentRequirement = async () => {
    if (!slug) return;

    try {
      // Check if form requires payment by trying to get payment config
      const response = await api.get(`/v1/forms/slug/${slug}/payment-config`);
      if (response.data && response.data.requires_payment) {
        setPaymentConfig(response.data);
      }
    } catch (err) {
      // If payment config endpoint doesn't exist or fails, form doesn't require payment
      console.log('Payment not required for this form');
    }
  };

  // Backend PayPal integration functions
  const initiatePayPalPayment = async () => {
    try {
      const formTotal = computeTotal();

      // Check if the form actually has price fields that would require payment
      const priceFields = schema.data.filter(field => field.type === 'price');
      if (priceFields.length === 0) {
        console.error('This form does not have any payment fields configured.');
        alert('This form does not have any payment fields configured.');
        return;
      }

      if (formTotal <= 0) {
        console.error('Payment amount must be greater than zero.');
        alert('Payment amount must be greater than zero.');
        return;
      }

      // Save form data to localStorage before PayPal redirect
      const formData = form.getValues();
      const formDataWithTimestamp = {
        ...formData,
        _timestamp: Date.now()
      };
      localStorage.setItem(`form_data_${slug}`, JSON.stringify(formDataWithTimestamp));
      console.log('Saved form data to localStorage:', formData);

      // Include additional payment context for the backend
      const paymentData = {
        payment_amount: formTotal,
        form_response: formData, // Use current form data
        payment_method: 'paypal',
        requires_payment: true,
        // Include schema information to help backend understand pricing
        form_schema: priceFields.map(field => ({
          id: field.id,
          name: field.name,
          type: field.type,
          amount: (field as any).amount,
          paymentMethods: (field as any).paymentMethods
        }))
      };

      console.log('Sending payment data to backend:', paymentData);

      const response = await formPaymentApi.createFormPaymentOrder(slug!, paymentData);

      if (response.success && response.approval_url) {
        // Redirect to PayPal for payment
        window.location.href = response.approval_url;
      } else {
        throw new Error(response.error || 'Failed to create PayPal payment');
      }
    } catch (error: any) {
      console.error('PayPal payment initiation failed:', error);
      setSubmitState('error');
      setSubmitMessage(`PayPal payment failed: ${error.message || 'Unknown error'}`);
    }
  };

  // Handle PayPal return from payment - redirect to success page
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token'); // PayPal Orders API v2 returns 'token' (order ID)
    const payerId = urlParams.get('PayerID');

    console.log('PayPal return URL params:', {
      token,
      payerId,
      fullUrl: window.location.href,
      search: window.location.search,
      allParams: Object.fromEntries(urlParams.entries())
    });

    // If we have PayPal return parameters, we should be on the success page
    // The backend redirects to /forms/:slug/payment/success, but sometimes 
    // the redirect might not work, so we'll ensure we go to the correct page
    if (token && payerId && slug) {
      const currentPath = window.location.pathname;
      const expectedSuccessPath = `/forms/${slug}/payment/success`;

      if (currentPath !== expectedSuccessPath) {
        console.log('PayPal return detected, redirecting to success page:', {
          currentPath,
          expectedSuccessPath,
          token,
          payerId
        });

        // Preserve the PayPal return parameters in the redirect
        const successUrl = `${expectedSuccessPath}${window.location.search}`;
        window.location.replace(successUrl);
        return;
      }
    }
  }, [slug]);

  // Get available payment methods from price fields
  const getAvailablePaymentMethods = () => {
    const methods = { allowPayPal: false, allowInPerson: false };
    let foundPriceFields = false;

    // Check price fields for payment method configurations
    for (const f of schema.data as AnyField[]) {
      if (f.type === "price" && evaluateVisibility((f as any).visibleIf, values)) {
        foundPriceFields = true;
        const priceField = f as any;

        // Check for PayPal (treat undefined as enabled for backward compatibility)
        if (priceField.paymentMethods?.allowPayPal !== false) {
          methods.allowPayPal = true;
        }

        // Check for in-person
        if (priceField.paymentMethods?.allowInPerson) {
          methods.allowInPerson = true;
        }
      }
    }

    // If we found price fields but no specific methods configured
    if (foundPriceFields && !methods.allowPayPal && !methods.allowInPerson) {
      // For Form Builder preview (no slug), default to PayPal only to showcase UI
      // For public forms, default to both for backward compatibility
      if (!slug) {
        methods.allowPayPal = true;
      } else {
        methods.allowPayPal = true;
        methods.allowInPerson = true;
      }
    }

    return methods;
  };
  const [pageError, setPageError] = useState<string | null>(null);

  if (!slug && boundsViolations.length > 0) {
    return (
      <div className={cn("mx-auto w-full", formWidthClass)}>
        <PreviewUnavailableAlert message="Fix the following min/max conflicts to resume the live builder preview:">
          {boundsViolations.map((issue) => (
            <li key={issue.fieldId}>
              <span className="font-medium">{issue.fieldLabel || issue.fieldName}</span>: {issue.message}
            </li>
          ))}
        </PreviewUnavailableAlert>
      </div>
    );
  }

  if (!slug && optionViolations.length > 0) {
    return (
      <div className={cn("mx-auto w-full", formWidthClass)}>
        <PreviewUnavailableAlert message="Fix the following option issues to resume the live builder preview:">
          {optionViolations.map((issue) => (
            <li key={issue.fieldId}>
              <span className="font-medium">{issue.fieldLabel}</span>: 
              {issue.hasEmptyLabels && issue.hasEmptyValues 
                ? ' One or more options have empty labels and values'
                : issue.hasEmptyLabels 
                ? ' One or more options have empty labels'
                : ' One or more options have empty values'}
            </li>
          ))}
        </PreviewUnavailableAlert>
      </div>
    );
  }

  const onSubmit = form.handleSubmit(async (data: any) => {
    // Prevent duplicate submissions from multiple form instances, with timestamp-based expiration
    const globalSubmitKey = `form_submitting_${slug || 'preview'}`;
    const LOCK_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
    const lockRaw = sessionStorage.getItem(globalSubmitKey);
    if (lockRaw) {
      try {
        const lock = JSON.parse(lockRaw);
        if (lock.submitting && typeof lock.setAt === 'number') {
          if (Date.now() - lock.setAt < LOCK_EXPIRY_MS) {
            console.log(`[${formInstanceId}] Submission already in progress, skipping...`);
            return;
          } else {
            // Lock expired, clean up
            sessionStorage.removeItem(globalSubmitKey);
          }
        } else {
          // Malformed lock, clean up
          sessionStorage.removeItem(globalSubmitKey);
        }
      } catch {
        // Malformed lock, clean up
        sessionStorage.removeItem(globalSubmitKey);
      }
    }

    console.log(`[${formInstanceId}] Starting form submission...`);
    sessionStorage.setItem(globalSubmitKey, JSON.stringify({ submitting: true, setAt: Date.now() }));
    console.log("Preview submit", data);

    // If a slug prop is provided, submit to public endpoint
    if (slug) {
      try {
        setSubmitState('submitting');
        setSubmitMessage('Submitting...');

        // Check if form has pricing and requires payment
        const formTotal = computeTotal();
        const hasPaymentRequired = paymentConfig?.requires_payment || formTotal > 0;

        if (hasPaymentRequired) {
          const availableMethods = getAvailablePaymentMethods();
          const paypalOnly = availableMethods.allowPayPal && !availableMethods.allowInPerson;
          const inPersonOnly = !availableMethods.allowPayPal && availableMethods.allowInPerson;
          const bothEnabled = availableMethods.allowPayPal && availableMethods.allowInPerson;

          // Auto-determine payment method based on configuration
          let selectedPaymentMethod = paymentMethod;

          // Scenario 1: PayPal Only - auto-select PayPal
          if (paypalOnly) {
            selectedPaymentMethod = 'paypal';
          }
          // Scenario 2: In-Person Only - auto-select in-person
          else if (inPersonOnly) {
            selectedPaymentMethod = 'in-person';
          }
          // Scenario 3: Both enabled - use user selection or default to PayPal
          else if (bothEnabled) {
            if (!selectedPaymentMethod) {
              // Check form data for payment method selection
              const formPaymentMethod = Object.keys(data).find(key =>
                key.includes('_payment_method')
              );
              if (formPaymentMethod) {
                selectedPaymentMethod = data[formPaymentMethod] as 'paypal' | 'in-person';
                setPaymentMethod(selectedPaymentMethod);
              } else {
                selectedPaymentMethod = 'paypal'; // default
                setPaymentMethod(selectedPaymentMethod);
              }
            }
          }

          // Handle PayPal payment flow
          if (selectedPaymentMethod === 'paypal') {
            // Initiate PayPal payment via backend
            setSubmitState('submitting');
            setSubmitMessage('Redirecting to PayPal...');

            try {
              await initiatePayPalPayment();
              // Don't remove lock here - PayPal will redirect and come back
            } catch (error) {
              // Error handling is done in initiatePayPalPayment function
              // Remove lock on PayPal error
              sessionStorage.removeItem(globalSubmitKey);
            }

            return;
          }

          // If in-person payment selected, submit normally with note
          if (selectedPaymentMethod === 'in-person') {
            await api.post(`/v1/forms/slug/${slug}/responses`, {
              ...data,
              payment_method: 'in-person',
              payment_amount: formTotal,
              payment_status: 'pending'
            });
            setSubmitState('success');
            setSubmitMessage('Thanks for your response! Please complete payment in-person as arranged.');
            form.reset();
            sessionStorage.removeItem(globalSubmitKey);
            return;
          }
        }

        // Regular form submission (no payment required)
        await api.post(`/v1/forms/slug/${slug}/responses`, data);
        setSubmitState('success');
        setSubmitMessage('Thanks for your response! We have received it.');
        form.reset();
      } catch (err: any) {
        console.error('Submit failed', err);
        const detail = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Submit failed';
        const detailStr = typeof detail === 'string' ? detail.toLowerCase() : '';
        // Map server reasons to full-page friendly error messages
        if (detailStr.includes('expired')) {
          setPageError('This form has expired and is no longer accepting responses.');
          setSubmitState('error');
          return;
        }
        if (detailStr.includes('not available') || detailStr.includes('not visible')) {
          setPageError('This form is not available for public viewing.');
          setSubmitState('error');
          return;
        }
        if (detailStr.includes('not found')) {
          setPageError('Form not found.');
          setSubmitState('error');
          return;
        }
        setSubmitState('error');
        setSubmitMessage(typeof detail === 'string' ? detail : 'Submit failed');
      } finally {
        // Always clean up the submission lock
        sessionStorage.removeItem(globalSubmitKey);
        console.log(`[${formInstanceId}] Submission completed, lock removed`);
      }
      return;
    }

    setSubmitState('success');
    setSubmitMessage('Preview submission captured.');
    // Clean up lock for preview submissions too
    sessionStorage.removeItem(globalSubmitKey);
  });

  const computeTotal = (): number => {
    let total = 0;
    for (const f of schema.data as AnyField[]) {
      if (!evaluateVisibility((f as any).visibleIf, values)) continue;
      const val = (values as any)?.[f.name];
      if (f.type === "price") {
        const amt = (f as any).amount;
        if (typeof amt === "number" && !Number.isNaN(amt)) total += amt;
        continue;
      }
      if (f.type === "checkbox" || f.type === "switch") {
        if (val && (f as any).price) total += Number((f as any).price) || 0;
      } else if (f.type === "radio") {
        const sf = f as SelectField;
        const opt = (sf.options || []).find((o) => o.value === val);
        if (opt?.price) total += Number(opt.price) || 0;
      } else if (f.type === "select") {
        const sf = f as SelectField;
        if (sf.multiple && Array.isArray(val)) {
          for (const v of val) {
            const opt = (sf.options || []).find((o) => o.value === v);
            if (opt?.price) total += Number(opt.price) || 0;
          }
        } else if (typeof val === "string") {
          const opt = (sf.options || []).find((o) => o.value === val);
          if (opt?.price) total += Number(opt.price) || 0;
        }
      } else if (f.type === "date") {
        const df = f as DateField;
        const cfg = df.pricing;
        if (!cfg?.enabled) continue;
        const weekdayPrice = (d: Date): number => {
          const dow = d.getDay();
          const override = cfg.weekdayOverrides?.[dow as 0 | 1 | 2 | 3 | 4 | 5 | 6];
          const specific = cfg.specificDates?.find((x) => x.date === format(d, "yyyy-MM-dd"))?.price;
          if (specific != null) return specific;
          if (override != null) return override;
          return cfg.basePerDay || 0;
        };
        if (df.mode === "range") {
          const r = val as { from?: Date; to?: Date } | undefined;
          if (r?.from && r.to) {
            const start = new Date(r.from);
            const end = new Date(r.to);
            // include both endpoints
            for (let d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
              total += weekdayPrice(d);
            }
          } else if (r?.from) {
            total += weekdayPrice(new Date(r.from));
          }
        } else {
          const d = val as Date | undefined;
          if (d) total += weekdayPrice(new Date(d));
        }
      }
    }
    return total;
  };
  const total = computeTotal();

  const hasPricing = (): boolean => {
    for (const f of schema.data as AnyField[]) {
      if (f.type === "price") {
        return true;
      } else if (f.type === "checkbox" || f.type === "switch") {
        if ((f as any).price != null) return true;
      } else if (f.type === "radio" || f.type === "select") {
        if ((f as any).options?.some((o: any) => o.price != null)) return true;
      } else if (f.type === "date") {
        const df = f as DateField;
        if (df.pricing?.enabled) return true;
      }
    }
    return false;
  };
  const showPricingBar = hasPricing();

  if (slug && submitState === 'success' && submitMessage) {
    return (
      <div className={cn("mx-auto w-full", formWidthClass)}>
        <div className="rounded-md border border-border bg-muted/30 p-8 text-center flex flex-col items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MailCheck className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="text-xl font-semibold">Thank you!</h2>
          <p className="text-muted-foreground max-w-md">
            {submitMessage}
          </p>
        </div>
      </div>
    );
  }

  // If a page-level error occurred (expired / not available / not found) show the friendly error card
  if (pageError) {
    return (
      <div className={cn("mx-auto w-full", formWidthClass)}>
        <div className="rounded-md border border-border bg-muted/30 p-8 text-center flex flex-col items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12A9 9 0 1112 3a9 9 0 019 9z" />
            </svg>
          </span>
          <h2 className="text-xl font-semibold">Form unavailable</h2>
          <p className="text-destructive max-w-md">{pageError}</p>
        </div>
      </div>
    );
  }

  const isSubmitting = submitState === 'submitting' || form.formState.isSubmitting;

  return (
    <div className={cn("mx-auto w-full", formWidthClass)}>
      <form onSubmit={onSubmit} className="grid grid-cols-12 gap-4">
        {schema.data.filter((f) => evaluateVisibility(f.visibleIf, values)).map((f) => (
          <FieldRenderer
            key={f.id}
            field={f}
            control={form.control}
            error={(form.formState.errors as any)?.[f.name]?.message as string | undefined}
          />
        ))}

        {/* Payment section - show if form has pricing */}
        {slug && (showPricingBar || paymentConfig?.requires_payment) && (
          <div className="col-span-12 space-y-4">
            <Alert className="border-blue-200 bg-blue-50">
              <CreditCard className="h-4 w-4" />
              <AlertTitle>Payment Required</AlertTitle>
              <AlertDescription>
                <div className="space-y-3">
                  {showPricingBar && (
                    <div className="text-lg font-semibold">
                      Total: ${computeTotal().toFixed(2)}
                    </div>
                  )}

                  {paymentConfig?.payment_description && (
                    <div className="text-sm">{paymentConfig.payment_description}</div>
                  )}

                  {/* Payment methods are now handled by price fields directly */}
                  <div className="text-sm text-muted-foreground">
                    Choose your payment method in the form above.
                  </div>

                  {/* Payment status messages */}
                  {submitMessage && submitState !== 'success' && (
                    <div className={`text-sm mt-2 ${submitState === 'error' ? 'text-red-600' : 'text-blue-600'}`}>
                      {submitMessage}
                    </div>
                  )}

                </div>
              </AlertDescription>
            </Alert>
          </div>
        )}

        <div className="col-span-12">
          {(() => {
            const availableMethods = getAvailablePaymentMethods();
            const paypalOnly = availableMethods.allowPayPal && !availableMethods.allowInPerson;
            const inPersonOnly = !availableMethods.allowPayPal && availableMethods.allowInPerson;
            const bothEnabled = availableMethods.allowPayPal && availableMethods.allowInPerson;
            const hasPayment = total > 0;

            // Check if form has price fields (for Form Builder preview experience)
            const hasPriceFields = schema.data.some(field => field.type === 'price');

            // For forms with payment (both preview and public forms)
            // Show PayPal UI if has payment OR if has price fields (for Form Builder preview)
            if (hasPayment || (!slug && hasPriceFields)) {
              // Scenario 1: PayPal Only
              if (paypalOnly) {
                return (
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-white rounded flex items-center justify-center">
                        <span className="text-blue-600 text-xs font-bold">P</span>
                      </div>
                      {isSubmitting ? 'Processing...' : 'Pay with PayPal & Submit'}
                    </span>
                  </Button>
                );
              }

              // Scenario 2: In-Person Only
              if (inPersonOnly) {
                return (
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                  >
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-white rounded flex items-center justify-center">
                        <span className="text-green-600 text-xs">💵</span>
                      </div>
                      {isSubmitting ? 'Submitting...' : 'Submit Form (Pay In-Person Later)'}
                    </span>
                  </Button>
                );
              }

              // Scenario 3: Both Enabled - Dynamic button based on selection
              if (bothEnabled) {
                // Find the payment method field and get its current value
                const paymentMethodField = Object.keys(values).find(key =>
                  key.includes('_payment_method')
                );
                const currentMethod = paymentMethodField ?
                  values[paymentMethodField] as 'paypal' | 'in-person' : 'paypal';

                if (currentMethod === 'paypal') {
                  return (
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-white rounded flex items-center justify-center">
                          <span className="text-blue-600 text-xs font-bold">P</span>
                        </div>
                        {isSubmitting ? 'Processing...' : 'Pay with PayPal & Submit'}
                      </span>
                    </Button>
                  );
                } else {
                  return (
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                    >
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-white rounded flex items-center justify-center">
                          <span className="text-green-600 text-xs">💵</span>
                        </div>
                        {isSubmitting ? 'Submitting...' : 'Submit Form (Pay In-Person Later)'}
                      </span>
                    </Button>
                  );
                }
              }
            }

            // Default submit button for non-payment forms or admin preview
            return (
              <Button
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </Button>
            );
          })()}

          {submitMessage && submitState !== 'success' && (
            <div
              className={`text-sm mt-2 ${submitState === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}
            >
              {submitMessage}
            </div>
          )}
        </div>
        {showPricingBar && (
          <div className="col-span-12">
            <div className="mt-2 border-t pt-2 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Pricing summary</div>
              <div className="text-base">
                <span className="font-medium">Estimated Total: </span>${total.toFixed(2)}
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
