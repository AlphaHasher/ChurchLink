import React from 'react';
import { BiblePassage } from '@/shared/types/BiblePlan';

type Props = React.HTMLAttributes<HTMLDivElement> & {
  passage: BiblePassage;
};

const base = "inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-lg text-sm font-medium cursor-grab hover:bg-blue-200 transition-colors whitespace-nowrap max-w-full min-w-0";

const PassageBadge = React.forwardRef<HTMLDivElement, Props>(({ passage, className, ...rest }, ref) => {
  return (
    <div ref={ref} className={`${base} ${className ?? ''}`} {...rest}>
      <span className="truncate min-w-0">{passage.reference}</span>
    </div>
  );
});

PassageBadge.displayName = 'PassageBadge';

export default PassageBadge;
