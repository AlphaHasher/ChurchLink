import { useState, useMemo, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  ColDef,
  ICellRendererParams,
  ModuleRegistry,
  AllCommunityModule
} from "ag-grid-community";
import "ag-grid-community/styles/ag-theme-quartz.css";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/components/ui/Dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Edit,
  Copy,
  Lock,
  Unlock,
  Trash,
} from "lucide-react";
import { useCustomTemplates, type CustomTemplate } from "../hooks/useCustomTemplates";

ModuleRegistry.registerModules([AllCommunityModule]);

interface ManageGroupsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Actions cell renderer
const ActionsCellRenderer = (props: ICellRendererParams<CustomTemplate>) => {
  const { data, context } = props;
  if (!data) return null;

  const {
    handleEdit,
    handleDuplicate,
    handleToggleLock,
    setDeleteTarget,
  } = context;

  return (
    <div className="flex items-center justify-start gap-2 h-full">
      <Button size="sm" variant="outline" onClick={() => handleEdit(data._id)}>
        <Edit className="h-4 w-4 mr-2" /> Edit
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleDuplicate(data._id)}>
            <Copy className="h-4 w-4 mr-2" /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleToggleLock(data._id, data.locked ?? false)}>
            {data.locked ? (
              <>
                <Unlock className="h-4 w-4 mr-2" /> Unlock
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 mr-2" /> Lock
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-red-600"
            onClick={() => setDeleteTarget(data)}
            disabled={data.locked}
          >
            <Trash className="h-4 w-4 mr-2" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export function ManageGroupsDialog({ open, onOpenChange }: ManageGroupsDialogProps) {
  const {
    templates,
    loading,
    duplicateTemplate,
    toggleLock,
    deleteTemplate,
  } = useCustomTemplates();

  const gridRef = useRef<AgGridReact<CustomTemplate>>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomTemplate | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [unlockTarget, setUnlockTarget] = useState<CustomTemplate | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const handleEdit = (groupId: string) => {
    // Open in new tab
    const url = `/admin/webbuilder/group/${groupId}/edit`;
    window.open(url, "_blank");
  };

  const handleDuplicate = async (groupId: string) => {
    try {
      setStatus("Duplicating...");
      await duplicateTemplate(groupId);
      setStatus("Duplicated successfully");
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      console.error("Failed to duplicate:", err);
      setStatus("Failed to duplicate");
      setTimeout(() => setStatus(null), 3000);
    }
  };

  const handleToggleLock = async (groupId: string, currentLocked: boolean) => {
    try {
      setStatus(currentLocked ? "Unlocking..." : "Locking...");
      await toggleLock(groupId, currentLocked);
      setStatus(currentLocked ? "Unlocked" : "Locked");
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      console.error("Failed to toggle lock:", err);
      setStatus("Failed to toggle lock");
      setTimeout(() => setStatus(null), 3000);
    }
  };

  const handleDeleteAttempt = (template: CustomTemplate) => {
    if (template.locked) {
      setUnlockTarget(template);
    } else {
      setDeleteTarget(template);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteConfirmName !== deleteTarget.name) {
      setStatus("Name doesn't match");
      setTimeout(() => setStatus(null), 3000);
      return;
    }

    try {
      setStatus("Deleting...");
      await deleteTemplate(deleteTarget._id);
      setStatus("Deleted successfully");
      setDeleteTarget(null);
      setDeleteConfirmName("");
      setTimeout(() => setStatus(null), 3000);
    } catch (err: unknown) {
      console.error("Failed to delete:", err);
      const message = err instanceof Error ? err.message : "Failed to delete";
      setStatus(message);
      setTimeout(() => setStatus(null), 3000);
    }
  };

  const columnDefs = useMemo<ColDef<CustomTemplate>[]>(() => [
    {
      field: "name",
      headerName: "Group Name",
      flex: 2,
      sortable: true,
      filter: true,
    },
    {
      field: "description",
      headerName: "Description",
      flex: 2,
      sortable: true,
      filter: true,
      valueFormatter: (params) => params.value || "—",
    },
    {
      field: "created_at",
      headerName: "Created",
      flex: 1,
      sortable: true,
      valueFormatter: (params) => {
        if (!params.value) return "—";
        return new Date(params.value).toLocaleDateString();
      },
    },
    {
      field: "locked",
      headerName: "Status",
      width: 100,
      cellRenderer: (params: ICellRendererParams<CustomTemplate>) => {
        const locked = params.data?.locked ?? false;
        return locked ? (
          <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded font-medium">
            Locked
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded font-medium">
            Unlocked
          </span>
        );
      },
    },
    {
      headerName: "Actions",
      flex: 2,
      cellRenderer: ActionsCellRenderer,
      sortable: false,
      filter: false,
    },
  ], []);

  const gridContext = {
    handleEdit,
    handleDuplicate,
    handleToggleLock,
    setDeleteTarget: handleDeleteAttempt,
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Manage Custom Groups</DialogTitle>
            <DialogDescription>
              Edit, duplicate, lock, or delete your saved group templates.
            </DialogDescription>
          </DialogHeader>

          <div className="mb-2">
            {status && (
              <div className="text-sm text-muted-foreground">{status}</div>
            )}
          </div>

          <div className="ag-theme-quartz" style={{ height: 400, width: "100%" }}>
            <AgGridReact<CustomTemplate>
              ref={gridRef}
              rowData={templates}
              columnDefs={columnDefs}
              context={gridContext}
              pagination={true}
              paginationPageSize={10}
              loading={loading}
              defaultColDef={{
                resizable: true,
                sortable: false,
                filter: false,
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Unlock Required Dialog */}
      <AlertDialog
        open={!!unlockTarget}
        onOpenChange={(open) => !open && setUnlockTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Group is Locked</AlertDialogTitle>
            <AlertDialogDescription>
              This group is locked. You must unlock it before you can delete it.
              Type the group name exactly to unlock: <strong>{unlockTarget?.name}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder="Type group name to unlock"
            value={deleteConfirmName}
            onChange={(e) => setDeleteConfirmName(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setUnlockTarget(null);
              setDeleteConfirmName("");
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (unlockTarget && deleteConfirmName === unlockTarget.name) {
                  await handleToggleLock(unlockTarget._id, true);
                  setUnlockTarget(null);
                  setDeleteConfirmName("");
                }
              }}
              disabled={deleteConfirmName !== unlockTarget?.name}
            >
              Unlock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteConfirmName("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Type the group name exactly to confirm: <strong>{deleteTarget?.name}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder="Type group name to confirm"
            value={deleteConfirmName}
            onChange={(e) => setDeleteConfirmName(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteTarget(null);
              setDeleteConfirmName("");
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteConfirmName !== deleteTarget?.name}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
