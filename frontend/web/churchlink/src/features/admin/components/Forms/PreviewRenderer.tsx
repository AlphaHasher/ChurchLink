import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { schemaToZodObject } from "./schemaGen";
import { FieldRenderer } from "./FieldRenderer";
import { useBuilderStore, type BuilderState } from "./store";
import { Button } from "@/shared/components/ui/button";
import { useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { getBoundsViolations } from "./validation";

export function PreviewRenderer() {
  const schema = useBuilderStore((s: BuilderState) => s.schema);
  const boundsViolations = useMemo(() => getBoundsViolations(schema), [schema]);
  const zodSchema = schemaToZodObject(schema); // always build schema
  const form = useForm({ resolver: zodResolver(zodSchema), defaultValues: {} }); // always init form
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
      {/* Language selector removed here; kept in Live Preview card header */}
      {/* Hidden required fields errors */}
      {(() => {
        const errs: Record<string, any> = (form.formState.errors as any) || {};
        const msgs: string[] = [];
        for (const f of schema.data) {
          const e = errs?.[f.name];
          if (!e) continue;
          const vis = isVisible((f as any).visibleIf);
          if (!vis && e?.message) msgs.push(e.message as string);
        }
        return msgs.length > 0 ? (
          <div className="col-span-12">
            <Alert variant="destructive">
              <AlertTitle>Some required fields are missing</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-5">
                  {msgs.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        ) : null;
      })()}

      {schema.data.filter((f) => isVisible(f.visibleIf)).map((f) => (
        <FieldRenderer
          key={f.id}
          field={f}
          control={form.control}
          error={(form.formState.errors as any)?.[f.name]?.message as string | undefined}
        />
      ))}
      <div className="col-span-12">
        <Button type="submit">Submit</Button>
        {status && <div className="text-sm text-muted-foreground mt-2">{status}</div>}
      </div>
    </form>
  );
}
