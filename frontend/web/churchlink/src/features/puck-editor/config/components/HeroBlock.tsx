import type { ComponentConfig } from "@measured/puck";
import { TranslationsField } from "../../fields/TranslationsField";
import { usePuckLanguage } from "../../context/PuckLanguageContext";
import type { TranslationMap } from "../../utils/languageUtils";

export type HeroBlockProps = {
  title: string;
  subtitle: string;
  backgroundImage: string;
  backgroundOverlay: "none" | "light" | "dark" | "gradient";
  height: "sm" | "md" | "lg" | "xl" | "screen";
  textAlign: "left" | "center" | "right";
  buttonLabel: string;
  buttonHref: string;
  showButton: boolean;
  translations?: TranslationMap;
};

export const HeroBlock: ComponentConfig<HeroBlockProps> = {
  label: "Hero",
  fields: {
    title: {
      type: "text",
      label: "Title",
    },
    subtitle: {
      type: "textarea",
      label: "Subtitle",
    },
    backgroundImage: {
      type: "text",
      label: "Background Image URL",
    },
    backgroundOverlay: {
      type: "select",
      label: "Overlay",
      options: [
        { label: "None", value: "none" },
        { label: "Light", value: "light" },
        { label: "Dark", value: "dark" },
        { label: "Gradient", value: "gradient" },
      ],
    },
    height: {
      type: "select",
      label: "Height",
      options: [
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Extra Large", value: "xl" },
        { label: "Full Screen", value: "screen" },
      ],
    },
    textAlign: {
      type: "radio",
      label: "Text Alignment",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right", value: "right" },
      ],
    },
    showButton: {
      type: "radio",
      label: "Show Button",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    buttonLabel: {
      type: "text",
      label: "Button Text",
    },
    buttonHref: {
      type: "text",
      label: "Button Link",
    },
    translations: {
      type: "custom",
      label: "Translations",
      render: ({ value, onChange }) => (
        <TranslationsField
          value={value as TranslationMap}
          onChange={onChange}
          translatableFields={[
            { name: "title", type: "text", label: "Title" },
            { name: "subtitle", type: "textarea", label: "Subtitle" },
            { name: "buttonLabel", type: "text", label: "Button Text" },
          ]}
        />
      ),
    },
  },
  defaultProps: {
    title: "Welcome to Our Church",
    subtitle: "Join us for worship and fellowship",
    backgroundImage: "https://placehold.co/1920x1080",
    backgroundOverlay: "dark",
    height: "lg",
    textAlign: "center",
    showButton: true,
    buttonLabel: "Learn More",
    buttonHref: "#",
    translations: {},
  },
  render: ({
    title,
    subtitle,
    backgroundImage,
    backgroundOverlay,
    height,
    textAlign,
    showButton,
    buttonLabel,
    buttonHref,
    translations,
  }) => {
    // Try to use preview language context, but gracefully handle if not in editor
    let previewLanguage = "en";
    try {
      const context = usePuckLanguage();
      previewLanguage = context.previewLanguage;
    } catch {
      // Not in editor context (e.g., public page renderer) - will be handled by localizeComponentData
    }

    // Use translated text if available, otherwise use defaults
    const displayTitle = translations?.[previewLanguage]?.title || title;
    const displaySubtitle = translations?.[previewLanguage]?.subtitle || subtitle;
    const displayButtonLabel = translations?.[previewLanguage]?.buttonLabel || buttonLabel;
    const heightClasses: Record<string, string> = {
      sm: "min-h-[300px]",
      md: "min-h-[400px]",
      lg: "min-h-[500px]",
      xl: "min-h-[600px]",
      screen: "min-h-screen",
    };

    const alignClasses: Record<string, string> = {
      left: "text-left items-start",
      center: "text-center items-center",
      right: "text-right items-end",
    };

    const overlayClasses: Record<string, string> = {
      none: "",
      light: "bg-white/50",
      dark: "bg-black/50",
      gradient: "bg-gradient-to-b from-black/70 to-transparent",
    };

    return (
      <div
        className={`relative ${heightClasses[height]} w-full flex flex-col justify-center px-8`}
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {backgroundOverlay !== "none" && (
          <div className={`absolute inset-0 ${overlayClasses[backgroundOverlay]}`} />
        )}
        <div
          className={`relative z-10 flex flex-col ${alignClasses[textAlign]} max-w-4xl mx-auto w-full gap-4`}
        >
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white drop-shadow-lg">
            {displayTitle}
          </h1>
          {displaySubtitle && (
            <p className="text-lg md:text-xl text-white/90 max-w-2xl drop-shadow">
              {displaySubtitle}
            </p>
          )}
          {showButton && displayButtonLabel && (
            <a
              href={buttonHref}
              className="inline-flex items-center justify-center mt-4 px-6 py-3 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 transition-colors"
            >
              {displayButtonLabel}
            </a>
          )}
        </div>
      </div>
    );
  },
};
