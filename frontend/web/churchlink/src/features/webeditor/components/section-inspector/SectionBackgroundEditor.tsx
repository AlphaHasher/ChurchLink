import React, { useEffect } from "react";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { ColorPicker, ColorPickerAlpha, ColorPickerHue, ColorPickerSelection, ColorPickerOutput } from "@/shared/components/ui/shadcn-io/color-picker";
import { NumericDragInput } from "@/shared/components/NumericDragInput";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/Dialog";
import { Separator } from "@/shared/components/ui/separator";
import { Input } from "@/shared/components/ui/input";
import MediaLibrary from "@/features/admin/pages/MediaLibrary";
import { getPublicUrl, getThumbnailUrl } from "@/helpers/MediaInteraction";
import type { ImageResponse } from "@/shared/types/ImageData";
import { SectionV2 } from "@/shared/types/pageV2";

interface SectionBackgroundEditorProps {
  section: SectionV2;
  open: boolean;
  onUpdate: (updater: React.SetStateAction<SectionV2[]>) => void;
}

export const SectionBackgroundEditor: React.FC<SectionBackgroundEditorProps> = ({
  section,
  open,
  onUpdate,
}) => {
  const style = (section?.background?.style || {}) as any;
  const bgString = String((style.background ?? style.backgroundImage ?? '') as string).trim();
  const hasBackground = bgString.length > 0;
  const isLinear = /linear-gradient\(/i.test(bgString);
  const isImageUrl = /url\(/i.test(bgString);

  // Extract image ID if background is set via our media library
  const extractImageId = React.useCallback((): string | null => {
    if (!isImageUrl) return null;
    // Match url("...") or url('...') or url(...)
    const match = bgString.match(/url\(['"]?([^'")]+)['"]?\)/i);
    if (!match) return null;
    const url = match[1];
    // Try to extract the image ID from our API URLs (e.g., /v1/assets/public/id/IMAGE_ID)
    const idMatch = url.match(/\/v1\/assets\/public\/id\/([a-f0-9]{24})/i);
    return idMatch ? idMatch[1] : null;
  }, [bgString, isImageUrl]);

  const extractColorOnly = React.useCallback((input: string | undefined): string => {
    if (!input) return '#4f46e5';
    const s = String(input).trim();
    const m = s.match(/(#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?|hsl|oklch|lab|lch)\([^\)]+\))/);
    if (m && m[1]) return m[1].trim();
    return s.split(/\s+/)[0];
  }, []);

  const toCssColor = React.useCallback((value: any): string => {
    if (typeof value === 'string') return value;
    if (value && typeof value.string === 'function') {
      try { return value.string(); } catch { }
    }
    if (value && typeof value.hexa === 'function') {
      try { return value.hexa(); } catch { }
    }
    if (value && typeof value.hex === 'function') {
      try { return value.hex(); } catch { }
    }
    return String(value ?? '');
  }, []);

  const parseLinearGradient = React.useCallback((): { angle: number; c1: string; c2: string } => {
    if (!isLinear) return { angle: 90, c1: '#4f46e5', c2: '#3b82f6' };
    const raw = bgString;
    const start = raw.toLowerCase().indexOf('linear-gradient(');
    const end = raw.lastIndexOf(')');
    if (start === -1 || end === -1) return { angle: 90, c1: '#4f46e5', c2: '#3b82f6' };
    const inner = raw.slice(start + 'linear-gradient('.length, end);
    const parts: string[] = [];
    let depth = 0; let buf = '';
    for (let i = 0; i < inner.length; i++) {
      const ch = inner[i];
      if (ch === '(') depth++;
      if (ch === ')') depth = Math.max(0, depth - 1);
      if (ch === ',' && depth === 0) { parts.push(buf.trim()); buf = ''; continue; }
      buf += ch;
    }
    if (buf.trim()) parts.push(buf.trim());

    const first = parts[0] || '';
    const isAngleToken = /deg|turn|rad|grad|^to\s+/i.test(first);
    const angleVal = (() => {
      if (!isAngleToken) return 90;
      const m = first.match(/([-+]?\d*\.?\d+)/);
      const n = m ? parseFloat(m[1]) : 90;
      return Number.isFinite(n) ? Math.max(0, Math.min(360, n)) : 90;
    })();

    const stop1 = isAngleToken ? (parts[1] || '#4f46e5') : (parts[0] || '#4f46e5');
    const stop2 = isAngleToken ? (parts[2] || '#3b82f6') : (parts[1] || '#3b82f6');
    return { angle: angleVal, c1: extractColorOnly(stop1), c2: extractColorOnly(stop2) };
  }, [isLinear, bgString, extractColorOnly]);

  const { angle: parsedAngle, c1: parsedC1, c2: parsedC2 } = React.useMemo(() => parseLinearGradient(), [parseLinearGradient]);

  const [mode, setMode] = React.useState<string>(
    hasBackground ? (isLinear ? 'gradient' : (isImageUrl ? 'image' : 'custom')) : 'solid'
  );
  const [angle, setAngle] = React.useState<number>(parsedAngle);
  const [c1, setC1] = React.useState<string>(parsedC1);
  const [c2, setC2] = React.useState<string>(parsedC2);
  const [custom, setCustom] = React.useState<string>(hasBackground ? bgString : '');
  const [imageId, setImageId] = React.useState<string>(extractImageId() || '');
  const [mediaModalOpen, setMediaModalOpen] = React.useState(false);
  const [bgSize, setBgSize] = React.useState<string>((style.backgroundSize as string) || 'cover');
  const [bgPosition, setBgPosition] = React.useState<string>((style.backgroundPosition as string) || 'center');
  const [bgRepeat, setBgRepeat] = React.useState<string>((style.backgroundRepeat as string) || 'no-repeat');
  const [brightness, setBrightness] = React.useState<number>(100);
  const [hexInput, setHexInput] = React.useState<string>(style.backgroundColor?.trim()?.length ? style.backgroundColor : '#ffffff');

  useEffect(() => {
    if (!open) return;
    const nextMode = hasBackground ? (isLinear ? 'gradient' : (isImageUrl ? 'image' : 'custom')) : 'solid';
    setMode(nextMode);
    setAngle(parsedAngle);
    setC1(parsedC1);
    setC2(parsedC2);
    const nextCustom = hasBackground ? bgString : '';
    setCustom(nextCustom);
    const nextImageId = extractImageId() || '';
    setImageId(nextImageId);

    // Parse filter property for brightness
    const filterStr = (style.filter as string) || '';
    const brightnessMatch = filterStr.match(/brightness\((\d+(?:\.\d+)?)%?\)/);
    setBrightness(brightnessMatch ? parseFloat(brightnessMatch[1]) : 100);
    
    // Sync hex input with background color
    const currentBgColor = style.backgroundColor?.trim()?.length ? style.backgroundColor : '#ffffff';
    setHexInput(currentBgColor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, section.id, hasBackground, isLinear, isImageUrl, parsedAngle, parsedC1, parsedC2, bgString, extractImageId]);

  // Ignore ColorPicker's initial notify on mount/open to prevent feedback loops
  const skipInitialRef = React.useRef(true);
  React.useEffect(() => {
    const id = window.setTimeout(() => {
      skipInitialRef.current = false;
    }, 0);
    return () => {
      window.clearTimeout(id);
      skipInitialRef.current = true;
    };
  }, []);

  // Schedule updates to avoid flooding React with state changes while dragging
  const scheduleRef = React.useRef<number | null>(null);
  const scheduleSetSections = React.useCallback((updater: React.SetStateAction<SectionV2[]>) => {
    if (scheduleRef.current) window.clearTimeout(scheduleRef.current);
    scheduleRef.current = window.setTimeout(() => {
      onUpdate(updater);
      scheduleRef.current = null;
    }, 16);
  }, [onUpdate]);
  React.useEffect(() => {
    return () => {
      if (scheduleRef.current) {
        window.clearTimeout(scheduleRef.current);
        scheduleRef.current = null;
      }
    };
  }, [section.id]);

  // Remove Tailwind background utilities
  const stripBgUtilities = React.useCallback((cls?: string): string | undefined => {
    if (!cls) return undefined;
    const cleaned = cls
      .split(/\s+/)
      .filter(Boolean)
      .filter((t) => !/^bg-/.test(t) && !/^from-/.test(t) && !/^via-/.test(t) && !/^to-/.test(t))
      .join(' ')
      .trim();
    return cleaned || undefined;
  }, []);

  const applySolid = React.useCallback((css: string) => {
    scheduleSetSections((prev) => {
      let changed = false;
      const next = prev.map((s) => {
        if (s.id !== section.id) return s;
        const current = (s.background?.style || {}) as any;
        if (current.backgroundColor === css && !current.background && !current.backgroundImage) return s;
        const { background, backgroundImage, ...rest } = current;
        const prevClass = (s.background?.className || '') as string;
        const nextClass = stripBgUtilities(prevClass);
        changed = true;
        return {
          ...s,
          background: {
            ...(s.background || {}),
            className: nextClass,
            style: { ...rest, backgroundColor: css },
          },
        } as SectionV2;
      });
      return changed ? next : prev;
    });
  }, [section.id, scheduleSetSections, stripBgUtilities]);

  const applyGradient = React.useCallback((nextAngle: number, nextC1: string, nextC2: string) => {
    const gradient = `linear-gradient(${Math.round(nextAngle)}deg, ${nextC1}, ${nextC2})`;
    scheduleSetSections((prev) => {
      let changed = false;
      const next = prev.map((s) => {
        if (s.id !== section.id) return s;
        const current = (s.background?.style || {}) as any;
        if (((current.background ?? current.backgroundImage) === gradient) && !current.backgroundColor) return s;
        const { backgroundColor, backgroundImage, ...rest } = current;
        const prevClass = (s.background?.className || '') as string;
        const nextClass = stripBgUtilities(prevClass);
        changed = true;
        return {
          ...s,
          background: {
            ...(s.background || {}),
            className: nextClass,
            style: { ...rest, background: gradient },
          },
        } as SectionV2;
      });
      return changed ? next : prev;
    });
  }, [section.id, scheduleSetSections, stripBgUtilities]);

  const applyCustom = React.useCallback((css: string) => {
    scheduleSetSections((prev) => {
      let changed = false;
      const next = prev.map((s) => {
        if (s.id !== section.id) return s;
        const current = (s.background?.style || {}) as any;
        if (((current.background ?? current.backgroundImage) === css) && !current.backgroundColor) return s;
        const { backgroundColor, backgroundImage, ...rest } = current;
        const prevClass = (s.background?.className || '') as string;
        const nextClass = stripBgUtilities(prevClass);
        changed = true;
        return {
          ...s,
          background: {
            ...(s.background || {}),
            className: nextClass,
            style: { ...rest, background: css },
          },
        } as SectionV2;
      });
      return changed ? next : prev;
    });
  }, [section.id, scheduleSetSections, stripBgUtilities]);

  const applyImage = React.useCallback((
    id: string,
    size?: string,
    position?: string,
    repeat?: string,
    bright?: number
  ) => {
    const imageUrl = getPublicUrl(id);
    const css = `url("${imageUrl}")`;
    const targetSize = size || bgSize;
    const targetPosition = position || bgPosition;
    const targetRepeat = repeat || bgRepeat;
    const targetBrightness = bright !== undefined ? bright : brightness;

    scheduleSetSections((prev) => {
      let changed = false;
      const next = prev.map((s) => {
        if (s.id !== section.id) return s;
        const current = (s.background?.style || {}) as any;
        const currentBg = current.background ?? current.backgroundImage ?? '';
        const currentSize = current.backgroundSize ?? 'cover';
        const currentPosition = current.backgroundPosition ?? 'center';
        const currentRepeat = current.backgroundRepeat ?? 'no-repeat';
        const currentBrightness = current['--bg-brightness'] ?? '100';

        // Skip if nothing changed
        if (currentBg === css &&
          currentSize === targetSize &&
          currentPosition === targetPosition &&
          currentRepeat === targetRepeat &&
          currentBrightness === String(targetBrightness) &&
          !current.backgroundColor) {
          return s;
        }

        const { backgroundColor, backgroundImage, ...rest } = current;
        const prevClass = (s.background?.className || '') as string;
        const nextClass = stripBgUtilities(prevClass);
        changed = true;

        const newStyle: any = {
          ...rest,
          backgroundImage: css,
          backgroundSize: targetSize,
          backgroundPosition: targetPosition,
          backgroundRepeat: targetRepeat,
          '--bg-brightness': String(targetBrightness),
        };

        return {
          ...s,
          background: {
            ...(s.background || {}),
            className: nextClass,
            style: newStyle,
          },
        } as SectionV2;
      });
      return changed ? next : prev;
    });
  }, [section.id, scheduleSetSections, stripBgUtilities, bgSize, bgPosition, bgRepeat, brightness]);

  const handleC1Change = React.useCallback((c: any) => {
    if (!open || skipInitialRef.current) return;
    const css = toCssColor(c);
    setC1(css);
    applyGradient(angle, css, c2);
  }, [toCssColor, applyGradient, angle, c2, open]);

  const handleC2Change = React.useCallback((c: any) => {
    if (!open || skipInitialRef.current) return;
    const css = toCssColor(c);
    setC2(css);
    applyGradient(angle, c1, css);
  }, [toCssColor, applyGradient, angle, c1, open]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Label className="min-w-24">Mode</Label>
        <Select value={mode} onValueChange={(v) => setMode(v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Mode" /></SelectTrigger>
          <SelectContent className="z-[1000]">
            <SelectItem value="solid">Solid</SelectItem>
            <SelectItem value="gradient">Gradient</SelectItem>
            <SelectItem value="image">Image</SelectItem>
            <SelectItem value="custom">Custom CSS</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {mode === 'solid' && (
        <div className="space-y-2">
          <ColorPicker
            value={style.backgroundColor?.trim()?.length ? style.backgroundColor : '#ffffff'}
            onChange={(c) => {
              if (!open || skipInitialRef.current) return;
              const css = toCssColor(c);
              applySolid(css);
            }}
            className="flex flex-col gap-2"
          >
            <div className="grid grid-rows-[180px_1rem_1rem] gap-2">
              <ColorPickerSelection />
              <ColorPickerHue />
              <ColorPickerAlpha 
                style={{
                  background: 'linear-gradient(to right, transparent, currentColor)',
                  boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)',
                }}
              />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Label htmlFor="bg-hex-input" className="text-xs whitespace-nowrap">Hex:</Label>
              <Input
                id="bg-hex-input"
                type="text"
                value={hexInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setHexInput(val);
                  // Only apply if valid hex format
                  if (/^#([0-9A-Fa-f]{3}){1,2}$/.test(val) || /^#([0-9A-Fa-f]{8})$/.test(val)) {
                    applySolid(val);
                  }
                }}
                className="h-8 text-xs font-mono"
                placeholder="#ffffff"
              />
            </div>
            <div className="flex items-center gap-2">
              <ColorPickerOutput />
            </div>
          </ColorPicker>
        </div>
      )}

      {mode === 'gradient' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Color 1</Label>
              <ColorPicker value={c1} onChange={handleC1Change} className="flex flex-col gap-2">
                <div className="grid grid-rows-[120px_1rem] gap-2">
                  <ColorPickerSelection />
                  <ColorPickerHue />
                </div>
              </ColorPicker>
            </div>
            <div className="space-y-1">
              <Label>Color 2</Label>
              <ColorPicker value={c2} onChange={handleC2Change} className="flex flex-col gap-2">
                <div className="grid grid-rows-[120px_1rem] gap-2">
                  <ColorPickerSelection />
                  <ColorPickerHue />
                </div>
              </ColorPicker>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sec-angle">Angle (deg)</Label>
            <NumericDragInput
              id="sec-angle"
              min={0}
              max={360}
              step={1}
              value={angle}
              onChange={(val) => {
                const next = typeof val === 'number' ? val : angle;
                setAngle(next);
                applyGradient(next, c1, c2);
              }}
            />
          </div>
        </div>
      )}

      {mode === 'image' && (
        <div className="space-y-3">
          <Label>Background Image</Label>
          {imageId && (
            <div className="relative w-full h-32 rounded border overflow-hidden">
              <img
                src={getThumbnailUrl(imageId)}
                alt="Background preview"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setMediaModalOpen(true)}
              className="flex-1"
            >
              {imageId ? 'Change Image' : 'Select Image'}
            </Button>
            {imageId && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setImageId('');
                  applySolid('#ffffff');
                  setMode('solid');
                }}
              >
                Remove
              </Button>
            )}
          </div>

          {imageId && (
            <>
              <div className="space-y-2">
                <Label htmlFor="bg-size">Size</Label>
                <Select value={bgSize} onValueChange={(v) => {
                  setBgSize(v);
                  applyImage(imageId, v, bgPosition, bgRepeat);
                }}>
                  <SelectTrigger id="bg-size"><SelectValue /></SelectTrigger>
                  <SelectContent side="bottom" align="start" sideOffset={4} className="z-[10000] max-h-[300px] overflow-y-auto">
                    <SelectItem value="cover">Cover (fill, crop if needed)</SelectItem>
                    <SelectItem value="contain">Contain (fit, show all)</SelectItem>
                    <SelectItem value="auto">Auto (original size)</SelectItem>
                    <SelectItem value="100% 100%">Stretch (distort to fit)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bg-position">Position</Label>
                <Select value={bgPosition} onValueChange={(v) => {
                  setBgPosition(v);
                  applyImage(imageId, bgSize, v, bgRepeat);
                }}>
                  <SelectTrigger id="bg-position"><SelectValue /></SelectTrigger>
                  <SelectContent side="bottom" align="start" sideOffset={4} className="z-[10000] max-h-[300px] overflow-y-auto">
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="top">Top</SelectItem>
                    <SelectItem value="bottom">Bottom</SelectItem>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                    <SelectItem value="top left">Top Left</SelectItem>
                    <SelectItem value="top right">Top Right</SelectItem>
                    <SelectItem value="bottom left">Bottom Left</SelectItem>
                    <SelectItem value="bottom right">Bottom Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bg-repeat">Repeat</Label>
                <Select value={bgRepeat} onValueChange={(v) => {
                  setBgRepeat(v);
                  applyImage(imageId, bgSize, bgPosition, v);
                }}>
                  <SelectTrigger id="bg-repeat"><SelectValue /></SelectTrigger>
                  <SelectContent side="bottom" align="start" sideOffset={4} className="z-[10000] max-h-[300px] overflow-y-auto">
                    <SelectItem value="no-repeat">No Repeat</SelectItem>
                    <SelectItem value="repeat">Repeat (tile pattern)</SelectItem>
                    <SelectItem value="repeat-x">Repeat Horizontal</SelectItem>
                    <SelectItem value="repeat-y">Repeat Vertical</SelectItem>
                    <SelectItem value="space">Space (with gaps)</SelectItem>
                    <SelectItem value="round">Round (stretch to fit)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator className="my-3" />

              <div className="space-y-2">
                <Label htmlFor="bg-brightness">Brightness (%)</Label>
                <NumericDragInput
                  id="bg-brightness"
                  min={0}
                  max={200}
                  step={5}
                  value={brightness}
                  onChange={(val) => {
                    const next = typeof val === 'number' ? val : brightness;
                    setBrightness(next);
                    applyImage(imageId, bgSize, bgPosition, bgRepeat, next);
                  }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {mode === 'custom' && (
        <div className="space-y-2">
          <Label htmlFor="sec-custom-bg">CSS background</Label>
          <input
            id="sec-custom-bg"
            className="w-full border rounded p-2 text-xs"
            placeholder="e.g. radial-gradient(...), conic-gradient(...), url(...), etc"
            value={custom}
            onChange={(e) => {
              const css = e.target.value;
              setCustom(css);
              applyCustom(css);
            }}
          />
        </div>
      )}

      {/* Media Library Dialog */}
      <Dialog open={mediaModalOpen} onOpenChange={setMediaModalOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle>Select Background Image</DialogTitle>
          </DialogHeader>
          <div className="p-4 overflow-auto max-h-[75vh]">
            <MediaLibrary
              selectionMode
              onSelect={(asset: ImageResponse) => {
                setImageId(asset.id);
                applyImage(asset.id, bgSize, bgPosition, bgRepeat);
                setMediaModalOpen(false);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

