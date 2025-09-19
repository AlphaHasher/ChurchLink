import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Button } from "@/shared/components/ui/button";
import { useBuilderStore } from "./store";
import type { AnyField, SelectField } from "./types";

export function Inspector() {
  const selectedId = useBuilderStore((s) => s.selectedId);
  const field = useBuilderStore((s) => s.schema.fields.find((f) => f.id === s.selectedId));
  const update = useBuilderStore((s) => s.updateField);
  const updateOptions = useBuilderStore((s) => s.updateOptions);

  if (!selectedId || !field) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Inspector</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Select a field to edit its properties</CardContent>
      </Card>
    );
  }

  const onChange = (patch: Partial<AnyField>) => update(field.id, patch);

  const renderOptions = () => {
    if (field.type !== "select" && field.type !== "radio") return null;
    const sel = field as SelectField;
    return (
      <div className="space-y-2">
        <Label>Options</Label>
        {sel.options?.map((o, idx) => (
          <div key={idx} className="flex gap-2">
            <Input
              placeholder="Label"
              value={o.label}
              onChange={(e) => {
                const next = [...sel.options];
                next[idx] = { ...next[idx], label: e.target.value };
                updateOptions(field.id, next);
              }}
            />
            <Input
              placeholder="Value"
              value={o.value}
              onChange={(e) => {
                const next = [...sel.options];
                next[idx] = { ...next[idx], value: e.target.value };
                updateOptions(field.id, next);
              }}
            />
            <Button
              variant="ghost"
              onClick={() => {
                const next = sel.options.filter((_, i) => i !== idx);
                updateOptions(field.id, next);
              }}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          variant="secondary"
          onClick={() => updateOptions(field.id, [...(sel.options || []), { label: "New option", value: `value${(sel.options?.length || 0) + 1}` }])}
        >
          Add option
        </Button>
      </div>
    );
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Inspector</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label>Label</Label>
          <Input value={field.label} onChange={(e) => onChange({ label: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Name</Label>
          <Input value={field.name} onChange={(e) => onChange({ name: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Placeholder</Label>
          <Input value={field.placeholder || ""} onChange={(e) => onChange({ placeholder: e.target.value })} />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox checked={!!field.required} onCheckedChange={(v) => onChange({ required: !!v })} />
          <Label>Required</Label>
        </div>
        {renderOptions()}
      </CardContent>
    </Card>
  );
}
