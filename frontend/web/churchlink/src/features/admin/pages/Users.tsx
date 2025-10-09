import { useEffect, useMemo, useRef, useState } from "react";
import LogicalUserPermsTable from "@/features/admin/components/Users/LogicalUserOverview/LogicalUserPermsTable";
import UsersTable from "@/features/admin/components/Users/BaseUserTable/UsersTable";

import { applyBaseUserMask, applyUserPermLogicMask } from "@/helpers/DataFunctions";
import { fetchPermissions } from "@/helpers/PermissionsHelper";
import {
  fetchUsersPaged,
  fetchLogicalUsersPaged,
  type UsersSearchParams,
  type UsersPagedResult,
} from "@/helpers/UserHelper";

import { AccountPermissions } from "@/shared/types/AccountPermissions";
import { BaseUserMask, UserInfo } from "@/shared/types/UserInfo";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

type SortDir = "asc" | "desc";
type SortBy = "email" | "name" | "uid" | "createdOn";

const DEFAULT_PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 350;

const Users = () => {
  // ------- shared permissions (small set, fetch once) -------
  const [perms, setPerms] = useState<AccountPermissions[]>([]);
  const [permsLoading, setPermsLoading] = useState<boolean>(false);

  // ------- base users table state -------
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [page, setPage] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [sortBy, setSortBy] = useState<SortBy>("createdOn");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [searchField, setSearchField] = useState<"email" | "name">("name"); // NAME FIRST
  const [searchTermInput, setSearchTermInput] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [usersLoading, setUsersLoading] = useState<boolean>(false);

  // ------- logical users (roles != []) table state -------
  const [logicalUsers, setLogicalUsers] = useState<UserInfo[]>([]);
  const [totalLogical, setTotalLogical] = useState<number>(0);
  const [logicPage, setLogicPage] = useState<number>(0);
  const [logicPageSize, setLogicPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [logicSortBy, setLogicSortBy] = useState<SortBy>("name");
  const [logicSortDir, setLogicSortDir] = useState<SortDir>("asc");
  const [logicSearchField, setLogicSearchField] = useState<"email" | "name">("name");
  const [logicSearchInput, setLogicSearchInput] = useState<string>("");
  const [logicSearch, setLogicSearch] = useState<string>("");
  const [logicalLoading, setLogicalLoading] = useState<boolean>(false);

  // **NEW**: force-refresh token for logical view (fires effect even if page stays 0)
  const [logicReload, setLogicReload] = useState(0);

  // ------- abort controllers to cancel stale requests -------
  const usersAbortRef = useRef<AbortController | null>(null);
  const logicalAbortRef = useRef<AbortController | null>(null);

  // ------- fetch permissions once -------
  useEffect(() => {
    (async () => {
      setPermsLoading(true);
      const data = await fetchPermissions();
      setPerms(data);
      setPermsLoading(false);
    })();
  }, []);

  // ------- debounce base search -------
  useEffect(() => {
    const id = setTimeout(() => setSearchTerm(searchTermInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchTermInput]);

  // ------- debounce logical search -------
  useEffect(() => {
    const id = setTimeout(() => setLogicSearch(logicSearchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [logicSearchInput]);

  // ------- load base users page whenever query state changes -------
  useEffect(() => {
    (async () => {
      usersAbortRef.current?.abort();
      const controller = new AbortController();
      usersAbortRef.current = controller;
      setUsersLoading(true);

      const params: UsersSearchParams = {
        page,
        pageSize,
        searchField,
        searchTerm,
        sortBy,
        sortDir,
      };

      try {
        const res: UsersPagedResult = await fetchUsersPaged(params, controller.signal);
        setUsers(res.items);
      } catch (e) {
        console.error("Failed to load users page", e);
      } finally {
        setUsersLoading(false);
      }
    })();
  }, [page, pageSize, searchField, searchTerm, sortBy, sortDir]);

  // ------- load logical users page whenever its query state changes -------
  useEffect(() => {
    (async () => {
      logicalAbortRef.current?.abort();
      const controller = new AbortController();
      logicalAbortRef.current = controller;
      setLogicalLoading(true);

      const params: UsersSearchParams = {
        page: logicPage,
        pageSize: logicPageSize,
        searchField: logicSearchField,
        searchTerm: logicSearch,
        sortBy: logicSortBy,
        sortDir: logicSortDir,
      };

      try {
        const res: UsersPagedResult = await fetchLogicalUsersPaged(params, controller.signal);
        setLogicalUsers(res.items);
        setTotalLogical(res.total);
      } catch (e) {
        console.error("Failed to load logical users page", e);
      } finally {
        setLogicalLoading(false);
      }
    })();
    // **NOTE**: add logicReload to deps so we can force a refetch on demand
  }, [logicPage, logicPageSize, logicSearchField, logicSearch, logicSortBy, logicSortDir, logicReload]);

  // ------- masks for the tables -------
  const baseRows: BaseUserMask[] = useMemo(
    () => applyBaseUserMask(users, perms),
    [users, perms]
  );
  const logicalRows = useMemo(
    () => applyUserPermLogicMask(logicalUsers, perms),
    [logicalUsers, perms]
  );

  // ------- handlers -------
  const handleBaseSortChange = (field: string, dir: SortDir) => {
    const map: Record<string, SortBy> = { name: "name", email: "email", uid: "uid" };
    setSortBy(map[field] ?? "createdOn");
    setSortDir(dir);
    setPage(0);
  };

  const handleLogicalSortChange = (field: string, dir: SortDir) => {
    const map: Record<string, SortBy> = { name: "name", email: "email", uid: "uid" };
    setLogicSortBy(map[field] ?? "name");
    setLogicSortDir(dir);
    setLogicPage(0);
  };

  // called after AssignRolesDialog saves
  const refreshAfterRoleChange = async () => {
    // base table: keep position
    setPage((p) => p);
    // logical table: jump to first page for visibility AND force a refetch
    setLogicPage(0);
    setLogicReload((x) => x + 1);   // <-- hard refresh even if already on page 0
  };

  return (
    <div className="p-6 overflow-x-hidden">
      <h1 className="text-xl font-bold mb-4">Users Overview</h1>

      {/* Top controls for BASE table: shadcn Select (Name-first) + input */}
      <div className="flex gap-2 items-center mb-3">
        <Select
          value={searchField}
          onValueChange={(val: "name" | "email") => {
            setSearchField(val);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Search field" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Search by Name</SelectItem>
            <SelectItem value="email">Search by Email</SelectItem>
          </SelectContent>
        </Select>

        <input
          value={searchTermInput}
          onChange={(e) => {
            setSearchTermInput(e.target.value);
            setPage(0);
          }}
          placeholder={`Type to search ${searchField}...`}
          className="border rounded px-3 py-1 w-80"
        />
      </div>

      <UsersTable
        data={baseRows}
        permData={perms}
        loading={usersLoading || permsLoading}
        page={page}
        pageSize={pageSize}
        onPageChange={(p) => setPage(p)}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(0);
        }}
        onSortChange={handleBaseSortChange}
        onSearchChange={(field, term) => {
          setSearchField(field);
          setSearchTermInput(term);
          setPage(0);
        }}
        onSave={refreshAfterRoleChange}
      />

      <h1 className="text-xl font-bold mb-4 mt-8">User Permissions Logical Overview</h1>

      {/* Top controls for LOGICAL table: shadcn Select (Name-first) + input */}
      <div className="flex gap-2 items-center mb-3">
        <Select
          value={logicSearchField}
          onValueChange={(val: "name" | "email") => {
            setLogicSearchField(val);
            setLogicPage(0);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Search field" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Search by Name</SelectItem>
            <SelectItem value="email">Search by Email</SelectItem>
          </SelectContent>
        </Select>

        <input
          value={logicSearchInput}
          onChange={(e) => {
            setLogicSearchInput(e.target.value);
            setLogicPage(0);
          }}
          placeholder={`Type to search ${logicSearchField}...`}
          className="border rounded px-3 py-1 w-80"
        />
      </div>

      <LogicalUserPermsTable
        data={logicalRows as any}
        loading={logicalLoading || permsLoading}
        total={totalLogical}
        page={logicPage}
        pageSize={logicPageSize}
        onPageChange={(p) => setLogicPage(p)}
        onPageSizeChange={(s) => {
          setLogicPageSize(s);
          setLogicPage(0);
        }}
        onSortChange={handleLogicalSortChange}
        onSearchChange={(field, term) => {
          setLogicSearchField(field);
          setLogicSearchInput(term);
          setLogicPage(0);
        }}
      />
    </div>
  );
};

export default Users;
