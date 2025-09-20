import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Button } from "@/shared/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { useBuilderStore } from "./store";
import type { AnyField, SelectField } from "./types";
import { format } from "date-fns";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/shared/components/ui/hover-card";
import { CircleHelp } from "lucide-react";
import { Table, TableBody, TableHead, TableRow, TableCell, TableHeader } from "@/shared/components/ui/DataTable";

export function Inspector() {
  const selectedId = useBuilderStore((s) => s.selectedId);
  const field = useBuilderStore((s) => s.schema.fields.find((f) => f.id === s.selectedId));
  const update = useBuilderStore((s) => s.updateField);
  const updateOptions = useBuilderStore((s) => s.updateOptions);

  if (!selectedId || !field) {
    return <div className="text-sm text-muted-foreground">Select a field to edit its properties</div>;
  }

  const onChange = (patch: Partial<AnyField>) => update(field.id, patch);

  const renderOptions = () => {
    if (field.type !== "select" && field.type !== "radio") return null;
    const sel = field as SelectField;
    return (
      <div className="space-y-2">
        <Label>Options</Label>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Value</TableHead>
              <TableHead className="w-28">Price</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(sel.options || []).map((o, idx) => (
              <TableRow key={idx}>
                <TableCell>
                  <Input
                    placeholder="Label"
                    value={o.label}
                    onChange={(e) => {
                      const next = [...sel.options];
                      next[idx] = { ...next[idx], label: e.target.value };
                      updateOptions(field.id, next);
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    placeholder="Value"
                    value={o.value}
                    onChange={(e) => {
                      const next = [...sel.options];
                      next[idx] = { ...next[idx], value: e.target.value };
                      updateOptions(field.id, next);
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    placeholder="0"
                    value={(o as any).price ?? ""}
                    onChange={(e) => {
                      const next = [...sel.options];
                      const price = e.target.value === "" ? undefined : Number(e.target.value);
                      next[idx] = { ...next[idx], price } as any;
                      updateOptions(field.id, next);
                    }}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const next = sel.options.filter((_, i) => i !== idx);
                      updateOptions(field.id, next);
                    }}
                  >
                    Remove
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => updateOptions(field.id, [...(sel.options || []), { label: "New option", value: `value${(sel.options?.length || 0) + 1}` }])}
          >
            Add option
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
        {field.type === "static" && (
          <div className="space-y-2">
            <div className="space-y-1">
              <Label>Text content</Label>
              <Input value={(field as any).content || ""} onChange={(e) => onChange({ content: e.target.value } as any)} />
            </div>
            <div className="grid grid-cols-3 gap-2 items-end">
              <div className="space-y-1">
                <Label>As</Label>
                <Select value={(field as any).as || "p"} onValueChange={(v) => onChange({ as: v as any } as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="h1">H1</SelectItem>
                    <SelectItem value="h2">H2</SelectItem>
                    <SelectItem value="h3">H3</SelectItem>
                    <SelectItem value="h4">H4</SelectItem>
                    <SelectItem value="p">Paragraph</SelectItem>
                    <SelectItem value="small">Small</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Color</Label>
                <Input type="color" value={(field as any).color || "#000000"} onChange={(e) => onChange({ color: e.target.value } as any)} />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox checked={(field as any).bold || false} onCheckedChange={(v) => onChange({ bold: !!v } as any)} />
                  <Label>Bold</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox checked={(field as any).underline || false} onCheckedChange={(v) => onChange({ underline: !!v } as any)} />
                  <Label>Underline</Label>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="space-y-1">
          <Label>Label</Label>
          <Input value={field.label} onChange={(e) => onChange({ label: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Name</Label>
          <Input value={field.name} onChange={(e) => onChange({ name: e.target.value })} />
        </div>
        {field.type !== "static" && field.type !== "price" && (
          <div className="space-y-1">
            <Label>Placeholder</Label>
            <Input value={field.placeholder || ""} onChange={(e) => onChange({ placeholder: e.target.value })} />
          </div>
        )}
        {field.type === "price" && (
          <div className="space-y-1">
            <Label>Amount</Label>
            <Input type="number" value={(field as any).amount ?? 0}
                   onChange={(e) => onChange({ amount: e.target.value === "" ? 0 : Number(e.target.value) } as any)} />
            <p className="text-xs text-muted-foreground">This field does not render; it only adds to the total when visible.</p>
          </div>
        )}
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
        {(field.type === "checkbox" || field.type === "switch") && (
          <div className="space-y-1">
            <Label>Price when selected</Label>
            <Input type="number" value={(field as any).price ?? ""} onChange={(e) => onChange({ price: e.target.value === "" ? undefined : Number(e.target.value) } as any)} />
          </div>
        )}
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
            <div className="col-span-3">
              <Label>Allowed values (comma-separated)</Label>
              <Input value={(field as any).allowedValues ?? ""} onChange={(e) => onChange({ allowedValues: e.target.value } as any)} placeholder="e.g. 6,11,42" />
            </div>
          </div>
        )}
        {(field.type === "text" || field.type === "textarea" || field.type === "password") && (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Min length</Label>
              <Input type="number" value={(field as any).minLength ?? ""} onChange={(e) => onChange({ minLength: e.target.value === "" ? undefined : Number(e.target.value) } as any)} />
            </div>
            <div>
              <Label>Max length</Label>
              <Input type="number" value={(field as any).maxLength ?? ""} onChange={(e) => onChange({ maxLength: e.target.value === "" ? undefined : Number(e.target.value) } as any)} />
            </div>
            {(field.type === "text" || field.type === "textarea") && (
              <div className="col-span-3">
                <Label>Pattern (regex)</Label>
                <Input value={(field as any).pattern ?? ""} onChange={(e) => onChange({ pattern: e.target.value } as any)} />
              </div>
            )}
          </div>
        )}
        {field.type === "time" && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Min time</Label>
              <Input type="time" value={(field as any).minTime ?? ""} onChange={(e) => onChange({ minTime: e.target.value || undefined } as any)} />
            </div>
            <div>
              <Label>Max time</Label>
              <Input type="time" value={(field as any).maxTime ?? ""} onChange={(e) => onChange({ maxTime: e.target.value || undefined } as any)} />
            </div>
          </div>
        )}
        {(field.type === "date") && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Min date</Label>
                <Input
                  type="date"
                  value={(field as any).minDate ? format(new Date((field as any).minDate), "yyyy-MM-dd") : ""}
                  onChange={(e) => onChange({ minDate: e.target.value ? new Date(e.target.value) : undefined } as any)}
                />
              </div>
              <div>
                <Label>Max date</Label>
                <Input
                  type="date"
                  value={(field as any).maxDate ? format(new Date((field as any).maxDate), "yyyy-MM-dd") : ""}
                  onChange={(e) => onChange({ maxDate: e.target.value ? new Date(e.target.value) : undefined } as any)}
                />
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
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox checked={!!(field as any).pricing?.enabled} onCheckedChange={(v) => onChange({ pricing: { ...(field as any).pricing, enabled: !!v } } as any)} />
                <Label>Enable per-day pricing</Label>
              </div>
              {(field as any).pricing?.enabled && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Base price per day</Label>
                      <Input type="number" value={(field as any).pricing?.basePerDay ?? ""} onChange={(e) => onChange({ pricing: { ...(field as any).pricing, basePerDay: e.target.value === "" ? undefined : Number(e.target.value) } } as any)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Sunday price</Label>
                      <Input type="number" value={(field as any).pricing?.weekdayOverrides?.[0] ?? ""} onChange={(e) => onChange({ pricing: { ...(field as any).pricing, weekdayOverrides: { ...(field as any).pricing?.weekdayOverrides, 0: e.target.value === "" ? undefined : Number(e.target.value) } } } as any)} />
                    </div>
                    <div>
                      <Label>Monday price</Label>
                      <Input type="number" value={(field as any).pricing?.weekdayOverrides?.[1] ?? ""} onChange={(e) => onChange({ pricing: { ...(field as any).pricing, weekdayOverrides: { ...(field as any).pricing?.weekdayOverrides, 1: e.target.value === "" ? undefined : Number(e.target.value) } } } as any)} />
                    </div>
                    <div>
                      <Label>Tuesday price</Label>
                      <Input type="number" value={(field as any).pricing?.weekdayOverrides?.[2] ?? ""} onChange={(e) => onChange({ pricing: { ...(field as any).pricing, weekdayOverrides: { ...(field as any).pricing?.weekdayOverrides, 2: e.target.value === "" ? undefined : Number(e.target.value) } } } as any)} />
                    </div>
                    <div>
                      <Label>Wednesday price</Label>
                      <Input type="number" value={(field as any).pricing?.weekdayOverrides?.[3] ?? ""} onChange={(e) => onChange({ pricing: { ...(field as any).pricing, weekdayOverrides: { ...(field as any).pricing?.weekdayOverrides, 3: e.target.value === "" ? undefined : Number(e.target.value) } } } as any)} />
                    </div>
                    <div>
                      <Label>Thursday price</Label>
                      <Input type="number" value={(field as any).pricing?.weekdayOverrides?.[4] ?? ""} onChange={(e) => onChange({ pricing: { ...(field as any).pricing, weekdayOverrides: { ...(field as any).pricing?.weekdayOverrides, 4: e.target.value === "" ? undefined : Number(e.target.value) } } } as any)} />
                    </div>
                    <div>
                      <Label>Friday price</Label>
                      <Input type="number" value={(field as any).pricing?.weekdayOverrides?.[5] ?? ""} onChange={(e) => onChange({ pricing: { ...(field as any).pricing, weekdayOverrides: { ...(field as any).pricing?.weekdayOverrides, 5: e.target.value === "" ? undefined : Number(e.target.value) } } } as any)} />
                    </div>
                    <div>
                      <Label>Saturday price</Label>
                      <Input type="number" value={(field as any).pricing?.weekdayOverrides?.[6] ?? ""} onChange={(e) => onChange({ pricing: { ...(field as any).pricing, weekdayOverrides: { ...(field as any).pricing?.weekdayOverrides, 6: e.target.value === "" ? undefined : Number(e.target.value) } } } as any)} />
                    </div>
                  </div>
                </div>
              )}
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
          <div className="flex items-center gap-2">
            <Label>Conditional visibility</Label>
            <HoverCard>
              <HoverCardTrigger asChild>
                <button type="button" className="inline-flex items-center text-muted-foreground hover:text-foreground" aria-label="Conditional visibility help">
                  <CircleHelp className="h-4 w-4" />
                </button>
              </HoverCardTrigger>
              <HoverCardContent className="w-96" align="start">
                <div className="space-y-2 text-sm">
                  <p>Show this field only when a simple condition on another field is true.</p>
                  <p>Syntax: <code>name op value</code></p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>name</strong>: another field's name</li>
                    <li><strong>op</strong>: one of <code>==</code>, <code>!=</code>, <code>&gt;=</code>, <code>&lt;=</code>, <code>&gt;</code>, <code>&lt;</code></li>
                    <li><strong>value</strong>: number, boolean (<code>true</code>/<code>false</code>), or string (wrap in quotes)</li>
                  </ul>
                  <div className="space-y-1">
                    <p className="font-medium">Examples</p>
                    <pre className="rounded bg-muted p-2 text-xs">staff == true</pre>
                    <pre className="rounded bg-muted p-2 text-xs">age &gt;= 12</pre>
                    <pre className="rounded bg-muted p-2 text-xs">country == "US"</pre>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">Multiple conditions</p>
                    <p>Chain with <code>&amp;&amp;</code> (AND) or <code>||</code> (OR). Only first condition is parsed today; support for chaining is planned. For now, prefer one condition per field.</p>
                    <pre className="rounded bg-muted p-2 text-xs">subscribe == true &amp;&amp; age &gt;= 18</pre>
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          </div>
          <Input value={field.visibleIf || ""} onChange={(e) => onChange({ visibleIf: e.target.value })} placeholder='e.g. age > 12' />
        </div>
        {renderOptions()}
    </div>
  );
}
