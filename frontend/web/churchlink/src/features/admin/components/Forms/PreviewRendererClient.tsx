'use client';

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { schemaToZodObject } from "./schemaGen";
import { evaluateVisibility } from "./visibilityUtils";
import { FieldRenderer } from "./FieldRenderer";
import { useBuilderStore } from "./store";
import { Button } from "@/shared/components/ui/button";
import type { AnyField, DateField, SelectField } from "./types";
import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { MailCheck, CreditCard } from "lucide-react";
import { formWidthToClass } from "./types";
import { cn } from "@/lib/utils";
import { getBoundsViolations, getOptionViolations } from "./validation";
import PreviewUnavailableAlert from "./PreviewUnavailableAlert";

import {
  getFormBySlug,
  isFreeForm,
  allowedPaymentOptions,
  submitFreeForm,
  submitDoorPaymentForm,
  createFormPaymentOrder,
} from "@/helpers/FormSubmissionHelper";
import type { Form, FormPaymentOption } from "@/shared/types/Form";

/**
 * Props:
 * - slug: when present, we’re rendering the public form (requires auth at API layer).
 * - instanceId: optional unique id to prevent accidental double submits across tabs.
 * - applyFormWidth: use form builder’s layout width class.
 */
export function PreviewRendererClient({
  slug,
  applyFormWidth = true,
}: {
  slug?: string;
  instanceId?: string;
  applyFormWidth?: boolean;
}) {
  const schema = useBuilderStore((s) => s.schema);
  const boundsViolations = useMemo(() => getBoundsViolations(schema), [schema]);
  const optionViolations = useMemo(
    () => (!slug ? getOptionViolations(schema) : []),
    [schema, slug]
  );

  const zodSchema = schemaToZodObject(schema);

  const defaultValues = useMemo(() => {
    const defaults: Record<string, any> = {};
    for (const field of schema.data) {
      if (field.type === "switch" || field.type === "checkbox") {
        defaults[field.name] = false;
      }
    }
    return defaults;
  }, [schema.data]);

  const form = useForm({ resolver: zodResolver(zodSchema), defaultValues });
  const formWidthClass = applyFormWidth ? formWidthToClass((schema as any)?.formWidth) : undefined;
  const values = form.watch();

  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  // Public form configuration (payment options/price)
  const [serverForm, setServerForm] = useState<Form | null>(null);
  const [availableMethods, setAvailableMethods] = useState<{ allowPayPal: boolean; allowInPerson: boolean }>({
    allowPayPal: false,
    allowInPerson: false,
  });


  // Load live form config (submission_price/payment_options) when slug is provided
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!slug) return;
      try {
        const f = await getFormBySlug(slug);
        if (!mounted) return;
        setServerForm(f);
        const opts = new Set<FormPaymentOption>(allowedPaymentOptions(f));
        setAvailableMethods({
          allowPayPal: opts.has("paypal"),
          allowInPerson: opts.has("door"),
        });

        // On public page, attempt to restore in-progress responses (saved before PayPal redirect)
        const savedFormDataKey = `form_data_${slug}`;
        const saved = localStorage.getItem(savedFormDataKey);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            const { _timestamp, ...restored } = parsed ?? {};
            form.reset({ ...defaultValues, ...restored });
          } catch {
            // bad data; clear it
            localStorage.removeItem(savedFormDataKey);
          }
        }

        // Cleanup any lingering stale saved data (older than 1h)
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key || !key.startsWith("form_data_")) continue;
          try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const data = JSON.parse(raw);
            if (typeof data?._timestamp === "number" && data._timestamp < oneHourAgo) {
              localStorage.removeItem(key);
            }
          } catch {
            localStorage.removeItem(key);
          }
        }
      } catch (err: any) {
        // Expose common public errors in a friendly card
        const msg =
          err?.response?.data?.detail ||
          err?.response?.data?.message ||
          err?.message ||
          "Unable to load form.";
        const low = String(msg).toLowerCase();
        if (low.includes("expired")) setPageError("This form has expired and is no longer accepting responses.");
        else if (low.includes("not available") || low.includes("not visible"))
          setPageError("This form is not available for public viewing.");
        else if (low.includes("not found")) setPageError("Form not found.");
        else setPageError(msg);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Builder preview guards
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
                ? " One or more options have empty labels and values"
                : issue.hasEmptyLabels
                  ? " One or more options have empty labels"
                  : " One or more options have empty values"}
            </li>
          ))}
        </PreviewUnavailableAlert>
      </div>
    );
  }

  // Price computation based on visible fields
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

  // Helper: does the authored schema include any paid constructs?
  const hasPricing = (): boolean => {
    for (const f of schema.data as AnyField[]) {
      if (f.type === "price") return true;
      if ((f.type === "checkbox" || f.type === "switch") && (f as any).price != null) return true;
      if ((f.type === "radio" || f.type === "select") && (f as any).options?.some((o: any) => o.price != null))
        return true;
      if (f.type === "date" && (f as DateField).pricing?.enabled) return true;
    }
    return false;
  };
  const showPricingBar = hasPricing();

  // PayPal start: persist answers and redirect to approval
  const startPayPalFlow = async () => {
    if (!slug || !serverForm) return;
    if (!availableMethods.allowPayPal) throw new Error("PayPal is not allowed for this form.");

    // Save current answers (so the success page can submit them after capture+submit)
    const answers = form.getValues();
    localStorage.setItem(
      `form_data_${slug}`,
      JSON.stringify({ ...answers, _timestamp: Date.now() })
    );

    const order = await createFormPaymentOrder(slug);
    // Find the approval link in PayPal order.links (rel: "approve" or "payer-action")
    const links = (order?.paypal?.links as Array<{ rel?: string; href?: string }> | undefined) || [];
    const approve =
      links.find((l) => (l.rel || "").toLowerCase() === "approve") ||
      links.find((l) => (l.rel || "").toLowerCase() === "payer-action");

    if (!approve?.href) {
      throw new Error("Missing PayPal approval link.");
    }

    // Redirect to PayPal
    window.location.href = approve.href;
  };

  // Submit handler
  const onSubmit = form.handleSubmit(async (data: Record<string, any>) => {
    // StrictMode-safe lock to avoid double submission
    const globalSubmitKey = `form_submitting_${slug || "preview"}`;
    const LOCK_EXPIRY_MS = 5 * 60 * 1000;
    const lockRaw = sessionStorage.getItem(globalSubmitKey);
    if (lockRaw) {
      try {
        const lock = JSON.parse(lockRaw);
        if (lock?.submitting && typeof lock?.setAt === "number" && Date.now() - lock.setAt < LOCK_EXPIRY_MS) {
          return;
        }
      } catch {
        // ignore and reset
      }
      sessionStorage.removeItem(globalSubmitKey);
    }
    sessionStorage.setItem(globalSubmitKey, JSON.stringify({ submitting: true, setAt: Date.now() }));

    try {
      setSubmitState("submitting");
      setSubmitMessage("Submitting...");

      // Public submit path
      if (slug && serverForm) {
        // If the form is free (based on server), submit as free regardless of UI-estimated total
        if (isFreeForm(serverForm)) {
          await submitFreeForm(slug, data, serverForm);
          setSubmitState("success");
          setSubmitMessage("Thanks for your response! We have received it.");
          form.reset(defaultValues);
          return;
        }

        // Paid form: decide method
        const methods = availableMethods;
        const hasInPersonOnly = !methods.allowPayPal && methods.allowInPerson;
        const both = methods.allowPayPal && methods.allowInPerson;

        // If both are enabled, try to pick from a dedicated field (suffix convention)
        let chosen: "paypal" | "door" = "paypal";
        if (both) {
          const pickerKey = Object.keys(data).find((k) => k.includes("_payment_method"));
          const val = pickerKey ? String(data[pickerKey]) : null;
          if (val === "in-person" || val === "door") chosen = "door";
        } else if (hasInPersonOnly) {
          chosen = "door";
        } else {
          chosen = "paypal";
        }

        if (chosen === "door") {
          await submitDoorPaymentForm(slug, data, serverForm);
          setSubmitState("success");
          setSubmitMessage(
            "Thanks for your response! We’ve recorded your intent to pay in person. Please complete payment on arrival."
          );
          form.reset(defaultValues);
          return;
        }

        // PayPal path — NEW combined flow is handled on the success page; we only redirect here.
        setSubmitMessage("Redirecting to PayPal...");
        await startPayPalFlow();
        // Do not clear the lock; the redirect will leave the page
        return;
      }

      // Builder preview (no slug): just show success and reset
      setSubmitState("success");
      setSubmitMessage("Preview submission captured.");
    } catch (err: any) {
      console.error("Submit failed", err);
      const detail =
        err?.response?.data?.detail || err?.response?.data?.message || err?.message || "Submit failed";
      const low = String(detail).toLowerCase();
      if (low.includes("expired")) setPageError("This form has expired and is no longer accepting responses.");
      else if (low.includes("not available") || low.includes("not visible"))
        setPageError("This form is not available for public viewing.");
      else if (low.includes("not found")) setPageError("Form not found.");
      setSubmitState("error");
      setSubmitMessage(typeof detail === "string" ? detail : "Submit failed");
    } finally {
      // Clear the lock unless we are redirecting to PayPal (in which case we already left)
      sessionStorage.removeItem(globalSubmitKey);
    }
  });

  // Success card (public)
  if (slug && submitState === "success" && submitMessage) {
    return (
      <div className={cn("mx-auto w-full", formWidthClass)}>
        <div className="rounded-md border border-border bg-muted/30 p-8 text-center flex flex-col items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MailCheck className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="text-xl font-semibold">Thank you!</h2>
          <p className="text-muted-foreground max-w-md">{submitMessage}</p>
        </div>
      </div>
    );
  }

  // Friendly page-level errors
  if (pageError) {
    return (
      <div className={cn("mx-auto w-full", formWidthClass)}>
        <div className="rounded-md border border-border bg-muted/30 p-8 text-center flex flex-col items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12A9 9 0 1112 3a9 9 0 019 9z" />
            </svg>
          </span>
          <h2 className="text-xl font-semibold">Form unavailable</h2>
          <p className="text-destructive max-w-md">{pageError}</p>
        </div>
      </div>
    );
  }

  const isSubmitting = submitState === "submitting" || form.formState.isSubmitting;

  // Render form
  return (
    <div className={cn("mx-auto w-full", formWidthClass)}>
      <form onSubmit={onSubmit} className="grid grid-cols-12 gap-4">
        {schema.data
          .filter((f) => evaluateVisibility(f.visibleIf, values))
          .map((f) => (
            <FieldRenderer
              key={f.id}
              field={f}
              control={form.control}
              error={(form.formState.errors as any)?.[f.name]?.message as string | undefined}
            />
          ))}

        {/* Payment section (public) */}
        {slug && (showPricingBar || (!!serverForm && !isFreeForm(serverForm))) && (
          <div className="col-span-12 space-y-4">
            <Alert className="border-blue-200 bg-blue-50">
              <CreditCard className="h-4 w-4" />
              <AlertTitle>Payment Required</AlertTitle>
              <AlertDescription>
                <div className="space-y-3">
                  {showPricingBar && (
                    <div className="text-lg font-semibold">Total: ${computeTotal().toFixed(2)}</div>
                  )}
                  <div className="text-sm text-muted-foreground">
                    Choose your payment method inside the form (if available).
                  </div>
                  {submitMessage && submitState !== "success" && (
                    <div className={`text-sm mt-2 ${submitState === "error" ? "text-red-600" : "text-blue-600"}`}>
                      {submitMessage}
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Submit button */}
        <div className="col-span-12">
          {(() => {
            const hasPriceFields = schema.data.some((f) => f.type === "price");
            const methods = availableMethods;
            const paypalOnly = methods.allowPayPal && !methods.allowInPerson;
            const inPersonOnly = !methods.allowPayPal && methods.allowInPerson;
            const both = methods.allowPayPal && methods.allowInPerson;

            // Show PayPal-specific CTAs when payment exists (or preview showcases price fields)
            if ((slug && serverForm && !isFreeForm(serverForm)) || (!slug && hasPriceFields)) {
              if (paypalOnly) {
                return (
                  <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-white rounded flex items-center justify-center">
                        <span className="text-blue-600 text-xs font-bold">P</span>
                      </div>
                      {isSubmitting ? "Processing..." : "Pay with PayPal & Submit"}
                    </span>
                  </Button>
                );
              }
              if (inPersonOnly) {
                return (
                  <Button type="submit" disabled={isSubmitting} className="w-full bg-green-600 hover:bg-green-700 text-white">
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-white rounded flex items-center justify-center">
                        <span className="text-green-600 text-xs">💵</span>
                      </div>
                      {isSubmitting ? "Submitting..." : "Submit Form (Pay In-Person Later)"}
                    </span>
                  </Button>
                );
              }
              if (both) {
                const paymentMethodField = Object.keys(values).find((k) => k.includes("_payment_method"));
                const current = (paymentMethodField ? values[paymentMethodField] : "paypal") as "paypal" | "in-person";
                const isPayPal = current === "paypal";
                return (
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full ${isPayPal ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700"} text-white`}
                  >
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-white rounded flex items-center justify-center">
                        <span className={`${isPayPal ? "text-blue-600" : "text-green-600"} text-xs`}>{isPayPal ? "P" : "💵"}</span>
                      </div>
                      {isSubmitting ? "Processing..." : isPayPal ? "Pay with PayPal & Submit" : "Submit Form (Pay In-Person Later)"}
                    </span>
                  </Button>
                );
              }
            }

            // Default submit (free or preview without price fields)
            return (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit"}
              </Button>
            );
          })()}

          {submitMessage && submitState !== "success" && (
            <div className={`text-sm mt-2 ${submitState === "error" ? "text-destructive" : "text-muted-foreground"}`}>
              {submitMessage}
            </div>
          )}
        </div>

        {/* Pricing summary bar (builder preview or public UI with priced elements) */}
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