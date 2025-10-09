import { useEffect } from "react";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Button } from "@/shared/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/shared/components/ui/popover";
import { Calendar } from "@/shared/components/ui/calendar";
import { useBuilderStore } from "./store";
import type { AnyField, SelectField } from "./types";
import { format } from "date-fns";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/shared/components/ui/hover-card";
import { Calendar as CalendarIcon, CircleHelp } from "lucide-react";
import { Table, TableBody, TableHead, TableRow, TableCell, TableHeader } from "@/shared/components/ui/DataTable";

const parseNonNegativeNumber = (raw: string, emptyValue?: number): number | undefined => {
  const trimmed = raw?.trim() ?? "";
  if (trimmed === "") return emptyValue;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return emptyValue;
  return Math.max(0, parsed);
};

export function Inspector() {
  const selectedId = useBuilderStore((s) => s.selectedId);
  const field = useBuilderStore((s) => s.schema.data.find((f) => f.id === s.selectedId));
  const update = useBuilderStore((s) => s.updateField);
  const updateOptions = useBuilderStore((s) => s.updateOptions);
  const addLocale = useBuilderStore((s) => s.addLocale);
  const removeLocale = useBuilderStore((s) => s.removeLocale);
  const schema = useBuilderStore((s) => s.schema);
  const schemaLocales = schema.locales || [];
  const defaultLocale = schema.defaultLocale || 'en';
  const availableLocales = (() => {
    const set = new Set<string>();
    if (defaultLocale) set.add(defaultLocale);
    for (const l of schemaLocales) set.add(l);
    const i18n = (field as any)?.i18n as Record<string, any> | undefined;
    if (i18n) Object.keys(i18n).forEach((k) => set.add(k));
    if ((field as any)?.type === 'select' || (field as any)?.type === 'radio') {
      const sel = field as SelectField;
      for (const o of (sel.options || [])) {
        const oi = (o as any)?.i18n as Record<string, any> | undefined;
        if (oi) Object.keys(oi).forEach((k) => set.add(k));
      }
    }
    return Array.from(set);
  })();

  if (!selectedId || !field) {
    return <div className="text-sm text-muted-foreground">Select a field to edit its properties</div>;
  }

  const onChange = (patch: Partial<AnyField>) => update(field.id, patch);

  useEffect(() => {
    if (field.type === 'static' && field.required) {
      update(field.id, { required: false });
    }
  }, [field.id, field.required, field.type, update]);

  const normalizeDateOnly = (value: Date | string | undefined): Date | null => {
    if (!value) return null;
    if (value instanceof Date) {
      return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }
    const datePortion = value.length > 10 ? value.slice(0, 10) : value;
    const parts = datePortion.split("-").map((part) => Number(part));
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
    const [year, month, day] = parts;
    return new Date(year, month - 1, day);
  };

  const currentMinDate = (field as any).minDate;
  const currentMaxDate = (field as any).maxDate;
  const minDateObj = normalizeDateOnly(currentMinDate) || undefined;
  const maxDateObj = normalizeDateOnly(currentMaxDate) || undefined;
  const minMaxLabel = (() => {
    if (minDateObj && maxDateObj) {
      return `${format(minDateObj, "PPP")} – ${format(maxDateObj, "PPP")}`;
    }
    if (minDateObj) {
      return `From ${format(minDateObj, "PPP")}`;
    }
    if (maxDateObj) {
      return `Until ${format(maxDateObj, "PPP")}`;
    }
    return "Set min / max dates";
  })();

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
                  {(availableLocales.length > 0) && (
                    <div className="mt-1 space-y-1">
                      <Label className="text-xs text-muted-foreground">Localized labels</Label>
                      {availableLocales.map((loc) => (
                        <div className="flex items-center gap-2" key={loc}>
                          <span className="text-xs w-10">{loc}</span>
                          <Input
                            placeholder={`Label (${loc})`}
                            value={o.i18n?.[loc]?.label ?? ''}
                            onChange={(e) => {
                              const next = [...sel.options] as any[];
                              const curr = next[idx];
                              const i18n = { ...(curr.i18n || {}) };
                              i18n[loc] = { ...(i18n[loc] || {}), label: e.target.value };
                              next[idx] = { ...curr, i18n };
                              updateOptions(field.id, next as any);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
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
                    min={0}
                    value={(o as any).price ?? ""}
                    onChange={(e) => {
                      const next = [...sel.options];
                      const price = parseNonNegativeNumber(e.target.value);
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
        {/* Localization controls for field texts (hidden for price fields) */}
        {field.type !== 'price' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Localization</Label>
            <div className="flex items-center gap-2">
              <Input
                className="h-8 w-24"
                placeholder="Add locale"
                onKeyDown={(e) => {
                  const v = (e.target as HTMLInputElement).value.trim();
                  if (e.key === 'Enter' && v) {
                    addLocale(v);
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
              />
            </div>
          </div>
          <div className="space-y-2">
            {availableLocales.map((loc) => (
              <div key={loc} className="border rounded p-2 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{loc}</div>
                  {loc !== defaultLocale && (
                    <Button size="sm" variant="ghost" onClick={() => removeLocale(loc)}>Remove</Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <Label className="text-xs">Label</Label>
                    <Input
                      value={(field as any).i18n?.[loc]?.label ?? ''}
                      onChange={(e) => {
                        const i18n = { ...((field as any).i18n || {}) };
                        i18n[loc] = { ...(i18n[loc] || {}), label: e.target.value };
                        update(field.id, { i18n } as any);
                      }}
                    />
                  </div>
                  {!['static', 'price', 'date', 'time'].includes((field as any).type) && (
                    <div>
                      <Label className="text-xs">Placeholder</Label>
                      <Input
                        value={(field as any).i18n?.[loc]?.placeholder ?? ''}
                        onChange={(e) => {
                          const i18n = { ...((field as any).i18n || {}) };
                          i18n[loc] = { ...(i18n[loc] || {}), placeholder: e.target.value };
                          update(field.id, { i18n } as any);
                        }}
                      />
                    </div>
                  )}
                  <div className="col-span-2">
                    <Label className="text-xs">Help text</Label>
                    <Input
                      value={(field as any).i18n?.[loc]?.helpText ?? ''}
                      onChange={(e) => {
                        const i18n = { ...((field as any).i18n || {}) };
                        i18n[loc] = { ...(i18n[loc] || {}), helpText: e.target.value };
                        update(field.id, { i18n } as any);
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          </div>
          )}
        {field.type === "static" && (
          <div className="space-y-2">
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
        {/* Removed base Label input; use Localization cards below to manage label per language */}
        {field.type !== 'price' && (
        <div className="space-y-1">
          <Label>Component Name</Label>
          <Input value={field.name} onChange={(e) => onChange({ name: e.target.value })} />
        </div>
        )}
        {/* Removed base Placeholder input; use Localization cards to manage placeholders per locale */}
        {field.type === "price" && (
          <div className="space-y-1">
            <Label>Amount</Label>
            <Input
              type="number"
              min={0}
              value={(field as any).amount ?? 0}
              onChange={(e) => {
                const amount = parseNonNegativeNumber(e.target.value, 0) ?? 0;
                onChange({ amount } as any);
              }}
            />
            <p className="text-xs text-muted-foreground">This field does not render; it only adds to the total when visible.</p>
          </div>
        )}
        {field.type !== 'price' && (
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
          <div className="flex items-center gap-2">
            <Checkbox checked={!!field.required} onCheckedChange={(v) => onChange({ required: !!v })} />
            <Label>Required</Label>
          </div>
        )}
        {(field.type === "checkbox" || field.type === "switch") && (
          <div className="space-y-1">
            <Label>Price when selected</Label>
            <Input
              type="number"
              min={0}
              value={(field as any).price ?? ""}
              onChange={(e) => {
                const price = parseNonNegativeNumber(e.target.value);
                onChange({ price } as any);
              }}
            />
          </div>
        )}
        {field.type === "number" && (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Min</Label>
              <Input type="number" value={(field as any).min ?? ""} onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  update(field.id, { min: undefined });
                  return;
                }
                const nextMin = Number(raw);
                update(field.id, { min: Number.isNaN(nextMin) ? undefined : nextMin });
              }} />
            </div>
            <div>
              <Label>Max</Label>
              <Input type="number" value={(field as any).max ?? ""} onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  update(field.id, { max: undefined });
                  return;
                }
                const nextMax = Number(raw);
                update(field.id, { max: Number.isNaN(nextMax) ? undefined : nextMax });
              }} />
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
              <Input type="number" value={(field as any).minLength ?? ""} onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  update(field.id, { minLength: undefined });
                  return;
                }
                const nextMin = Number(raw);
                update(field.id, { minLength: Number.isNaN(nextMin) ? undefined : nextMin });
              }} />
            </div>
            <div>
              <Label>Max length</Label>
              <Input type="number" value={(field as any).maxLength ?? ""} onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  update(field.id, { maxLength: undefined });
                  return;
                }
                const nextMax = Number(raw);
                update(field.id, { maxLength: Number.isNaN(nextMax) ? undefined : nextMax });
              }} />
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
              <Input type="time" value={(field as any).minTime ?? ""} onChange={(e) => {
                const raw = e.target.value;
                update(field.id, { minTime: raw || undefined });
              }} />
            </div>
            <div>
              <Label>Max time</Label>
              <Input type="time" value={(field as any).maxTime ?? ""} onChange={(e) => {
                const raw = e.target.value;
                update(field.id, { maxTime: raw || undefined });
              }} />
            </div>
          </div>
        )}
        {(field.type === "date") && (
          <div className="space-y-2">
            <div className="space-y-1">
              <Label>Min / Max date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <span className={minDateObj || maxDateObj ? "" : "text-muted-foreground"}>
                      {minMaxLabel}
                    </span>
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto space-y-2 p-3" align="start">
                  <Calendar
                    mode="range"
                    selected={
                      minDateObj
                        ? {
                            from: minDateObj,
                            to: maxDateObj ?? minDateObj,
                          }
                        : undefined
                    }
                    onSelect={(range: { from?: Date; to?: Date } | undefined) => {
                      if (!range || !range.from) {
                        update(field.id, { minDate: undefined, maxDate: undefined });
                        return;
                      }
                      const from = range.from;
                      const to = range.to ?? range.from;
                      update(field.id, {
                        minDate: format(from, "yyyy-MM-dd"),
                        maxDate: format(to, "yyyy-MM-dd"),
                      });
                    }}
                    initialFocus
                    captionLayout="dropdown"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-sm"
                      onClick={() => update(field.id, { minDate: undefined, maxDate: undefined })}
                    >
                      Clear
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
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
                      <Input
                        type="number"
                        min={0}
                        value={(field as any).pricing?.basePerDay ?? ""}
                        onChange={(e) => {
                          const basePerDay = parseNonNegativeNumber(e.target.value);
                          onChange({ pricing: { ...(field as any).pricing, basePerDay } } as any);
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Sunday price</Label>
                      <Input
                        type="number"
                        min={0}
                        value={(field as any).pricing?.weekdayOverrides?.[0] ?? ""}
                        onChange={(e) => {
                          const val = parseNonNegativeNumber(e.target.value);
                          onChange({ pricing: { ...(field as any).pricing, weekdayOverrides: { ...(field as any).pricing?.weekdayOverrides, 0: val } } } as any);
                        }}
                      />
                    </div>
                    <div>
                      <Label>Monday price</Label>
                      <Input
                        type="number"
                        min={0}
                        value={(field as any).pricing?.weekdayOverrides?.[1] ?? ""}
                        onChange={(e) => {
                          const val = parseNonNegativeNumber(e.target.value);
                          onChange({ pricing: { ...(field as any).pricing, weekdayOverrides: { ...(field as any).pricing?.weekdayOverrides, 1: val } } } as any);
                        }}
                      />
                    </div>
                    <div>
                      <Label>Tuesday price</Label>
                      <Input
                        type="number"
                        min={0}
                        value={(field as any).pricing?.weekdayOverrides?.[2] ?? ""}
                        onChange={(e) => {
                          const val = parseNonNegativeNumber(e.target.value);
                          onChange({ pricing: { ...(field as any).pricing, weekdayOverrides: { ...(field as any).pricing?.weekdayOverrides, 2: val } } } as any);
                        }}
                      />
                    </div>
                    <div>
                      <Label>Wednesday price</Label>
                      <Input
                        type="number"
                        min={0}
                        value={(field as any).pricing?.weekdayOverrides?.[3] ?? ""}
                        onChange={(e) => {
                          const val = parseNonNegativeNumber(e.target.value);
                          onChange({ pricing: { ...(field as any).pricing, weekdayOverrides: { ...(field as any).pricing?.weekdayOverrides, 3: val } } } as any);
                        }}
                      />
                    </div>
                    <div>
                      <Label>Thursday price</Label>
                      <Input
                        type="number"
                        min={0}
                        value={(field as any).pricing?.weekdayOverrides?.[4] ?? ""}
                        onChange={(e) => {
                          const val = parseNonNegativeNumber(e.target.value);
                          onChange({ pricing: { ...(field as any).pricing, weekdayOverrides: { ...(field as any).pricing?.weekdayOverrides, 4: val } } } as any);
                        }}
                      />
                    </div>
                    <div>
                      <Label>Friday price</Label>
                      <Input
                        type="number"
                        min={0}
                        value={(field as any).pricing?.weekdayOverrides?.[5] ?? ""}
                        onChange={(e) => {
                          const val = parseNonNegativeNumber(e.target.value);
                          onChange({ pricing: { ...(field as any).pricing, weekdayOverrides: { ...(field as any).pricing?.weekdayOverrides, 5: val } } } as any);
                        }}
                      />
                    </div>
                    <div>
                      <Label>Saturday price</Label>
                      <Input
                        type="number"
                        min={0}
                        value={(field as any).pricing?.weekdayOverrides?.[6] ?? ""}
                        onChange={(e) => {
                          const val = parseNonNegativeNumber(e.target.value);
                          onChange({ pricing: { ...(field as any).pricing, weekdayOverrides: { ...(field as any).pricing?.weekdayOverrides, 6: val } } } as any);
                        }}
                      />
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
                  <p>Syntax: <code>Component Name op value</code></p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Component Name</strong>: another field's name</li>
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
    </>
    )}
    {renderOptions()}
    </div>
  );
}
