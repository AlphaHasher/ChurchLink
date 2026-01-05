import { icons } from "lucide-react";

interface CompoundIconProps {
  icon?: string;
  size?: number;
  className?: string;
}

export const CompoundIcon = ({ icon = "none", size = 24, className }: CompoundIconProps) => {
  if (!icon || icon === "none") return null;

  try {
    const LucideIcon = (icons as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[icon];
    if (!LucideIcon) return null;
    return <LucideIcon size={size} className={className} />;
  } catch {
    return null;
  }
};
