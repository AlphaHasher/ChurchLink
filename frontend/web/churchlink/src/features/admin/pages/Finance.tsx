import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/components/ui/Dialog";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Separator } from "@/shared/components/ui/separator";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Users,
  Download,
  Eye,
  BarChart3,
  Settings,
  RefreshCw,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import api from "@/api/api";
import PayPalSettingsComponent from "../components/Finance/PayPalSettings";
import { App, ConfigProvider, theme } from "antd";

// Types for the enhanced finance system
interface Transaction {
  transaction_id: string;
  user_email: string;
  user_name?: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string;
  payment_type: "donation" | "event_registration" | "form_submission";
  created_on: string;
  event_id?: string;
  event_name?: string;
  form_id?: string;
  form_name?: string;
  payer_info?: {
    first_name?: string;
    last_name?: string;
    email?: string;
  };
  metadata?: Record<string, any>;
}

interface FinancialSummary {
  total_revenue: number;
  total_transactions: number;
  revenue_by_type: {
    donations: number;
    event_registrations: number;
    form_submissions: number;
  };
  revenue_by_status: {
    completed: number;
    pending: number;
    failed: number;
    refunded: number;
  };
  period_comparison: {
    current_period: number;
    previous_period: number;
    percentage_change: number;
  };
  trending_data: Array<{
    date: string;
    revenue: number;
    transaction_count: number;
  }>;
}

interface EventAnalytics {
  total_events: number;
  total_revenue: number;
  average_ticket_price: number;
  top_events: Array<{
    event_id: string;
    event_name: string;
    revenue: number;
    registrations: number;
  }>;
}

interface FormAnalytics {
  total_forms: number;
  total_revenue: number;
  average_submission_value: number;
  top_forms: Array<{
    form_id: string;
    form_name: string;
    revenue: number;
    submissions: number;
  }>;
}

