import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { schemaToZodObject } from "./schemaGen";
import { FieldRenderer } from "./FieldRenderer";
import { useBuilderStore } from "./store";
import { Button } from "@/shared/components/ui/button";
import type { AnyField, DateField, SelectField } from "./types";
import { format } from "date-fns";
import api from '@/api/api';
import { useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { MailCheck } from 'lucide-react';
import { formWidthToClass } from "./types";
import { cn } from "@/lib/utils";
import { getBoundsViolations } from "./validation";

export function PreviewRendererClient({ slug, applyFormWidth = true }: { slug?: string; applyFormWidth?: boolean }) {
  const schema = useBuilderStore((s) => s.schema);
  const boundsViolations = useMemo(() => getBoundsViolations(schema), [schema]);
  const zodSchema = schemaToZodObject(schema); // always create schema
  const form = useForm({ resolver: zodResolver(zodSchema), defaultValues: {} }); // always init form hook
  const formWidthClass = applyFormWidth ? formWidthToClass((schema as any)?.formWidth) : undefined;
  const values = form.watch();
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
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

  const onSubmit = form.handleSubmit(async (data: any) => {
    console.log("Preview submit", data);
    // If a slug prop is provided, submit to public endpoint and redirect to thank-you
    if (slug) {
      try {
        setSubmitState('submitting');
        setSubmitMessage('Submitting...');
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
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : 'Submit'}
        </Button>
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
