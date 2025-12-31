import type { ComponentConfig } from "@measured/puck";

export type MapBlockProps = {
  embedUrl: string;
  height: "sm" | "md" | "lg" | "xl";
  rounded: "none" | "sm" | "md" | "lg";
};

export const MapBlock: ComponentConfig<MapBlockProps> = {
  label: "Map",
  fields: {
    embedUrl: {
      type: "textarea",
      label: "Google Maps Embed URL",
    },
    height: {
      type: "select",
      label: "Height",
      options: [
        { label: "Small (250px)", value: "sm" },
        { label: "Medium (350px)", value: "md" },
        { label: "Large (450px)", value: "lg" },
        { label: "Extra Large (550px)", value: "xl" },
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
      ],
    },
  },
  defaultProps: {
    embedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3024.123456789!2d-74.005!3d40.712!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDDCsDQyJzQzLjIiTiA3NMKwMDAnMTguMCJX!5e0!3m2!1sen!2sus!4v1234567890",
    height: "md",
    rounded: "md",
  },
  render: ({ embedUrl, height, rounded }) => {
    const heightMap: Record<string, string> = {
      sm: "250px",
      md: "350px",
      lg: "450px",
      xl: "550px",
    };

    const roundedClasses: Record<string, string> = {
      none: "rounded-none",
      sm: "rounded-sm",
      md: "rounded-md",
      lg: "rounded-lg",
    };

    // Extract src from iframe if full embed code is pasted
    let src = embedUrl;
    const iframeSrcMatch = embedUrl.match(/src="([^"]+)"/);
    if (iframeSrcMatch) {
      src = iframeSrcMatch[1];
    }

    return (
      <div className={`w-full overflow-hidden ${roundedClasses[rounded]}`} style={{ height: heightMap[height] }}>
        <iframe
          src={src}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Google Map"
        />
      </div>
    );
  },
};
