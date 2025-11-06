import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Button } from "@/shared/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/shared/components/ui/toggle-group";
import { Textarea } from "@/shared/components/ui/textarea";
import { useBuilderStore } from "./store";
import type { AnyField, SelectField } from "./types";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/shared/components/ui/hover-card";
import { CircleHelp } from "lucide-react";
import { Table, TableBody, TableHead, TableRow, TableCell, TableHeader } from "@/shared/components/ui/DataTable";
import { TranslationsPanel } from "./TranslationsPanel";

export function Inspector() {
  const selectedId = useBuilderStore((s) => s.selectedId);
  const field = useBuilderStore((s) => s.schema.data.find((f) => f.id === s.selectedId));
  const allFields = useBuilderStore((s) => s.schema.data);
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
            <Textarea value={(field as any).content || ""} onChange={(e) => onChange({ content: e.target.value } as any)} placeholder="Enter static text content" className="resize-none" rows={4} />
          </div>
          <div className="grid grid-cols-3 gap-2 items-end">
            <div className="space-y-1 min-w-0">
              <Label>As</Label>
              <Select value={(field as any).as || "p"} onValueChange={(v) => onChange({ as: v as any } as any)}>
                <SelectTrigger className="w-full min-w-0"><SelectValue /></SelectTrigger>
                <SelectContent className="w-[var(--radix-select-trigger-width)]">
                  <SelectItem value="h1">H1</SelectItem>
                  <SelectItem value="h2">H2</SelectItem>
                  <SelectItem value="h3">H3</SelectItem>
                  <SelectItem value="h4">H4</SelectItem>
                  <SelectItem value="p">Paragraph</SelectItem>
                  <SelectItem value="small">Small</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 min-w-0">
              <Label>Color</Label>
              <Input
                type="color"
                value={(field as any).color || "#000000"}
                onChange={(e) => onChange({ color: e.target.value } as any)}
                className="w-full min-w-0"
              />
            </div>

            <div className="space-y-1 min-w-0">
              <Label>Style</Label>
              <ToggleGroup
                type="multiple"
                value={[(field as any).bold ? "bold" : "", (field as any).underline ? "underline" : ""].filter(Boolean)}
                onValueChange={(values) =>
                  onChange({ bold: values.includes("bold"), underline: values.includes("underline") } as any)
                }
                className="w-full justify-start"
              >
                <ToggleGroupItem value="bold" aria-label="Bold" size="sm">
                  <span className="font-bold">B</span>
                </ToggleGroupItem>
                <ToggleGroupItem value="underline" aria-label="Underline" size="sm">
                  <span className="underline">U</span>
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </div>
      )}
      {/* English (base) label - always editable */}
      {field.type !== 'static' && field.type !== 'price' && (
        <div className="space-y-1">
          <Label>Label (English)</Label>
          <Input value={field.label || ""} onChange={(e) => onChange({ label: e.target.value })} placeholder="Enter field label" />
        </div>
      )}

      {/* English (base) placeholder - always editable for applicable field types */}
      {(field.type === "text" ||
        field.type === "email" ||
        field.type === "url" ||
        field.type === "tel" ||
        field.type === "textarea" ||
        field.type === "number") && (
          <div className="space-y-1">
            <Label>Placeholder (English)</Label>
            <Input value={field.placeholder || ""} onChange={(e) => onChange({ placeholder: e.target.value })} placeholder="Enter placeholder text" />
          </div>
        )}
      {field.type !== 'price' && field.type !== 'pricelabel' && (
        <div className="space-y-1">
          <Label>Component Name</Label>
          <Input value={field.name} onChange={(e) => onChange({ name: e.target.value })} />
        </div>
      )}
      {field.type === "price" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Amount</Label>
            {(() => {
              // Calculate total from pricelabel fields
              const pricelabelFields = allFields.filter(f => f.type === 'pricelabel') as any[];
              const calculatedTotal = pricelabelFields.reduce((sum, f) => sum + (f.amount || 0), 0);
              const hasPricelabelFields = pricelabelFields.length > 0;
              
              if (hasPricelabelFields) {
                return (
                  <div className="space-y-2">
                    <div className="p-3 bg-muted rounded-md">
                      <div className="text-sm font-medium text-muted-foreground mb-2">
                        Calculated from price components:
                      </div>
                      <div className="text-2xl font-bold text-primary">
                        ${calculatedTotal.toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-2 space-y-1">
                        <div>{pricelabelFields.length} price component{pricelabelFields.length === 1 ? '' : 's'} found:</div>
                        {pricelabelFields.map((pf, idx) => (
                          <div key={pf.id} className="flex justify-between text-xs">
                            <span>• {pf.label || `Component ${idx + 1}`}</span>
                            <span>${(pf.amount || 0).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        onChange({ amount: calculatedTotal } as any);
                      }}
                    >
                      Apply Calculated Total (${calculatedTotal.toFixed(2)})
                    </Button>
                  </div>
                );
              } else {
                return (
                  <div className="space-y-2">
                    <Input 
                      type="number" 
                      value={(field as any).amount ?? 0}
                      onChange={(e) => onChange({ amount: e.target.value === "" ? 0 : Number(e.target.value) } as any)} 
                    />
                    <p className="text-xs text-muted-foreground">
                      Manual entry mode - no price components found. Add price components for automatic calculation.
                    </p>
                  </div>
                );
              }
            })()}
          </div>

          <div className="space-y-2">
            <Label>Payment Methods</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={!!((field as any).paymentMethods?.allowPayPal ?? true)}
                  onCheckedChange={(v) => {
                    const current = (field as any).paymentMethods || {};
                    const newAllowPayPal = !!v;
                    let newAllowInPerson = current.allowInPerson ?? true;
                    // If toggling off and both would be false, force the other to true
                    if (!newAllowPayPal && !newAllowInPerson) {
                      newAllowInPerson = true;
                    }
                    onChange({
                      paymentMethods: {
                        ...current,
                        allowPayPal: newAllowPayPal,
                        allowInPerson: newAllowInPerson,
                      }
                    } as any);
                  }}
                />
                <Label>Allow PayPal Payment</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={!!((field as any).paymentMethods?.allowInPerson ?? true)}
                  onCheckedChange={(v) => {
                    const current = (field as any).paymentMethods || {};
                    const newAllowInPerson = !!v;
                    let newAllowPayPal = current.allowPayPal ?? true;
                    // If toggling off and both would be false, force the other to true
                    if (!newAllowInPerson && !newAllowPayPal) {
                      newAllowPayPal = true;
                    }
                    onChange({
                      paymentMethods: {
                        ...current,
                        allowInPerson: newAllowInPerson,
                        allowPayPal: newAllowPayPal,
                      }
                    } as any);
                  }}
                />
                <Label>Allow In-Person Payment</Label>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Configure which payment methods are available for this price field. At least one method should be enabled.
            </p>
          </div>
        </div>
      )}

      {field.type === "pricelabel" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Amount</Label>
            <Input type="number" value={(field as any).amount ?? 0}
              onChange={(e) => onChange({ amount: e.target.value === "" ? 0 : Number(e.target.value) } as any)} />
            <p className="text-xs text-muted-foreground">This is a display field that shows an individual price component.</p>
          </div>
        </div>
      )}

      {field.type !== 'price' && field.type !== 'pricelabel' && (
        <>
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
          {field.type !== 'static' && (
            <ToggleGroup
              type="single"
              value={field.required ? "required" : ""}
              onValueChange={(value) => {
                onChange({ required: value === "required" });
              }}
              className="w-full justify-start"
            >
              <ToggleGroupItem value="required" aria-label="Required" size="sm">
                Required
              </ToggleGroupItem>
            </ToggleGroup>
          )}
          {(field.type === "checkbox" || field.type === "switch") && (
            <div className="space-y-1">
              <Label>Price when selected</Label>
              <Input type="number" value={(field as any).price ?? ""} onChange={(e) => onChange({ price: e.target.value === "" ? undefined : Number(e.target.value) } as any)} />
            </div>
          )}
          {field.type === "switch" && (
            <div className="space-y-1 border-t pt-3">
              <Label>On/Off Text</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">On Text</Label>
                  <Input value={(field as any).onText || ""} onChange={(e) => onChange({ onText: e.target.value } as any)} placeholder="e.g., Yes" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Off Text</Label>
                  <Input value={(field as any).offText || ""} onChange={(e) => onChange({ offText: e.target.value } as any)} placeholder="e.g., No" />
                </div>
              </div>
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
                    value={(field as any).minDate || ""}
                    onChange={(e) => onChange({ minDate: e.target.value || undefined } as any)}
                  />
                </div>
                <div>
                  <Label>Max date</Label>
                  <Input
                    type="date"
                    value={(field as any).maxDate || ""}
                    onChange={(e) => onChange({ maxDate: e.target.value || undefined } as any)} />
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
                <HoverCardContent className="w-[420px] max-w-[90vw]" align="start">
                  <div className="space-y-2 text-sm">
                    <p>Show this field only when conditions on other fields are true. Chain as many conditions as needed.</p>
                    <p>Syntax: <code>Component Name op value</code></p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li><strong>Component Name</strong>: another field's name</li>
                      <li><strong>op</strong>: one of <code>==</code>, <code>!=</code>, <code>&gt;=</code>, <code>&lt;=</code>, <code>&gt;</code>, <code>&lt;</code></li>
                      <li><strong>value</strong>: number, boolean (<code>true</code>/<code>false</code>), or string (wrap in quotes)</li>
                    </ul>
                    <div className="space-y-1">
                      <p className="font-medium">Single condition examples</p>
                      <pre className="rounded bg-muted p-2 text-xs overflow-x-auto">staff == true</pre>
                      <pre className="rounded bg-muted p-2 text-xs overflow-x-auto">age &gt;= 18</pre>
                      <pre className="rounded bg-muted p-2 text-xs overflow-x-auto">country == "USA"</pre>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">Multiple conditions (unlimited chaining)</p>
                      <p>Chain with <code>&amp;&amp;</code> (AND) or <code>||</code> (OR). AND has higher precedence:</p>
                      <pre className="rounded bg-muted p-2 text-xs overflow-x-auto">age &gt;= 18 &amp;&amp; subscribe == true</pre>
                      <pre className="rounded bg-muted p-2 text-xs overflow-x-auto">country == "USA" || country == "Canada" || country == "Mexico"</pre>
                      <pre className="rounded bg-muted p-2 text-xs overflow-x-auto">age &gt;= 18 &amp;&amp; member == true || admin == true</pre>
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div>
            <Input value={field.visibleIf || ""} onChange={(e) => onChange({ visibleIf: e.target.value })} placeholder='e.g. age >= 18 && subscribe == true' />
          </div>
        </>
      )}
      {renderOptions()}
      {field.type !== 'price' && (
        <div className="border-t pt-3">
          <TranslationsPanel field={field} />
        </div>
      )}
    </div>
  );
}
