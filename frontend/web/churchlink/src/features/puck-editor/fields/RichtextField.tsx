import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Pilcrow,
  Copy,
  Clipboard,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/shared/components/ui/dropdown-menu";
import {
  copyStyle,
  getPastedStyle,
  hasCopiedStyle,
  extractStyleFromEditor,
  applyStyleToEditor,
} from "../utils/styleClipboard";

interface RichtextFieldProps {
  value: string;
  onChange: (value: string) => void;
  contentEditable?: boolean;
}

// Toolbar button component
function ToolbarButton({
  onClick,
  isActive,
  disabled,
  children,
  title,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        "p-1.5 rounded hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        isActive && "bg-accent text-accent-foreground"
      )}
    >
      {children}
    </button>
  );
}

export function RichtextField({ value, onChange }: RichtextFieldProps) {
  const isInternalChange = useRef(false);
  const [hasCopied, setHasCopied] = useState(hasCopiedStyle());

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => {
      isInternalChange.current = true;
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none p-3 min-h-[100px] focus:outline-none",
      },
    },
  });

  // Sync external value changes (but not our own updates)
  useEffect(() => {
    if (editor && !isInternalChange.current) {
      const currentContent = editor.getHTML();
      if (currentContent !== value) {
        editor.commands.setContent(value || "");
      }
    }
    isInternalChange.current = false;
  }, [value, editor]);

  const setHeading = useCallback(
    (level: 1 | 2 | 3 | 4 | 5 | 6) => {
      editor?.chain().focus().toggleHeading({ level }).run();
    },
    [editor]
  );

  const setParagraph = useCallback(() => {
    editor?.chain().focus().setParagraph().run();
  }, [editor]);

  const getCurrentHeadingLevel = useCallback((): string => {
    if (!editor) return "p";
    for (let i = 1; i <= 6; i++) {
      if (editor.isActive("heading", { level: i as 1 | 2 | 3 | 4 | 5 | 6 })) {
        return `h${i}`;
      }
    }
    return "p";
  }, [editor]);

  const handleCopyStyle = useCallback(() => {
    if (editor) {
      copyStyle(extractStyleFromEditor(editor));
      setHasCopied(true);
    }
  }, [editor]);

  const handlePasteStyle = useCallback(() => {
    if (editor) {
      const style = getPastedStyle();
      if (style) {
        applyStyleToEditor(editor, style);
      }
    }
  }, [editor]);

  if (!editor) {
    return null;
  }

  const currentLevel = getCurrentHeadingLevel();

  return (
    <div className="border rounded-md overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-1 border-b bg-muted/30">
        {/* Text type - Paragraph/Heading dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="Paragraph/Heading"
              className={cn(
                "p-1.5 rounded hover:bg-accent transition-colors flex items-center gap-1",
                (currentLevel !== "p" || editor.isActive("paragraph")) && "bg-accent text-accent-foreground"
              )}
            >
              <Pilcrow className="h-4 w-4" />
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuRadioGroup value={currentLevel}>
              <DropdownMenuRadioItem
                value="p"
                onClick={setParagraph}
              >
                Paragraph
              </DropdownMenuRadioItem>
              {[1, 2, 3, 4, 5, 6].map((level) => (
                <DropdownMenuRadioItem
                  key={`h${level}`}
                  value={`h${level}`}
                  onClick={() => setHeading(level as 1 | 2 | 3 | 4 | 5 | 6)}
                >
                  Heading {level}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive("strike")}
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          title="Ordered List"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Alignment */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          isActive={editor.isActive({ textAlign: "left" })}
          title="Align Left"
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          isActive={editor.isActive({ textAlign: "center" })}
          title="Align Center"
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          isActive={editor.isActive({ textAlign: "right" })}
          title="Align Right"
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Copy/Paste Style */}
        <ToolbarButton
          onClick={handleCopyStyle}
          title="Copy Style"
        >
          <Copy className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={handlePasteStyle}
          isActive={hasCopied}
          title="Paste Style"
          disabled={!hasCopied}
        >
          <Clipboard className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Editor content */}
      <EditorContent editor={editor} />
    </div>
  );
}
