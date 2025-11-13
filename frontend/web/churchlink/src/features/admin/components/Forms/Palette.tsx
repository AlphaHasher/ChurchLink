import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { useBuilderStore } from "./store";

const items = [
  { type: "static", label: "Static Text" },
  { type: "text", label: "Text" },
  { type: "textarea", label: "Textarea" },
  { type: "checkbox", label: "Checkbox" },
  { type: "tel", label: "Phone" },
  { type: "email", label: "Email" },
  { type: "url", label: "URL" },
  { type: "date", label: "Date" },
  { type: "number", label: "Number" },
  { type: "select", label: "Select" },
  { type: "radio", label: "Radio" },
  { type: "switch", label: "Switch" },
  { type: "time", label: "Time" },
  { type: "pricelabel", label: "Price (for label purpose)" },
  { type: "price", label: "Payment Method" },
] as const;

export function Palette() {
  const addField = useBuilderStore((s) => s.addField);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="p-3 pb-2">
        <CardTitle>Palette</CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0 flex flex-col gap-2 flex-1 overflow-y-auto">
        {items.map((it) => (
          <Button
            key={it.type}
            className="w-full justify-start truncate"
            variant="secondary"
            onClick={() => addField(it.type as any)}
            title={it.label}
          >
            {it.label}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
