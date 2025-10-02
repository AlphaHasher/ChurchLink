import { Node, SectionV2 } from "@/shared/types/pageV2";

export const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const defaultSection = (): SectionV2 => ({
  id: newId(),
  kind: "section",
  heightPercent: 100,
  background: { className: "bg-white" },
  grid: { className: "w-full" },
  styleTokens: {},
  children: [
    { 
      id: `${newId()}-c0`, 
      type: "container", 
      props: { maxWidth: "xl", paddingX: 4, paddingY: 6 }, 
      children: [],
      layout: {
        units: { xu: 0, yu: 0, wu: 12, hu: 8 }  // Full-ish width, moderate height
      }
    } as Node,
  ],
});

export const createPresetSection = (key: string): SectionV2 | null => {
  if (key === "hero") {
    return {
      id: `${newId()}-hero`,
      kind: "section",
      heightPercent: 100,
      background: { className: "bg-white" },
      grid: { className: "w-full" },
      styleTokens: {},
      children: [
        { 
          id: `${newId()}-c1`, 
          type: "container", 
          props: { maxWidth: "xl", paddingX: 4, paddingY: 10 }, 
          children: [
            { 
              id: `${newId()}-h1`, 
              type: "text", 
              props: { variant: "h1", html: "Your Headline" },
              layout: {
                units: { xu: 0, yu: 0, wu: 10, hu: 2 }
              }
            } as Node,
            { 
              id: `${newId()}-p1`, 
              type: "text", 
              props: { variant: "p", html: "Short description goes here." },
              layout: {
                units: { xu: 0, yu: 3, wu: 8, hu: 1 }
              }
            } as Node,
            { 
              id: `${newId()}-btn`, 
              type: "button", 
              props: { label: "Call to Action" },
              layout: {
                units: { xu: 0, yu: 5, wu: 4, hu: 1 }
              }
            } as Node,
          ],
          layout: {
            units: { xu: 0, yu: 0, wu: 12, hu: 10 }
          }
        } as Node,
      ],
    };
  }
  
  if (key === "events") {
    return {
      id: `${newId()}-events`,
      kind: "section",
      heightPercent: 100,
      background: { className: "bg-white" },
      grid: { className: "w-full" },
      styleTokens: {},
      children: [
        { 
          id: `${newId()}-c2`, 
          type: "container", 
          props: { maxWidth: "xl", paddingX: 4, paddingY: 6 }, 
          children: [],
          layout: {
            units: { xu: 0, yu: 0, wu: 12, hu: 8 }
          }
        } as Node,
        { 
          id: `${newId()}-t2`, 
          type: "text", 
          props: { variant: "h2", html: "Upcoming Events" },
          layout: {
            units: { xu: 0, yu: 0, wu: 8, hu: 1 }
          }
        } as Node,
        { 
          id: `${newId()}-e2`, 
          type: "eventList", 
          props: { showFilters: true },
          layout: {
            units: { xu: 0, yu: 2, wu: 12, hu: 6 }
          }
        } as Node,
      ],
    };
  }
  
  return null;
};

export const ELEMENTS: Array<{ type: Node["type"]; label: string }> = [
  { type: "text", label: "Text" },
  { type: "button", label: "Button" },
  { type: "container", label: "Container" },
  { type: "eventList", label: "Event List" },
];

export const SECTION_PRESETS = [
  { key: "hero", label: "Hero" },
  { key: "events", label: "Events" },
];
