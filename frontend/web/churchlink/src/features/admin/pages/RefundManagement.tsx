import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/Dialog';
import { Textarea } from '@/shared/components/ui/textarea';
import { AlertCircle, CheckCircle, Clock, DollarSign, Eye, FileText, RefreshCw, X } from 'lucide-react';
import { Skeleton } from '@/shared/components/ui/skeleton';
import api from '@/api/api';
import { format } from 'date-fns';

interface RefundRequest {
  id: string;
  request_id: string;
  event_id: string;
  event_name: string;
  user_uid: string;
  person_id?: string;
  display_name: string;
  transaction_id: string;
  payment_amount: number;
  payment_method: string;
  reason: string;
  user_notes?: string;
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  processed_at?: string;
  admin_notes?: string;
  processed_by?: string;
  paypal_refund_id?: string;
  paypal_refund_status?: string;
}

const RefundManagement: React.FC = () => {
  const [refundRequests, setRefundRequests] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<RefundRequest | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showManualCompleteModal, setShowManualCompleteModal] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    eventId: '',
    search: ''
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  useEffect(() => {
    fetchRefundRequests();
  }, []);

  const fetchRefundRequests = async () => {
    try {
      setLoading(true);
      const response = await api.get('/v1/events/refund/requests/all', {
        params: {
          skip: 0,
          limit: 100, // Fetch more for client-side filtering
          ...(filters.status !== 'all' && { status: filters.status }),
          ...(filters.eventId && { event_id: filters.eventId })
        }
      });

      if (response.data?.success) {
        setRefundRequests(response.data.refund_requests);
      }
    } catch (error) {
      console.error('Failed to fetch refund requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessRequest = async (requestId: string, action: 'approve' | 'reject', adminNotes: string) => {
    try {
      setProcessing(requestId);
      
      const response = await api.post(`/v1/events/refund/request/${requestId}/process`, {
        action,
        admin_notes: adminNotes,
        auto_process_paypal: action === 'approve'
      });

      if (response.data?.success) {
        // Refresh the list
        await fetchRefundRequests();
        setShowDetailModal(false);
        setSelectedRequest(null);
      }
    } catch (error: any) {
      console.error('Failed to process refund request:', error);
      alert(`Failed to ${action} refund request: ${error?.response?.data?.detail || error?.message}`);
    } finally {
      setProcessing(null);
    }
  };

  const handleRetryPayPal = async (requestId: string) => {
    try {
      setProcessing(requestId);
      
      const response = await api.post(`/v1/events/refund/request/${requestId}/retry-paypal`);

      if (response.data?.success) {
        alert('PayPal refund retry successful!');
        await fetchRefundRequests();
        setShowDetailModal(false);
        setSelectedRequest(null);
      } else {
        alert(`PayPal retry failed: ${response.data?.message}`);
      }
    } catch (error: any) {
      console.error('Failed to retry PayPal refund:', error);
      alert(`Failed to retry PayPal refund: ${error?.response?.data?.detail || error?.message}`);
    } finally {
      setProcessing(null);
    }
  };

  const handleManualComplete = async (requestId: string, refundMethod: string, manualNotes: string) => {
    try {
      setProcessing(requestId);
      
      const response = await api.post(`/v1/events/refund/request/${requestId}/manual-complete`, {
        refund_method: refundMethod,
        manual_notes: manualNotes
      });

      if (response.data?.success) {
        alert('Refund manually completed successfully!');
        await fetchRefundRequests();
        setShowDetailModal(false);
        setShowManualCompleteModal(false);
        setSelectedRequest(null);
      }
    } catch (error: any) {
      console.error('Failed to manually complete refund:', error);
      alert(`Failed to manually complete refund: ${error?.response?.data?.detail || error?.message}`);
    } finally {
      setProcessing(null);
    }
  };

  const handleDiagnoseTransaction = async (requestId: string) => {
    try {
      setProcessing(requestId);
      
      const response = await api.get(`/v1/events/refund/request/${requestId}/transaction-info`);

      if (response.data?.success) {
        // Show diagnostic information in an alert
        const info = response.data;
        const paypalInfo = info.paypal_info;
        
        let message = `Transaction Diagnostic Information:\n\n`;
        message += `Transaction ID: ${info.refund_request.transaction_id}\n`;
        message += `PayPal Environment: ${info.environment.paypal_mode}\n`;
        message += `PayPal Status: ${paypalInfo.status}\n`;
        
        if (paypalInfo.status === 'found_as_payment') {
          message += `Found as Payment - State: ${paypalInfo.state}\n`;
          message += `Transactions: ${paypalInfo.transactions}\n`;
        } else if (paypalInfo.status === 'found_as_sale') {
          message += `Found as Sale - State: ${paypalInfo.state}\n`;
          message += `Amount: ${JSON.stringify(paypalInfo.amount)}\n`;
        } else if (paypalInfo.status === 'not_found') {
          message += `PayPal Status: Transaction not found in PayPal system\n`;
          message += `This may indicate:\n`;
          message += `• Environment mismatch (sandbox vs live)\n`;
          message += `• Transaction is too old\n`;
          message += `• Transaction was already refunded\n`;
          message += `• Transaction was made in different PayPal account\n`;
        } else {
          message += `Error: ${paypalInfo.error}\n`;
        }
        
        alert(message);
      }
    } catch (error: any) {
      console.error('Failed to diagnose transaction:', error);
      alert(`Failed to diagnose transaction: ${error?.response?.data?.detail || error?.message}`);
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: React.ReactNode; label: string }> = {
      pending: { variant: 'secondary', icon: <Clock className="w-3 h-3" />, label: 'Pending' },
      approved: { variant: 'default', icon: <CheckCircle className="w-3 h-3" />, label: 'Approved' },
      rejected: { variant: 'destructive', icon: <X className="w-3 h-3" />, label: 'Rejected' },
      processing: { variant: 'outline', icon: <RefreshCw className="w-3 h-3" />, label: 'Processing' },
      completed: { variant: 'default', icon: <CheckCircle className="w-3 h-3" />, label: 'Completed' },
      cancelled: { variant: 'secondary', icon: <X className="w-3 h-3" />, label: 'Cancelled' }
    };

    const config = variants[status] || variants.pending;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const filteredRequests = refundRequests.filter(request => {
    if (filters.status !== 'all' && request.status !== filters.status) return false;
    if (filters.eventId && request.event_id !== filters.eventId) return false;
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        request.display_name.toLowerCase().includes(searchLower) ||
        request.event_name?.toLowerCase().includes(searchLower) ||
        request.transaction_id.toLowerCase().includes(searchLower) ||
        request.request_id.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRequests = filteredRequests.slice(startIndex, startIndex + itemsPerPage);

  const RefundRequestDetailModal = () => {
    const [action, setAction] = useState<'approve' | 'reject' | null>(null);
    const [adminNotes, setAdminNotes] = useState('');

    if (!selectedRequest) return null;

    return (
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Refund Request Details</DialogTitle>
            <DialogDescription>
              Review and process refund request {selectedRequest.request_id}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Status</Label>
                <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
              </div>
              <div>
                <Label className="text-sm font-medium">Amount</Label>
                <div className="mt-1 font-semibold">${selectedRequest.payment_amount.toFixed(2)}</div>
              </div>
            </div>

            {/* Event & User Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Event</Label>
                <div className="mt-1">{selectedRequest.event_name}</div>
              </div>
              <div>
                <Label className="text-sm font-medium">Requested By</Label>
                <div className="mt-1">{selectedRequest.display_name}</div>
              </div>
            </div>

            {/* Transaction Info */}
            <div>
              <Label className="text-sm font-medium">Transaction ID</Label>
              <div className="mt-1 font-mono text-sm">{selectedRequest.transaction_id}</div>
            </div>

            {/* Reason */}
            <div>
              <Label className="text-sm font-medium">Reason</Label>
              <div className="mt-1 p-3 bg-muted rounded-md">{selectedRequest.reason}</div>
            </div>

            {/* User Notes */}
            {selectedRequest.user_notes && (
              <div>
                <Label className="text-sm font-medium">User Notes</Label>
                <div className="mt-1 p-3 bg-muted rounded-md">{selectedRequest.user_notes}</div>
              </div>
            )}

            {/* Admin Notes */}
            {selectedRequest.admin_notes && (
              <div>
                <Label className="text-sm font-medium">Admin Notes</Label>
                <div className="mt-1 p-3 bg-muted rounded-md">{selectedRequest.admin_notes}</div>
              </div>
            )}

            {/* PayPal Info */}
            {selectedRequest.paypal_refund_id && (
              <div>
                <Label className="text-sm font-medium">PayPal Refund ID</Label>
                <div className="mt-1 font-mono text-sm">{selectedRequest.paypal_refund_id}</div>
                {selectedRequest.paypal_refund_status && (
                  <div className="text-sm text-muted-foreground">Status: {selectedRequest.paypal_refund_status}</div>
                )}
              </div>
            )}

            {/* Timestamps */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-sm font-medium">Created</Label>
                <div className="mt-1">{format(new Date(selectedRequest.created_at), 'PPp')}</div>
              </div>
              {selectedRequest.processed_at && (
                <div>
                  <Label className="text-sm font-medium">Processed</Label>
                  <div className="mt-1">{format(new Date(selectedRequest.processed_at), 'PPp')}</div>
                </div>
              )}
            </div>

            {/* Action Section for Pending Requests */}
            {selectedRequest.status === 'pending' && (
              <>
                <div className="border-t pt-4">
                  <Label className="text-sm font-medium">Action</Label>
                  <Select value={action || ''} onValueChange={(value: 'approve' | 'reject') => setAction(value)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select action..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approve">Approve & Process Refund</SelectItem>
                      <SelectItem value="reject">Reject Request</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-medium">Admin Notes</Label>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Enter notes about this decision..."
                    className="mt-1"
                  />
                </div>
              </>
            )}

            {/* Special Actions for Approved/Pending with Failed PayPal */}
            {(selectedRequest.status === 'pending' || selectedRequest.status === 'approved') && 
             selectedRequest.admin_notes?.includes('PayPal') && (
              <div className="border-t pt-4 space-y-3">
                <Label className="text-sm font-medium">PayPal Processing Failed - Additional Actions</Label>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={() => handleRetryPayPal(selectedRequest.request_id)}
                    disabled={processing === selectedRequest.request_id}
                  >
                    {processing === selectedRequest.request_id ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Retry PayPal
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setShowManualCompleteModal(true)}
                    disabled={processing === selectedRequest.request_id}
                  >
                    Manual Complete
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleDiagnoseTransaction(selectedRequest.request_id)}
                    disabled={processing === selectedRequest.request_id}
                  >
                    Diagnose Transaction
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailModal(false)}>
              Close
            </Button>
            {selectedRequest.status === 'pending' && action && (
              <Button
                onClick={() => handleProcessRequest(selectedRequest.request_id, action, adminNotes)}
                disabled={processing === selectedRequest.request_id}
                variant={action === 'approve' ? 'default' : 'destructive'}
              >
                {processing === selectedRequest.request_id ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                {action === 'approve' ? 'Approve & Process' : 'Reject Request'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const ManualCompleteModal = () => {
    const [refundMethod, setRefundMethod] = useState('manual');
    const [manualNotes, setManualNotes] = useState('');

    if (!selectedRequest) return null;

    return (
      <Dialog open={showManualCompleteModal} onOpenChange={setShowManualCompleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual Refund Completion</DialogTitle>
            <DialogDescription>
              Complete refund {selectedRequest.request_id} manually (outside PayPal)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Refund Method</Label>
              <Select value={refundMethod} onValueChange={setRefundMethod}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual Processing</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cash">Cash Refund</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">Notes</Label>
              <Textarea
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                placeholder="Enter details about how the refund was processed..."
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualCompleteModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => handleManualComplete(selectedRequest.request_id, refundMethod, manualNotes)}
              disabled={processing === selectedRequest.request_id || !manualNotes.trim()}
            >
              {processing === selectedRequest.request_id ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Complete Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Refund Management</h1>
        <p className="text-muted-foreground">Manage event registration refund requests</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{refundRequests.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {refundRequests.filter(r => r.status === 'pending').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${refundRequests.reduce((sum, r) => sum + r.payment_amount, 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {refundRequests.filter(r => r.status === 'completed').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Status</Label>
              <Select value={filters.status} onValueChange={(value) => setFilters({...filters, status: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Search</Label>
              <Input
                placeholder="Search by name, event, transaction..."
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
              />
            </div>

            <div className="flex items-end">
              <Button onClick={fetchRefundRequests} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Refund Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>Refund Requests</CardTitle>
          <CardDescription>
            Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredRequests.length)} of {filteredRequests.length} requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No refund requests found</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request ID</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Requestor</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-mono text-sm">{request.request_id}</TableCell>
                      <TableCell>{request.event_name}</TableCell>
                      <TableCell>{request.display_name}</TableCell>
                      <TableCell>${request.payment_amount.toFixed(2)}</TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell>{format(new Date(request.created_at), 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedRequest(request);
                            setShowDetailModal(true);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center space-x-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  
                  <span className="text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <RefundRequestDetailModal />
      <ManualCompleteModal />
    </div>
  );
};

export default RefundManagement;