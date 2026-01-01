import type { Config, Data } from "@measured/puck";

// Import all component configs
import { TextBlock, type TextBlockProps } from "./components/TextBlock";
import { ButtonBlock, type ButtonBlockProps } from "./components/ButtonBlock";
import { ImageBlock, type ImageBlockProps } from "./components/ImageBlock";
import { HeroBlock, type HeroBlockProps } from "./components/HeroBlock";
import { SpacerBlock, type SpacerBlockProps } from "./components/SpacerBlock";
import { DividerBlock, type DividerBlockProps } from "./components/DividerBlock";
import { MapBlock, type MapBlockProps } from "./components/MapBlock";
import { GroupBlock, type GroupBlockProps } from "./components/GroupBlock";

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
};

// Root props for page-level settings
type RootProps = {
  title: string;
};

// Puck configuration
export const config: Config<Props, RootProps> = {
  root: {
    fields: {
      title: {
        type: "text",
        label: "Page Title",
      },
    },
    defaultProps: {
      title: "New Page",
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
      components: ["GroupBlock", "SpacerBlock", "DividerBlock"],
    },
    content: {
      title: "Content",
      components: ["TextBlock", "ButtonBlock", "ImageBlock"],
    },
    sections: {
      title: "Sections",
      components: ["HeroBlock"],
    },
    integrations: {
      title: "Integrations",
      components: ["MapBlock"],
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
    },
  },
};