const FinancePage: React.FC = () => {
  // State management
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [eventAnalytics, setEventAnalytics] = useState<EventAnalytics | null>(null);
  const [formAnalytics, setFormAnalytics] = useState<FormAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Filter and pagination state
  const [filters, setFilters] = useState({
    payment_type: "all",
    status: "all",
    user_email: "",
    start_date: "",
    end_date: "",
    event_id: "",
    form_id: ""
  });
  const [pagination, setPagination] = useState({
    skip: 0,
    limit: 20,
    total: 0
  });

  // Fetch financial summary
  const fetchSummary = async () => {
    try {
      const response = await api.get("/v1/finance/analytics/summary");

      // Transform backend response to match frontend expectations
      const backendData = response.data;

      // Calculate revenue by type from payment type data
      const revenueByType = {
        donations: 0,
        event_registrations: 0,
        form_submissions: 0
      };

      // Calculate revenue by status from status data
      const revenueByStatus = {
        completed: 0,
        pending: 0,
        failed: 0,
        refunded: 0
      };

      // Process payment type data
      if (backendData.summary?.by_payment_type) {
        backendData.summary.by_payment_type.forEach((item: any) => {
          const paymentType = item.payment_type || 'unknown';
          if (paymentType === 'donation') {
            revenueByType.donations += item.total_amount || 0;
          } else if (paymentType === 'event_registration') {
            revenueByType.event_registrations += item.total_amount || 0;
          } else if (paymentType === 'form_submission') {
            revenueByType.form_submissions += item.total_amount || 0;
          }
        });
      }

      // Process status data
      if (backendData.summary?.by_status) {
        backendData.summary.by_status.forEach((item: any) => {
          const status = item.status || 'unknown';
          if (status in revenueByStatus) {
            revenueByStatus[status as keyof typeof revenueByStatus] = item.total_amount || 0;
          }
        });
      }

      // Transform time series data
      const trendingData = (backendData.summary?.time_series || []).map((item: any) => ({
        date: item.period || '',
        revenue: item.total_amount || 0,
        transaction_count: item.transaction_count || 0
      }));

      // Create transformed summary matching FinancialSummary interface
      const transformedSummary: FinancialSummary = {
        total_revenue: backendData.summary?.overall?.total_revenue || 0,
        total_transactions: backendData.summary?.overall?.total_transactions || 0,
        revenue_by_type: revenueByType,
        revenue_by_status: revenueByStatus,
        period_comparison: {
          current_period: backendData.summary?.overall?.total_revenue || 0,
          previous_period: 0, // Not available from backend yet
          percentage_change: 0 // Not available from backend yet
        },
        trending_data: trendingData
      };

      setSummary(transformedSummary);
    } catch (err: any) {
      console.error("Failed to fetch financial summary:", err);
      setError("Failed to load financial summary");
    }
  };

  // Fetch transactions with filters and pagination
  const fetchTransactions = async () => {
    try {
      const params = new URLSearchParams();
      params.append("skip", pagination.skip.toString());
      params.append("limit", pagination.limit.toString());

      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== "all") params.append(key, value);
      });

      const response = await api.get(`/v1/finance/transactions?${params}`);
      setTransactions(response.data.transactions || []);
      setPagination(prev => ({
        ...prev,
        total: response.data.total || 0
      }));
    } catch (err: any) {
      console.error("Failed to fetch transactions:", err);
      setError("Failed to load transactions");
    }
  };

  // Fetch event analytics
  const fetchEventAnalytics = async () => {
    try {
      const response = await api.get("/v1/finance/analytics/events");
      setEventAnalytics(response.data);
    } catch (err: any) {
      console.error("Failed to fetch event analytics:", err);
    }
  };

  // Fetch form analytics
  const fetchFormAnalytics = async () => {
    try {
      const response = await api.get("/v1/finance/analytics/forms");
      setFormAnalytics(response.data);
    } catch (err: any) {
      console.error("Failed to fetch form analytics:", err);
    }
  };

  // Initial data fetch
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        await Promise.all([
          fetchSummary(),
          fetchTransactions(),
          fetchEventAnalytics(),
          fetchFormAnalytics()
        ]);
      } catch (err) {
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Refetch transactions when filters or pagination change
  useEffect(() => {
    if (!loading) {
      fetchTransactions();
    }
  }, [filters, pagination.skip]);

  // Format currency
  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status badge variant
  const getStatusBadge = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    const variants = {
      completed: "default" as const,
      pending: "secondary" as const,
      failed: "destructive" as const,
      refunded: "outline" as const
    };
    return variants[status as keyof typeof variants] || "outline";
  };

  // Get payment type badge variant
  const getPaymentTypeBadge = (type: string): "default" | "secondary" | "outline" => {
    const variants = {
      donation: "default" as const,
      event_registration: "secondary" as const,
      form_submission: "outline" as const
    };
    return variants[type as keyof typeof variants] || "outline";
  };

  // Calculate percentage change indicator
  const getChangeIndicator = (change: number) => {
    if (change > 0) {
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    } else if (change < 0) {
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    }
    return null;
  };

  // Handle transaction detail view
  const viewTransactionDetail = async (transaction: Transaction) => {
    try {
      const response = await api.get(`/v1/finance/transactions/${transaction.transaction_id}`);
      setSelectedTransaction(response.data);
      setShowTransactionModal(true);
    } catch (err) {
      console.error("Failed to fetch transaction detail:", err);
      setSelectedTransaction(transaction);
      setShowTransactionModal(true);
    }
  };

  // Export transactions to CSV
  const exportTransactions = () => {
    const csvData = [
      ['Transaction ID', 'User Email', 'Name', 'Amount', 'Currency', 'Status', 'Payment Type', 'Date', 'Event/Form'],
      ...transactions.map(t => [
        t.transaction_id,
        t.user_email,
        t.user_name || t.payer_info?.first_name + ' ' + t.payer_info?.last_name || '',
        t.amount.toString(),
        t.currency,
        t.status,
        t.payment_type,
        formatDate(t.created_on),
        t.event_name || t.form_name || ''
      ])
    ];

    const csvContent = csvData.map(row =>
      row.map(field => `"${field}"`).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `transactions_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle filter changes
  const updateFilter = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, skip: 0 })); // Reset to first page
  };

  // Handle pagination
  const goToPage = (direction: 'next' | 'prev') => {
    setPagination(prev => ({
      ...prev,
      skip: direction === 'next'
        ? Math.min(prev.skip + prev.limit, prev.total - prev.limit)
        : Math.max(prev.skip - prev.limit, 0)
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading financial data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Finance Dashboard</h1>
          <p className="text-gray-600">Comprehensive financial analytics and transaction management</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => window.location.reload()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={exportTransactions}>
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(summary.total_revenue)}</div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    {summary.period_comparison && typeof summary.period_comparison.percentage_change === 'number' ? (
                      <>
                        {getChangeIndicator(summary.period_comparison.percentage_change)}
                        <span className="ml-1">
                          {summary.period_comparison.percentage_change > 0 ? '+' : ''}
                          {summary.period_comparison.percentage_change.toFixed(1)}% from last period
                        </span>
                      </>
                    ) : (
                      <span className="ml-1">No comparison data available</span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.total_transactions}</div>
                  <p className="text-xs text-muted-foreground">Across all payment types</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Event Revenue</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(summary.revenue_by_type.event_registrations)}</div>
                  <p className="text-xs text-muted-foreground">From event registrations</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Donations</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(summary.revenue_by_type.donations)}</div>
                  <p className="text-xs text-muted-foreground">Direct donations</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Revenue Breakdown */}
          {summary && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Payment Type</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Donations</span>
                    <span className="font-medium">{formatCurrency(summary.revenue_by_type.donations)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Event Registrations</span>
                    <span className="font-medium">{formatCurrency(summary.revenue_by_type.event_registrations)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Form Submissions</span>
                    <span className="font-medium">{formatCurrency(summary.revenue_by_type.form_submissions)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center">
                      <Badge variant="default" className="mr-2">Completed</Badge>
                    </span>
                    <span className="font-medium">{formatCurrency(summary.revenue_by_status.completed)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center">
                      <Badge variant="secondary" className="mr-2">Pending</Badge>
                    </span>
                    <span className="font-medium">{formatCurrency(summary.revenue_by_status.pending)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center">
                      <Badge variant="destructive" className="mr-2">Failed</Badge>
                    </span>
                    <span className="font-medium">{formatCurrency(summary.revenue_by_status.failed)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center">
                      <Badge variant="outline" className="mr-2">Refunded</Badge>
                    </span>
                    <span className="font-medium">{formatCurrency(summary.revenue_by_status.refunded)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Transaction Management</CardTitle>
              <CardDescription>View and manage all payment transactions</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by email..."
                    value={filters.user_email}
                    onChange={(e) => updateFilter('user_email', e.target.value)}
                    className="pl-8"
                  />
                </div>

                <Select value={filters.payment_type} onValueChange={(value) => updateFilter('payment_type', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Payment Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="donation">Donations</SelectItem>
                    <SelectItem value="event_registration">Event Registrations</SelectItem>
                    <SelectItem value="form_submission">Form Submissions</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filters.status} onValueChange={(value) => updateFilter('status', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="refunded">Refunded</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="outline" onClick={() => setFilters({
                  payment_type: "all",
                  status: "all",
                  user_email: "",
                  start_date: "",
                  end_date: "",
                  event_id: "",
                  form_id: ""
                })}>
                  <Filter className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              </div>

              {/* Transactions Table */}
              <div className="border rounded-lg">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b">
                      <tr>
                        <th className="text-left p-4 font-medium">Transaction ID</th>
                        <th className="text-left p-4 font-medium">User</th>
                        <th className="text-left p-4 font-medium">Amount</th>
                        <th className="text-left p-4 font-medium">Type</th>
                        <th className="text-left p-4 font-medium">Status</th>
                        <th className="text-left p-4 font-medium">Date</th>
                        <th className="text-left p-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((transaction) => (
                        <tr key={transaction.transaction_id} className="border-b hover:bg-muted/50">
                          <td className="p-4 font-mono text-sm">{transaction.transaction_id}</td>
                          <td className="p-4">
                            <div>
                              <p className="font-medium">{transaction.user_name || 'Unknown'}</p>
                              <p className="text-sm text-muted-foreground">{transaction.user_email}</p>
                            </div>
                          </td>
                          <td className="p-4 font-semibold">{formatCurrency(transaction.amount, transaction.currency)}</td>
                          <td className="p-4">
                            <Badge variant={getPaymentTypeBadge(transaction.payment_type)}>
                              {transaction.payment_type.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <Badge variant={getStatusBadge(transaction.status)}>
                              {transaction.status}
                            </Badge>
                          </td>
                          <td className="p-4 text-sm">{formatDate(transaction.created_on)}</td>
                          <td className="p-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => viewTransactionDetail(transaction)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between p-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing {pagination.skip + 1} to {Math.min(pagination.skip + pagination.limit, pagination.total)} of {pagination.total} transactions
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage('prev')}
                      disabled={pagination.skip === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage('next')}
                      disabled={pagination.skip + pagination.limit >= pagination.total}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Event Analytics */}
            {eventAnalytics && (
              <Card>
                <CardHeader>
                  <CardTitle>Event Revenue Analytics</CardTitle>
                  <CardDescription>Performance metrics for event registrations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Events</p>
                      <p className="text-2xl font-bold">{eventAnalytics.total_events}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                      <p className="text-2xl font-bold">{formatCurrency(eventAnalytics.total_revenue)}</p>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-sm font-medium mb-2">Top Events by Revenue</p>
                    <div className="space-y-2">
                      {eventAnalytics.top_events && eventAnalytics.top_events.length > 0 ? (
                        eventAnalytics.top_events.slice(0, 5).map((event) => (
                          <div key={event.event_id} className="flex justify-between items-center">
                            <span className="text-sm">{event.event_name}</span>
                            <span className="font-medium">{formatCurrency(event.revenue)}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No event data available</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Form Analytics */}
            {formAnalytics && (
              <Card>
                <CardHeader>
                  <CardTitle>Form Revenue Analytics</CardTitle>
                  <CardDescription>Performance metrics for form submissions</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Forms</p>
                      <p className="text-2xl font-bold">{formAnalytics.total_forms}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                      <p className="text-2xl font-bold">{formatCurrency(formAnalytics.total_revenue)}</p>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-sm font-medium mb-2">Top Forms by Revenue</p>
                    <div className="space-y-2">
                      {formAnalytics.top_forms && formAnalytics.top_forms.length > 0 ? (
                        formAnalytics.top_forms.slice(0, 5).map((form) => (
                          <div key={form.form_id} className="flex justify-between items-center">
                            <span className="text-sm">{form.form_name}</span>
                            <span className="font-medium">{formatCurrency(form.revenue)}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No form data available</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <PayPalSettingsComponent />
        </TabsContent>
      </Tabs>

      {/* Transaction Detail Modal */}
      <Dialog open={showTransactionModal} onOpenChange={setShowTransactionModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>
              Complete information for transaction {selectedTransaction?.transaction_id}
            </DialogDescription>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Transaction ID</p>
                  <p className="font-mono">{selectedTransaction.transaction_id}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Amount</p>
                  <p className="font-semibold">{formatCurrency(selectedTransaction.amount, selectedTransaction.currency)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">User Email</p>
                  <p>{selectedTransaction.user_email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">User Name</p>
                  <p>{selectedTransaction.user_name || 'Not provided'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Payment Type</p>
                  <Badge variant={getPaymentTypeBadge(selectedTransaction.payment_type)}>
                    {selectedTransaction.payment_type.replace('_', ' ')}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <Badge variant={getStatusBadge(selectedTransaction.status)}>
                    {selectedTransaction.status}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Payment Method</p>
                  <p>{selectedTransaction.payment_method}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Date</p>
                  <p>{formatDate(selectedTransaction.created_on)}</p>
                </div>
              </div>

              {(selectedTransaction.event_name || selectedTransaction.form_name) && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Related To</p>
                  <p>{selectedTransaction.event_name || selectedTransaction.form_name}</p>
                </div>
              )}

              {selectedTransaction.metadata && Object.keys(selectedTransaction.metadata).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Additional Information</p>
                  <div className="bg-muted/50 p-3 rounded text-sm">
                    <pre>{JSON.stringify(selectedTransaction.metadata, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const FinanceRoute: React.FC = () => {
  const [isDark, setIsDark] = React.useState(
    typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark")
  );

  React.useEffect(() => {
    const element = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(element.classList.contains("dark"));
    });
    observer.observe(element, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        cssVar: true,
        token: isDark
          ? {
              colorBgContainer: "#12171f",
              colorBgElevated: "#12171f",
              colorBorder: "#2a3340",
              colorSplit: "#202734",
              colorText: "#e6edf3",
              colorTextSecondary: "#9aa7b3",
              colorPrimary: "#2e7cf6",
              borderRadius: 10,
            }
          : { borderRadius: 10 },
      }}
    >
      <App>
        <FinancePage />
      </App>
    </ConfigProvider>
  );
};
export default FinanceRoute;