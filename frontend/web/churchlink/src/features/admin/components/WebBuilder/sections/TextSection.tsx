import React, { useCallback, useEffect, useRef, useState } from "react";
import EditorJS, { OutputData } from "@editorjs/editorjs";
// Import Editor.js plugins
import Paragraph from "@editorjs/paragraph";
import Header from "@editorjs/header";
import List from "@editorjs/list";
import Image from "@editorjs/image";


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

interface TextSectionProps {
  data: TextContent;
  isEditing: boolean;
  onChange?: (content: TextContent) => void;
}

const TextSection: React.FC<TextSectionProps> = ({ data, isEditing, onChange }) => {
  const editorRef = useRef<EditorJS | null>(null);
  const editorHolderRef = useRef<HTMLDivElement>(null);
  const currentDataRef = useRef<TextContent>(data);
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
        const newData = {
          editorjs: outputData,
          // Keep text fallback for backward compatibility
          text: undefined
        };
        currentDataRef.current = newData;
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
        paragraph: Paragraph,
        header: Header,
        list: List,
        image: Image,
      },
      data: data.editorjs || {
        time: Date.now(),
        blocks: data.text ? [{
          type: 'paragraph',
          data: { text: data.text }
        }] : [],
        version: "2.31.0"
      },
      // Remove onChange to prevent re-renders during typing
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

  // Load data when it changes externally
  useEffect(() => {
    if (editorRef.current && isEditorReady && data.editorjs) {
      editorRef.current.render(data.editorjs);
    }
  }, [data.editorjs, isEditorReady]);

  // Render Editor.js output as HTML
  const renderEditorJSContent = (editorData: EditorJSOutput): string => {
    return editorData.blocks.map(block => {
      switch (block.type) {
        case 'paragraph':
          return `<p>${block.data.text}</p>`;
        case 'header':
          const level = block.data.level || 3;
          return `<h${level}>${block.data.text}</h${level}>`;
        case 'list':
          const listTag = block.data.style === 'ordered' ? 'ol' : 'ul';
          const items = block.data.items.map((item: string) => `<li>${item}</li>`).join('');
          return `<${listTag}>${items}</${listTag}>`;
        case 'image':
          return `<img src="${block.data.file?.url || block.data.url}" alt="${block.data.caption || ''}" />`;
        case 'link':
          return `<a href="${block.data.link}" target="_blank" rel="noopener noreferrer">${block.data.link}</a>`;
        default:
          return `<div>${JSON.stringify(block.data)}</div>`;
      }
    }).join('');
  };

  const getPreviewContent = (): string => {
    if (data.editorjs) {
      return renderEditorJSContent(data.editorjs);
    } else if (data.text) {
      return `<p>${data.text}</p>`;
    }
    return '';
  };

  return (
    <section className="text-section">
      {/* Basic Editor.js styles */}
      <style>{`
        .editorjs-holder {
          min-height: 200px;
          padding: 16px;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          background: white;
        }
        .editorjs-holder .ce-block__content,
        .editorjs-holder .ce-toolbar__content {
          max-width: none;
        }
        .editorjs-holder .ce-paragraph[data-placeholder]:empty::before {
          color: #9ca3af;
          font-style: italic;
        }
        .editorjs-holder .ce-header {
          margin: 1em 0 0.5em 0;
        }
        .editorjs-holder .ce-header h1 {
          font-size: 2em;
          font-weight: bold;
          line-height: 1.2;
          margin: 0.5em 0;
        }
        .editorjs-holder .ce-header h2 {
          font-size: 1.5em;
          font-weight: bold;
          line-height: 1.3;
          margin: 0.5em 0;
        }
        .editorjs-holder .ce-header h3 {
          font-size: 1.25em;
          font-weight: bold;
          line-height: 1.4;
          margin: 0.5em 0;
        }
        .editorjs-holder .ce-header h4 {
          font-size: 1.1em;
          font-weight: bold;
          line-height: 1.4;
          margin: 0.5em 0;
        }
        .editorjs-holder .ce-header h5 {
          font-size: 1em;
          font-weight: bold;
          line-height: 1.4;
          margin: 0.5em 0;
        }
        .editorjs-holder .ce-header h6 {
          font-size: 0.9em;
          font-weight: bold;
          line-height: 1.4;
          margin: 0.5em 0;
        }
        .editorjs-holder .ce-list {
          margin: 1em 0;
        }
        .editorjs-holder .ce-list__item {
          padding: 0.25em 0;
        }
      `}</style>

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

      {isEditing && !isPreview ? (
        <div className="editor-container">
          <div ref={editorHolderRef} className="editorjs-holder" />
        </div>
      ) : (
        <div
          className="prose prose-lg max-w-none"
          dangerouslySetInnerHTML={{ __html: getPreviewContent() }}
        />
      )}
    </section>
  );
};

export default TextSection;
