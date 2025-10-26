import { useMemo, useState } from "react";
import { Label } from "@/shared/components/ui/label";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/Dialog";
import MediaLibrary from "@/features/admin/pages/MediaLibrary";
import { getPublicUrl, getThumbnailUrl } from "@/helpers/MediaInteraction";
import type { ImageResponse } from "@/shared/types/ImageData";

interface DashboardImageSelectorProps {
  value?: string;
  onChange: (imageId: string) => void;
  label?: string;
  helperText?: string;
}

export function DashboardImageSelector({
  value,
  onChange,
  label = "Dashboard Page Image",
  helperText = "Choose an image from the media library. The image’s ID will be stored for this dashboard page."
}: DashboardImageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Build preview URLs only when we have an image ID
  const thumbUrl = useMemo(() => (value ? getThumbnailUrl(value) : ""), [value]);
  const fullUrl = useMemo(() => (value ? getPublicUrl(value) : ""), [value]);

  const handlePick = (asset: ImageResponse) => {
    onChange(asset.id); // store the chosen image_id
    setIsOpen(false);
  };

  const clearSelection = () => onChange("");

  return (
    <div className="space-y-2">
      <Label htmlFor="dashboard-image">{label}</Label>
      <small className="text-gray-500 text-xs block mb-1">{helperText}</small>

      <div className="flex items-center gap-3">
        {value ? (
          <a
            href={fullUrl}
            target="_blank"
            rel="noreferrer"
            className="block w-[96px] h-[72px] shrink-0 overflow-hidden rounded border border-gray-200 bg-gray-50"
            title="Open full image"
          >
            <img
              src={thumbUrl}
              alt="Dashboard image preview"
              className="w-full h-full object-cover"
            />
          </a>
        ) : (
          <div className="w-[96px] h-[72px] shrink-0 rounded border border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400">
            No image
          </div>
        )}

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setIsOpen(true)}>
            {value ? "Change image…" : "Select image…"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" onClick={clearSelection}>
              Remove
            </Button>
          )}
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle>Select or Upload Dashboard Image</DialogTitle>
          </DialogHeader>

          <div className="p-4 overflow-auto max-h-[75vh]">
            <MediaLibrary selectionMode onSelect={handlePick} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DashboardImageSelector;
