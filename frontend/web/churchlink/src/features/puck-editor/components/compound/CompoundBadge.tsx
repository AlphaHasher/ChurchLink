import styles from "../../styles/components/CompoundBadge.module.css";
import { getClassNameFactory } from "../../utils/classNames";

const getClassName = getClassNameFactory("CompoundBadge", styles);

interface CompoundBadgeProps {
  label: string;
  url?: string;
  variant?: "default" | "secondary" | "destructive" | "outline";
  isEditing?: boolean;
}

export const CompoundBadge = ({
  label,
  url = "",
  variant = "default",
  isEditing = false
}: CompoundBadgeProps) => {
  const className = getClassName({
    [variant]: true,
  });

  if (url && !isEditing) {
    return (
      <a href={url} className={className}>
        {label}
      </a>
    );
  }

  return <span className={className}>{label}</span>;
};
