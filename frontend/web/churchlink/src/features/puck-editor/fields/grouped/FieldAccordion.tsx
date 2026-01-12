import * as React from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/shared/components/ui/accordion";
import { LucideIcon } from "lucide-react";
import * as Icons from "lucide-react";

interface FieldAccordionProps {
  label: string;
  icon?: string; // lucide icon name (e.g., "heading-1")
  defaultOpen?: boolean;
  badge?: string; // e.g., "3 items"
  children: React.ReactNode;
}

export const FieldAccordion: React.FC<FieldAccordionProps> = ({
  label,
  icon,
  defaultOpen = false,
  badge,
  children,
}) => {
  // Get icon component if icon name provided
  const IconComponent = icon
    ? (Icons[icon as keyof typeof Icons] as LucideIcon | undefined)
    : null;

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={defaultOpen ? "open" : undefined}
      className="border rounded-md"
    >
      <AccordionItem value="open" className="border-0">
        <AccordionTrigger className="hover:no-underline px-3 py-2">
          <div className="flex items-center gap-2 flex-1 text-left">
            {IconComponent && (
              <IconComponent className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="font-normal">{label}</span>
            {badge && (
              <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                {badge}
              </span>
            )}
          </div>
        </AccordionTrigger>

        <AccordionContent className="px-3 pb-3">{children}</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};
