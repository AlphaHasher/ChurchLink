"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

// shadcn/ui
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/components/ui/tabs";
import { Textarea } from "@/shared/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { Separator } from "@/shared/components/ui/separator";
import { Loader2 } from "lucide-react";

// Helpers & types
import {
  createOneTimeDonation,
  createDonationSubscription,
} from "@/helpers/DonationHelper";
import type { DonationInterval } from "@/shared/types/Donations";

type Props = {
  className?: string;
  merchantOrgId?: string | null; // church/org id if applicable
  title?: string;
  subtitle?: string;
  defaultAmount?: number;
};

const PRESETS = [25, 50, 100, 250];

export default function PaypalSection({
  className,
  merchantOrgId = null,
  title = "Support the Ministry",
  subtitle = "Your generosity makes real impact.",
  defaultAmount = 25,
}: Props) {
  const [mode, setMode] = useState<"one-time" | "recurring">("one-time");
  const [interval, setInterval] = useState<DonationInterval>("MONTH");
  const [amount, setAmount] = useState<number>(defaultAmount);
  const [message, setMessage] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validAmount = useMemo(() => Number.isFinite(amount) && amount >= 1, [amount]); // keep UX sane

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!validAmount) {
      setError("Enter a valid amount (minimum $1.00).");
      return;
    }

    try {
      setBusy(true);

      if (mode === "one-time") {
        const res = await createOneTimeDonation({
          amount,
          currency: "USD",
          message: message?.trim() || null,
          merchant_org_id: merchantOrgId ?? null,
        });

        if (!res.success || !res.approve_url) {
          setError(res.msg || "Unable to start PayPal payment.");
          return;
        }
        window.location.href = res.approve_url;
        return;
      }

      // recurring
      const sub = await createDonationSubscription({
        amount,
        currency: "USD",
        interval,
        message: message?.trim() || null,
        merchant_org_id: merchantOrgId ?? null,
      });

      if (!sub.success || !sub.approve_url) {
        setError(sub.msg || "Unable to start PayPal subscription.");
        return;
      }
      window.location.href = sub.approve_url;
    } catch (err) {
      console.error("[PaypalSection] submit error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={cn("w-full max-w-xl mx-auto", className)}>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="one-time">One-time</TabsTrigger>
            <TabsTrigger value="recurring">Recurring</TabsTrigger>
          </TabsList>

          <TabsContent value="one-time" className="mt-6">
            <AmountBlock amount={amount} setAmount={setAmount} />
            <Separator className="my-4" />
            <MessageBlock message={message} setMessage={setMessage} />
          </TabsContent>

          <TabsContent value="recurring" className="mt-6">
            <div className="mb-4">
              <Label className="mb-2 block">Frequency</Label>
              <RadioGroup
                className="grid grid-cols-3 gap-2"
                value={interval}
                onValueChange={(v) => setInterval(v as DonationInterval)}
              >
                <RadioBox value="WEEK" label="Weekly" checked={interval === "WEEK"} />
                <RadioBox value="MONTH" label="Monthly" checked={interval === "MONTH"} />
                <RadioBox value="YEAR" label="Yearly" checked={interval === "YEAR"} />
              </RadioGroup>
            </div>

            <AmountBlock amount={amount} setAmount={setAmount} />

            <Separator className="my-4" />
            <MessageBlock message={message} setMessage={setMessage} />
          </TabsContent>
        </Tabs>
      </CardContent>

      <CardFooter className="flex flex-col items-stretch gap-2">
        {error && (
          <div className="text-sm text-destructive border border-destructive/30 rounded-md px-3 py-2 bg-destructive/10">
            {error}
          </div>
        )}
        <Button
          onClick={(e) => onSubmit(e as any)}
          disabled={busy || !validAmount}
          className="w-full"
          size="lg"
        >
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Redirecting to PayPal…
            </>
          ) : mode === "one-time" ? (
            `Donate $${amount.toFixed(0)}`
          ) : (
            `Subscribe $${amount.toFixed(0)}/${interval.toLowerCase()}`
          )}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Payments are processed securely by PayPal. You’ll be redirected to approve the {mode}.
        </p>
      </CardFooter>
    </Card>
  );
}

/* ---------- subcomponents ---------- */

function AmountBlock({
  amount,
  setAmount,
}: {
  amount: number;
  setAmount: (n: number) => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-4 gap-2">
        {PRESETS.map((v) => (
          <Button
            key={v}
            variant={amount === v ? "default" : "outline"}
            onClick={() => setAmount(v)}
          >
            ${v}
          </Button>
        ))}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="customAmount">Custom amount</Label>
        <div className="flex items-center gap-2">
          <div className="rounded-md border px-3 py-2 text-sm bg-muted/30">$</div>
          <Input
            id="customAmount"
            type="number"
            inputMode="decimal"
            min={1}
            step={1}
            value={Number.isFinite(amount) ? amount : 1}
            onChange={(e) => {
              const n = parseFloat(e.currentTarget.value);
              setAmount(Number.isFinite(n) ? Math.max(1, n) : 1);
            }}
          />
        </div>
      </div>
    </div>
  );
}

function MessageBlock({
  message,
  setMessage,
}: {
  message: string;
  setMessage: (s: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="message">Message (optional)</Label>
      <Textarea
        id="message"
        placeholder="Add a note with your donation"
        value={message}
        onChange={(e) => setMessage(e.currentTarget.value)}
        rows={3}
      />
    </div>
  );
}

function RadioBox({
  value,
  label,
  checked,
}: {
  value: string;
  label: string;
  checked?: boolean;
}) {
  return (
    <div className={cn("border rounded-md p-2 flex items-center justify-center", checked ? "border-primary" : "")}>
      <RadioGroupItem value={value} id={`rg-${value}`} className="sr-only" />
      <Label htmlFor={`rg-${value}`} className="cursor-pointer select-none text-sm">
        {label}
      </Label>
    </div>
  );
}
