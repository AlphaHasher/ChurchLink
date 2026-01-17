import type { Editor } from "@tiptap/react";

export type TextStyle = {
  level: "p" | "h1" | "h2" | "h3";
  alignment: "left" | "center" | "right";
  bold: boolean;
  italic: boolean;
  strike: boolean;
};

let copiedStyle: TextStyle | null = null;

export function copyStyle(style: TextStyle): void {
  copiedStyle = { ...style };
}

export function getPastedStyle(): TextStyle | null {
  return copiedStyle ? { ...copiedStyle } : null;
}

export function hasCopiedStyle(): boolean {
  return copiedStyle !== null;
}

export function extractStyleFromEditor(editor: Editor): TextStyle {
  const getLevel = (): TextStyle["level"] => {
    if (editor.isActive("heading", { level: 1 })) return "h1";
    if (editor.isActive("heading", { level: 2 })) return "h2";
    if (editor.isActive("heading", { level: 3 })) return "h3";
    return "p";
  };

  const getAlignment = (): TextStyle["alignment"] => {
    if (editor.isActive({ textAlign: "center" })) return "center";
    if (editor.isActive({ textAlign: "right" })) return "right";
    return "left";
  };

  return {
    level: getLevel(),
    alignment: getAlignment(),
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    strike: editor.isActive("strike"),
  };
}

export function applyStyleToEditor(editor: Editor, style: TextStyle): void {
  const chain = editor.chain().focus();

  // Set heading/paragraph
  if (style.level === "p") {
    chain.setParagraph();
  } else {
    const level = parseInt(style.level.substring(1)) as 1 | 2 | 3;
    chain.setHeading({ level });
  }

  // Set alignment
  chain.setTextAlign(style.alignment);

  // Set marks
  if (style.bold) {
    chain.setBold();
  } else {
    chain.unsetBold();
  }
  if (style.italic) {
    chain.setItalic();
  } else {
    chain.unsetItalic();
  }
  if (style.strike) {
    chain.setStrike();
  } else {
    chain.unsetStrike();
  }

  chain.run();
}
