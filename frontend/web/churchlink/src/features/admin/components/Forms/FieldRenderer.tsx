import type { ChangeEvent, CSSProperties } from "react";
import { Controller, Control } from "react-hook-form";
import { AnyField, widthToCols } from "./types";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Switch } from "@/shared/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { Button } from "@/shared/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Calendar } from "@/shared/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { normalizeDateOnly } from '@/helpers/DateHelper'
import { useBuilderStore } from "./store";

const PHONE_MAX_DIGITS = 10;
const NON_DIGIT_REGEX = /\D/g;

const normalizePhoneDigits = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.replace(NON_DIGIT_REGEX, "").slice(0, PHONE_MAX_DIGITS);
};

const formatPhoneDisplay = (value: unknown): string => {
  const digits = normalizePhoneDigits(value);
  if (!digits) return "";
  const area = digits.slice(0, 3);
  const prefix = digits.slice(3, 6);
  const line = digits.slice(6, 10);
  if (digits.length <= 3) {
    return `(${area}`;
  }
  if (digits.length <= 6) {
    return `(${area}) ${prefix}`;
  }
  return `(${area}) ${prefix}-${line}`;
};

const startOfDay = (date: Date | undefined): Date | undefined => {
  if (!date) return undefined;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

type Props = {
  field: AnyField;
  control: Control<any>;
  error?: string;
};

export function FieldRenderer({ field, control, error }: Props) {
  const colClass = cn("col-span-12", widthToCols(field.width));
  const activeLocale = useBuilderStore((s) => s.activeLocale);
  const allFields = useBuilderStore((s) => s.schema.data);
  const translations = useBuilderStore((s) => s.translations);
  

  // Handle price field separately to avoid double layout
  if (field.type === "price") {
    const priceField = field as any;
    let amount = priceField.amount || 0;
    
    // Calculate total from pricelabel fields if they exist
    const pricelabelFields = allFields.filter(f => f.type === 'pricelabel') as any[];
    const calculatedTotal = pricelabelFields.reduce((sum, f) => sum + (f.amount || 0), 0);
    
    // Use calculated total if pricelabel fields exist, otherwise use manual amount
    if (pricelabelFields.length > 0) {
      amount = calculatedTotal;
    }
    
    const paymentMethods = priceField.paymentMethods || {};
    const allowPayPal = paymentMethods.allowPayPal !== false; // default true
    const allowInPerson = paymentMethods.allowInPerson !== false; // default true
    const localizedLabel = priceField.label;

    // Determine UI behavior based on enabled payment methods
    const paypalOnly = allowPayPal && !allowInPerson;
    const inPersonOnly = !allowPayPal && allowInPerson;
    const bothEnabled = allowPayPal && allowInPerson;

    return (
      <div className={cn("flex flex-col gap-3", colClass)}>
        {/* Price field header */}
        {localizedLabel && (
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-1">
              <span>{localizedLabel}</span>
              {field.required ? <span className="text-destructive" aria-hidden>*</span> : null}
            </Label>
            <span className="text-lg font-semibold text-primary">
              ${amount.toFixed(2)}
            </span>
          </div>
        )}

        {/* Scenario 1: PayPal Only - Show PayPal info */}
        {paypalOnly && (
          <div className="border rounded-lg p-4 space-y-3 bg-blue-50">
            <div className="flex items-center gap-2 text-blue-700">
              <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
                <span className="text-white text-xs font-bold">P</span>
              </div>
              <span className="font-medium">PayPal Payment Required</span>
            </div>
            <p className="text-sm text-blue-600">
              This form requires payment through PayPal. You'll be redirected to PayPal to complete the payment when submitting.
            </p>
          </div>
        )}

        {/* Scenario 2: In-Person Only - Show note */}
        {inPersonOnly && (
          <div className="border rounded-lg p-4 space-y-3 bg-green-50">
            <div className="flex items-center gap-2 text-green-700">
              <div className="w-5 h-5 bg-green-600 rounded flex items-center justify-center">
                <span className="text-white text-xs">💵</span>
              </div>
              <span className="font-medium">In-Person Payment Required</span>
            </div>
            <p className="text-sm text-green-600">
              This payment will be collected in-person at the event or location.
              You can submit the form now and complete payment when you arrive.
            </p>
          </div>
        )}

        {/* Scenario 3: Both Enabled - Show selection options */}
        {bothEnabled && (
          <div className="border rounded-lg p-4 space-y-3">
            <div className="text-sm font-medium mb-2">Choose Payment Method:</div>

            <Controller
              name={`${field.name}_payment_method`}
              control={control}
              defaultValue="paypal"
              render={({ field: rhf }) => (
                <div className="space-y-2">
                  {/* PayPal Option */}
                  <label className="flex items-center gap-3 p-2 border rounded-md cursor-pointer hover:bg-muted/20 transition-colors">
                    <input
                      type="radio"
                      name={rhf.name}
                      value="paypal"
                      checked={rhf.value === 'paypal'}
                      onChange={() => rhf.onChange('paypal')}
                      className="w-4 h-4"
                    />
                    <div className="flex items-center gap-2 flex-1">
                      <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
                        <span className="text-white text-xs font-bold">P</span>
                      </div>
                      <span className="text-sm font-medium">Pay with PayPal</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        (Secure online payment)
                      </span>
                    </div>
                  </label>

                  {/* In-Person Option */}
                  <label className="flex items-center gap-3 p-2 border rounded-md cursor-pointer hover:bg-muted/20 transition-colors">
                    <input
                      type="radio"
                      name={rhf.name}
                      value="in-person"
                      checked={rhf.value === 'in-person'}
                      onChange={() => rhf.onChange('in-person')}
                      className="w-4 h-4"
                    />
                    <div className="flex items-center gap-2 flex-1">
                      <div className="w-5 h-5 bg-green-600 rounded flex items-center justify-center">
                        <span className="text-white text-xs">💵</span>
                      </div>
                      <span className="text-sm font-medium">Pay In-Person</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        (Pay at location)
                      </span>
                    </div>
                  </label>
                </div>
              )}
            />

            <div className="text-xs text-muted-foreground text-center pt-2 border-t">
              Submit button will adapt based on your selection
            </div>
          </div>
        )}

        {/* No payment methods configured */}
        {!allowPayPal && !allowInPerson && (
          <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
            ⚠️ No payment methods configured
          </div>
        )}

        {error && <p className="text-xs text-destructive">{String(error)}</p>}
      </div>
    );
  }
  
  // Handle pricelabel field separately for display
  if (field.type === "pricelabel") {
    const pricelabelField = field as any;
    const amount = pricelabelField.amount || 0;
    
    const t = (key: 'label', base?: string) => {
      // If no active locale or it's English, return base
      if (!activeLocale || activeLocale === 'en') return base;
      
      // Get translations for this field
      const fieldTranslations = translations[field.id]?.[activeLocale];
      if (!fieldTranslations) return base;
      
      // Check if translation exists
      const val = (fieldTranslations as any)[key];
      return (val != null && val !== '') ? val : base;
    };
    
    const localizedLabel = t('label', pricelabelField.label);
    
    return (
      <div className={cn("flex items-center justify-between py-2", colClass)}>
        <Label className="text-sm font-medium">
          {localizedLabel || "Price Component"}
        </Label>
        <span className="text-lg font-semibold text-primary">
          ${amount.toFixed(2)}
        </span>
      </div>
    );
  }
  

  const t = (key: 'label' | 'placeholder' | 'helpText' | 'content', base?: string) => {
    // If no active locale or it's English, return base
    if (!activeLocale || activeLocale === 'en') return base;

    // Get translations for this field
    const fieldTranslations = translations[field.id]?.[activeLocale];
    if (!fieldTranslations) return base;

    // For helpText and content, check if it exists in the translations
    const val = (fieldTranslations as any)[key];
    return (val != null && val !== '') ? val : base;
  };

  const tOption = (optionIdx: number, base: string) => {
    // If no active locale or it's English, return base
    if (!activeLocale || activeLocale === 'en') return base;

    // Get translations for this field's options
    const fieldTranslations = translations[field.id]?.[activeLocale];
    if (!fieldTranslations) return base;

    const val = (fieldTranslations as any)[`option_${optionIdx}`];
    return (val != null && val !== '') ? val : base;
  };

  const localizedLabel = t('label', field.label);
  const localizedPlaceholder = t('placeholder', (field as any).placeholder);
  const localizedHelp = t('helpText', (field as any).helpText);
  if (field.type === "static") {
    const f: any = field as any;
    const Tag = (f.as || "p") as any;
    const sizeClass = (() => {
      switch (f.as) {
        case "h1":
          return "text-4xl";
        case "h2":
          return "text-3xl";
        case "h3":
          return "text-2xl";
        case "h4":
          return "text-xl";
        case "small":
          return "text-sm";
        case "p":
        default:
          return "text-base";
      }
    })();
    const baseStyle: CSSProperties = {
      color: f.color || undefined,
      fontWeight: f.bold ? 600 : undefined,
    };
    const staticText = t('content', f.content) || "Modify Me!";
    return (
      <div className={cn("flex flex-col gap-2", colClass)}>
        <Tag
          className={cn(sizeClass, "whitespace-pre-wrap")}
          style={{ ...baseStyle, whiteSpace: 'pre-wrap' }}
        >
          {staticText}
        </Tag>
        {localizedHelp && (
          <p className="text-sm text-muted-foreground">{localizedHelp}</p>
        )}
      </div>
    );
  }
  return (
    <div className={cn("flex flex-col gap-2", colClass)}>
      {localizedLabel && (
        <Label htmlFor={field.name} className="text-sm font-medium flex items-center gap-1">
          <span>{localizedLabel}</span>
          {field.required ? <span className="text-destructive" aria-hidden>*</span> : null}
        </Label>
      )}

      <Controller
        name={field.name}
        control={control}
        render={({ field: rhf }) => {
          switch (field.type) {
            case "text":
              return (
                <Input id={field.name} placeholder={localizedPlaceholder} {...rhf} />
              );
            case "email":
              return (
                <Input id={field.name} type="email" placeholder={localizedPlaceholder || "you@example.com"} {...rhf} />
              );
            case "url":
              return (
                <Input id={field.name} type="url" placeholder={localizedPlaceholder || "https://"} {...rhf} />
              );
            case "tel": {
              const handlePhoneChange = (event: ChangeEvent<HTMLInputElement>) => {
                const digits = normalizePhoneDigits(event.target.value);
                rhf.onChange(digits || undefined);
              };
              return (
                <Input
                  id={field.name}
                  type="tel"
                  inputMode="tel"
                  placeholder={localizedPlaceholder || "(555) 123-4567"}
                  value={formatPhoneDisplay(rhf.value)}
                  onChange={handlePhoneChange}
                  onBlur={rhf.onBlur}
                  name={rhf.name}
                  ref={rhf.ref}
                  maxLength={14}
                />
              );
            }
            case "textarea":
              return (
                <Textarea id={field.name} placeholder={localizedPlaceholder} {...rhf} />
              );
            case "number":
              return (
                <Input
                  id={field.name}
                  type="number"
                  placeholder={localizedPlaceholder}
                  min={(field as any).min}
                  max={(field as any).max}
                  step={(field as any).step}
                  value={rhf.value ?? ""}
                  onChange={(e) => rhf.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                />
              );
            case "checkbox":
              return (
                <div className="flex items-center gap-2">
                  <Checkbox id={field.name} checked={!!rhf.value} onCheckedChange={rhf.onChange} />
                  {localizedPlaceholder && (
                    <Label htmlFor={field.name} className="text-sm text-muted-foreground">
                      {localizedPlaceholder}
                    </Label>
                  )}
                </div>
              );
            case "switch":
              return (
                <div className="flex items-center gap-2">
                  <Switch checked={!!rhf.value} onCheckedChange={rhf.onChange} id={field.name} />
                  <Label htmlFor={field.name} className="text-sm text-muted-foreground">
                    {rhf.value ? ((field as any).onText || localizedPlaceholder) : ((field as any).offText || localizedPlaceholder)}
                  </Label>
                </div>
              );
            case "select": {
              const f: any = field as any;
              const opts = f.options || [];
              const safeOpts = opts.filter((o: any) => (o?.value ?? "").toString().trim() !== "");
              if (f.multiple) {
                const current: string[] = Array.isArray(rhf.value) ? rhf.value : [];
                const toggle = (val: string, checked: boolean) => {
                  const next = checked ? [...current, val] : current.filter((v) => v !== val);
                  rhf.onChange(next);
                };
                return (
                  <div className="flex flex-col gap-2">
                    {safeOpts.map((o: any, idx: number) => (
                      <label key={o.value} className="flex items-center gap-2">
                        <Checkbox
                          checked={current.includes(o.value)}
                          onCheckedChange={(v) => toggle(o.value, !!v)}
                        />
                        <span>{tOption(idx, o.label)}</span>
                      </label>
                    ))}
                  </div>
                );
              }
              return (
                <Select value={rhf.value} onValueChange={rhf.onChange}>
                  <SelectTrigger id={field.name}>
                    <SelectValue placeholder={localizedPlaceholder || "Choose"} />
                  </SelectTrigger>
                  <SelectContent>
                    {safeOpts.map((o: any, idx: number) => (
                      <SelectItem key={o.value} value={o.value}>
                        {tOption(idx, o.label)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );
            }
            case "radio": {
              const opts = (field as any).options || [];
              return (
                <RadioGroup value={rhf.value} onValueChange={rhf.onChange}>
                  {opts.map((o: any, idx: number) => (
                    <div className="flex items-center space-x-2" key={o.value}>
                      <RadioGroupItem id={`${field.name}-${o.value}`} value={o.value} />
                      <Label htmlFor={`${field.name}-${o.value}`}>{tOption(idx, o.label)}</Label>
                    </div>
                  ))}
                </RadioGroup>
              );
            }
            case "date": {
              const f: any = field as any;
              const mode = f.mode || "single";
              const minDate = normalizeDateOnly(f.minDate);
              const maxDate = normalizeDateOnly(f.maxDate);
              const disabled = (date: Date) => {
                const day = startOfDay(date);
                if (!day) return false;
                if (minDate && day.getTime() < minDate.getTime()) return true;
                if (maxDate && day.getTime() > maxDate.getTime()) return true;
                return false;
              };

              if (mode === "range") {
                const raw = (rhf.value as { from?: Date; to?: Date } | undefined) || {};
                const selected = {
                  from: startOfDay(raw.from),
                  to: startOfDay(raw.to),
                };
                const label = selected.from && selected.to
                  ? `${format(selected.from, "PPP")} – ${format(selected.to, "PPP")}`
                  : selected.from
                    ? `${format(selected.from, "PPP")} – …`
                    : field.placeholder || "Pick a date range";
                const selectedRange = selected.from ? selected : undefined;
                return (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("justify-start", !selected.from && "text-muted-foreground")}>
                        {label}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="range"
                        selected={selectedRange as any}
                        onSelect={(r: { from?: Date; to?: Date } | undefined) => {
                          if (!r || !r.from) {
                            rhf.onChange(undefined);
                            return;
                          }
                          rhf.onChange({
                            from: startOfDay(r.from),
                            to: startOfDay(r.to),
                          });
                        }}
                        disabled={disabled}
                        captionLayout="dropdown"
                      />
                    </PopoverContent>
                  </Popover>
                );
              }


              const selectedDate: Date | undefined = startOfDay(rhf.value as Date | undefined);
              return (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("justify-start", !selectedDate && "text-muted-foreground")}
                    >
                      {selectedDate ? format(selectedDate, "PPP") : (field.placeholder || "Pick a date")}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(d: Date | undefined) => rhf.onChange(startOfDay(d))}
                      disabled={disabled}
                      captionLayout="dropdown"
                    />
                  </PopoverContent>
                </Popover>
              );
            }
            case "time": {
              const val: string | undefined = rhf.value;
              return (
                <Input
                  id={field.name}
                  type="time"
                  value={val ?? ""}
                  onChange={(e) => rhf.onChange(e.target.value || undefined)}
                  min={(field as any).minTime}
                  max={(field as any).maxTime}
                />
              );
            }
            default:
              return <div />;
          }
        }}
      />

      {localizedHelp && (
        <p className="text-xs text-muted-foreground">{localizedHelp}</p>
      )}
      {error && <p className="text-xs text-destructive">{String(error)}</p>}
    </div>
  );
}
