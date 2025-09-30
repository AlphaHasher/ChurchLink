import { Node, SectionV2 } from "@/shared/types/pageV2";

export const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const defaultSection = (): SectionV2 => ({
  id: newId(),
  kind: "section",
  fullHeight: true,
  background: { className: "bg-white" },
  grid: { className: "w-full" },
  styleTokens: {},
  children: [
    { id: `${newId()}-c0`, type: "container", props: { maxWidth: "xl", paddingX: 4, paddingY: 6 }, children: [] } as Node,
  ],
});

export const createPresetSection = (key: string): SectionV2 | null => {
  if (key === "hero") {
    return {
      id: `${newId()}-hero`,
      kind: "section",
      fullHeight: true,
      background: { className: "bg-white" },
      grid: { className: "w-full" },
      styleTokens: {},
      children: [
        { 
          id: `${newId()}-c1`, 
          type: "container", 
          props: { maxWidth: "xl", paddingX: 4, paddingY: 10 }, 
          children: [
            { id: `${newId()}-h1`, type: "text", props: { variant: "h1", html: "Your Headline" } },
            { id: `${newId()}-p1`, type: "text", props: { variant: "p", html: "Short description goes here." } },
            { id: `${newId()}-btn`, type: "button", props: { label: "Call to Action" } },
          ] as Node[] 
        } as Node,
      ],
    };
  }
  
  if (key === "events") {
    return {
      id: `${newId()}-events`,
      kind: "section",
      fullHeight: false,
      background: { className: "bg-white" },
      grid: { className: "w-full" },
      styleTokens: {},
      children: [
        { 
          id: `${newId()}-c2`, 
          type: "container", 
          props: { maxWidth: "xl", paddingX: 4, paddingY: 6 }, 
          children: [
            { id: `${newId()}-t2`, type: "text", props: { variant: "h2", html: "Upcoming Events" } },
            { id: `${newId()}-e2`, type: "eventList", props: { showFilters: true } },
          ] as Node[] 
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
