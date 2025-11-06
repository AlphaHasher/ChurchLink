import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { schemaToZodObject } from "./schemaGen";
import { evaluateVisibility } from "./visibilityUtils";
import { FieldRenderer } from "./FieldRenderer";
import { useBuilderStore, type BuilderState } from "./store";
import { Button } from "@/shared/components/ui/button";
import { useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import type { AnyField } from "./types";
import { getBoundsViolations } from "./validation";
export function PreviewRenderer() {
  const schema = useBuilderStore((s: BuilderState) => s.schema);
  const boundsViolations = useMemo(() => getBoundsViolations(schema), [schema]);
  const zodSchema = schemaToZodObject(schema);

  // Set default values for payment method fields
  const getDefaultValues = () => {
    const defaults: Record<string, any> = {};
    for (const f of schema.data as AnyField[]) {
      if (f.type === "price") {
        const priceField = f as any;
        const allowPayPal = priceField.paymentMethods?.allowPayPal !== false;
        const allowInPerson = priceField.paymentMethods?.allowInPerson !== false;

        // Set default payment method for fields that allow both
        if (allowPayPal && allowInPerson) {
          defaults[`${f.name}_payment_method`] = 'paypal';
        }
      }
    }
    return defaults;
  };

  const form = useForm({
    resolver: zodResolver(zodSchema),
    defaultValues: getDefaultValues()
  });
  const values = form.watch();
  const [status, setStatus] = useState<string | null>(null);
  if (boundsViolations.length > 0) {
    return (
      <Alert variant="warning">
        <AlertTitle>Preview unavailable</AlertTitle>
        <AlertDescription>
          <p className="mb-1">Fix these min/max conflicts to continue:</p>
          <ul className="list-disc pl-5 space-y-1">
            {boundsViolations.map((issue) => (
              <li key={issue.fieldId}>
                <span className="font-medium">{issue.fieldLabel || issue.fieldName}</span>: {issue.message}
              </li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
    );
  }
  // Language selection handled in parent card header

  // Get available payment methods from price fields
  const getAvailablePaymentMethods = () => {
    const methods = { allowPayPal: false, allowInPerson: false };

    // Check price fields for payment method configurations
    for (const f of schema.data as AnyField[]) {
      if (f.type === "price" && evaluateVisibility((f as any).visibleIf, values)) {
        const priceField = f as any;
        if (priceField.paymentMethods?.allowPayPal) {
          methods.allowPayPal = true;
        }
        if (priceField.paymentMethods?.allowInPerson) {
          methods.allowInPerson = true;
        }
      }
    }

    // If no price fields specify methods, default to both (backward compatibility)
    if (!methods.allowPayPal && !methods.allowInPerson) {
      methods.allowPayPal = true;
      methods.allowInPerson = true;
    }

    return methods;
  };

  // Compute total price from visible price fields
  const computeTotal = () => {
    let total = 0;
    for (const f of schema.data as AnyField[]) {
      if (f.type === "price" && evaluateVisibility((f as any).visibleIf, values)) {
        const priceField = f as any;
        total += priceField.amount || 0;
      }
    }
    return total;
  };

  const onSubmit = form.handleSubmit(async (data: any) => {
    console.log("Preview submit", data);
    // For admin preview, just show a status message
    try {
      setStatus('Validated');
      // Optionally could POST to a test endpoint if desired
    } catch (err) {
      setStatus('Validation failed');
    }
  });

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-12 gap-4">
      {/* Language selector removed here; kept in Live Preview card header */}
      {schema.data.filter((f) => evaluateVisibility(f.visibleIf, values)).map((f) => (
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
          const total = computeTotal();
          const hasPayment = total > 0;

          // For forms with payment (preview mode)
          if (hasPayment) {
            // Scenario 1: PayPal Only
            if (paypalOnly) {
              return (
                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-white rounded flex items-center justify-center">
                      <span className="text-blue-600 text-xs font-bold">P</span>
                    </div>
                    Pay with PayPal & Submit
                  </span>
                </Button>
              );
            }

            // Scenario 2: In-Person Only
            if (inPersonOnly) {
              return (
                <Button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-white rounded flex items-center justify-center">
                      <span className="text-green-600 text-xs">💵</span>
                    </div>
                    Submit Form (Pay In-Person Later)
                  </span>
                </Button>
              );
            }

            // Scenario 3: Both Enabled - Dynamic button based on selection
            if (bothEnabled) {
              // Check form data for payment method selection
              const paymentMethodField = Object.keys(values).find(key =>
                key.includes('_payment_method')
              );
              const selectedMethod = paymentMethodField ?
                values[paymentMethodField] as 'paypal' | 'in-person' : 'paypal';

              if (selectedMethod === 'paypal') {
                return (
                  <Button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-white rounded flex items-center justify-center">
                        <span className="text-blue-600 text-xs font-bold">P</span>
                      </div>
                      Pay with PayPal & Submit
                    </span>
                  </Button>
                );
              } else {
                return (
                  <Button
                    type="submit"
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                  >
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-white rounded flex items-center justify-center">
                        <span className="text-green-600 text-xs">💵</span>
                      </div>
                      Submit Form (Pay In-Person Later)
                    </span>
                  </Button>
                );
              }
            }
          }

          // Default submit button for non-payment forms
          return (
            <Button type="submit">Submit</Button>
          );
        })()}
        {status && <div className="text-sm text-muted-foreground mt-2">{status}</div>}
      </div>
    </form>
  );
}
