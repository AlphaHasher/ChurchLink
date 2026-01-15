import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { ModeToggle } from "@/shared/components/ModeToggle";
import { ArrowLeft, Globe, LayoutGrid, Eye } from "lucide-react";
import { UndoRedoButtons } from "./UndoRedoButtons";
import { usePuckLanguage } from "../context/PuckLanguageContext";
import { LANGUAGES } from "../utils/languageUtils";

interface PuckHeaderOverrideProps {
  slug: string;
  onBack: () => void;
  onPreview: () => void;
  onManageGroups: () => void;
  onPublish: () => void;
  publishing: boolean;
  isPublished: boolean;
}

export function PuckHeaderOverride({
  slug,
  onBack,
  onPreview,
  onManageGroups,
  onPublish,
  publishing,
  isPublished,
}: PuckHeaderOverrideProps) {
  const { previewLanguage, setPreviewLanguage, availableLanguages } = usePuckLanguage();

  return (
    <header className="flex items-center gap-3 px-6 py-3 bg-background border-b">
      {/* Back Button */}
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      <div className="h-6 w-px bg-border" />

      {/* Page Title with Status */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="font-semibold text-base truncate">{slug}</span>

        {/* Status badges */}
        {publishing && (
          <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 font-medium whitespace-nowrap">
            Publishing...
          </span>
        )}
        {isPublished && !publishing && (
          <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium whitespace-nowrap">
            Live
          </span>
        )}
      </div>

      {/* Language Selector */}
      {availableLanguages.length > 1 && (
        <>
          <div className="h-6 w-px bg-border" />
          <Select value={previewLanguage} onValueChange={setPreviewLanguage}>
            <SelectTrigger className="w-[180px] h-8">
              <Globe className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableLanguages.map((lang) => (
                <SelectItem key={lang} value={lang}>
                  {LANGUAGES[lang] || lang} ({lang})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}

      <div className="h-6 w-px bg-border" />

      {/* Undo/Redo Buttons */}
      <UndoRedoButtons />

      <div className="h-6 w-px bg-border" />

      {/* Tools Section */}
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" onClick={onManageGroups}>
          <LayoutGrid className="h-4 w-4 mr-2" />
          Manage Groups
        </Button>
        <div className="h-6 w-px bg-border" />
        <Button variant="outline" size="sm" onClick={onPreview}>
          <Eye className="h-4 w-4 mr-2" />
          Preview
        </Button>
        <div className="h-6 w-px bg-border" />
        <ModeToggle />
        <Button size="sm" onClick={onPublish} disabled={publishing}>
          {publishing ? "Publishing..." : "Publish"}
        </Button>
      </div>
    </header>
  );
}
