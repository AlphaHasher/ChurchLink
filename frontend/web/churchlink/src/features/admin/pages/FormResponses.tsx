import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import {
  ColDef,
  ICellRendererParams,
  ValueGetterParams,
  ModuleRegistry,
  ClientSideRowModelModule,
  PaginationModule,
  TextFilterModule,
  DateFilterModule
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-quartz.css';

// Register only the modules we need
ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  PaginationModule,
  TextFilterModule,
  DateFilterModule
]);

import FormsTabs from '@/features/admin/components/Forms/FormsTabs';
import api from '@/api/api';
import { fetchUserInfoByUId } from '@/helpers/UserHelper';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/Dialog';
import { ArrowLeft, RefreshCcw, Download, Eye } from 'lucide-react';
import { fetchResponsesAndDownloadCsv } from '@/shared/utils/csvExport';
import { Skeleton } from '@/shared/components/ui/skeleton';

const useQuery = () => new URLSearchParams(useLocation().search);

// Cell renderer for user name column
const UserNameCellRenderer = (props: ICellRendererParams) => {
  const { data } = props;
  if (!data) return null;

  const userId = data.user_id;
  const userData = userId ? props.context.userInfo[userId] : null;

  return <span>{userData?.name || (userId ? 'Loading...' : 'Anonymous')}</span>;
};

// Cell renderer for email column
const EmailCellRenderer = (props: ICellRendererParams) => {
  const { data } = props;
  if (!data) return null;

  const userId = data.user_id;
  const userData = userId ? props.context.userInfo[userId] : null;

  return <span>{userData?.email || '—'}</span>;
};

// Filter value getter for user name
const userNameFilterValueGetter = (params: ValueGetterParams) => {
  const userId = params.data?.user_id;
  const userData = userId ? params.context.userInfo[userId] : null;
  return userData?.name || (userId ? 'Loading...' : 'Anonymous');
};

// Filter value getter for email
const emailFilterValueGetter = (params: ValueGetterParams) => {
  const userId = params.data?.user_id;
  const userData = userId ? params.context.userInfo[userId] : null;
  return userData?.email || '';
};

// Cell renderer for preview button column
const PreviewCellRenderer = (props: ICellRendererParams) => {
  const { data, context } = props;
  if (!data) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => context.setPreviewResponse(data)}
    >
      <Eye className="h-4 w-4 mr-1" />
      Preview
    </Button>
  );
};

