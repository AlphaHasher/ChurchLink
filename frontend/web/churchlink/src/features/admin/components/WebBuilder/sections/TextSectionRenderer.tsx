import React from "react";
import "./editorjs-shared.css";
import type { TextContent, EditorJSOutput } from "./TextSection";

export interface TextSectionRendererProps {
  data: TextContent | EditorJSOutput | undefined | null;
  className?: string;
}

function getEditorData(data: TextSectionRendererProps["data"]): EditorJSOutput | null {
  if (!data) return null;
  // If a TextContent object with editorjs exists
  if ((data as any).editorjs) return (data as any).editorjs as EditorJSOutput;
  // If already OutputData
  if ((data as any).blocks) return data as EditorJSOutput;
  return null;
}

const TextSectionRenderer: React.FC<TextSectionRendererProps> = ({ data, className }) => {
  const editorData = getEditorData(data);

  const html = React.useMemo(() => {
    if (!editorData) return "";
    const render = (d: EditorJSOutput): string => {
      const renderListItems = (items: any[]): string => {
        return items
          .map((it: any) => {
            const content = typeof it === "string" ? it : it?.content ?? "";
            return `<li class=\"cdx-list__item\"><div class=\"cdx-list__item-content\">${content}</div></li>`;
          })
          .join("");
      };
      const renderChecklistItems = (items: any[]): string => {
        return items
          .map((it: any) => {
            const content = it?.content ?? "";
            const checked = Boolean(it?.meta?.checked);
            const checkedClass = checked ? " cdx-list__item--checked" : "";
            const checkSvg = `
              <span class=\"cdx-list__checkbox-check\">
                <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" fill=\"none\" viewBox=\"0 0 24 24\"><path stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"2\" d=\"M7 12L10.4884 15.8372C10.5677 15.9245 10.705 15.9245 10.7844 15.8372L17 9\"></path></svg>
              </span>`;
            return (
              `<li class=\"cdx-list__item${checkedClass}\">` +
              `<div class=\"cdx-list__checkbox\" data-checked=\"${checked}\">${checkSvg}</div>` +
              `<div class=\"cdx-list__item-content\">${content}</div>` +
              `</li>`
            );
          })
          .join("");
      };

      const blocksInner = (d.blocks || [])
        .map((block: any) => {
          switch (block.type) {
            case "paragraph": {
              const text = block.data?.text ?? "";
              return `<div class="ce-paragraph">${text}</div>`;
            }
            case "header": {
              const level = block.data?.level || 3;
              const text = block.data?.text ?? "";
              return `<h${level} class="ce-header">${text}</h${level}>`;
            }
            case "list": {
              const style = block.data?.style;
              const items: any[] = Array.isArray(block.data?.items) ? block.data.items : [];
              if (style === "checklist") {
                return `<ul class=\"cdx-list cdx-list-checklist\">${renderChecklistItems(items)}</ul>`;
              }
              if (style === "ordered") {
                return `<ol class=\"cdx-list cdx-list-ordered\">${renderListItems(items)}</ol>`;
              }
              return `<ul class=\"cdx-list cdx-list-unordered\">${renderListItems(items)}</ul>`;
            }
            case "checklist": {
              const items: any[] = Array.isArray(block.data?.items) ? block.data.items : [];
              const itemsHtml = items
                .map((it: any) => {
                  const text = it?.text ?? "";
                  const checked = it?.checked ? "checked" : "";
                  return `<li class=\"cdx-checklist__item\"><input type=\"checkbox\" disabled ${checked}/> <span>${text}</span></li>`;
                })
                .join("");
              return `<ul class=\"cdx-checklist\">${itemsHtml}</ul>`;
            }
            case "image": {
              const url = block.data?.file?.url || block.data?.url;
              const alt = block.data?.caption || "";
              return url ? `<img src="${url}" alt="${alt}" />` : "";
            }
            default:
              return "";
          }
        });

      // Wrap each block with the same structure the editor uses
      const wrapped = blocksInner
        .map((inner: string) => `<div class=\"ce-block\"><div class=\"ce-block__content\">${inner}</div></div>`)
        .join("");

      return wrapped;
    };
    return render(editorData);
  }, [editorData]);

  return (
    <div className={`editorjs-renderer${className ? ` ${className}` : ""}`}>
      <div className="editorjs-holder" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
};

export default TextSectionRenderer;


