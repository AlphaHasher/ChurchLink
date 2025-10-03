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
      background: {
        className: "relative isolate overflow-hidden bg-slate-950 text-white",
        style: {
          backgroundImage: "radial-gradient(circle at 20% 20%, rgba(99,102,241,0.35), transparent 55%), radial-gradient(circle at 80% 0%, rgba(56,189,248,0.3), transparent 45%), linear-gradient(180deg, rgba(15,23,42,0.95) 0%, rgba(15,23,42,0.85) 100%)",
        },
      },
      grid: { className: "w-full" },
      styleTokens: {
        fontFamily: "Inter, sans-serif",
      },
      children: [
        { 
          id: `${newId()}-c1`, 
          type: "container", 
          props: { maxWidth: "2xl", paddingX: 6, paddingY: 16 }, 
          style: {
            className: "relative h-full flex flex-col items-center justify-center gap-8 text-center",
          },
          children: [
            { 
              id: `${newId()}-h1`, 
              type: "text", 
              props: { variant: "lead", html: "WELCOME HOME", align: "center" },
              style: {
                className: "uppercase tracking-[0.4em] text-indigo-200/80",
                fontSize: 1,
                fontWeight: 600,
              },
              layout: {
                units: { xu: 1, yu: 1, wu: 10, hu: 2 }
              }
            } as Node,
            { 
              id: `${newId()}-p1`, 
              type: "text",
              props: { variant: "h1", html: "A Place to Gather, Grow, and Go.", align: "center" },
              style: {
                className: "leading-tight text-balance drop-shadow-xl",
                fontSize: 3.75,
                fontWeight: 700,
                color: "#f8fafc",
              },
              layout: {
                units: { xu: 1, yu: 4, wu: 10, hu: 3 }
              }
            } as Node,
            { 
              id: `${newId()}-btn`, 
              type: "text", 
              props: { variant: "p", html: "Join us Sundays at 9 &amp; 11 AM to worship, connect, and experience life-giving community.", align: "center" },
              style: {
                className: "max-w-2xl mx-auto text-lg leading-relaxed text-slate-200/90",
                fontSize: 1.125,
              },
              layout: {
                units: { xu: 1, yu: 8, wu: 10, hu: 2 }
              }
            } as Node,
            { 
              id: `${newId()}-btn-primary`, 
              type: "button", 
              props: { label: "Plan Your Visit", href: "#" },
              style: {
                className: "px-8 py-3 rounded-full bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-500/30 hover:bg-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 transition",
              },
              layout: {
                units: { xu: 2, yu: 11, wu: 4, hu: 2 }
              }
            } as Node,
            { 
              id: `${newId()}-btn-secondary`, 
              type: "button", 
              props: { label: "Watch Online", href: "#" },
              style: {
                className: "px-8 py-3 rounded-full bg-white/10 text-white font-semibold border border-white/20 hover:bg-white/20 transition backdrop-blur-sm",
              },
              layout: {
                units: { xu: 6, yu: 11, wu: 4, hu: 2 }
              }
            } as Node,
          ],
          layout: {
            units: { xu: 0, yu: 1, wu: 12, hu: 14 }
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
