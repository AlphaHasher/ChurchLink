import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"

function inferSizeFromClassName(className?: string): number | null {
  if (!className) return null;
  if (/(?:^|\s)(h|size)-3(?!\d)/.test(className)) return 12;
  if (/(?:^|\s)(h|size)-4(?!\d)/.test(className)) return 16;
  if (/(?:^|\s)(h|size)-5(?!\d)/.test(className)) return 20;
  if (/(?:^|\s)(h|size)-6(?!\d)/.test(className)) return 24;
  if (/(?:^|\s)(h|size)-7(?!\d)/.test(className)) return 28;
  if (/(?:^|\s)(h|size)-8(?!\d)/.test(className)) return 32;
  return null;
}


const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
  
>(({ className, ...props }, ref) => (



  <CheckboxPrimitive.Root ref={ref} asChild {...props}>
    <motion.button
      type="button"
      className={cn(
        "peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary",
        className
      )}
      initial={false}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: "spring", stiffness: 600, damping: 28 }}
    >
      <CheckboxPrimitive.Indicator asChild forceMount>
        {(() => {
          const sizePx = inferSizeFromClassName(className) ?? 16;
          const stroke = Math.max(1, Number(((sizePx / 24) * 3 * 0.9).toFixed(2)));
          return (
            <motion.svg
              viewBox="0 0 24 24"
              width="100%"
              height="100%"
              fill="none"
              stroke="currentColor"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-current"
              initial={false}
            >
              <motion.path
                d="M5 12.5 10 17 19 7"
                vectorEffect="non-scaling-stroke"
                pathLength={1}
                style={{ strokeDasharray: 1 }}
                initial={{ strokeDashoffset: (props.checked === true) ? 0 : 1 }}
                animate={{ strokeDashoffset: (props.checked === true) ? 0 : 1 }}
                transition={{ duration: 0.14, ease: "easeInOut" }}
              />
            </motion.svg>
          );
        })()}
      </CheckboxPrimitive.Indicator>
    </motion.button>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
