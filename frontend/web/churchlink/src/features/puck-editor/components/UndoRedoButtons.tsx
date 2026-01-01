import { Button } from "@/shared/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { Redo2, Undo2 } from "lucide-react";
import { createUsePuck } from "@measured/puck";

// Create a selector-based hook for better performance (avoids unnecessary re-renders)
const usePuck = createUsePuck();

/**
 * Undo/Redo buttons that use Puck's internal history.
 * Must be rendered inside the Puck component (e.g., in header override).
 */
export function UndoRedoButtons() {
  const history = usePuck((s) => s.history);

  // hasPast/hasFuture are booleans, back/forward are functions
  const canUndo = history.hasPast ?? false;
  const canRedo = history.hasFuture ?? false;

  const handleUndo = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    history.back();
  };

  const handleRedo = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    history.forward();
  };

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleUndo}
            onMouseDown={(e) => e.preventDefault()}
            disabled={!canUndo}
            aria-label="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Undo (Ctrl+Z)</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRedo}
            onMouseDown={(e) => e.preventDefault()}
            disabled={!canRedo}
            aria-label="Redo"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Redo (Ctrl+Shift+Z)</TooltipContent>
      </Tooltip>
    </div>
  );
}