const FormResponses = () => {
  const navigate = useNavigate();
  const query = useQuery();
  const formId = query.get('formId') || '';

  const [formMeta, setFormMeta] = useState<{ title: string; description?: string; data?: any[] } | null>(null);
  const [responses, setResponses] = useState<{ submitted_at: string; user_id?: string; response: Record<string, any> }[]>([]);
  const [userInfo, setUserInfo] = useState<Record<string, { name: string; email: string }>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewResponse, setPreviewResponse] = useState<{ submitted_at: string; user_id?: string; response: Record<string, any> } | null>(null);

  useEffect(() => {
    const fetchMeta = async () => {
      if (!formId) return;
      try {
        const resp = await api.get(`/v1/forms/${formId}`);
        const meta = { title: resp.data?.title || 'Form', description: resp.data?.description, data: resp.data?.data };
        setFormMeta(meta);
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
      setResponses(fetched);

      // Preload user info for better performance
      const uniqueUserIds = [...new Set(fetched.map((item: any) => item.user_id).filter(Boolean))] as string[];
      if (uniqueUserIds.length > 0) {
        preloadUserInfo(uniqueUserIds);
      }
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : 'Failed to load responses';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const preloadUserInfo = async (userIds: string[]) => {
    const idsToFetch = userIds.filter(id => !userInfo[id]);
    if (idsToFetch.length === 0) return;

    const infoPromises = idsToFetch.map(async (uid) => {
      try {
        const userData = await fetchUserInfoByUId(uid);
        if (userData) {
          const name = userData.first_name && userData.last_name
            ? `${userData.first_name} ${userData.last_name}`
            : userData.first_name || userData.last_name || uid;
          const email = userData.email || '';
          return { uid, name, email };
        }
        return { uid, name: uid, email: '' };
      } catch (error) {
        console.error(`Failed to fetch info for user ${uid}:`, error);
        return { uid, name: uid, email: '' };
      }
    });

    try {
      const results = await Promise.all(infoPromises);
      const newUserInfo = results.reduce((acc, { uid, name, email }) => {
        acc[uid] = { name, email };
        return acc;
      }, {} as Record<string, { name: string; email: string }>);

      setUserInfo(prev => ({ ...prev, ...newUserInfo }));
    } catch (error) {
      console.error('Error preloading user info:', error);
    }
  };

  useEffect(() => { fetchResponses(); }, [formId]);

  // Column definitions for ag-grid
  const columnDefs: ColDef[] = [
    {
      headerName: 'User Name',
      field: 'user_id',
      flex: 2,
      minWidth: 150,
      cellRenderer: UserNameCellRenderer,
      filterValueGetter: userNameFilterValueGetter,
    },
    {
      headerName: 'Email',
      field: 'user_id',
      flex: 2,
      minWidth: 200,
      cellRenderer: EmailCellRenderer,
      filterValueGetter: emailFilterValueGetter,
    },
  {
    headerName: 'Submitted',
    field: 'submitted_at',
    flex: 1,
    minWidth: 150,
    valueFormatter: (params) => formatDate(params.value),
    filter: 'agDateColumnFilter',
    filterParams: {
      comparator: (filterLocalDateAtMidnight: Date, cellValue: string) => {
        if (!cellValue) return -1;
        const cellDate = new Date(cellValue);

        // Compare only date parts (year, month, day)
        const filterDate = new Date(filterLocalDateAtMidnight);
        filterDate.setHours(0, 0, 0, 0);

        const compareDate = new Date(cellDate);
        compareDate.setHours(0, 0, 0, 0);

        if (filterDate.getTime() === compareDate.getTime()) {
          return 0;
        }
        if (compareDate.getTime() < filterDate.getTime()) {
          return -1;
        }
        if (compareDate.getTime() > filterDate.getTime()) {
          return 1;
        }
        return 0;
      }
    }
  },
    {
      headerName: 'Actions',
      field: 'actions',
      flex: 1,
      minWidth: 120,
      cellRenderer: PreviewCellRenderer,
      sortable: false,
      filter: false,
    },
  ];

  const defaultColDef: ColDef = {
    resizable: true,
    sortable: true,
    filter: true,
  };

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
    try {
      await fetchResponsesAndDownloadCsv(formId, { existingColumns: [], limit: 500, filename: `${formMeta?.title || 'responses'}.csv` });
    } catch (e) {
      // ignore
    }
  };

  const renderResponsePreview = (response: { submitted_at: string; user_id?: string; response: Record<string, any> }) => {
    if (!formMeta?.data) return null;

    return (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Submitted: {formatDate(response.submitted_at)}
        </div>
        {formMeta.data.map((field: any, index: number) => {
          if (!field || field.type === 'static' || field.type === 'price') {
            return null;
          }
          const value = response.response[field.name];
          let displayValue = '';

          if (value === null || value === undefined || value === '') {
            displayValue = '—';
          } else if (typeof value === 'boolean') {
            displayValue = value ? 'Yes' : 'No';
          } else if (Array.isArray(value)) {
            displayValue = value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ');
          } else if (typeof value === 'object') {
            displayValue = JSON.stringify(value, null, 2);
          } else {
            displayValue = String(value);
          }

          return (
            <div key={index} className="border-b pb-2">
              <div className="font-medium text-sm">{field.label || field.name}</div>
              <div className="text-sm text-muted-foreground">{displayValue}</div>
            </div>
          );
        })}
      </div>
    );
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
                  <div className="text-sm text-muted-foreground">{responses.length === 0 ? 'No responses' : `${responses.length} response${responses.length === 1 ? '' : 's'}`}</div>
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
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-1/4" />
                <div className="ag-theme-quartz" style={{ height: 500, width: '100%' }}>
                  <div className="grid grid-cols-4 gap-3 p-4">
                    <Skeleton className="h-8 col-span-1" />
                    <Skeleton className="h-8 col-span-1" />
                    <Skeleton className="h-8 col-span-1" />
                    <Skeleton className="h-8 col-span-1" />
                  </div>
                </div>
              </div>
            ) : responses.length === 0 ? (
              <div className="text-sm text-muted-foreground p-4">No responses found.</div>
            ) : (
              <div className="ag-theme-quartz" style={{ height: 500, width: '100%' }}>
                <AgGridReact
                  rowData={responses}
                  columnDefs={columnDefs}
                  defaultColDef={defaultColDef}
                  pagination={true}
                  paginationPageSize={10}
                  paginationPageSizeSelector={[10, 20, 50]}
                  context={{
                    userInfo,
                    setPreviewResponse,
                  }}
                  animateRows={true}
                  enableCellTextSelection={true}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Response Preview Dialog */}
      <Dialog open={!!previewResponse} onOpenChange={(open) => { if (!open) setPreviewResponse(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Response Preview</DialogTitle>
          </DialogHeader>
          {previewResponse && renderResponsePreview(previewResponse)}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FormResponses;

