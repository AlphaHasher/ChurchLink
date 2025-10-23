import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { schemaToZodObject } from "./schemaGen";
import { FieldRenderer } from "./FieldRenderer";
import { useBuilderStore } from "./store";
import { Button } from "@/shared/components/ui/button";
import type { AnyField, DateField, SelectField } from "./types";
import { format } from "date-fns";
import api from '@/api/api';
import { useState, useEffect, useMemo } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { MailCheck } from 'lucide-react';
import { formWidthToClass } from "./types";
import { cn } from "@/lib/utils";
import { formPaymentApi } from "@/features/forms/api/formPaymentApi";
import { getBoundsViolations } from "./validation";
import { useAuth } from "@/features/auth/hooks/auth-context";


export function PreviewRendererClient({ slug, applyFormWidth = true }: { slug?: string, instanceId?: string, applyFormWidth?: boolean }) {
  const schema = useBuilderStore((s) => s.schema);
  const boundsViolations = useMemo(() => getBoundsViolations(schema), [schema]);
  const zodSchema = schemaToZodObject(schema); // always create schema
  const form = useForm({ resolver: zodResolver(zodSchema), defaultValues: {} }); // always init form hook
  const formWidthClass = applyFormWidth ? formWidthToClass((schema as any)?.formWidth) : undefined;
  const values = form.watch();
  const { user, loading: authLoading } = useAuth(); // Add authentication check
  
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<any>(null);
  

  // Initialize form and payment when slug is available
  useEffect(() => {
    if (!slug) return;
    
    checkPaymentRequirement();
    restoreFormData();
    cleanupOldFormData();
  }, [slug, form]);

  const restoreFormData = () => {
    const savedFormData = localStorage.getItem(`form_data_${slug}`);
    if (!savedFormData) return;
    
    try {
      const { _timestamp, ...formResponseData } = JSON.parse(savedFormData);
      form.reset(formResponseData);
    } catch (e) {
      console.error('Failed to restore form data:', e);
      localStorage.removeItem(`form_data_${slug}`);
    }
  };

  const cleanupOldFormData = () => {
    try {
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      Object.keys(localStorage)
        .filter(key => key.startsWith('form_data_'))
        .forEach(key => {
          try {
            const data = JSON.parse(localStorage.getItem(key) || '{}');
            if (data._timestamp && data._timestamp < oneHourAgo) {
              localStorage.removeItem(key);
            }
          } catch (e) {
            localStorage.removeItem(key); // Remove malformed entries
          }
        });
    } catch (e) {
      console.error('Error cleaning up localStorage:', e);
    }
  };

  const checkPaymentRequirement = async () => {
    if (!slug) return;
    
    try {
      const response = await api.get(`/v1/forms/slug/${slug}/payment-config`);
      if (response.data && response.data.requires_payment) {
        setPaymentConfig(response.data);
      }
    } catch (err) {
      console.log('Payment not required for this form');
    }
  };

  const determinePaymentMethod = (data: any) => {
    const availableMethods = getAvailablePaymentMethods();
    const { allowPayPal, allowInPerson } = availableMethods;
    
    // PayPal only
    if (allowPayPal && !allowInPerson) return 'paypal';
    
    // In-person only
    if (!allowPayPal && allowInPerson) return 'in-person';
    
    // Both enabled - check form data for user selection
    const formPaymentMethod = Object.keys(data).find(key => 
      key.includes('_payment_method')
    );
    
    return formPaymentMethod ? data[formPaymentMethod] as 'paypal' | 'in-person' : 'paypal';
  };

  const submitInPersonPayment = async (data: any, formTotal: number) => {
    if (!user) {
      setSubmitState('error');
      setSubmitMessage('Authentication required. Please log in and try again.');
      return;
    }

    const priceField = schema.data.find(f => f.type === "price" && isVisible((f as any).visibleIf)) as any;
    const priceValue = priceField ? (priceField.amount || 0) : formTotal;
    
    await api.post(`/v1/forms/slug/${slug}/responses`, {
      response: {
        ...data,
        price_payment_method: 'in-person',
        [`price_${priceField?.id}`]: priceValue,
        price_field_id: priceField?.id,
        price_amount: priceValue
      },
      payment_info: {
        amount: formTotal,
        status: 'pending_door_payment',
        payment_method: 'in-person',
        transaction_id: null,
        payment_time: new Date().toISOString(),
        price_field_id: priceField?.id,
        price_field_value: priceValue
      }
    });
    
    setSubmitState('success');
    setSubmitMessage('Thanks for your response! Please complete payment in-person as arranged.');
    form.reset();
  };

  const submitRegularForm = async (data: any) => {
    if (!user) {
      setSubmitState('error');
      setSubmitMessage('Authentication required. Please log in and try again.');
      return;
    }

    const submissionData: any = { response: data };
    
    // Include price field information even for non-payment submissions
    const priceFields = schema.data.filter(field => field.type === 'price');
    if (priceFields.length > 0) {
      const priceField = priceFields[0] as any;
      const priceValue = priceField ? (priceField.amount || 0) : 0;
      
      submissionData.response = {
        ...data,
        [`price_${priceField.id}`]: priceValue,
        price_field_id: priceField.id,
        price_amount: priceValue
      };
    }
    
    await api.post(`/v1/forms/slug/${slug}/responses`, submissionData);
    setSubmitState('success');
    setSubmitMessage('Thanks for your response! We have received it.');
    form.reset();
  };

  const handleSubmissionError = (err: any) => {
    const detail = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Submit failed';
    const detailStr = typeof detail === 'string' ? detail.toLowerCase() : '';
    
    // Map server errors to user-friendly messages
    if (detailStr.includes('expired')) {
      setPageError('This form has expired and is no longer accepting responses.');
      setSubmitState('error');
    } else if (detailStr.includes('not available') || detailStr.includes('not visible')) {
      setPageError('This form is not available for public viewing.');
      setSubmitState('error');
    } else if (detailStr.includes('not found')) {
      setPageError('Form not found.');
      setSubmitState('error');
    } else {
      setSubmitState('error');
      setSubmitMessage(typeof detail === 'string' ? detail : 'Submit failed');
    }
  };

  // Backend PayPal integration functions
  const validatePaymentRequirements = () => {
    const priceFields = schema.data.filter(field => field.type === 'price');
    const formTotal = computeTotal();
    
    if (priceFields.length === 0) {
      alert('This form does not have any payment fields configured.');
      return null;
    }
    
    if (formTotal <= 0) {
      alert('Payment amount must be greater than zero.');
      return null;
    }
    
    return { priceFields, formTotal };
  };

  const saveFormDataToLocalStorage = () => {
    const formData = form.getValues();
    localStorage.setItem(`form_data_${slug}`, JSON.stringify({
      ...formData,
      _timestamp: Date.now()
    }));
    return formData;
  };

  const buildPaymentData = (formData: any, priceFields: any[], formTotal: number) => {
    const priceField = priceFields[0] as any;
    const priceValue = priceField ? (priceField.amount || 0) : formTotal;
    
    return {
      payment_amount: formTotal,
      form_response: {
        ...formData,
        price_payment_method: 'paypal',
        [`price_${priceField?.id}`]: priceValue,
        price_field_id: priceField?.id,
        price_amount: priceValue
      },
      payment_method: 'paypal',
      requires_payment: true,
      form_schema: priceFields.map(field => ({
        id: field.id,
        name: field.name,
        type: field.type,
        amount: (field as any).amount,
        paymentMethods: (field as any).paymentMethods
      })),
      price_field_info: {
        id: priceField?.id,
        value: priceValue,
        name: priceField?.name || `price_${priceField?.id}`
      }
    };
  };

  const initiatePayPalPayment = async () => {
    try {
      const validation = validatePaymentRequirements();
      if (!validation) return;
      
      const { priceFields, formTotal } = validation;
      const formData = saveFormDataToLocalStorage();
      const paymentData = buildPaymentData(formData, priceFields, formTotal);
      
      const response = await formPaymentApi.createFormPaymentOrder(slug!, paymentData);
      
      if (response.success && response.approval_url) {
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

  // Handle PayPal return redirect
  useEffect(() => {
    if (!slug) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const payerId = urlParams.get('PayerID');
    
    if (token && payerId) {
      const currentPath = window.location.pathname;
      const expectedSuccessPath = `/forms/${slug}/payment/success`;
      
      if (currentPath !== expectedSuccessPath) {
        window.location.replace(`${expectedSuccessPath}${window.location.search}`);
      }
    }
  }, [slug]);

  const getAvailablePaymentMethods = () => {
    const methods = { allowPayPal: false, allowInPerson: false };
    
    const visiblePriceFields = schema.data.filter(
      (f: AnyField) => f.type === "price" && isVisible((f as any).visibleIf)
    ) as any[];
    
    if (visiblePriceFields.length === 0) return methods;
    
    // Check payment method configurations
    visiblePriceFields.forEach(field => {
      if (field.paymentMethods?.allowPayPal !== false) {
        methods.allowPayPal = true;
      }
      if (field.paymentMethods?.allowInPerson) {
        methods.allowInPerson = true;
      }
    });
    
    // Default fallback if no methods configured
    if (!methods.allowPayPal && !methods.allowInPerson) {
      methods.allowPayPal = true;
      if (slug) methods.allowInPerson = true; // Only for public forms
    }
    
    return methods;
  };
  const [pageError, setPageError] = useState<string | null>(null);

  if (!slug && boundsViolations.length > 0) {
    return (
      <div className={cn("mx-auto w-full", formWidthClass)}>
        <Alert variant="destructive">
          <AlertTitle>Preview unavailable</AlertTitle>
          <AlertDescription>
            <p className="mb-2">Fix the following min/max conflicts to resume the live builder preview:</p>
            <ul className="list-disc pl-5 space-y-1">
              {boundsViolations.map((issue) => (
                <li key={issue.fieldId}>
                  <span className="font-medium">{issue.fieldLabel || issue.fieldName}</span>: {issue.message}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const isVisible = (visibleIf?: string): boolean => {
    if (!visibleIf) return true;
    const m = visibleIf.match(/^\s*(\w+)\s*(==|!=|>=|<=|>|<)\s*(.+)\s*$/);
    if (!m) return true;
    const [, name, op, rhsRaw] = m;
    const lhs = (values as any)?.[name];
    let rhs: any = rhsRaw;
    if (/^['"].*['"]$/.test(rhsRaw)) rhs = rhsRaw.slice(1, -1);
    else if (/^(true|false)$/i.test(rhsRaw)) rhs = rhsRaw.toLowerCase() === "true";
    else if (!Number.isNaN(Number(rhsRaw))) rhs = Number(rhsRaw);
    switch (op) {
      case "==": return lhs == rhs;
      case "!=": return lhs != rhs;
      case ">=": return lhs >= rhs;
      case "<=": return lhs <= rhs;
      case ">": return lhs > rhs;
      case "<": return lhs < rhs;
      default: return true;
    }
  };

  // Handle PayPal payment separately (not through form submission)
  const handlePayPalPayment = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent form submission
    e.stopPropagation();
    
    // Ensure user is authenticated before processing payment
    if (!user) {
      setSubmitState('error');
      setSubmitMessage('You must be logged in to submit this form.');
      return;
    }

    // Validate form before initiating PayPal payment
    const isValid = await form.trigger(); // Trigger validation
    
    if (!isValid) {
      setSubmitState('error');
      setSubmitMessage('Please fix the form errors before proceeding with payment.');
      return;
    }

    setSubmitState('submitting');
    setSubmitMessage('Redirecting to PayPal...');
    
    try {
      await initiatePayPalPayment();
      // Don't reset state here - PayPal will redirect and come back
    } catch (error) {
      // Error handling is done in initiatePayPalPayment function
      setSubmitState('idle');
    }
  };

  const onSubmit = form.handleSubmit(async (data: any) => {
    // If a slug prop is provided, submit to public endpoint
    if (slug) {
      // Ensure user is authenticated before submitting
      if (!user) {
        setSubmitState('error');
        setSubmitMessage('You must be logged in to submit this form.');
        return;
      }

      try {
        setSubmitState('submitting');
        setSubmitMessage('Submitting...');
        
        const formTotal = computeTotal();
        const hasPaymentRequired = paymentConfig?.requires_payment || formTotal > 0;
        
        if (hasPaymentRequired) {
          const selectedPaymentMethod = determinePaymentMethod(data);
          
          // PayPal payments should be handled by button click, not form submission
          if (selectedPaymentMethod === 'paypal') {
            setSubmitState('error');
            setSubmitMessage('PayPal payment should be handled separately.');
            return;
          }
          
          // Handle in-person payment
          if (selectedPaymentMethod === 'in-person') {
            await submitInPersonPayment(data, formTotal);
            return;
          }
        }
        
        // Regular form submission (no payment required)
        await submitRegularForm(data);
      } catch (err: any) {
        console.error('Submit failed', err);
        handleSubmissionError(err);
      }
      return;
    }

    setSubmitState('success');
    setSubmitMessage('Preview submission captured.');
  });

  const computeTotal = (): number => {
    let total = 0;
    for (const f of schema.data as AnyField[]) {
      if (!isVisible((f as any).visibleIf)) continue;
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
          const override = cfg.weekdayOverrides?.[dow as 0|1|2|3|4|5|6];
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
  
  // Collect errors for fields that are currently hidden, so they still surface
  const hiddenErrors: string[] = useMemo(() => {
    const msgs: string[] = [];
    const errs: Record<string, any> = (form.formState.errors as any) || {};
    const byName: Record<string, any> = errs;
    for (const f of schema.data as AnyField[]) {
      const e = byName[f.name];
      if (!e) continue;
      const currentlyVisible = isVisible((f as any).visibleIf);
      if (!currentlyVisible) {
        const msg = e?.message as string | undefined;
        if (msg) msgs.push(msg);
      }
    }
    return msgs;
  }, [form.formState.errors, schema.data, values]);
  

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

  // Show loading while authentication is being checked for public forms
  if (slug && authLoading) {
    return (
      <div className={cn("mx-auto w-full", formWidthClass)}>
        <div className="rounded-md border border-border bg-muted/30 p-8 text-center flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <h2 className="text-xl font-semibold">Loading...</h2>
          <p className="text-muted-foreground max-w-md">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Show authentication required message for public forms if user is not authenticated
  if (slug && !user && !authLoading) {
    return (
      <div className={cn("mx-auto w-full", formWidthClass)}>
        <div className="rounded-md border border-border bg-muted/30 p-8 text-center flex flex-col items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 text-yellow-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </span>
          <h2 className="text-xl font-semibold">Authentication Required</h2>
          <p className="text-muted-foreground max-w-md">You must be logged in to access this form.</p>
        </div>
      </div>
    );
  }

  const isSubmitting = submitState === 'submitting' || form.formState.isSubmitting;

  return (
  <div className={cn("mx-auto w-full", formWidthClass)}>
  <form onSubmit={onSubmit} className="grid grid-cols-12 gap-4">
      {/* Show errors for hidden required fields too */}
      {hiddenErrors.length > 0 && (
        <div className="col-span-12">
          <Alert variant="destructive">
            <AlertTitle>Some required fields are missing</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5">
                {hiddenErrors.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {schema.data.filter((f) => isVisible(f.visibleIf)).map((f) => (
        <FieldRenderer
          key={f.id}
          field={f}
          control={form.control}
          error={(form.formState.errors as any)?.[f.name]?.message as string | undefined}
        />
      ))}
      
    
      
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
                  type="button"
                  onClick={handlePayPalPayment}
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
                    type="button"
                    onClick={handlePayPalPayment}
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
        })()}
        
        {submitMessage && submitState !== 'success' && (
          <div
            className={`text-sm mt-2 ${submitState === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}
          >
            {submitMessage}
          </div>
        )}
      </div>
      
    </form>
    </div>
  );
}
