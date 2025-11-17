import React, { useMemo, useState } from "react";
import { Loader2, ArrowRight, Repeat2, DollarSign, Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/shared/components/ui/select";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Separator } from "@/shared/components/ui/separator";

import {
  createOneTimeDonation,
  createDonationSubscription,
} from "@/helpers/DonationHelper";
import type { DonationInterval, DonationCurrency } from "@/shared/types/Donations";

import { useLocalize } from "@/shared/utils/localizationUtils";

type Mode = "one_time" | "recurring";

const PaypalSection: React.FC<{
  defaultAmount?: number;
  defaultCurrency?: DonationCurrency;
  defaultInterval?: DonationInterval;
  isEditing?: boolean;
}> = ({
  defaultAmount = 25,
  defaultCurrency = "USD",
  defaultInterval = "MONTH",
  isEditing = false,
}) => {
    const localize = useLocalize();

    const [mode, setMode] = useState<Mode>("one_time");
    const [amountInput, setAmountInput] = useState<string>(
      defaultAmount ? String(defaultAmount) : ""
    );

    // Derived numeric value, used for validation + submission
    const amount = useMemo(() => {
      const v = parseFloat(amountInput);
      if (!Number.isFinite(v) || v <= 0) return 0;
      return v;
    }, [amountInput]);
    const [currency, setCurrency] = useState<DonationCurrency>(defaultCurrency);
    const [interval, setInterval] = useState<DonationInterval>(defaultInterval);
    const [message, setMessage] = useState<string>("");

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const disabled = useMemo(
      () => submitting || !amount || amount <= 0,
      [submitting, amount]
    );

    const prettyInterval = useMemo(() => {
      if (mode !== "recurring") return null;
      switch (interval) {
        case "WEEK":
          return "every week";
        case "MONTH":
          return "every month";
        case "YEAR":
          return "every year";
        default:
          return null;
      }
    }, [mode, interval]);

    const handleOneTime = async () => {
      setError(null);
      setSubmitting(true);
      try {
        const res = await createOneTimeDonation({
          amount,
          currency,
          message: message || null,
        });

        if (!res.success) {
          setError(res.msg || "Could not create PayPal order.");
          setSubmitting(false);
          return;
        }

        if (res.approve_url) {
          window.location.href = res.approve_url;
          return;
        }

        setError("Order created but no approval link returned by PayPal.");
      } catch (e) {
        console.error("[PaypalSection] one-time create failed:", e);
        setError("Something went wrong while creating your donation.");
      } finally {
        setSubmitting(false);
      }
    };

    const handleRecurring = async () => {
      setError(null);
      setSubmitting(true);
      try {
        const res = await createDonationSubscription({
          amount,
          currency,
          interval,
          message: message || null,
        });

        if (!res.success) {
          setError(res.msg || "Could not create PayPal subscription.");
          setSubmitting(false);
          return;
        }

        if (res.approve_url) {
          window.location.href = res.approve_url;
          return;
        }

        setError("Subscription created but no approval link returned by PayPal.");
      } catch (e) {
        console.error("[PaypalSection] subscription create failed:", e);
        setError("Something went wrong while creating your subscription.");
      } finally {
        setSubmitting(false);
      }
    };

    const handleSubmit = () => {
      if (isEditing) {
        return;
      }
      if (mode === "recurring") {
        void handleRecurring();
      } else {
        void handleOneTime();
      }
    };

    return (
      <Card className="border border-muted shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <DollarSign className="h-4 w-4 text-primary" />
            </span>
            <span>{localize("Support with PayPal")}</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {localize("Give securely through PayPal. You can make a one-time gift or set up an automatic recurring donation.")}
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Mode selector – whole cards clickable */}
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">
              {localize("How often would you like to give?")}
            </Label>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as Mode)}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
              <Label
                htmlFor="donation-mode-one-time"
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 text-left transition-all ${mode === "one_time"
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-background hover:bg-muted/60"
                  }`}
              >
                <RadioGroupItem id="donation-mode-one-time" value="one_time" className="mt-0.5" />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1 text-sm font-medium">
                    {localize("One-time gift")}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {localize("A single donation processed immediately.")}
                  </p>
                </div>
              </Label>

              <Label
                htmlFor="donation-mode-recurring"
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 text-left transition-all ${mode === "recurring"
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-background hover:bg-muted/60"
                  }`}
              >
                <RadioGroupItem id="donation-mode-recurring" value="recurring" className="mt-0.5" />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1 text-sm font-medium">
                    {localize("Recurring support")}
                    <Repeat2 className="h-3 w-3 opacity-80" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {localize("Automatically give on a schedule you choose.")}
                  </p>
                </div>
              </Label>
            </RadioGroup>
          </div>

          {/* Amount + cadence + summary */}
          <div className="grid gap-6 md:grid-cols-[1.2fr,1fr]">
            <div className="space-y-4">
              <div
                className={`grid grid-cols-1 gap-4 ${mode === "recurring" ? "sm:grid-cols-3" : "sm:grid-cols-2"
                  }`}
              >
                <div>
                  <Label htmlFor="amount">{localize("Amount")}</Label>
                  <Input
                    id="amount"
                    type="number"
                    min={1}
                    step="1"
                    value={amountInput}
                    onChange={(e) => {
                      // Let the user freely type / clear the field
                      setAmountInput(e.target.value);
                    }}
                    onBlur={() => {
                      // On blur, snap it to a clean value or clear it
                      const v = parseFloat(amountInput);
                      if (!Number.isFinite(v) || v <= 0) {
                        // Invalid or <= 0 → clear the field
                        setAmountInput("");
                        return;
                      }
                      // Valid positive number → normalize formatting
                      setAmountInput(v.toString());
                    }}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="currency">{localize("Currency")}</Label>
                  <Select
                    value={currency}
                    onValueChange={(v) => setCurrency(v as DonationCurrency)}
                  >
                    <SelectTrigger id="currency" className="mt-1">
                      <SelectValue placeholder="USD" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {mode === "recurring" && (
                  <div>
                    <Label htmlFor="interval">{localize("Cadence")}</Label>
                    <Select
                      value={interval}
                      onValueChange={(v) => setInterval(v as DonationInterval)}
                    >
                      <SelectTrigger id="interval" className="mt-1">
                        <SelectValue placeholder="MONTH" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="WEEK">{localize("Weekly")}</SelectItem>
                        <SelectItem value="MONTH">{localize("Monthly")}</SelectItem>
                        <SelectItem value="YEAR">{localize("Yearly")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="message">{localize("Message (optional)")}</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={localize("Add a note to appear alongside your donation (optional)…")}
                  className="mt-1 min-h-[80px]"
                />
              </div>
            </div>

            <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-medium">{localize("Summary")}</span>
              </div>
              <p className="text-muted-foreground">
                {mode === "one_time" ? (
                  <>
                    {localize("You’re giving a one-time gift of")}{" "}
                    <span className="font-semibold">
                      {currency} {amount > 0 ? amount.toFixed(2) : "0.00"}
                    </span>{" "}
                    {localize("via PayPal.")}.
                  </>
                ) : (
                  <>
                    {localize("You’re setting up a recurring donation of")}{" "}
                    <span className="font-semibold">
                      {currency} {amount > 0 ? amount.toFixed(2) : "0.00"}
                    </span>{" "}
                    {prettyInterval && <span>{localize(prettyInterval)}</span>}{" "}
                    {localize("through PayPal.")}
                  </>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {localize("You’ll be redirected to PayPal to confirm and complete the payment. Your card details never touch our servers.")}
              </p>
            </div>
          </div>

          <Separator />

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{localize(error)}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={disabled}
              className="flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {localize("Preparing PayPal…")}
                </>
              ) : (
                <>
                  {localize("Continue to PayPal")}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

export default PaypalSection;
