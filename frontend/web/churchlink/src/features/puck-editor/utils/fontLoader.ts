import type { CSSProperties } from "react";
import type { ComponentData, Data } from "@puckeditor/core";

// Font property names to scan for in components
const FONT_PROPS = [
  "fontFamily", "headingFont", "descriptionFont", "buttonFont",
  "titleFont", "labelFont", "valueFont", "cardHeadingFont", "cardDescriptionFont",
  "questionFont", "answerFont"
];

// Track loaded fonts to avoid duplicate <link> tags
const loadedFonts = new Set<string>();
const loadedFontLinks = new Map<string, string>();
const injectedByDocument = new WeakMap<Document, Set<string>>();
let iframeObserverInitialized = false;

type ParsedFont = { family: string; weight: string; style: string };

// Parse font value format: "FontFamily:weight:style" e.g. "Roboto:700:italic" or just "Roboto"
function parseFontValue(value: string): ParsedFont {
  if (!value) return { family: "", weight: "400", style: "normal" };
  const [family = "", weight = "400", style = "normal"] = value.split(":");
  return { family, weight, style };
}

export function loadGoogleFont(fontValue: string): void {
  const { family, weight, style } = parseFontValue(fontValue);
  if (!family) return;

  // Create a unique key for this specific font+weight+style combo
  const fontKey = `${family}:${weight}:${style}`;
  if (loadedFonts.has(fontKey)) return;

  // Build Google Fonts URL with specific weight
  // For italic, we need to use ital,wght axis
  const weightParam = style === "italic"
    ? `ital,wght@1,${weight}`
    : `wght@${weight}`;

  if (typeof document === "undefined") return;

  const href = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:${weightParam}&display=swap`;
  loadedFontLinks.set(fontKey, href);

  ensureFontLoadedInDocument(document, fontKey, href);
  ensureFontLoadedInIframes(fontKey);
  initIframeObserver();
  loadedFonts.add(fontKey);
}

export type FontStyle = {
  fontFamily?: string;
  fontWeight?: number;
  fontStyle?: string;
};

export function getFontFamilyVariables(fontValue: string | undefined): CSSProperties | undefined {
  if (!fontValue) return undefined;

  const { family, weight, style } = parseFontValue(fontValue);
  if (!family) return undefined;

  loadGoogleFont(fontValue);

  return {
    "--page-font-family": `${family}, sans-serif`,
    "--page-font-weight": weight,
    "--page-font-style": style,
  } as CSSProperties;
}

export function getFontFamilyStyle(fontValue: string | undefined): FontStyle | undefined {
  if (!fontValue) return undefined;

  const { family, weight, style } = parseFontValue(fontValue);
  if (!family) return undefined;

  loadGoogleFont(fontValue);

  return {
    fontFamily: `${family}, sans-serif`,
    fontWeight: parseInt(weight, 10),
    fontStyle: style,
  };
}

function ensureFontLoadedInDocument(doc: Document, fontKey: string, href: string): void {
  const head = doc.head;
  if (!head) return;

  let injected = injectedByDocument.get(doc);
  if (!injected) {
    injected = new Set<string>();
    injectedByDocument.set(doc, injected);
  }

  if (injected.has(fontKey)) return;

  const link = doc.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  head.appendChild(link);
  injected.add(fontKey);
}

function ensureFontLoadedInIframes(fontKey: string): void {
  const href = loadedFontLinks.get(fontKey);
  if (!href) return;

  const iframes = document.querySelectorAll("iframe");
  iframes.forEach((iframe) => {
    const doc = iframe.contentDocument;
    if (!doc) return;
    ensureFontLoadedInDocument(doc, fontKey, href);
  });
}

function injectAllFontsIntoIframe(iframe: HTMLIFrameElement): void {
  const doc = iframe.contentDocument;
  if (!doc) return;
  loadedFontLinks.forEach((href, fontKey) => {
    ensureFontLoadedInDocument(doc, fontKey, href);
  });
  // Ensure iframe has white background (fix dark background from :root styles)
  injectIframeBackgroundFix(doc);
}

const IFRAME_BG_FIX_ID = "puck-iframe-bg-fix";
function injectIframeBackgroundFix(doc: Document): void {
  if (doc.getElementById(IFRAME_BG_FIX_ID)) return;
  const style = doc.createElement("style");
  style.id = IFRAME_BG_FIX_ID;
  style.textContent = "html { background-color: #ffffff !important; }";
  doc.head?.appendChild(style);
}

// Ensure all iframes have white background (call from PuckEditor on mount)
export function initIframeBackgroundFix(): () => void {
  if (typeof document === "undefined") return () => {};

  const applyFixToAllIframes = () => {
    document.querySelectorAll("iframe").forEach((iframe) => {
      const doc = iframe.contentDocument;
      if (doc?.head) injectIframeBackgroundFix(doc);
    });
  };

  // Apply immediately
  applyFixToAllIframes();

  // Watch for new iframes (e.g., when returning from preview mode)
  const observer = new MutationObserver(() => applyFixToAllIframes());
  observer.observe(document.body, { childList: true, subtree: true });

  // Also poll briefly for iframes that load async
  const interval = setInterval(applyFixToAllIframes, 200);
  setTimeout(() => clearInterval(interval), 2000);

  return () => {
    observer.disconnect();
    clearInterval(interval);
  };
}

function initIframeObserver(): void {
  if (iframeObserverInitialized || typeof document === "undefined") return;
  iframeObserverInitialized = true;

  const attach = (iframe: HTMLIFrameElement) => {
    if (iframe.contentDocument?.readyState === "complete") {
      injectAllFontsIntoIframe(iframe);
    }
    iframe.addEventListener("load", () => injectAllFontsIntoIframe(iframe));
  };

  document.querySelectorAll("iframe").forEach((iframe) => attach(iframe));

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLIFrameElement) {
          attach(node);
          return;
        }
        if (node instanceof HTMLElement) {
          node.querySelectorAll?.("iframe").forEach((iframe) => attach(iframe));
        }
      });
    });
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

// Extract all font values from page data - shared across PuckEditor and PuckPageRenderer
export function extractFontsFromData(data: Data): Set<string> {
  const fonts = new Set<string>();

  function scanComponent(comp: ComponentData) {
    if (!comp.props) return;

    for (const propName of FONT_PROPS) {
      const fontValue = comp.props[propName];
      if (typeof fontValue === "string" && fontValue) {
        fonts.add(fontValue);
      }
    }

    // Check nested typography object
    const typography = comp.props.typography as Record<string, unknown> | undefined;
    if (typography?.fontFamily && typeof typography.fontFamily === "string") {
      fonts.add(typography.fontFamily);
    }

    // Recursively handle children (GroupBlock, GridContainer slots)
    if (Array.isArray(comp.props.children)) {
      (comp.props.children as ComponentData[]).forEach(scanComponent);
    }
  }

  data.content?.forEach(scanComponent);
  return fonts;
}
