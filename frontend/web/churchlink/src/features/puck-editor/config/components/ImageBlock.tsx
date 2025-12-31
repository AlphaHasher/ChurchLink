import type { ComponentConfig } from "@measured/puck";

export type ImageBlockProps = {
  src: string;
  alt: string;
  objectFit: "contain" | "cover" | "fill" | "none";
  aspectRatio: "auto" | "1/1" | "4/3" | "16/9" | "21/9";
  rounded: "none" | "sm" | "md" | "lg" | "full";
};

export const ImageBlock: ComponentConfig<ImageBlockProps> = {
  label: "Image",
  fields: {
    src: {
      type: "text",
      label: "Image URL",
    },
    alt: {
      type: "text",
      label: "Alt Text",
    },
    objectFit: {
      type: "select",
      label: "Object Fit",
      options: [
        { label: "Contain", value: "contain" },
        { label: "Cover", value: "cover" },
        { label: "Fill", value: "fill" },
        { label: "None", value: "none" },
      ],
    },
    aspectRatio: {
      type: "select",
      label: "Aspect Ratio",
      options: [
        { label: "Auto", value: "auto" },
        { label: "Square (1:1)", value: "1/1" },
        { label: "Standard (4:3)", value: "4/3" },
        { label: "Widescreen (16:9)", value: "16/9" },
        { label: "Ultra-wide (21:9)", value: "21/9" },
      ],
    },
    rounded: {
      type: "select",
      label: "Border Radius",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Full", value: "full" },
      ],
    },
  },
  defaultProps: {
    src: "https://placehold.co/800x400",
    alt: "Image description",
    objectFit: "cover",
    aspectRatio: "16/9",
    rounded: "md",
  },
  render: ({ src, alt, objectFit, aspectRatio, rounded }) => {
    const objectFitClasses: Record<string, string> = {
      contain: "object-contain",
      cover: "object-cover",
      fill: "object-fill",
      none: "object-none",
    };

    const roundedClasses: Record<string, string> = {
      none: "rounded-none",
      sm: "rounded-sm",
      md: "rounded-md",
      lg: "rounded-lg",
      full: "rounded-full",
    };

    const aspectRatioStyle = aspectRatio !== "auto"
      ? { aspectRatio: aspectRatio.replace("/", " / ") }
      : {};

    return (
      <div className="w-full" style={aspectRatioStyle}>
        <img
          src={src}
          alt={alt}
          className={`w-full h-full ${objectFitClasses[objectFit]} ${roundedClasses[rounded]}`}
        />
      </div>
    );
  },
};
