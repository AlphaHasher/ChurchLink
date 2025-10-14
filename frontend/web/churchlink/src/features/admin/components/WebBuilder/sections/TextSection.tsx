import React, { useCallback, useEffect, useRef, useState } from "react";
import EditorJS, { OutputData } from "@editorjs/editorjs";
// Import Editor.js plugins
import Paragraph from "@editorjs/paragraph";
import Header from "@editorjs/header";
import List from "@editorjs/list";
import Underline from "@editorjs/underline";
import Marker from "@editorjs/marker";
import InlineCode from "@editorjs/inline-code";
import TextStyle from "@skchawala/editorjs-text-style";
import ColorPicker from "editorjs-color-picker";
import TextSectionRenderer from "./TextSectionRenderer";
import "./editorjs-shared.css";


// Editor.js data structure interfaces
export interface EditorJSBlock {
  type: string;
  data: any;
  id?: string;
}

export type EditorJSOutput = OutputData;

export interface TextContent {
  editorjs?: EditorJSOutput;
  // Fallback for backward compatibility
  text?: string;
}

// Community tools are used for color and font styles

interface TextSectionProps {
  data: TextContent;
  isEditing: boolean;
  onChange?: (content: TextContent) => void;
}

const TextSection: React.FC<TextSectionProps> = ({ data, isEditing, onChange }) => {
  const editorRef = useRef<EditorJS | null>(null);
  const editorHolderRef = useRef<HTMLDivElement>(null);
  const currentDataRef = useRef<TextContent>(data);
  const lastSavedJsonRef = useRef<string | null>(data.editorjs ? JSON.stringify(data.editorjs) : null);
  const skipExternalRenderRef = useRef<boolean>(false);
  const [isPreview, setIsPreview] = useState(false);
  const [isEditorReady, setIsEditorReady] = useState(false);

  // Update current data ref when prop data changes
  useEffect(() => {
    currentDataRef.current = data;
  }, [data]);

  // Save current editor data to parent
  const saveToParent = useCallback(async () => {
    if (editorRef.current) {
      try {
        const outputData = await editorRef.current.save();

        // Safety: avoid wiping existing content with an empty payload
        const hasBlocks = Array.isArray(outputData?.blocks) && outputData.blocks.length > 0;
        const hadPrevious = !!lastSavedJsonRef.current;
        if (!hasBlocks && hadPrevious) {
          // Skip saving empty state to prevent accidental data loss
          return;
        }

        const newData = {
          editorjs: outputData,
          // Keep text fallback for backward compatibility
          text: undefined
        };
        currentDataRef.current = newData;
        lastSavedJsonRef.current = JSON.stringify(outputData);
        // We will receive the same data back from parent; don't re-render editor for that
        skipExternalRenderRef.current = true;
        onChange?.(newData);
      } catch (error) {
        console.error('Saving failed: ', error);
      }
    }
  }, [onChange]);

  // Initialize Editor.js
  useEffect(() => {
    if (!isEditing || !editorHolderRef.current || editorRef.current) return;

    const editor = new EditorJS({
      holder: editorHolderRef.current,
      tools: {
        paragraph: {
          class: Paragraph,
          inlineToolbar: ["bold", "italic", "marker", "underline", "inlineCode", "ColorPicker", "TextStyle"],
        } as any,
        header: {
          class: Header,
          inlineToolbar: ["bold", "italic", "marker", "underline", "inlineCode", "ColorPicker", "TextStyle"],
        } as any,
        list: {
          class: List,
          inlineToolbar: ["bold", "italic", "marker", "underline", "inlineCode", "ColorPicker", "TextStyle"],
        } as any,
        marker: Marker,
        underline: Underline,
        inlineCode: InlineCode,
        ColorPicker: ColorPicker as any,
        TextStyle: {
          class: TextStyle as any,
          config: {
            controls: ["color", "fontSize", "fontFamily"],
            fontFamilies: [
              { label: "Default", value: "inherit" },
              { label: "Inter", value: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial" },
              { label: "Serif", value: "ui-serif, Georgia, 'Times New Roman', serif" },
              { label: "Mono", value: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace" },
            ],
          },
        } as any,
      },
      data: data.editorjs || {
        time: Date.now(),
        blocks: data.text ? [{
          type: 'paragraph',
          data: { text: data.text }
        }] : [],
        version: "2.31.0"
      },
      // Per docs: save editor data on each change. We keep focus by skipping external re-renders.
      onChange: async () => {
        await saveToParent();
      },
      placeholder: "Start writing your content here...",
    });

    editorRef.current = editor;

    editor.isReady.then(() => {
      setIsEditorReady(true);
    }).catch((reason) => {
      console.log(`Editor.js initialization failed because of ${reason}`);
    });

    return () => {
      if (editorRef.current && editorRef.current.destroy) {
        editorRef.current.destroy();
        editorRef.current = null;
        setIsEditorReady(false);
      }
    };
  }, [isEditing, data]);

  // Load data when it changes externally (e.g., server load or different section)
  // Avoid re-rendering when the change came from this component's own save.
  useEffect(() => {
    if (!editorRef.current || !isEditorReady || !data.editorjs) return;

    const incoming = JSON.stringify(data.editorjs);
    const lastSaved = lastSavedJsonRef.current;

    // If this update is the echo of our own save, skip rendering to preserve focus
    if (skipExternalRenderRef.current && incoming === lastSaved) {
      skipExternalRenderRef.current = false;
      return;
    }

    if (incoming !== lastSaved) {
      editorRef.current.render(data.editorjs);
      lastSavedJsonRef.current = incoming;
      currentDataRef.current = data;
    }
  }, [data.editorjs, isEditorReady]);

  // Toggle read-only mode for exact visual parity on preview
  useEffect(() => {
    if (!editorRef.current || !isEditorReady) return;
    try {
      editorRef.current.readOnly.toggle(isPreview || !isEditing);
    } catch (e) {
      // no-op
    }
  }, [isPreview, isEditing, isEditorReady]);

  // Renderer handles preview output for parity

  // Note: preview rendering is handled by TextSectionRenderer for parity

  return (
    <section className="text-section">
      {/* Styles moved to shared CSS for parity with renderer */}

      {isEditing && (
        <div className="text-right mb-4">
          <button
            onClick={async () => {
              // Save data before switching modes
              if (!isPreview) {
                await saveToParent();
              }
              setIsPreview(!isPreview);
            }}
            className="px-4 py-1 text-sm rounded bg-gray-900 text-white border border-transparent hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors"
          >
            {isPreview ? "Edit" : "Preview"}
          </button>
        </div>
      )}

      {/* Show editor or renderer depending on preview */}
      <div className="editor-container" style={{ display: isPreview ? 'none' : 'block' }}>
        <div ref={editorHolderRef} className="editorjs-holder" />
      </div>
      {isPreview && (
        <TextSectionRenderer data={data} />
      )}
    </section>
  );
};

export default TextSection;
