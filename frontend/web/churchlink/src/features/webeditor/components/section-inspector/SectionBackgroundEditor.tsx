import React from "react";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { ColorPicker, ColorPickerAlpha, ColorPickerHue, ColorPickerSelection, ColorPickerOutput } from "@/shared/components/ui/shadcn-io/color-picker";
import { NumericDragInput } from "@/shared/components/NumericDragInput";
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
      try { return value.string(); } catch {}
    }
    if (value && typeof value.hexa === 'function') {
      try { return value.hexa(); } catch {}
    }
    if (value && typeof value.hex === 'function') {
      try { return value.hex(); } catch {}
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
    hasBackground ? (isLinear ? 'gradient' : 'custom') : 'solid'
  );
  const [angle, setAngle] = React.useState<number>(parsedAngle);
  const [c1, setC1] = React.useState<string>(parsedC1);
  const [c2, setC2] = React.useState<string>(parsedC2);
  const [custom, setCustom] = React.useState<string>(hasBackground ? bgString : '');

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

  const handleSolidChange = React.useCallback((c: any) => {
    if (!open || skipInitialRef.current) return;
    const css = toCssColor(c);
    applySolid(css);
  }, [toCssColor, applySolid, open]);

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
          <SelectContent>
            <SelectItem value="solid">Solid</SelectItem>
            <SelectItem value="gradient">Gradient</SelectItem>
            <SelectItem value="custom">Custom CSS</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {mode === 'solid' && (
        <div className="space-y-2">
          <ColorPicker
            value={style.backgroundColor?.trim()?.length ? style.backgroundColor : '#ffffff'}
            onChange={handleSolidChange}
            className="flex flex-col gap-2"
          >
            <div className="grid grid-rows-[180px_1rem_1rem] gap-2">
              <ColorPickerSelection />
              <ColorPickerHue />
              <ColorPickerAlpha />
            </div>
            <div className="mt-1 flex items-center gap-2">
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
    </div>
  );
};

