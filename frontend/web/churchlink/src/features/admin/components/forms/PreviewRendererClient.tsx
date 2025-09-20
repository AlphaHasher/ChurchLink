import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { schemaToZodObject } from "./schemaGen";
import { FieldRenderer } from "./FieldRenderer";
import { useBuilderStore } from "./store";
import { Button } from "@/shared/components/ui/button";
import type { AnyField, DateField, SelectField } from "./types";
import { format } from "date-fns";

export function PreviewRendererClient() {
  const schema = useBuilderStore((s) => s.schema);
  const zodSchema = schemaToZodObject(schema);
  const form = useForm({ resolver: zodResolver(zodSchema), defaultValues: {} });
  const values = form.watch();

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

  const onSubmit = form.handleSubmit((data: any) => {
    console.log("Preview submit", data);
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

  return (
  <form onSubmit={onSubmit} className="grid grid-cols-12 gap-4">
  {schema.data.filter((f) => isVisible(f.visibleIf)).map((f) => (
        <FieldRenderer key={f.id} field={f} control={form.control} error={(form.formState.errors as any)?.[f.name]?.message as string | undefined} />
      ))}
      <div className="col-span-12">
        <Button type="submit">Validate</Button>
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
  );
}
