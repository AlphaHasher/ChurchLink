import { useMemo, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ColDef,
  GridApi,
  ICellRendererParams,
  ModuleRegistry,
} from "ag-grid-community";
import "ag-grid-community/styles/ag-theme-quartz.css";
ModuleRegistry.registerModules([AllCommunityModule]);

import {
  fmt,
} from "@/helpers/MembershipHelper";

import { MembershipRequest } from "@/shared/types/MembershipRequests";

import DetailedUserDialog from "../BaseUserTable/DetailedUserDialog";
import MembershipReviewDialog from "./MembershipReviewDialog";

type SortDir = "asc" | "desc";

interface MembershipRequestTableProps {
  data: MembershipRequest[];
  total: number;
  loading?: boolean;

  page: number;
  pageSize: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;

  onSortChange?: (field: string, dir: SortDir) => void;
  onSearchChange?: (field: "name" | "email", term: string) => void;

  onSave?: () => Promise<void> | void;
}

type Row = MembershipRequest & { name?: string };

const ActionsCellRenderer = (props: ICellRendererParams<Row>) => {
  const row = props.data;
  const { onSave } = (props.context || {}) as { onSave?: () => Promise<void> | void };
  if (!row) return null;

  return (
    <div className="flex items-center gap-2">
      <MembershipReviewDialog request={row} onUpdated={onSave} />
      <DetailedUserDialog userId={row.uid} onSaved={onSave} />
    </div>
  );
};

export default function MembershipRequestTable({
  data,
  total,
  loading,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  onSearchChange,
  onSave,
}: MembershipRequestTableProps) {
  const gridApiRef = useRef<GridApi | null>(null);

  const columnDefs: ColDef<Row>[] = useMemo(
    () => [
      {
        field: "name",
        headerName: "Name",
        sortable: true,
        filter: true,
        flex: 2,
        minWidth: 150,
        valueGetter: (p) => `${p.data?.first_name ?? ""} ${p.data?.last_name ?? ""}`.trim(),
      },
      {
        field: "email",
        headerName: "Email",
        sortable: true,
        filter: true,
        flex: 3,
        minWidth: 200,
      },
      {
        field: "created_on",
        headerName: "Submitted On",
        sortable: true,
        filter: false,
        flex: 2,
        minWidth: 180,
        valueGetter: (p) => fmt(p.data?.created_on),
      },
      { field: "uid", headerName: "UID", sortable: true, filter: false, flex: 2, minWidth: 200 },
      { headerName: "Actions", cellRenderer: ActionsCellRenderer, sortable: false, filter: false, width: 160 },
    ],
    []
  );

  const defaultColDef: ColDef = useMemo(() => ({ resizable: true }), []);

  const handleSortChanged = (ev: any) => {
    if (!onSortChange) return;
    const state = ev.api.getColumnState();
    const sorted = state.find((c: any) => c.sort != null);
    if (sorted?.colId) onSortChange(sorted.colId, (sorted.sort as SortDir) ?? "asc");
    else onSortChange("created_on", "asc");
  };

  const handleFilterChanged = (ev: any) => {
    if (!onSearchChange) return;
    const model = ev.api.getFilterModel?.() || {};
    const nameModel = model["name"];
    const emailModel = model["email"];
    const lastChangedColId = ev.column?.getColId?.();

    if (lastChangedColId === "name" && nameModel) return onSearchChange("name", nameModel.filter ?? "");
    if (lastChangedColId === "email" && emailModel) return onSearchChange("email", emailModel.filter ?? "");

    if (nameModel?.filter) onSearchChange("name", nameModel.filter);
    else if (emailModel?.filter) onSearchChange("email", emailModel.filter);
    else onSearchChange("name", "");
  };

  return (
    <div className="container mx-start">
      <div className="ag-theme-quartz" style={{ height: 600, width: "100%" }}>
        <AgGridReact
          rowData={data}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          suppressPaginationPanel={true}
          animateRows={true}
          enableCellTextSelection={true}
          onGridReady={(params) => {
            gridApiRef.current = params.api;
          }}
          onSortChanged={handleSortChanged}
          onFilterChanged={handleFilterChanged}
          suppressScrollOnNewData={true}
          overlayNoRowsTemplate={loading ? "<span></span>" : "<span>No membership requests found</span>"}
          context={{ onSave }}
        />
      </div>

      <ServerPager
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}

function ServerPager({
  total,
  page,
  pageSize,
  loading,
  onPageChange,
  onPageSizeChange,
}: {
  total: number;
  page: number;
  pageSize: number;
  loading?: boolean;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil((total || 0) / (pageSize || 10)));
  const canPrev = page > 0;
  const canNext = page + 1 < totalPages;
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);

  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <div className="text-muted-foreground">
        {loading ? "Loading…" : `Showing ${from}-${to} of ${total}`}
      </div>
      <div className="flex items-center gap-2">
        <button
          className="px-2 py-1 border rounded disabled:opacity-50"
          onClick={() => onPageChange?.(Math.max(0, page - 1))}
          disabled={loading || !canPrev}
        >
          Prev
        </button>
        <span>
          Page {Math.min(page + 1, totalPages)} of {totalPages}
        </span>
        <button
          className="px-2 py-1 border rounded disabled:opacity-50"
          onClick={() => onPageChange?.(Math.min(totalPages - 1, page + 1))}
          disabled={loading || !canNext}
        >
          Next
        </button>

        <select
          className="ml-2 border rounded px-2 py-1"
          value={pageSize}
          onChange={(e) => onPageSizeChange?.(parseInt(e.target.value, 10))}
          disabled={loading}
        >
          {[10, 25, 50].map((s) => (
            <option key={s} value={s}>
              {s}/page
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
