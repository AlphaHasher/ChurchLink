// features/admin/pages/FormResponses.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import FormsTabs from '@/features/admin/components/Forms/FormsTabs';
import api from '@/api/api';
import { fetchUserInfoByUId } from '@/helpers/UserHelper';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { ArrowLeft, RefreshCcw, Download } from 'lucide-react';
import { fetchResponsesAndDownloadCsv } from '@/shared/utils/csvExport';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarProvider,
} from '@/shared/components/ui/sidebar';

const useQuery = () => new URLSearchParams(useLocation().search);

// Matches server response payment shape
type PaymentDetails = {
  payment_type: 'free' | 'paypal' | 'door';
  price: number;
  payment_complete: boolean;
  transaction_id: string | null;
  currency?: string | null;
  captured_amount?: number | null;
};

type ResponseItem = {
  submitted_at: string;
  user_id?: string;
  response: Record<string, any>; // dynamic answers; includes payment
  id?: string;
  _id?: string;
};

const FormResponses = () => {
  const navigate = useNavigate();
  const query = useQuery();
  const formId = query.get('formId') || '';

  const [responses, setResponses] = useState<ResponseItem[]>([]);
  const [formMeta, setFormMeta] = useState<{
    title: string;
    description?: string;
    data?: any[];
    supported_locales?: string[];
  } | null>(null);
  const [userInfo, setUserInfo] = useState<Record<string, { name: string; email: string }>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedResponseKey, setSelectedResponseKey] = useState<string | null>(null);
  const userInfoRef = useRef(userInfo);

  useEffect(() => {
    userInfoRef.current = userInfo;
  }, [userInfo]);

  useEffect(() => {
    const fetchMeta = async () => {
      if (!formId) return;
      try {
        const resp = await api.get(`/v1/forms/${formId}`);
        const meta = {
          title: resp.data?.title || 'Form',
          description: resp.data?.description,
          data: resp.data?.data,
          supported_locales: resp.data?.supported_locales,
        };
        setFormMeta(meta);
      } catch {
        // ignore
      }
    };
    fetchMeta();
  }, [formId]);

  const preloadUserInfo = useCallback(async (userIds: string[]) => {
    const idsToFetch = userIds.filter((id) => !userInfoRef.current[id]);
    if (idsToFetch.length === 0) return;

    const infoPromises = idsToFetch.map(async (uid) => {
      try {
        const userData = await fetchUserInfoByUId(uid);
        if (userData) {
          const name =
            userData.first_name && userData.last_name
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

      setUserInfo((prev) => ({ ...prev, ...newUserInfo }));
    } catch (error) {
      console.error('Error preloading user info:', error);
    }
  }, []);

  const fetchResponses = useCallback(async () => {
    if (!formId) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get(`/v1/forms/${formId}/responses`);
      let fetched = resp.data?.items || [];
      if (!Array.isArray(fetched)) fetched = [];
      setResponses(fetched as ResponseItem[]);

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
  }, [formId, preloadUserInfo]);

  useEffect(() => {
    fetchResponses();
  }, [fetchResponses]);

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return iso;
    }
  };

  const formatSidebarDate = (iso?: string) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-US', { month: 'short', day: '2-digit' });
    } catch {
      return iso;
    }
  };

  const exportCsv = async () => {
    if (!formId) return;
    try {
      await fetchResponsesAndDownloadCsv(formId, {
        existingColumns: [],
        limit: 500,
        filename: `${formMeta?.title || 'responses'}.csv`,
      });
    } catch {
      // ignore
    }
  };

  // Build sidebar items with "Payment Due" red pill only when incomplete
  const responseItems = useMemo(() => {
    return responses.map((response, index) => {
      const userId = (response as any).user_id;
      const userData = userId ? userInfo[userId] : null;
      const name = userData?.name || (userId ? 'Loading...' : 'Anonymous');
      const email = userData?.email || '';
      const key =
        (response as any).id || (response as any)._id || `${userId || 'anonymous'}-${response.submitted_at || index}-${index}`;

      const payment: PaymentDetails | undefined =
        (response as any).payment || (response.response as any)?.payment;

      // Incomplete when not free and !payment_complete (PayPal not captured, or door unpaid)
      const paymentDue = !!payment && payment.payment_type !== 'free' && !payment.payment_complete;

      return {
        key,
        name,
        email,
        submitted: response.submitted_at,
        submittedLabel: formatSidebarDate(response.submitted_at),
        response,
        payment,
        paymentDue,
      };
    });
  }, [responses, userInfo]);

  const filteredResponseItems = useMemo(() => {
    const term = (searchTerm || '').trim().toLowerCase();
    if (!term) return responseItems;

    return responseItems.filter((item) => {
      return item.name.toLowerCase().includes(term) || (item.email && item.email.toLowerCase().includes(term));
    });
  }, [responseItems, searchTerm]);

  useEffect(() => {
    if (filteredResponseItems.length === 0) {
      if (selectedResponseKey !== null) {
        setSelectedResponseKey(null);
      }
      return;
    }

    const exists = filteredResponseItems.some((item) => item.key === selectedResponseKey);
    if (!exists) {
      setSelectedResponseKey(filteredResponseItems[0].key);
    }
  }, [filteredResponseItems, selectedResponseKey]);

  const selectedItem =
    filteredResponseItems.find((item) => item.key === selectedResponseKey) ||
    responseItems.find((item) => item.key === selectedResponseKey) ||
    (filteredResponseItems.length > 0 ? filteredResponseItems[0] : null);

  const getFieldLabel = (field: any): string => {
    if (!field) return 'Field';
    const nameCandidate = field?.name;
    if (typeof nameCandidate === 'string') {
      const trimmedName = nameCandidate.trim();
      if (trimmedName.length > 0) {
        return trimmedName;
      }
    }

    const fallbackCandidates = [field?.id, field?.key, field?.fieldKey];
    for (const candidate of fallbackCandidates) {
      if (typeof candidate === 'string') {
        const trimmed = candidate.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
    }
    return 'Field';
  };

  const getFieldValueFromResponse = (field: any, responseData: Record<string, any>) => {
    if (!field || !responseData) return undefined;
    const candidates = [field?.name, field?.key, field?.id, field?.fieldKey];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate in responseData) {
        return responseData[candidate];
      }
    }
    return undefined;
  };

  const formatDateString = (raw: unknown): string | null => {
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const isoParts = trimmed.split('-');
    if (isoParts.length === 3 && isoParts[0].length === 4) {
      const [yearStr, monthStr, dayStr] = isoParts;
      const year = Number(yearStr);
      const month = Number(monthStr);
      const day = Number(dayStr);
      if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
        });
      }
    }
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      });
    }
    return trimmed;
  };

  const formatDateRangeValue = (value: any): string => {
    if (!value || typeof value !== 'object') return '—';
    const fromRaw = value.from ?? value.start ?? value.begin;
    const toRaw = value.to ?? value.end ?? value.finish;
    const from = formatDateString(fromRaw) ?? '';
    const to = formatDateString(toRaw) ?? '';
    if (from && to) return `${from} – ${to}`;
    if (from) return from;
    if (to) return to;
    return '—';
  };

  const formatTimeString = (raw: unknown): string => {
    if (typeof raw !== 'string') return raw == null ? '—' : String(raw);
    const trimmed = raw.trim();
    if (!trimmed) return '—';
    const match = /^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(trimmed);
    if (!match) return trimmed;
    let hour = Number(match[1]);
    const minute = match[2];
    if (Number.isNaN(hour)) return trimmed;
    const period = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return `${hour}:${minute} ${period}`;
  };

  const formatArrayValue = (values: any[]): string => {
    const formatted = values
      .map((item) => {
        if (item == null) return '';
        if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
          return String(item);
        }
        if (typeof item === 'object') {
          if ('label' in item && item.label) return String(item.label);
          if ('value' in item && item.value) return String(item.value);
          return JSON.stringify(item);
        }
        return '';
      })
      .filter((segment) => segment.trim().length > 0);
    return formatted.length > 0 ? formatted.join(', ') : '—';
  };

  const formatFieldValue = (field: any, rawValue: any): string => {
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      return '—';
    }

    if (typeof rawValue === 'boolean') {
      return rawValue ? 'Yes' : 'No';
    }

    if (field?.type === 'time') {
      return formatTimeString(rawValue);
    }

    if (field?.type === 'date') {
      if (field?.mode === 'range') {
        return formatDateRangeValue(rawValue);
      }
      if (typeof rawValue === 'string') {
        return formatDateString(rawValue) ?? '—';
      }
    }

    if (Array.isArray(rawValue)) {
      return formatArrayValue(rawValue);
    }

    if (typeof rawValue === 'object') {
      if (field?.type === 'date' && field?.mode === 'range') {
        return formatDateRangeValue(rawValue);
      }
      return JSON.stringify(rawValue, null, 2);
    }

    return String(rawValue);
  };

  const renderFieldRows = () => {
    if (!selectedItem || !formMeta?.data) return null;

    return formMeta.data
      .filter((field: any) => field && field.type !== 'static' && field.type !== 'price')
      .map((field: any, index: number) => {
        const fieldKey = field.id || field.name || index;
        const responseData = (selectedItem.response as any)?.response || {};
        const rawValue = getFieldValueFromResponse(field, responseData);
        const displayValue = formatFieldValue(field, rawValue);
        const label = getFieldLabel(field);

        return (
          <div
            key={fieldKey}
            className="grid grid-cols-1 gap-2 border-b py-3 last:border-b-0 sm:grid-cols-[minmax(0,220px)_1fr] sm:gap-6"
          >
            <div className="text-sm font-medium text-muted-foreground">{label}</div>
            <div className="text-sm whitespace-pre-wrap break-words">{displayValue}</div>
          </div>
        );
      });
  };

  // Payment badges inspired by the event table pills (soft bg + strong text)
  const SoftPill = ({ className, children }: { className: string; children: React.ReactNode }) => (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>{children}</span>
  );

  const PaymentTypeBadge = ({ p }: { p: PaymentDetails }) => {
    if (p.payment_type === 'free') {
      return <SoftPill className="bg-emerald-50 text-emerald-700">FREE</SoftPill>;
    }
    if (p.payment_type === 'paypal') {
      return <SoftPill className="bg-blue-50 text-blue-700">PayPal</SoftPill>;
    }
    return <SoftPill className="bg-amber-50 text-amber-700">At The Door</SoftPill>;
  };

  const PaymentStatusBadge = ({ p }: { p: PaymentDetails }) => {
    const complete = p.payment_type === 'free' || p.payment_complete === true;
    return complete ? (
      <SoftPill className="bg-emerald-50 text-emerald-700">Complete</SoftPill>
    ) : (
      <SoftPill className="bg-rose-50 text-rose-700">Payment Due</SoftPill>
    );
  };

  const PaymentCard = ({ p }: { p: PaymentDetails }) => {
    const priceStr =
      p.payment_type === 'free'
        ? 'FREE'
        : new Intl.NumberFormat(undefined, {
          style: 'currency',
          currency: (p.currency ?? 'USD') as any,
        }).format(p.price ?? 0);

    return (
      <div className="rounded-lg border bg-card text-card-foreground p-4">
        <div className="mb-3 text-sm font-semibold">Submission Payment Details</div>

        {/* Responsive: stacks at <640px, 3 columns at >=640px */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="text-xs uppercase text-muted-foreground">Payment Type</div>
            <div className="mt-1"><PaymentTypeBadge p={p} /></div>
          </div>

          <div className="flex min-w-0 flex-col gap-1">
            <div className="text-xs uppercase text-muted-foreground">Payment Price</div>
            <div className="mt-1 truncate text-sm font-medium">{priceStr}</div>
          </div>

          <div className="flex min-w-0 flex-col gap-1">
            <div className="text-xs uppercase text-muted-foreground">Payment Status</div>
            <div className="mt-1"><PaymentStatusBadge p={p} /></div>
          </div>
        </div>

        {p.transaction_id && (
          <div className="mt-3 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted-foreground">
            Transaction ID: <span className="font-mono">{p.transaction_id}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => navigate('/admin/forms/manage-forms')} title="Back to Manage Forms">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <h1 className="text-2xl font-semibold leading-tight">Form Responses</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchResponses} title="Refresh">
            <RefreshCcw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} title="Export responses as CSV">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <FormsTabs />

      <div className="mt-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>
              {formMeta ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{formMeta.title}</div>
                    {formMeta.description ? (
                      <div className="truncate text-sm text-muted-foreground">{formMeta.description}</div>
                    ) : null}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {responses.length === 0 ? 'No responses' : `${responses.length} response${responses.length === 1 ? '' : 's'}`}
                  </div>
                </div>
              ) : (
                <div className="w-full space-y-2">
                  <Skeleton className="h-6 w-1/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && <div className="mb-3 text-sm text-destructive">{error}</div>}

            {loading ? (
              <div className="flex flex-col gap-4 md:flex-row">
                <div className="w-full space-y-3 md:w-80">
                  <Skeleton className="h-10 w-full" />
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <SidebarMenuSkeleton key={idx} />
                  ))}
                </div>
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-7 w-1/3" />
                  <Skeleton className="h-32 w-full" />
                </div>
              </div>
            ) : responses.length === 0 ? (
              <div className="rounded-lg border bg-muted/20 p-6 text-sm text-muted-foreground">
                No responses found.
              </div>
            ) : (
              <div className="rounded-lg border">
                <SidebarProvider className="flex h-full min-h-[420px]">
                  {/* LEFT: Sidebar */}
                  <Sidebar collapsible="none" className="w-full max-w-[22rem] border-r bg-muted/30">
                    <SidebarHeader className="gap-2">
                      <SidebarInput
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Search responses"
                        className="h-10"
                      />
                      <div className="px-2 text-xs text-muted-foreground">
                        Showing {filteredResponseItems.length} of {responseItems.length}
                      </div>
                    </SidebarHeader>
                    <SidebarContent>
                      <SidebarGroup>
                        <SidebarGroupContent>
                          {filteredResponseItems.length === 0 ? (
                            <div className="px-3 py-6 text-sm text-muted-foreground">No matches found.</div>
                          ) : (
                            <SidebarMenu>
                              {filteredResponseItems.map((item) => (
                                <SidebarMenuItem key={item.key}>
                                  <SidebarMenuButton
                                    isActive={item.key === selectedResponseKey}
                                    onClick={() => setSelectedResponseKey(item.key)}
                                    className="items-center justify-between gap-2"
                                    size="lg"
                                  >
                                    <div className="flex min-w-0 items-center gap-2">
                                      <span className="truncate font-medium">{item.name}</span>
                                      {/* Sidebar Payment Due pill next to the name */}
                                      {item.paymentDue && (
                                        <SoftPill className="bg-rose-50 text-rose-700">Payment Due</SoftPill>
                                      )}
                                    </div>
                                    <span className="ml-2 shrink-0 text-right text-xs text-muted-foreground">
                                      {item.submittedLabel}
                                    </span>
                                  </SidebarMenuButton>
                                </SidebarMenuItem>
                              ))}
                            </SidebarMenu>
                          )}
                        </SidebarGroupContent>
                      </SidebarGroup>
                    </SidebarContent>
                  </Sidebar>

                  {/* RIGHT: Details */}
                  <SidebarInset className="flex-1 overflow-y-auto bg-background p-4 sm:p-6">
                    {selectedItem ? (
                      <div className="space-y-6">
                        {/* Default block: name / email / submitted */}
                        <div className="space-y-1">
                          <div className="truncate text-xl font-semibold">{selectedItem.name}</div>
                          {selectedItem.email ? (
                            <div className="truncate text-sm text-muted-foreground">{selectedItem.email}</div>
                          ) : null}
                          <div className="text-sm text-muted-foreground">
                            Submitted on {formatDate(selectedItem.submitted)}
                          </div>

                          {/* Payment details card (always present) */}
                          {(() => {
                            const p = (selectedItem.response as any)?.payment as PaymentDetails | undefined;
                            if (!p) return null;
                            return <div className="mt-4"><PaymentCard p={p} /></div>;
                          })()}
                        </div>

                        {/* Answer fields */}
                        <div className="space-y-2">
                          {renderFieldRows() || (
                            <div className="rounded-md border bg-muted/10 p-4 text-sm text-muted-foreground">
                              No fields to display for this response.
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        Select a response from the list.
                      </div>
                    )}
                  </SidebarInset>
                </SidebarProvider>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FormResponses;
