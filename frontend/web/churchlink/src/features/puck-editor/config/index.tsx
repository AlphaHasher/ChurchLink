import type { Config, Data } from "@puckeditor/core";

// Import all component configs
import { TextBlock, type TextBlockProps } from "./components/TextBlock";
import { ButtonBlock, type ButtonBlockProps } from "./components/ButtonBlock";
import { ImageBlock, type ImageBlockProps } from "./components/ImageBlock";
import { HeroBlock, type HeroBlockProps } from "./components/HeroBlock";
import { SpacerBlock, type SpacerBlockProps } from "./components/SpacerBlock";
import { DividerBlock, type DividerBlockProps } from "./components/DividerBlock";
import { MapBlock, type MapBlockProps } from "./components/MapBlock";
import { GroupBlock, type GroupBlockProps } from "./components/GroupBlock";
import { EventSectionBlock, type EventSectionBlockProps } from "./components/EventSectionBlock";
import { GridContainer, type GridContainerProps } from "./components/GridContainer";
import { BlankBlock, type BlankBlockProps } from "./components/BlankBlock";
import { SpaceBlock, type SpaceBlockProps } from "./components/SpaceBlock";
import { FaqBlock, type FaqBlockProps } from "./components/FaqBlock";
import { PaypalBlock, type PaypalBlockProps } from "./components/PaypalBlock";

// Import language utilities
import { LANGUAGES } from "../utils/languageUtils";
import { SupportedLanguagesField } from "../fields/SupportedLanguagesField";

// Define all component props types
type Props = {
  TextBlock: TextBlockProps;
  ButtonBlock: ButtonBlockProps;
  ImageBlock: ImageBlockProps;
  HeroBlock: HeroBlockProps;
  SpacerBlock: SpacerBlockProps;
  DividerBlock: DividerBlockProps;
  MapBlock: MapBlockProps;
  GroupBlock: GroupBlockProps;
  EventSectionBlock: EventSectionBlockProps;
  GridContainer: GridContainerProps;
  BlankBlock: BlankBlockProps;
  SpaceBlock: SpaceBlockProps;
  FaqBlock: FaqBlockProps;
  PaypalBlock: PaypalBlockProps;
};

// Root props for page-level settings
type RootProps = {
  title: string;
  pageMargins?: "none" | "small" | "medium" | "large" | "xl" | "custom";
  customPageMarginPx?: number;
  defaultLanguage?: string;
  supportedLanguages?: string[];
  _previewLanguage?: string; // Internal: current preview language in editor
};

// Puck configuration
export const config: Config<Props, RootProps> = {
  root: {
    fields: {
      title: {
        type: "text",
        label: "Page Title",
      },
      pageMargins: {
        type: "select",
        label: "Page Margins",
        options: [
          { label: "None (Full Width)", value: "none" },
          { label: "Small", value: "small" },
          { label: "Medium", value: "medium" },
          { label: "Large", value: "large" },
          { label: "Extra Large", value: "xl" },
          { label: "Custom", value: "custom" },
        ],
      },
      customPageMarginPx: {
        type: "number",
        label: "Custom Page Margin (px)",
        min: 0,
      },
      defaultLanguage: {
        type: "select",
        label: "Default Language",
        options: Object.entries(LANGUAGES).map(([code, name]) => ({
          label: `${name} (${code})`,
          value: code,
        })),
      },
      supportedLanguages: {
        type: "custom",
        label: "Supported Languages",
        render: ({ value, onChange }) => {
          return (
            <SupportedLanguagesField
              value={value as string[]}
              onChange={onChange}
            />
          );
        },
      },
    },
    defaultProps: {
      title: "New Page",
      pageMargins: "none",
      customPageMarginPx: 0,
      defaultLanguage: "en",
      supportedLanguages: ["en"],
    },
    render: ({ children }) => {
      return (
        <div className="min-h-screen">
          {children}
        </div>
      );
    },
  },
  categories: {
    layout: {
      title: "Layout",
      components: ["GroupBlock", "GridContainer", "SpacerBlock", "SpaceBlock", "DividerBlock", "BlankBlock"],
    },
    typography: {
      title: "Typography",
      components: ["TextBlock"],
    },
    content: {
      title: "Content",
      components: ["ButtonBlock", "ImageBlock"],
    },
    sections: {
      title: "Sections",
      components: ["HeroBlock", "EventSectionBlock", "FaqBlock"],
    },
    integrations: {
      title: "Integrations",
      components: ["MapBlock", "PaypalBlock"],
    },
  },
  components: {
    TextBlock,
    ButtonBlock,
    ImageBlock,
    HeroBlock,
    SpacerBlock,
    DividerBlock,
    MapBlock,
    GroupBlock,
    EventSectionBlock,
    GridContainer,
    BlankBlock,
    SpaceBlock,
    FaqBlock,
    PaypalBlock,
  },
};

// Type for Puck data
export type PuckData = Data<Props, RootProps>;

// Initial empty data structure
export const initialData: PuckData = {
  content: [],
  root: {
    props: {
      title: "New Page",
      pageMargins: "none",
      customPageMarginPx: 0,
      defaultLanguage: "en",
      supportedLanguages: ["en"],
    },
  },
};
