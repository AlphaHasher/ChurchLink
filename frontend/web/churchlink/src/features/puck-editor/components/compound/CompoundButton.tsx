import { Button } from "@/shared/components/ui/button";
import { CompoundIcon } from "./CompoundIcon";
import styles from "../../styles/components/CompoundButton.module.css";
import { getClassNameFactory } from "../../utils/classNames";

const getClassName = getClassNameFactory("CompoundButton", styles);

interface CompoundButtonProps {
  label: string;
  url?: string;
  variant?: "default" | "secondary" | "outline" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  icon?: string;
  isEditing?: boolean;
  fontVars?: React.CSSProperties;
}

export const CompoundButton = ({
  label,
  url = "",
  variant = "default",
  size = "default",
  icon,
  isEditing = false,
  fontVars = {},
}: CompoundButtonProps) => {
  const hasIcon = icon && icon !== "none";

  const buttonContent = (
    <>
      {hasIcon && <CompoundIcon icon={icon} size={size === "lg" ? 20 : size === "sm" ? 16 : 18} />}
      {label}
    </>
  );

  return (
    <Button
      asChild={!isEditing && !!url ? true : false}
      variant={variant}
      size={size}
      tabIndex={isEditing ? -1 : undefined}
      className={hasIcon ? getClassName("CompoundButton--hasIcon") : undefined}
      style={fontVars}
    >
      {!isEditing && url ? (
        <a href={url}>{buttonContent}</a>
      ) : (
        <span>{buttonContent}</span>
      )}
    </Button>
  );
};
