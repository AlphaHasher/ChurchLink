import { DB } from "./DB";

type FontRow = {
  id: string;
  css: string;
  timestamp: number;
};

type FontListRow = {
  id: string;
  fonts: any[];
  timestamp: number;
};

const STORE = "fonts";
const FONT_LIST_STORE = "fontList";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const FONT_LIST_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const memory = new Map<string, FontRow>();
let fontListMemory: FontListRow | null = null;

function isExpired(row: FontRow | null): boolean {
  if (!row) return true;
  return Date.now() - row.timestamp > TTL_MS;
}

function isFontListExpired(row: FontListRow | null): boolean {
  if (!row) return true;
  return Date.now() - row.timestamp > FONT_LIST_TTL_MS;
}

async function init(): Promise<void> {
  await DB.init();
  try {
    DB.setEncryptionForStore(STORE, false);
    DB.setEncryptionForStore(FONT_LIST_STORE, false);
  } catch {
    // ignore - optional optimisation
  }
}

export async function getCachedFontCss(fontId: string): Promise<string | null> {
  await init();

  const mem = memory.get(fontId);
  if (mem && !isExpired(mem)) return mem.css;

  try {
    const row = (await DB.get(STORE, fontId)) as FontRow | null;
    if (!row || isExpired(row)) {
      if (row) {
        try {
          await DB.delete(STORE, fontId);
        } catch {
          // ignore
        }
      }
      return null;
    }
    memory.set(fontId, row);
    return row.css;
  } catch {
    return null;
  }
}

export async function cacheFontCss(fontId: string, css: string): Promise<void> {
  await init();

  const row: FontRow = {
    id: fontId,
    css,
    timestamp: Date.now(),
  };

  memory.set(fontId, row);

  try {
    await DB.put(STORE, row);
  } catch {
    // ignore write errors to keep UI responsive
  }
}

export async function getCachedFontList(): Promise<any[] | null> {
  await init();

  if (fontListMemory && !isFontListExpired(fontListMemory)) {
    return fontListMemory.fonts;
  }

  try {
    const row = (await DB.get(FONT_LIST_STORE, "google-fonts")) as FontListRow | null;
    if (!row || isFontListExpired(row)) {
      if (row) {
        try {
          await DB.delete(FONT_LIST_STORE, "google-fonts");
        } catch {
          // ignore
        }
      }
      return null;
    }
    fontListMemory = row;
    return row.fonts;
  } catch {
    return null;
  }
}

export async function cacheFontList(fonts: any[]): Promise<void> {
  await init();

  const row: FontListRow = {
    id: "google-fonts",
    fonts,
    timestamp: Date.now(),
  };

  fontListMemory = row;

  try {
    await DB.put(FONT_LIST_STORE, row);
  } catch {
    // ignore write errors to keep UI responsive
  }
}

