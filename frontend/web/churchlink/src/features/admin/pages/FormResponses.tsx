import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import FormsTabs from '@/features/admin/components/Forms/FormsTabs';
import api from '@/api/api';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/shared/components/ui/card';
// pagination/select removed for simplified view
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/shared/components/ui/pagination';
import { ArrowLeft, RefreshCcw } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';

const useQuery = () => new URLSearchParams(useLocation().search);

const FormResponses = () => {
  const navigate = useNavigate();
  const query = useQuery();
  const formId = query.get('formId') || '';

  const [formMeta, setFormMeta] = useState<{ title: string; description?: string; data?: any[] } | null>(null);
  type Col = { key: string; label: string };
  const [columns, setColumns] = useState<Col[]>([]);
  // We will display raw user_id as recorded in DB. No name resolution here.
  const [count, setCount] = useState(0);
  const [rawItems, setRawItems] = useState<{ submitted_at: string; user_id?: string; response: Record<string, any> }[]>([]);
  const [items, setItems] = useState<{ submitted_at: string; user_id?: string; response: Record<string, any> }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchMeta = async () => {
      if (!formId) return;
      try {
        const resp = await api.get(`/v1/forms/${formId}`);
        const meta = { title: resp.data?.title || 'Form', description: resp.data?.description };
        setFormMeta(meta);
        setColumns([{ key: '__user__', label: 'User' }, { key: '__submitted__', label: 'Submitted' }]);
      } catch (e) {
        // ignore
      }
    };
    fetchMeta();
  }, [formId]);
  const fetchResponses = async () => {
    if (!formId) return;
    const hasFilters = Object.values(filters).some((v) => v && v.trim() !== '');
    const showLoading = !hasFilters; // avoid hiding table when user is typing filters
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const skip = hasFilters ? 0 : (page - 1) * pageSize;
      const fetchLimit = hasFilters ? 500 : pageSize; // backend enforces a 500 limit
      const resp = await api.get(`/v1/forms/${formId}/responses`, { params: { skip, limit: fetchLimit } });
      const total = resp.data?.count || 0;
      let fetched = resp.data?.items || [];
      if (!Array.isArray(fetched)) fetched = [];
      setRawItems(fetched);
      // If no filters, show paginated fetched items directly and keep backend count
      if (!hasFilters) {
        setItems(fetched);
        setCount(total);
      }
      // If filters are active and total exceeds fetchLimit, warn user that results are limited
      if (hasFilters) {
        if (total > fetchLimit) setNotice(`Filtering applied to first ${fetchLimit} responses (server limit). Results may be incomplete.`);
        else setNotice(null);
      } else {
        setNotice(null);
      }

      // Only update columns when not actively filtering to avoid remounting inputs while user types
      if (!hasFilters) {
        // Union any extra keys from responses that aren't in columns yet
        const existingKeys = new Set<string>(columns.map((c) => c.key));
        const extra: Col[] = [];
        for (const it of fetched) {
          const respObj = it?.response || {};
          Object.keys(respObj).forEach((k) => {
            if (!existingKeys.has(k)) {
              existingKeys.add(k);
              extra.push({ key: k, label: k });
            }
          });
        }
        if (extra.length > 0) {
          // Keep Submitted as first column; append extras at the end
          setColumns((prev) => {
            const userCol = prev.find((c) => c.key === '__user__');
            const submitted = prev.find((c) => c.key === '__submitted__');
            const others = prev.filter((c) => c.key !== '__submitted__' && c.key !== '__user__');
            return [userCol!, submitted!, ...others, ...extra];
          });
        }
      }

      // No user name resolution here; frontend will display raw user_id as-is.
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      // avoid storing/rendering non-string objects directly in the UI
      const msg = typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : 'Failed to load responses';
      setError(msg);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => { fetchResponses(); }, [formId, page, pageSize]);

  // When rawItems or filters (or pagination) change, compute filtered items and paginated display
  useEffect(() => {
    const applyFilters = () => {
      const fkeys = Object.keys(filters).filter((k) => filters[k] && filters[k].trim() !== '');
      let filtered = rawItems.slice();
      if (fkeys.length > 0) {
        filtered = filtered.filter((it) => {
          const resp = it.response || {};
          for (const k of fkeys) {
            const want = (filters[k] || '').toLowerCase();
            let val: any = undefined;
            if (k === '__user__') val = (it as any).user_id;
            else if (k === '__submitted__') val = it.submitted_at;
            else val = resp[k];
            const sval = val === null || val === undefined ? '' : String(val).toLowerCase();
            if (!sval.includes(want)) return false;
          }
          return true;
        });
      }
      // update count to filtered length
      setCount(filtered.length);
      // apply paging
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      setItems(filtered.slice(start, end));
    };
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawItems, filters, page, pageSize]);

  // Debounced fetch when filters change so typing doesn't trigger immediate fetches and steal focus
  useEffect(() => {
    const hasFilters = Object.values(filters).some((v) => v && v.trim() !== '');
    if (!hasFilters) {
      // filters cleared -> refresh immediately to show paginated backend results
      fetchResponses();
      return;
    }
    const t = setTimeout(() => {
      fetchResponses();
    }, 300);
    return () => clearTimeout(t);
  }, [filters]);
  const totalPages = Math.max(1, Math.ceil((count || 0) / pageSize));

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return iso;
    }
  };

  // Ensure columns are unique by key before rendering to avoid duplicate React keys. Causes bunch of errors without this
  const uniqueColumns = columns.filter((c, i, arr) => arr.findIndex((x) => x.key === c.key) === i);

  const SubmittedCell = ({ iso }: { iso?: string }) => {
    return <TableCell>{formatDate(iso)}</TableCell>;
  };

  const UserCell = ({ uid }: { uid?: string }) => {
    return <TableCell>{uid ?? '—'}</TableCell>;
  };

  const ValueCell = ({ value }: { value: any }) => {
    let display = '';
    if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) display = '—';
    else if (typeof value === 'boolean') display = value ? 'Yes' : 'No';
    else if (Array.isArray(value)) display = value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ');
    else if (typeof value === 'object') display = JSON.stringify(value);
    else display = String(value);
    return <TableCell>{display}</TableCell>;
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => navigate('/admin/forms/manage-forms')} title="Back to Manage Forms">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h1 className="text-2xl font-semibold mb-4">Form Responses</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchResponses} title="Refresh"><RefreshCcw className="h-4 w-4" /></Button>
        </div>
      </div>

      <FormsTabs />

      <div className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>
              {formMeta ? (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{formMeta.title}</div>
                    {formMeta.description ? <div className="text-sm text-muted-foreground">{formMeta.description}</div> : null}
                  </div>
                  <div className="text-sm text-muted-foreground">{count === 0 ? 'No responses' : `${count} response${count === 1 ? '' : 's'}`}</div>
                </div>
              ) : (
                <div className="text-muted-foreground">Loading form…</div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && <div className="text-sm text-destructive mb-3">{error}</div>}
            {notice && <div className="text-sm text-yellow-800 mb-3 p-2 bg-yellow-50 border border-yellow-100 rounded">{notice}</div>}
            {loading && <div className="text-sm">Loading responses…</div>}
            {/* Always render table header + filter inputs so user can adjust filters even when there are no results */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {uniqueColumns.map((col, idx) => (
                      <TableHead key={col?.key ?? `col-${idx}`}>{col?.label ?? String(col?.key ?? `Column ${idx + 1}`)}</TableHead>
                    ))}
                  </TableRow>
                  {/* filter inputs row */}
                  <TableRow>
                    {uniqueColumns.map((col, idx) => (
                      <TableHead key={`f-${col?.key ?? idx}`}>
                        <input
                          className="w-full px-2 py-1 border rounded text-sm"
                          placeholder="Filter"
                          value={filters[col?.key ?? ''] || ''}
                          onChange={(e) => {
                            const key = col?.key ?? '';
                            const v = e.target.value;
                            setFilters((prev) => ({ ...prev, [key]: v }));
                            setPage(1);
                          }}
                        />
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={Math.max(1, uniqueColumns.length)} className="text-sm text-muted-foreground p-4">
                        {loading ? 'Loading responses…' : 'No matching responses.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((it, idx) => {
                      const resp = it.response || {};
                      return (
                        <TableRow key={`${it.submitted_at}-${idx}`}>
                          {uniqueColumns.map((col, cidx) => {
                            const key = col?.key ?? '';
                            if (key === '__submitted__') return <SubmittedCell key={`s-${idx}-${cidx}`} iso={it.submitted_at} />;
                            if (key === '__user__') {
                              const uid = (it as any).user_id;
                              // show raw user_id as recorded in DB
                              return <UserCell key={`u-${idx}-${cidx}`} uid={uid} />;
                            }
                            const val = resp[key];
                            return <ValueCell key={`${idx}-${key}-${cidx}`} value={val} />;
                          })}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          <CardFooter className="flex items-center justify-between">
            <div />
            {count > 0 && (
              <div className="flex items-center gap-2">
                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                  <SelectTrigger className="w-24">
                    <SelectValue placeholder="Rows" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={(e: any) => { e.preventDefault(); setPage((p) => Math.max(1, p - 1)); }}
                        href="#"
                        className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                    {(() => {
                      const itemsNodes: React.ReactNode[] = [];
                      const maxToShow = 5;
                      let start = Math.max(1, page - 2);
                      let end = Math.min(totalPages, start + maxToShow - 1);
                      if (end - start < maxToShow - 1) {
                        start = Math.max(1, end - (maxToShow - 1));
                      }
                      if (start > 1) {
                        itemsNodes.push(
                          <PaginationItem key={1}>
                            <PaginationLink href="#" isActive={page === 1} onClick={(e: any) => { e.preventDefault(); setPage(1); }}>1</PaginationLink>
                          </PaginationItem>
                        );
                        if (start > 2) itemsNodes.push(<PaginationItem key="s-ellipsis"><span className="px-2">…</span></PaginationItem>);
                      }
                      for (let p = start; p <= end; p++) {
                        itemsNodes.push(
                          <PaginationItem key={p}>
                            <PaginationLink href="#" isActive={p === page} onClick={(e: any) => { e.preventDefault(); setPage(p); }}>{p}</PaginationLink>
                          </PaginationItem>
                        );
                      }
                      if (end < totalPages) {
                        if (end < totalPages - 1) itemsNodes.push(<PaginationItem key="e-ellipsis"><span className="px-2">…</span></PaginationItem>);
                        itemsNodes.push(
                          <PaginationItem key={totalPages}>
                            <PaginationLink href="#" isActive={page === totalPages} onClick={(e: any) => { e.preventDefault(); setPage(totalPages); }}>{totalPages}</PaginationLink>
                          </PaginationItem>
                        );
                      }
                      return itemsNodes;
                    })()}
                    <PaginationItem>
                      <PaginationNext
                        onClick={(e: any) => { e.preventDefault(); setPage((p) => Math.min(totalPages, p + 1)); }}
                        href="#"
                        className={page >= totalPages ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default FormResponses;
