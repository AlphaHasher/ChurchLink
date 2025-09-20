import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { schemaToZodObject } from "./schemaGen";
import { FieldRenderer } from "./FieldRenderer";
import { useBuilderStore, type BuilderState } from "./store";
import { Button } from "@/shared/components/ui/button";
import { useState } from 'react';

export function PreviewRenderer() {
  const schema = useBuilderStore((s: BuilderState) => s.schema);
  const zodSchema = schemaToZodObject(schema);
  const form = useForm({ resolver: zodResolver(zodSchema), defaultValues: {} });
  const values = form.watch();
  const [status, setStatus] = useState<string | null>(null);

  const isVisible = (visibleIf?: string): boolean => {
    if (!visibleIf) return true;
    // Parser: "name op literal" where op in == != >= <= > <
    const m = visibleIf.match(/^\s*(\w+)\s*(==|!=|>=|<=|>|<)\s*(.+)\s*$/);
    if (!m) return true;
    const [, name, op, rhsRaw] = m;
    const lhs = (values as any)?.[name];
    let rhs: any = rhsRaw;
  // normalize rhs: strip quotes, parse number/boolean
    if ((/^['"].*['"]$/).test(rhsRaw)) rhs = rhsRaw.slice(1, -1);
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
  {schema.data.filter((f) => isVisible(f.visibleIf)).map((f) => (
        <FieldRenderer key={f.id} field={f} control={form.control} />
      ))}
      <div className="col-span-12">
        <Button type="submit">Submit</Button>
        {status && <div className="text-sm text-muted-foreground mt-2">{status}</div>}
      </div>
    </form>
  );
}
