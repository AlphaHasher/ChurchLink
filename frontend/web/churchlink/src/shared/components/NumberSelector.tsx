import * as React from "react";

import { cn } from "@/lib/utils";
import { Input } from "@/shared/components/ui/input";

type ModifierLikeEvent = Pick<React.PointerEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>, "shiftKey" | "altKey">;

export type NumberSelectorProps = {
  value: number;
  onChange: (value: number) => void;
  /** Optional callback fired when a drag interaction completes. */
  onChangeEnd?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  shiftMultiplier?: number;
  altMultiplier?: number;
  clampOnBlur?: boolean;
  dragCursorClassName?: string;
  transformValue?: (value: number) => number;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">;

export const NumberSelector = React.forwardRef<HTMLInputElement, NumberSelectorProps>(
  (
    {
      value,
      onChange,
      onChangeEnd,
      min,
      max,
      step = 1,
      shiftMultiplier = 10,
      altMultiplier = 0.1,
      clampOnBlur = true,
      dragCursorClassName = "cursor-ew-resize",
      transformValue,
      className,
      disabled,
      ...restProps
    },
    ref
  ) => {
    const {
      onBlur: externalOnBlur,
      onFocus: externalOnFocus,
      onPointerDown: externalOnPointerDown,
      onPointerMove: externalOnPointerMove,
      onPointerUp: externalOnPointerUp,
      onPointerCancel: externalOnPointerCancel,
      onPointerLeave: externalOnPointerLeave,
      onKeyDown: externalOnKeyDown,
      onWheel: externalOnWheel,
      ...inputProps
    } = restProps;

    const [local, setLocal] = React.useState<number>(value ?? 0);
    const [dragging, setDragging] = React.useState(false);
    const startRef = React.useRef<{ x: number; y: number; value: number } | null>(null);
    const pointerIdRef = React.useRef<number | null>(null);
    const latestValueRef = React.useRef<number>(value ?? 0);
    const hasCapturedRef = React.useRef(false);
    const DRAG_THRESHOLD_PX = 5;

    React.useEffect(() => {
      if (!dragging) {
        setLocal(value ?? 0);
      }
      latestValueRef.current = value ?? 0;
    }, [value, dragging]);

    const clampValue = React.useCallback(
      (next: number) => {
        let result = next;
        if (typeof min === "number") result = Math.max(min, result);
        if (typeof max === "number") result = Math.min(max, result);
        return result;
      },
      [min, max]
    );

    const applyTransform = React.useCallback(
      (next: number) => {
        if (typeof transformValue === "function") {
          try {
            const result = transformValue(next);
            if (!Number.isFinite(result)) {
              return next;
            }
            return result;
          } catch {
            return next;
          }
        }
        return next;
      },
      [transformValue]
    );

    const emitChange = React.useCallback(
      (next: number) => {
        const transformed = applyTransform(next);
        const clamped = clampValue(transformed);
        if (clamped !== latestValueRef.current) {
          latestValueRef.current = clamped;
          onChange(clamped);
        }
        setLocal(clamped);
        return clamped;
      },
      [applyTransform, clampValue, onChange]
    );

    const getModifierMultiplier = React.useCallback(
      (event: ModifierLikeEvent) => {
        if (event.shiftKey) return shiftMultiplier;
        if (event.altKey) return altMultiplier;
        return 1;
      },
      [shiftMultiplier, altMultiplier]
    );

    const handleInputChange = React.useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const parsed = Number(event.target.value);
        if (Number.isFinite(parsed)) {
          emitChange(parsed);
        } else {
          // Revert the displayed value if the input is not a finite number.
          setLocal(latestValueRef.current);
        }
      },
      [emitChange]
    );

    const beginPotentialDrag = React.useCallback(
      (event: React.PointerEvent<HTMLInputElement>) => {
        if (disabled) return;
        pointerIdRef.current = event.pointerId;
        startRef.current = { x: event.clientX, y: event.clientY, value: latestValueRef.current };
        hasCapturedRef.current = false;
      },
      [disabled]
    );

    const finishDrag = React.useCallback(
      (event?: React.PointerEvent<HTMLInputElement>) => {
        if (pointerIdRef.current !== null && event) {
          const target = event.currentTarget as HTMLElement;
          if (target.hasPointerCapture(pointerIdRef.current)) {
            target.releasePointerCapture(pointerIdRef.current);
          }
        }
        pointerIdRef.current = null;
        startRef.current = null;
        hasCapturedRef.current = false;
        if (dragging) {
          setDragging(false);
          onChangeEnd?.(latestValueRef.current);
        }
      },
      [dragging, onChangeEnd]
    );

    const handlePointerDown = React.useCallback(
      (event: React.PointerEvent<HTMLInputElement>) => {
        beginPotentialDrag(event);
        externalOnPointerDown?.(event);
        // Intentionally do not prevent default here so the input can focus and steppers work
      },
      [beginPotentialDrag, externalOnPointerDown]
    );

    const handlePointerMove = React.useCallback(
      (event: React.PointerEvent<HTMLInputElement>) => {
        externalOnPointerMove?.(event);
        if (!startRef.current) return;

        const dx = event.clientX - startRef.current.x;
        const dy = event.clientY - startRef.current.y;
        const distance = Math.hypot(dx, dy);

        if (!dragging) {
          if (distance >= DRAG_THRESHOLD_PX) {
            setDragging(true);
            if (!hasCapturedRef.current) {
              (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
              hasCapturedRef.current = true;
            }
          } else {
            return;
          }
        }

        const delta = (dx - dy) * (step ?? 1) * getModifierMultiplier(event);
        emitChange(startRef.current.value + delta);

        event.preventDefault();
        event.stopPropagation();
      },
      [dragging, step, getModifierMultiplier, emitChange, externalOnPointerMove]
    );

    const handlePointerUp = React.useCallback(
      (event: React.PointerEvent<HTMLInputElement>) => {
        externalOnPointerUp?.(event);
        finishDrag(event);
      },
      [externalOnPointerUp, finishDrag]
    );

    const handlePointerCancel = React.useCallback(
      (event: React.PointerEvent<HTMLInputElement>) => {
        externalOnPointerCancel?.(event);
        finishDrag(event);
      },
      [externalOnPointerCancel, finishDrag]
    );

    const handlePointerLeave = React.useCallback(
      (event: React.PointerEvent<HTMLInputElement>) => {
        externalOnPointerLeave?.(event);
        if (dragging) {
          finishDrag(event);
        }
      },
      [externalOnPointerLeave, finishDrag, dragging]
    );

    const handleBlur = React.useCallback(
      (event: React.FocusEvent<HTMLInputElement>) => {
        if (clampOnBlur) {
          const clamped = clampValue(latestValueRef.current);
          if (clamped !== latestValueRef.current) {
            emitChange(clamped);
          } else {
            setLocal(clamped);
          }
        }
        externalOnBlur?.(event);
      },
      [clampOnBlur, clampValue, emitChange, externalOnBlur]
    );

    const handleFocus = React.useCallback(
      (event: React.FocusEvent<HTMLInputElement>) => {
        externalOnFocus?.(event);
      },
      [externalOnFocus]
    );

    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLInputElement>) => {
        let handled = false;

        if (!disabled) {
          if (event.key === "ArrowUp" || event.key === "ArrowRight") {
            emitChange(latestValueRef.current + (step ?? 1) * getModifierMultiplier(event));
            handled = true;
          } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
            emitChange(latestValueRef.current - (step ?? 1) * getModifierMultiplier(event));
            handled = true;
          } else if (event.key === "Home" && typeof min === "number") {
            emitChange(min);
            handled = true;
          } else if (event.key === "End" && typeof max === "number") {
            emitChange(max);
            handled = true;
          }
        }

        if (handled) {
          event.preventDefault();
          event.stopPropagation();
        }

        externalOnKeyDown?.(event);
      },
      [disabled, emitChange, getModifierMultiplier, min, max, step, externalOnKeyDown]
    );

    const handleWheel = React.useCallback(
      (event: React.WheelEvent<HTMLInputElement>) => {
        if (!disabled && (event.shiftKey || event.altKey)) {
          event.preventDefault();
          event.stopPropagation();
          const deltaDirection = event.deltaY < 0 ? 1 : -1;
          emitChange(
            latestValueRef.current + deltaDirection * (step ?? 1) * getModifierMultiplier(event)
          );
        }

        externalOnWheel?.(event);
      },
      [disabled, emitChange, getModifierMultiplier, step, externalOnWheel]
    );

    return (
      <Input
        ref={ref}
        type="number"
        value={Number.isFinite(local) ? local : 0}
        onChange={handleInputChange}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerLeave}
        onBlur={handleBlur}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        onWheel={handleWheel}
        disabled={disabled}
        step={step}
        inputMode="decimal"
        data-dragging={dragging ? "true" : undefined}
        className={cn(dragCursorClassName, dragging && "select-none", className)}
        {...inputProps}
      />
    );
  }
);

NumberSelector.displayName = "NumberSelector";


