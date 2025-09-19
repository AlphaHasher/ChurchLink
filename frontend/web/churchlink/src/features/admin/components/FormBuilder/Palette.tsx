import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { useBuilderStore } from "./store";

const items = [
  { type: "text", label: "Text" },
  { type: "textarea", label: "Textarea" },
  { type: "number", label: "Number" },
  { type: "select", label: "Select" },
  { type: "radio", label: "Radio" },
  { type: "checkbox", label: "Checkbox" },
  { type: "date", label: "Date" },
] as const;

export function Palette() {
  const addField = useBuilderStore((s) => s.addField);
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Palette</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {items.map((it) => (
          <Button
            key={it.type}
            className="w-full justify-start"
            variant="secondary"
            onClick={() => addField(it.type as any)}
          >
            {it.label}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
