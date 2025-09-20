import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Button } from "@/shared/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
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
        <div className="space-y-1">
          <Label>Width</Label>
          <Select value={field.width || "full"} onValueChange={(v) => onChange({ width: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="full">Full</SelectItem>
              <SelectItem value="half">Half</SelectItem>
              <SelectItem value="third">Third</SelectItem>
              <SelectItem value="quarter">Quarter</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox checked={!!field.required} onCheckedChange={(v) => onChange({ required: !!v })} />
          <Label>Required</Label>
        </div>
        {field.type === "number" && (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Min</Label>
              <Input type="number" value={(field as any).min ?? ""} onChange={(e) => onChange({ min: e.target.value === "" ? undefined : Number(e.target.value) } as any)} />
            </div>
            <div>
              <Label>Max</Label>
              <Input type="number" value={(field as any).max ?? ""} onChange={(e) => onChange({ max: e.target.value === "" ? undefined : Number(e.target.value) } as any)} />
            </div>
            <div>
              <Label>Step</Label>
              <Input type="number" value={(field as any).step ?? ""} onChange={(e) => onChange({ step: e.target.value === "" ? undefined : Number(e.target.value) } as any)} />
            </div>
          </div>
        )}
        {(field.type === "text" || field.type === "textarea") && (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Min length</Label>
              <Input type="number" value={(field as any).minLength ?? ""} onChange={(e) => onChange({ minLength: e.target.value === "" ? undefined : Number(e.target.value) } as any)} />
            </div>
            <div>
              <Label>Max length</Label>
              <Input type="number" value={(field as any).maxLength ?? ""} onChange={(e) => onChange({ maxLength: e.target.value === "" ? undefined : Number(e.target.value) } as any)} />
            </div>
            <div className="col-span-3">
              <Label>Pattern (regex)</Label>
              <Input value={(field as any).pattern ?? ""} onChange={(e) => onChange({ pattern: e.target.value } as any)} />
            </div>
          </div>
        )}
        {(field.type === "date") && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Min date</Label>
                <Input type="date" value={(field as any).minDate ?? ""} onChange={(e) => onChange({ minDate: e.target.value || undefined } as any)} />
              </div>
              <div>
                <Label>Max date</Label>
                <Input type="date" value={(field as any).maxDate ?? ""} onChange={(e) => onChange({ maxDate: e.target.value || undefined } as any)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Selection mode</Label>
              <Select value={(field as any).mode || "single"} onValueChange={(v) => onChange({ mode: v as any } as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single day</SelectItem>
                  <SelectItem value="range">Date range</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        {(field.type === "select") && (
          <div className="flex items-center gap-2">
            <Checkbox checked={(field as any).multiple ?? false} onCheckedChange={(v) => onChange({ multiple: !!v } as any)} />
            <Label>Allow multiple</Label>
          </div>
        )}
        <div className="space-y-1">
          <Label>Conditional visibility (e.g. subscribe == true)</Label>
          <Input value={field.visibleIf || ""} onChange={(e) => onChange({ visibleIf: e.target.value })} />
        </div>
        {renderOptions()}
      </CardContent>
    </Card>
  );
}
