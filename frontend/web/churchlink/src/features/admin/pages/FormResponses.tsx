import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import FormsTabs from '@/features/admin/components/Forms/FormsTabs';
import api from '@/api/api';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/shared/components/ui/pagination';
import { ArrowLeft, RefreshCcw, Download, ChevronUp, ChevronDown } from 'lucide-react';
import { fetchResponsesAndDownloadCsv } from '@/shared/utils/csvExport';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Skeleton } from '@/shared/components/ui/skeleton';

const useQuery = () => new URLSearchParams(useLocation().search);

const FormResponses = () => {
  const navigate = useNavigate();
  const query = useQuery();
  const formId = query.get('formId') || '';

  const [formMeta, setFormMeta] = useState<{ title: string; description?: string; data?: any[] } | null>(null);
  type Col = { key: string; label: string; type?: 'text' | 'date' | 'time' | 'number' };
  const [columns, setColumns] = useState<Col[]>([]);
  const [count, setCount] = useState(0);
  const [rawItems, setRawItems] = useState<{ submitted_at: string; user_id?: string; response: Record<string, any> }[]>([]);
  const [items, setItems] = useState<{ submitted_at: string; user_id?: string; response: Record<string, any> }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortField, setSortField] = useState<string>('__submitted__');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Helper function to detect field type from values
  const detectFieldType = (values: any[]): 'text' | 'date' | 'time' | 'number' => {
    for (const val of values) {
      if (val === null || val === undefined || val === '') continue;
      const str = String(val);
      
      // Check for time format (HH:MM or HH:MM:SS)
      if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(str)) {
        return 'time';
      }
      
      // Check for date format (various ISO formats)
      if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/.test(str)) {
        return 'date';
      }
      
      // Check if it's a number
      if (!isNaN(Number(str)) && str.trim() !== '') {
        return 'number';
      }
    }
    return 'text';
  };

  useEffect(() => {
    const fetchMeta = async () => {
      if (!formId) return;
      try {
        const resp = await api.get(`/v1/forms/${formId}`);
        const meta = { title: resp.data?.title || 'Form', description: resp.data?.description };
        setFormMeta(meta);
        setColumns([
          { key: '__user__', label: 'User', type: 'text' }, 
          { key: '__submitted__', label: 'Submitted', type: 'date' }
        ]);
      } catch (e) {
        // ignore
      }
    };
    fetchMeta();
  }, [formId]);
  const fetchResponses = async () => {
    if (!formId) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get(`/v1/forms/${formId}/responses`);
      let fetched = resp.data?.items || [];
      if (!Array.isArray(fetched)) fetched = [];
      setRawItems(fetched);
      setNotice(null);

      const existingKeys = new Set<string>(columns.map((c) => c.key));
      const extra: Col[] = [];
      const fieldValues: Record<string, any[]> = {};
      
      // Collect all values for each field to detect types
      for (const it of fetched) {
        const respObj = it?.response || {};
        Object.keys(respObj).forEach((k) => {
          if (!fieldValues[k]) fieldValues[k] = [];
          fieldValues[k].push(respObj[k]);
          
          if (!existingKeys.has(k)) {
            existingKeys.add(k);
          }
        });
      }
      
      // Create columns with detected types
      Object.keys(fieldValues).forEach((k) => {
        if (!existingKeys.has(k)) return;
        const isExtraCol = !columns.some((c) => c.key === k);
        if (isExtraCol) {
          const type = detectFieldType(fieldValues[k]);
          extra.push({ key: k, label: k, type });
        }
      });
      
      if (extra.length > 0) {
        // Keep Submitted as first column; append extras at the end
        setColumns((prev) => {
          const userCol = prev.find((c) => c.key === '__user__');
          const submitted = prev.find((c) => c.key === '__submitted__');
          const others = prev.filter((c) => c.key !== '__submitted__' && c.key !== '__user__');
          return [userCol!, submitted!, ...others, ...extra];
        });
      }

    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      // avoid storing/rendering non-string objects directly in the UI
      const msg = typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : 'Failed to load responses';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchResponses(); }, [formId]);

  useEffect(() => {
    const applyFilters = () => {
      const fkeys = Object.keys(filters).filter((k) => filters[k] && filters[k].trim() !== '');
      let filtered = rawItems.slice();
      
      // Apply filters
      if (fkeys.length > 0) {
        filtered = filtered.filter((it) => {
          const resp = it.response || {};
          for (const k of fkeys) {
            const want = (filters[k] || '').toLowerCase().trim();
            let val: any = undefined;
            
            if (k === '__user__') val = (it as any).user_id;
            else if (k === '__submitted__') val = it.submitted_at;
            else val = resp[k];
            
            const column = columns.find((c) => c.key === k);
            const fieldType = column?.type || 'text';
            
            // Handle different field types
            if (fieldType === 'date') {
              // For date filtering
              if (val) {
                // Create date objects and compare the actual date components
                const originalDate = new Date(val);
                const filterDate = new Date(want + 'T00:00:00'); // Add time to ensure local timezone
                
                // Compare year, month, and date components directly to avoid timezone issues
                const originalDateStr = originalDate.getFullYear() + '-' + 
                  String(originalDate.getMonth() + 1).padStart(2, '0') + '-' + 
                  String(originalDate.getDate()).padStart(2, '0');
                  
                const filterDateStr = filterDate.getFullYear() + '-' + 
                  String(filterDate.getMonth() + 1).padStart(2, '0') + '-' + 
                  String(filterDate.getDate()).padStart(2, '0');
                
                if (originalDateStr !== filterDateStr) return false;
              } else if (want !== '') {
                return false;
              }
            } else if (fieldType === 'time') {
              // For time filtering, match HH:MM format
              if (val) {
                const timeStr = String(val).toLowerCase();
                if (!timeStr.includes(want)) return false;
              } else if (want !== '') {
                return false;
              }
            } else {
              // Text and number filtering (default behavior)
              const sval = val === null || val === undefined ? '' : String(val).toLowerCase();
              if (!sval.includes(want)) return false;
            }
          }
          return true;
        });
      }
      
      // Apply sorting
      filtered.sort((a, b) => {
        let aVal: any = undefined;
        let bVal: any = undefined;
        
        if (sortField === '__user__') {
          aVal = (a as any).user_id || '';
          bVal = (b as any).user_id || '';
        } else if (sortField === '__submitted__') {
          aVal = a.submitted_at;
          bVal = b.submitted_at;
        } else {
          aVal = a.response?.[sortField];
          bVal = b.response?.[sortField];
        }
        
        // Handle null/undefined values
        if (aVal === null || aVal === undefined) aVal = '';
        if (bVal === null || bVal === undefined) bVal = '';
        
        const column = columns.find((c) => c.key === sortField);
        const fieldType = column?.type || 'text';
        
        // Type-specific comparison
        if (fieldType === 'date') {
          const aDate = aVal ? new Date(aVal).getTime() : 0;
          const bDate = bVal ? new Date(bVal).getTime() : 0;
          return sortDirection === 'desc' ? bDate - aDate : aDate - bDate;
        } else if (fieldType === 'number') {
          const aNum = parseFloat(String(aVal)) || 0;
          const bNum = parseFloat(String(bVal)) || 0;
          return sortDirection === 'desc' ? bNum - aNum : aNum - bNum;
        } else if (fieldType === 'time') {
          // Convert time to minutes for comparison
          const timeToMinutes = (timeStr: string): number => {
            const [hours, minutes] = String(timeStr).split(':').map(Number);
            return (hours || 0) * 60 + (minutes || 0);
          };
          const aMin = timeToMinutes(String(aVal));
          const bMin = timeToMinutes(String(bVal));
          return sortDirection === 'desc' ? bMin - aMin : aMin - bMin;
        } else {
          // Text comparison
          const aStr = String(aVal).toLowerCase();
          const bStr = String(bVal).toLowerCase();
          if (sortDirection === 'desc') {
            return bStr.localeCompare(aStr);
          } else {
            return aStr.localeCompare(bStr);
          }
        }
      });
      
      setCount(filtered.length);
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      setItems(filtered.slice(start, end));
    };
    applyFilters();
  }, [rawItems, filters, page, pageSize, sortField, sortDirection, columns]);
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

  const exportCsv = async () => {
    if (!formId) return;
    const existingColumns: Col[] = columns.slice();
    try {
      await fetchResponsesAndDownloadCsv(formId, { existingColumns, limit: 500, filename: `${formMeta?.title || 'responses'}.csv` });
    } catch (e) {
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setPage(1);
  };

  const renderFilterInput = (col: Col) => {
    const key = col?.key ?? '';
    const fieldType = col?.type || 'text';
    
    if (fieldType === 'date' && key === '__submitted__') {
      // Special date input for submitted date
      return (
        <input
          type="date"
          className="w-full px-2 py-1 border rounded text-sm"
          placeholder="Filter date"
          value={filters[key] || ''}
          onChange={(e) => {
            setFilters((prev) => ({ ...prev, [key]: e.target.value }));
            setPage(1);
          }}
        />
      );
    } else if (fieldType === 'date') {
      // Date input for other date fields
      return (
        <input
          type="date"
          className="w-full px-2 py-1 border rounded text-sm"
          placeholder="Filter date"
          value={filters[key] || ''}
          onChange={(e) => {
            setFilters((prev) => ({ ...prev, [key]: e.target.value }));
            setPage(1);
          }}
        />
      );
    } else if (fieldType === 'time') {
      // Time input for time fields
      return (
        <input
          type="time"
          className="w-full px-2 py-1 border rounded text-sm"
          placeholder="Filter time"
          value={filters[key] || ''}
          onChange={(e) => {
            setFilters((prev) => ({ ...prev, [key]: e.target.value }));
            setPage(1);
          }}
        />
      );
    } else {
      // Default text input
      return (
        <input
          className="w-full px-2 py-1 border rounded text-sm"
          placeholder="Filter"
          value={filters[key] || ''}
          onChange={(e) => {
            setFilters((prev) => ({ ...prev, [key]: e.target.value }));
            setPage(1);
          }}
        />
      );
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
          <Button variant="outline" size="sm" onClick={exportCsv} title="Export responses as CSV"><Download className="h-4 w-4" /></Button>
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
                <div className="w-full">
                  <Skeleton className="h-6 w-1/3" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && <div className="text-sm text-destructive mb-3">{error}</div>}
            {notice && <div className="text-sm text-yellow-800 mb-3 p-2 bg-yellow-50 border border-yellow-100 rounded">{notice}</div>}
            {loading && (
              <div className="space-y-3 mb-3">
                <Skeleton className="h-4 w-1/4" />
                <div className="grid grid-cols-6 gap-3">
                  <Skeleton className="h-8 col-span-1" />
                  <Skeleton className="h-8 col-span-2" />
                  <Skeleton className="h-8 col-span-1" />
                  <Skeleton className="h-8 col-span-1" />
                  <Skeleton className="h-8 col-span-1" />
                </div>
              </div>
            )}
            {/* Always render table header + filter inputs so user can adjust filters even when there are no results */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {uniqueColumns.map((col, idx) => {
                      const key = col?.key ?? '';
                      const label = col?.label ?? String(col?.key ?? `Column ${idx + 1}`);
                      const isSorted = sortField === key;
                      return (
                        <TableHead key={col?.key ?? `col-${idx}`} className="select-none">
                          <Button
                            variant="ghost"
                            className="h-auto p-0 font-medium flex items-center gap-1 hover:bg-transparent"
                            onClick={() => handleSort(key)}
                          >
                            {label}
                            <div className="flex flex-col">
                              <ChevronUp 
                                className={`h-3 w-3 ${isSorted && sortDirection === 'asc' ? 'text-primary' : 'text-muted-foreground'}`} 
                              />
                              <ChevronDown 
                                className={`h-3 w-3 -mt-1 ${isSorted && sortDirection === 'desc' ? 'text-primary' : 'text-muted-foreground'}`} 
                              />
                            </div>
                          </Button>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                  {/* filter inputs row */}
                  <TableRow>
                    {uniqueColumns.map((col, idx) => (
                      <TableHead key={`f-${col?.key ?? idx}`}>
                        {renderFilterInput(col)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={Math.max(1, uniqueColumns.length)} className="text-sm text-muted-foreground p-4">
                        {loading ? (
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-1/4" />
                            <Skeleton className="h-6" />
                            <Skeleton className="h-6" />
                          </div>
                        ) : (
                          'No matching responses.'
                        )}
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
