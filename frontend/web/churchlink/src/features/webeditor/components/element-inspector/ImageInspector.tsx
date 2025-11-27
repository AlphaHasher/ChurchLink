import React from "react";
import { Node } from "@/shared/types/pageV2";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/Dialog";
import { Separator } from "@/shared/components/ui/separator";
import { NumericDragInput } from "@/shared/components/NumericDragInput";
import { BuilderState } from "@/features/webeditor/state/BuilderState";
import MediaLibrary from "@/features/admin/pages/MediaLibrary";
import { getThumbnailUrl } from "@/helpers/MediaInteraction";

type ImageInspectorProps = {
  node: Node;
  onUpdate: (updater: (node: Node) => Node) => void;
  activeLocale?: string;
  defaultLocale?: string;
};

function resolveLocalized(
  node: Node,
  key: string,
  activeLocale?: string,
  defaultLocale?: string
): any {
  const i18n = (node as any).i18n as
    | Record<string, Record<string, any>>
    | undefined;
  const locale = activeLocale || defaultLocale;
  if (locale && i18n && i18n[locale] && i18n[locale].hasOwnProperty(key))
    return i18n[locale][key];
  return (node as any).props?.[key];
}

export const ImageInspector: React.FC<ImageInspectorProps> = ({
  node,
  onUpdate,
  activeLocale,
  defaultLocale,
}) => {
  const prevRef = React.useRef<Node | null>(null);
  const [mediaModalOpen, setMediaModalOpen] = React.useState(false);
  const [imageError, setImageError] = React.useState(false);

  // current value is an **ID**, not a URL
  const currentId = (node?.props as any)?.src as string | undefined;
  const previewUrl = currentId ? getThumbnailUrl(currentId) : "";

  // Parse current filter for brightness only; ignore any legacy drop-shadow or crop
  const style = (node as any)?.style || {};
  const filterStr = String(style.filter || '').trim();
  const brightnessMatch = filterStr.match(/brightness\((\d+(?:\.\d+)?)%?\)/);
  const initialBrightness = brightnessMatch ? parseFloat(brightnessMatch[1]) : 100;

  const [brightness, setBrightness] = React.useState(initialBrightness);

  // Sync state when node changes
  React.useEffect(() => {
    setBrightness(initialBrightness);
    setImageError(false); // Reset error state when node or src changes
  }, [node.id, currentId]);

  const commitHistoryIfNeeded = React.useCallback(
    (nextNodeSnapshot?: Node) => {
      const sectionId = BuilderState.selection?.sectionId;
      const nodeId = BuilderState.selection?.nodeId;
      if (sectionId && nodeId && prevRef.current) {
        BuilderState.pushNode(sectionId, nodeId, prevRef.current, nextNodeSnapshot || (node as Node));
        prevRef.current = null;
      }
    },
    [node]
  );

  const applyBrightness = React.useCallback((bright: number) => {
    onUpdate((n) => {
      const s = { ...(n as any).style } as any;
      if (bright !== 100) {
        s.filter = `brightness(${bright}%)`;
      } else {
        if (s.filter && /brightness\(/.test(String(s.filter))) {
          // remove brightness; if only brightness remove filter entirely
          const remaining = String(s.filter).split(/\s+/).filter(p => !/brightness\(/.test(p));
          if (remaining.length > 0) s.filter = remaining.join(' '); else delete s.filter;
        }
      }
      if (s.clipPath) delete s.clipPath; // ensure crop removed
      return { ...n, style: s } as Node;
    });
  }, [onUpdate]);

  return (
    <div className="space-y-4">
      {/* Source (ID) */}
      <div className="space-y-2">
        <Label htmlFor="image-id">Image ID</Label>
        <Input
          id="image-id"
          value={currentId || ""}
          onChange={(e) =>
            onUpdate((n) =>
              n.type === "image"
                ? ({ ...n, props: { ...(n.props || {}), src: e.target.value } } as Node)
                : n
            )
          }
          onFocus={() => {
            prevRef.current = { ...(node as any) };
          }}
          onBlur={() => {
            commitHistoryIfNeeded();
          }}
          placeholder="Paste an image ID (e.g. 68f03d...)"
        />
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            type="button"
            onClick={() => setMediaModalOpen(true)}
          >
            Select from Library
          </Button>

          {/* Preview from ID */}
          {currentId && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Preview"
                className="h-16 w-24 object-cover rounded border"
                onError={() => setImageError(true)}
                onLoad={() => setImageError(false)}
              />
              {imageError && (
                <div className="absolute inset-0 flex items-center justify-center text-[11px] text-muted-foreground bg-muted/60 rounded">
                  Couldn’t load preview
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MediaLibrary modal (same pattern as Events) */}
      <Dialog open={mediaModalOpen} onOpenChange={setMediaModalOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle>Select Image</DialogTitle>
          </DialogHeader>
          <div className="p-4 overflow-auto max-h-[70vh]">
            <MediaLibrary
              selectionMode
              onSelect={(asset) => {
                // store the ID, not a URL
                const id = asset.id
                if (!id) return;
                onUpdate((n) =>
                  n.type === "image"
                    ? ({ ...n, props: { ...(n.props || {}), src: id } } as Node)
                    : n
                );
                setMediaModalOpen(false);
                setImageError(false);
                commitHistoryIfNeeded();
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Alt text (locale-aware) */}
      <div className="space-y-2">
        <Label htmlFor="image-alt">Alt Text</Label>
        <Input
          id="image-alt"
          value={resolveLocalized(node, "alt", activeLocale, defaultLocale) || ""}
          onChange={(e) =>
            onUpdate((n) => {
              if (n.type !== "image") return n;
              const useLocale =
                activeLocale && defaultLocale && activeLocale !== defaultLocale
                  ? activeLocale
                  : null;
              if (useLocale) {
                const prevI18n = ((n as any).i18n || {}) as Record<
                  string,
                  Record<string, any>
                >;
                const prevFor = prevI18n[useLocale] || {};
                return {
                  ...(n as any),
                  i18n: { ...prevI18n, [useLocale]: { ...prevFor, alt: e.target.value } },
                } as Node;
              }
              return {
                ...n,
                props: { ...(n.props || {}), alt: e.target.value },
              } as Node;
            })
          }
          onFocus={() => {
            prevRef.current = { ...(node as any) };
          }}
          onBlur={() => {
            commitHistoryIfNeeded();
          }}
          placeholder="Short description for accessibility"
        />
      </div>

      {/* Object-fit */}
      <div className="space-y-2">
        <Label>Object Fit</Label>
        <Select
          value={(node.props as any)?.objectFit || "cover"}
          onValueChange={(value) =>
            onUpdate((n) =>
              n.type === "image"
                ? ({ ...n, props: { ...(n.props || {}), objectFit: value } } as Node)
                : n
            )
          }
          onOpenChange={(open) => {
            if (open) {
              prevRef.current = { ...(node as any) };
            } else {
              commitHistoryIfNeeded();
            }
          }}
        >
          <SelectTrigger id="image-objectfit">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent side="bottom" align="start" sideOffset={4}>
            <SelectItem value="cover">cover</SelectItem>
            <SelectItem value="contain">contain</SelectItem>
            <SelectItem value="fill">fill</SelectItem>
            <SelectItem value="none">none</SelectItem>
            <SelectItem value="scale-down">scale-down</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator className="my-4" />

      {/* Brightness */}
      <div className="space-y-2">
        <Label htmlFor="image-brightness">Brightness (%)</Label>
        <NumericDragInput
          id="image-brightness"
          min={0}
          max={200}
          step={5}
          value={brightness}
          onChange={(val) => {
            const next = typeof val === 'number' ? val : brightness;
            setBrightness(next);
            applyBrightness(next);
          }}
        />
      </div>
      {/* Drop shadow & crop system removed */}
    </div>
  );
};

export default ImageInspector;
