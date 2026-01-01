import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/shared/components/ui/Dialog";
import { Save } from "lucide-react";

interface SaveAsTemplateButtonProps {
  componentData: {
    type: string;
    props: Record<string, unknown>;
  };
  onSave: (name: string, description?: string) => Promise<void>;
}

export function SaveAsTemplateButton({ componentData, onSave }: SaveAsTemplateButtonProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave(name.trim(), description.trim() || undefined);
      setOpen(false);
      setName("");
      setDescription("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save template";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setName("");
      setDescription("");
      setError(null);
    }
  };

  // Only show for ComponentBlock
  if (componentData.type !== "ComponentBlock") {
    return null;
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-full mt-2"
        onClick={() => setOpen(true)}
      >
        <Save className="w-4 h-4 mr-2" />
        Save as Template
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as Template</DialogTitle>
            <DialogDescription>
              Save this component as a reusable template. It will appear in the "Custom" category of the component picker.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Template Name</label>
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder="e.g., Hero with CTA"
                disabled={saving}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Description (optional)</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this template"
                disabled={saving}
              />
            </div>

            {error && (
              <div className="text-sm text-destructive">{error}</div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? "Saving..." : "Save Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
