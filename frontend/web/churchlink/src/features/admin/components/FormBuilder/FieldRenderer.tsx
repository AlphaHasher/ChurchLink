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

type Props = {
  field: AnyField;
  control: Control<any>;
  error?: string;
};

export function FieldRenderer({ field, control, error }: Props) {
  const colClass = cn("col-span-12", widthToCols(field.width));
  return (
    <div className={cn("flex flex-col gap-2", colClass)}>
      {field.type !== "static" && field.label && (
        <Label htmlFor={field.name} className="text-sm font-medium flex items-center gap-1">
          <span>{field.label}</span>
          {field.required ? <span className="text-destructive" aria-hidden>*</span> : null}
        </Label>
      )}

      <Controller
        name={field.name}
        control={control}
        render={({ field: rhf }) => {
          switch (field.type) {
            case "static": {
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
              const style: React.CSSProperties = {
                color: f.color || undefined,
                fontWeight: f.bold ? 600 : undefined,
                textDecoration: f.underline ? "underline" : undefined,
              };
              return <Tag className={sizeClass} style={style}>{f.content || f.label}</Tag>;
            }
            case "text":
              return (
                <Input id={field.name} placeholder={field.placeholder} {...rhf} />
              );
            case "email":
              return (
                <Input id={field.name} type="email" placeholder={field.placeholder || "you@example.com"} {...rhf} />
              );
            case "url":
              return (
                <Input id={field.name} type="url" placeholder={field.placeholder || "https://"} {...rhf} />
              );
            case "tel":
              return (
                <Input id={field.name} type="tel" placeholder={field.placeholder || "+1 (555) 123-4567"} {...rhf} />
              );
            case "textarea":
              return (
                <Textarea id={field.name} placeholder={field.placeholder} {...rhf} />
              );
            case "number":
              return (
                <Input
                  id={field.name}
                  type="number"
                  placeholder={field.placeholder}
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
                  {field.placeholder && (
                    <Label htmlFor={field.name} className="text-sm text-muted-foreground">
                      {field.placeholder}
                    </Label>
                  )}
                </div>
              );
            case "switch":
              return (
                <div className="flex items-center gap-2">
                  <Switch checked={!!rhf.value} onCheckedChange={rhf.onChange} id={field.name} />
                  {field.placeholder && (
                    <Label htmlFor={field.name} className="text-sm text-muted-foreground">
                      {field.placeholder}
                    </Label>
                  )}
                </div>
              );
            case "select": {
              const f: any = field as any;
              const opts = f.options || [];
              if (f.multiple) {
                const current: string[] = Array.isArray(rhf.value) ? rhf.value : [];
                const toggle = (val: string, checked: boolean) => {
                  const next = checked ? [...current, val] : current.filter((v) => v !== val);
                  rhf.onChange(next);
                };
                return (
                  <div className="flex flex-col gap-2">
                    {opts.map((o: any) => (
                      <label key={o.value} className="flex items-center gap-2">
                        <Checkbox
                          checked={current.includes(o.value)}
                          onCheckedChange={(v) => toggle(o.value, !!v)}
                        />
                        <span>{o.label}</span>
                      </label>
                    ))}
                  </div>
                );
              }
              return (
                <Select value={rhf.value} onValueChange={rhf.onChange}>
                  <SelectTrigger id={field.name}>
                    <SelectValue placeholder={field.placeholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {opts.map((o: any) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
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
                  {opts.map((o: any) => (
                    <div className="flex items-center space-x-2" key={o.value}>
                      <RadioGroupItem id={`${field.name}-${o.value}`} value={o.value} />
                      <Label htmlFor={`${field.name}-${o.value}`}>{o.label}</Label>
                    </div>
                  ))}
                </RadioGroup>
              );
            }
            case "date": {
              const f: any = field as any;
              const mode = f.mode || "single";
              const minDate: Date | undefined = f.minDate;
              const maxDate: Date | undefined = f.maxDate;
              const disabled = (date: Date) => {
                if (minDate && date < minDate) return true;
                if (maxDate && date > maxDate) return true;
                return false;
              };

              if (mode === "range") {
                // Expect rhf.value as { from?: Date; to?: Date }
                const selected = (rhf.value as { from?: Date; to?: Date } | undefined) || {};
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
                            from: r.from,
                            to: r.to,
                          });
                        }}
                        disabled={disabled}
                        captionLayout="dropdown"
                      />
                    </PopoverContent>
                  </Popover>
                );
              }

              // single mode: value is Date | undefined
              const selectedDate: Date | undefined = rhf.value;
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
                      onSelect={(d: Date | undefined) => rhf.onChange(d)}
                      disabled={disabled}
                      captionLayout="dropdown"
                    />
                  </PopoverContent>
                </Popover>
              );
            }
            case "time": {
              // Expect HH:MM string
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

      {field.helpText && (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      )}
      {error && <p className="text-xs text-destructive">{String(error)}</p>}
    </div>
  );
}
