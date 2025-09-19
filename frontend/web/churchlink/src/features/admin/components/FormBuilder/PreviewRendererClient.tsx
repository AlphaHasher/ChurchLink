import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { schemaToZodObject } from "./schemaGen";
import { FieldRenderer } from "./FieldRenderer";
import { useBuilderStore } from "./store";
import { Button } from "@/shared/components/ui/button";

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

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-12 gap-4">
      {schema.fields.filter((f) => isVisible(f.visibleIf)).map((f) => (
        <FieldRenderer key={f.id} field={f} control={form.control} error={(form.formState.errors as any)?.[f.name]?.message as string | undefined} />
      ))}
      <div className="col-span-12">
        <Button type="submit">Validate</Button>
      </div>
    </form>
  );
}
