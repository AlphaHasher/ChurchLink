export type ResponsiveProps = Record<string, any>;

export type GridLayoutUnits = {
  // logical grid units, independent of zoom:
  xu: number; // columns from left
  yu: number; // rows from top
  wu?: number; // optional width in units
  hu?: number; // optional height in units
};

export type GridLayoutPx = {
  x: number;
  y: number;
  w?: number;
  h?: number;
};

export interface NodeBase {
  id: string;
  type: string;
  props?: Record<string, any>;
  style?: Record<string, any>;
  responsive?: ResponsiveProps;
  children?: Node[];
  // Optional per-locale overrides for textual props (e.g., html, label, alt)
  // Shape: { [locale]: { [propKey]: any } }
  i18n?: Record<string, Record<string, any>>;
  // New: position for builder canvas
  layout?: {
    units: GridLayoutUnits;
    px?: GridLayoutPx; // cached for convenience (recomputed when gridSize changes)
  };
}

export interface TextNode extends NodeBase {
  type: "text";
  props?: {
    html?: string;
    text?: string;
    variant?: "p" | "lead" | "muted" | "h1" | "h2" | "h3";
    align?: "left" | "center" | "right";
  } & Record<string, any>;
}

export interface ButtonNode extends NodeBase {
  type: "button";
  props?: {
    label?: string;
    href?: string;
    variant?: "default" | "secondary" | "outline" | "ghost";
    size?: "sm" | "md" | "lg";
  } & Record<string, any>;
}

export interface ContainerNode extends NodeBase {
  type: "container";
  props?: {
    maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
    paddingX?: number;
    paddingY?: number;
  } & Record<string, any>;
}

export interface EventListNode extends NodeBase {
  type: "eventList";
  props?: {
    showFilters?: boolean;
    eventName?: string | string[];
    lockedFilters?: { ministry?: string; ageRange?: string };
    title?: string;
    showTitle?: boolean;
  } & Record<string, any>;
}

export interface ImageNode extends NodeBase {
  type: "image";
  props?: {
    src?: string;
    alt?: string;
    objectFit?: "cover" | "contain" | "fill" | "none" | "scale-down";
  } & Record<string, any>;
}

export interface MapNode extends NodeBase {
  type: "map";
  props?: {
    embedUrl?: string;
  } & Record<string, any>;
}

export interface PaypalNode extends NodeBase {
  type: "paypal";
  props?: Record<string, any>;
}

export type Node =
  | TextNode
  | ButtonNode
  | ContainerNode
  | EventListNode
  | ImageNode
  | MapNode
  | PaypalNode
  | NodeBase;

export interface SectionV2 {
  id: string;
  kind: "section";
  fullHeight?: boolean;
  // If set, section min-height is applied as percentage of viewport height
  heightPercent?: number;
  background?: Record<string, any>;
  grid?: Record<string, any>;
  styleTokens?: Record<string, any>;
  
  builderGrid?: {
    gridSize?: number; // px per cell (e.g., 16)
    showGrid?: boolean;
    cols?: number; 
    aspect?: { num: number; den: number }; 
    slideScale?: boolean; // when true, render section as scaled fixed-aspect canvas
  };
  // When true, disables drag & resize of child nodes in the builder, but style editing remains
  lockLayout?: boolean;
  children: Node[];
}

export interface PageV2 {
  _id?: string;
  version: 2;
  title: string;
  slug: string;
  visible?: boolean;
  // Localization config for this page
  defaultLocale?: string; // e.g., 'en'
  locales?: string[];     // e.g., ['en', 'es']
  styleTokens?: {
    defaultFontFamily?: string;
    defaultFontFallback?: string;
    [key: string]: unknown;
  };
  sections: SectionV2[];
  created_at?: string;
  updated_at?: string;
}


