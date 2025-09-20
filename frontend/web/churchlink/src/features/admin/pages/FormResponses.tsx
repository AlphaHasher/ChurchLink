import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import FormsTabs from '@/features/admin/components/Forms/FormsTabs';
import api from '@/api/api';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/shared/components/ui/pagination';
import { ArrowLeft, RefreshCcw } from 'lucide-react';

const useQuery = () => new URLSearchParams(useLocation().search);

const FormResponses = () => {
  const navigate = useNavigate();
  const query = useQuery();
  const formId = query.get('formId') || '';

  const [formMeta, setFormMeta] = useState<{ title: string; description?: string } | null>(null);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<{ submitted_at: string; response: Record<string, any> }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const fetchMeta = async () => {
      if (!formId) return;
      try {
        const resp = await api.get(`/v1/forms/${formId}`);
        setFormMeta({ title: resp.data?.title || 'Form', description: resp.data?.description });
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
      const skip = (page - 1) * pageSize;
      const resp = await api.get(`/v1/forms/${formId}/responses`, { params: { skip, limit: pageSize } });
      setCount(resp.data?.count || 0);
      setItems(resp.data?.items || []);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load responses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchResponses(); }, [formId, page, pageSize]);

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
            {loading && <div className="text-sm">Loading responses…</div>}
            {!loading && count === 0 && (
              <div className="text-sm text-muted-foreground">No responses yet.</div>
            )}
            {!loading && count > 0 && (
              <div className="space-y-3">
                {items.map((it, idx) => (
                  <div key={`${it.submitted_at}-${idx}`} className="border rounded p-3">
                    <div className="text-xs text-muted-foreground mb-2">Submitted: {formatDate(it.submitted_at)}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Object.entries(it.response || {}).map(([k, v]) => (
                        <div key={k} className="text-sm">
                          <span className="font-medium">{k}:</span> <span className="text-muted-foreground">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                      const items: React.ReactNode[] = [];
                      const maxToShow = 5;
                      let start = Math.max(1, page - 2);
                      let end = Math.min(totalPages, start + maxToShow - 1);
                      if (end - start < maxToShow - 1) {
                        start = Math.max(1, end - (maxToShow - 1));
                      }
                      if (start > 1) {
                        items.push(
                          <PaginationItem key={1}>
                            <PaginationLink href="#" isActive={page === 1} onClick={(e: any) => { e.preventDefault(); setPage(1); }}>1</PaginationLink>
                          </PaginationItem>
                        );
                        if (start > 2) items.push(<PaginationItem key="s-ellipsis"><span className="px-2">…</span></PaginationItem>);
                      }
                      for (let p = start; p <= end; p++) {
                        items.push(
                          <PaginationItem key={p}>
                            <PaginationLink href="#" isActive={p === page} onClick={(e: any) => { e.preventDefault(); setPage(p); }}>{p}</PaginationLink>
                          </PaginationItem>
                        );
                      }
                      if (end < totalPages) {
                        if (end < totalPages - 1) items.push(<PaginationItem key="e-ellipsis"><span className="px-2">…</span></PaginationItem>);
                        items.push(
                          <PaginationItem key={totalPages}>
                            <PaginationLink href="#" isActive={page === totalPages} onClick={(e: any) => { e.preventDefault(); setPage(totalPages); }}>{totalPages}</PaginationLink>
                          </PaginationItem>
                        );
                      }
                      return items;
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
