import { Node, SectionV2 } from "@/shared/types/pageV2";

export const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const defaultSection = (): SectionV2 => ({
  id: newId(),
  kind: "section",
  heightPercent: 100,
  background: {
    className: "",
    style: {
      background: "linear-gradient(90deg, #4f46e5 0%, #3b82f6 100%)",
    },
  },
  grid: { className: "w-full" },
  styleTokens: {},
  builderGrid: {
    cols: 64,
    aspect: { num: 16, den: 9 },
    showGrid: true,
  },
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
      heightPercent: 110,
      background: {
        className: "relative isolate overflow-hidden bg-slate-950 text-white",
        style: {
          background: "linear-gradient(180deg, rgba(15,23,42,0.95) 0%, rgba(15,23,42,0.85) 100%)",
        },
      },
      grid: { className: "w-full" },
      styleTokens: {
        fontFamily: "Inter, sans-serif",
      },
      builderGrid: {
        cols: 64,
        aspect: { num: 16, den: 9 },
        showGrid: true,
      },
      children: [
        {
          id: `${newId()}-c1`, 
          type: "container", 
          props: { maxWidth: "2xl", paddingX: 0, paddingY: 0 }, 
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
                units: { xu: 13, yu: 7, wu: 12, hu: 4 }
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
                units: { xu: 0, yu: 13, wu: 40, hu: 10 }
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
                units: { xu: 8, yu: 25, wu: 22, hu: 7 }
              }
            } as Node,
            {
              id: `${newId()}-btn-primary`, 
              type: "button", 
              props: { label: "Plan Your Visit", href: "#" },
              style: {
                // Apply inline gradient so inspector shows the real fill
                // Matches brand hero blues/purples used in the section background
                className: "px-8 py-3 rounded-full text-white font-semibold shadow-lg shadow-indigo-500/30 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 transition",
                background: "linear-gradient(90deg, #4f46e5 0%, #3b82f6 100%)",
                customCss: "&:hover { opacity: 0.9; }",
              },
              layout: {
                units: { xu: 7, yu: 35, wu: 12, hu: 4 }
              }
            } as Node,
            {
              id: `${newId()}-btn-secondary`, 
              type: "button", 
              props: { label: "Watch Online", href: "#" },
              style: {
                className: "px-8 py-3 rounded-full bg-white/10 text-white font-semibold border border-white/20 transition backdrop-blur-sm",
                customCss: "&:hover { background: rgba(255,255,255,0.20); }",
              },
              layout: {
                units: { xu: 20, yu: 35, wu: 11, hu: 3 }
              }
            } as Node,
          ],
          layout: {
            units: { xu: 8, yu: 7, wu: 40, hu: 45 }
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
      background: { className: "bg-gradient-to-b from-slate-50 to-white" },
      grid: { className: "w-full" },
      styleTokens: {},
      builderGrid: {
        cols: 64,
        aspect: { num: 16, den: 9 },
        showGrid: true,
      },
      lockLayout: true,
      children: [
        { 
          id: `${newId()}-e2`, 
          type: "eventList", 
          props: { showFilters: true, showTitle: true },
          layout: {
            units: { xu: 0, yu: 0, wu: 12, hu: 8 }
          }
        } as Node,
      ],
    };
  }
  
  if (key === "map") {
    return {
      id: `${newId()}-map`,
      kind: "section",
      heightPercent: 70,
      background: { className: "bg-gradient-to-b from-slate-50 via-white to-slate-100" },
      grid: { className: "w-full" },
      styleTokens: {},
      builderGrid: {
        cols: 64,
        aspect: { num: 16, den: 9 },
        showGrid: true,
      },
      lockLayout: true,
      children: [
        {
          id: `${newId()}-c-map`,
          type: "container",
          props: { maxWidth: "xl", paddingX: 4, paddingY: 10 },
          children: [
            { id: `${newId()}-map-title`, type: "text", props: { variant: "h2", html: "Our Location", align: "left" }, style: { fontSize: 2, fontWeight: 700, color: "#0f172a", paddingBottom: 2 } } as Node,
            {
              id: `${newId()}-map`,
              type: "map",
              props: (() => {
                const place = "6601 Watt Ave, North Highlands, CA 95660";
                const embedUrl = `https://www.google.com/maps?q=${encodeURIComponent(place)}&output=embed`;
                return { embedUrl, place };
              })(),
              style: { borderRadius: 16, backgroundColor: "#ffffff" },
            } as Node,
            { id: `${newId()}-map-cta`, type: "button", props: { label: "Get Directions", href: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent("6601 Watt Ave, North Highlands, CA 95660")}` }, style: { className: "mt-4 px-4 py-2 rounded-full bg-slate-900 text-white hover:bg-slate-800" } } as Node,
          ],
        } as Node,
      ],
    };
  }

  if (key === "paypal") {
    return {
      id: `${newId()}-paypal`,
      kind: "section",
      heightPercent: 120,
      background: { className: "bg-gradient-to-b from-slate-50 via-white to-slate-100" },
      grid: { className: "w-full" },
      styleTokens: {},
      builderGrid: {
        cols: 64,
        aspect: { num: 16, den: 9 },
        showGrid: true,
      },
      lockLayout: true,
      children: [
        {
          id: `${newId()}-c-paypal`,
          type: "container",
          props: { maxWidth: "xl", paddingX: 4, paddingY: 10 },
          children: [
            { id: `${newId()}-paypal-title`, type: "text", props: { variant: "h2", html: "Give Online" }, style: { fontSize: 2.25, fontWeight: 700, color: "#0f172a" }, layout: { units: { xu: 0, yu: 0, wu: 12, hu: 2 } } } as Node,
            { id: `${newId()}-paypal-desc`, type: "text", props: { variant: "p", html: "Your generosity fuels our mission. Secure donations powered by PayPal." }, style: { color: "#334155" }, layout: { units: { xu: 0, yu: 3, wu: 12, hu: 2 } } } as Node,
            {
              id: `${newId()}-paypal`,
              type: "paypal",
              style: { borderRadius: 16, backgroundColor: "#ffffff", className: "shadow-sm ring-1 ring-slate-200" },
              layout: { units: { xu: 0, yu: 6, wu: 12, hu: 26 } },
            } as Node,
          ],
          layout: { units: { xu: 0, yu: 0, wu: 12, hu: 36 } },
        } as Node,
      ],
    };
  }

  if (key === "serviceTimes") {
    return {
      id: `${newId()}-service`,
      kind: "section",
      heightPercent: 85,
      background: { className: "", style: { backgroundColor: "#92a2c4" } },
      grid: { className: "w-full" },
      styleTokens: { fontFamily: "Lato, sans-serif", name: "service times" },
      builderGrid: {
        cols: 64,
        aspect: { num: 16, den: 9 },
        showGrid: true,
      },
      children: [
        {
          id: `${newId()}-c-service`,
          type: "container",
          props: { maxWidth: "xl", paddingX: 4, paddingY: 10 },
          style: { className: "block w-full h-full [&_.card]:shadow-sm [&_.card]:ring-1 [&_.card]:ring-slate-200" },
          children: [
            { id: `${newId()}-svc-title`, type: "text", props: { variant: "h2", html: "Service Times" }, style: { fontSize: 2, fontWeight: 700, color: "#0f172a" }, layout: { units: { xu: 24, yu: 2, wu: 15, hu: 3 } } } as Node,
            { id: `${newId()}-svc-sub`, type: "text", props: { variant: "p", html: "We'd love to see you this Sunday!" }, style: { color: "#475569" }, layout: { units: { xu: 23, yu: 6, wu: 17, hu: 2 } } } as Node,
            { id: `${newId()}-svc-card-2`, type: "container", style: { borderRadius: 16, backgroundColor: "#ffffff", className: "card p-6" }, children: [
              { id: `${newId()}-svc-card-2-title`, type: "text", props: { variant: "h3", html: "Location" }, style: { fontWeight: 700, color: "#0f172a" }, layout: { units: { xu: 6, yu: 13, wu: 10, hu: 2 } } } as Node,
              { id: `${newId()}-svc-card-2-p`, type: "text", props: { variant: "p", html: "6601 Watt Ave, North Highlands, CA 95660" }, style: { color: "#334155" }, layout: { units: { xu: 5, yu: 17, wu: 12, hu: 3 } } } as Node,
            ], layout: { units: { xu: 4, yu: 12, wu: 17, hu: 9 } } } as Node,
            { id: `${newId()}-svc-card-3`, type: "container", style: { borderRadius: 16, backgroundColor: "#ffffff", className: "card p-6" }, children: [
              { id: `${newId()}-svc-card-3-title`, type: "text", props: { variant: "h3", html: "Kids & Students" }, style: { fontWeight: 700, color: "#0f172a" }, layout: { units: { xu: 25, yu: 13, wu: 12, hu: 2 } } } as Node,
              { id: `${newId()}-svc-card-3-p`, type: "text", props: { variant: "p", html: "Age-appropriate programs during both services" }, style: { color: "#334155" }, layout: { units: { xu: 25, yu: 17, wu: 13, hu: 3 } } } as Node,
            ], layout: { units: { xu: 23, yu: 12, wu: 18, hu: 9 } } } as Node,
            { id: `${newId()}-svc-card-1`, type: "container", style: { borderRadius: 16, backgroundColor: "#ffffff", className: "card p-6" }, children: [
              { id: `${newId()}-svc-card-1-title`, type: "text", props: { variant: "h3", html: "Sunday Gatherings" }, style: { fontWeight: 700, color: "#0f172a" }, layout: { units: { xu: 45, yu: 13, wu: 14, hu: 2 } } } as Node,
              { id: `${newId()}-svc-card-1-p`, type: "text", props: { variant: "p", html: "9:00 AM & 11:00 AM • Main Auditorium" }, style: { color: "#334155" }, layout: { units: { xu: 45, yu: 17, wu: 16, hu: 3 } } } as Node,
            ], layout: { units: { xu: 44, yu: 12, wu: 18, hu: 9 } } } as Node,

            { id: `${newId()}-svc-cta`, type: "button", props: { label: "Plan Your Visit", href: "#" }, style: { className: "px-6 py-3 rounded-full bg-slate-900 text-white hover:bg-slate-800 transition" }, layout: { units: { xu: 27, yu: 28, wu: 11, hu: 3 } } } as Node,
          ],
          layout: { units: { xu: 0, yu: 2, wu: 64, hu: 32 } },
        } as Node,
      ],
    };
  }

  if (key === "menu") {
    return {
      id: `${newId()}-menu`,
      kind: "section",
      heightPercent: 90,
      background: { className: "bg-gradient-to-b from-white to-slate-50" },
      grid: { className: "w-full" },
      styleTokens: {},
      builderGrid: { cols: 64, aspect: { num: 16, den: 9 }, showGrid: true },
      children: [
        {
          id: `${newId()}-c-menu`,
          type: "container",
          props: { maxWidth: "xl", paddingX: 4, paddingY: 10 },
          children: [
            {
              id: `${newId()}-menu-node`,
              type: "menu",
              props: { data: { items: [] } },
              style: { className: "" },
              layout: { units: { xu: 0, yu: 0, wu: 12, hu: 12 } },
            } as Node,
          ],
          layout: { units: { xu: 0, yu: 0, wu: 12, hu: 14 } },
        } as Node,
      ],
    };
  }

  if (key === "contactInfo") {
    return {
      id: `${newId()}-contact`,
      kind: "section",
      heightPercent: 90,
      background: { className: "bg-white" },
      grid: { className: "w-full" },
      styleTokens: {},
      builderGrid: { cols: 64, aspect: { num: 16, den: 9 }, showGrid: true },
      children: [
        {
          id: `${newId()}-c-contact`,
          type: "container",
          props: { maxWidth: "xl", paddingX: 4, paddingY: 10 },
          children: [
            {
              id: `${newId()}-contact-node`,
              type: "contactInfo",
              props: { data: { items: [{ label: "Phone", value: "(555) 123-4567" }, { label: "Email", value: "hello@yourchurch.org" }] } },
              style: { className: "" },
              layout: { units: { xu: 0, yu: 0, wu: 12, hu: 10 } },
            } as Node,
          ],
          layout: { units: { xu: 0, yu: 0, wu: 12, hu: 12 } },
        } as Node,
      ],
    };
  }
  
  return null;
};

export const ELEMENTS: Array<{ type: Node["type"]; label: string }> = [
  { type: "text", label: "Text" },
  { type: "button", label: "Button" },
  { type: "image", label: "Image" },
  { type: "container", label: "Container" },
  { type: "eventList", label: "Event List" },
  { type: "map", label: "Map" },
  { type: "serviceTimes", label: "Service Times" },
  { type: "menu", label: "Menu" },
  { type: "contactInfo", label: "Contact Info" },
];

export const SECTION_PRESETS = [
  { key: "hero", label: "Hero" },
  { key: "events", label: "Events" },
  { key: "map", label: "Map Section" },
  { key: "paypal", label: "PayPal (locked layout)" },
  { key: "serviceTimes", label: "Service Times" },
  { key: "menu", label: "Menu" },
  { key: "contactInfo", label: "Contact Info" },
];
