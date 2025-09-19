import { Controller, Control } from "react-hook-form";
import { AnyField, widthToCols } from "./types";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";

type Props = {
  field: AnyField;
  control: Control<any>;
  error?: string;
};

export function FieldRenderer({ field, control, error }: Props) {
  const colClass = cn("col-span-12", widthToCols(field.width));
  return (
    <div className={cn("flex flex-col gap-2", colClass)}>
      {field.label && (
        <Label htmlFor={field.name} className="text-sm font-medium">
          {field.label}
        </Label>
      )}

      <Controller
        name={field.name}
        control={control}
        render={({ field: rhf }) => {
          switch (field.type) {
            case "text":
              return (
                <Input id={field.name} placeholder={field.placeholder} {...rhf} />
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
            case "date":
              return (
                <Input id={field.name} type="date" value={rhf.value ?? ""} onChange={rhf.onChange} />
              );
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
