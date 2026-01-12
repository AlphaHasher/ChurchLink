import { Button } from "@/shared/components/ui/button";
import { CompoundIcon } from "./CompoundIcon";

interface CompoundButtonProps {
  label: string;
  url?: string;
  variant?: "default" | "secondary" | "outline" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  icon?: string;
  isEditing?: boolean;
  fontVars?: React.CSSProperties;
  labelColor?: string;
  backgroundColor?: string;
}

export const CompoundButton = ({
  label,
  url = "",
  variant = "default",
  size = "default",
  icon,
  isEditing = false,
  fontVars = {},
  labelColor,
  backgroundColor,
}: CompoundButtonProps) => {
  const hasIcon = icon && icon !== "none";
  const iconSize = size === "lg" ? 20 : size === "sm" ? 16 : 18;

  const buttonContent = (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      whiteSpace: 'nowrap',
      color: labelColor || undefined,
    }}>
      {hasIcon && <CompoundIcon icon={icon} size={iconSize} />}
      {label}
    </span>
  );

  const buttonStyle = {
    fontFamily: fontVars?.fontFamily ? `${fontVars.fontFamily} !important` : undefined,
    fontWeight: fontVars?.fontWeight,
    fontStyle: fontVars?.fontStyle,
    ...(backgroundColor ? { backgroundColor } : {}),
  };

  return (
    <Button
      asChild={!isEditing && !!url}
      variant={variant}
      size={size}
      tabIndex={isEditing ? -1 : undefined}
      style={buttonStyle}
    >
      {!isEditing && url ? (
        <a href={url}>{buttonContent}</a>
      ) : (
        buttonContent
      )}
    </Button>
  );
};
