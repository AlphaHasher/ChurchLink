import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { 
  CreditCard, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import api from '@/api/api';

interface PaymentInfo {
  status: 'completed' | 'pending' | 'failed' | 'not_required' | 'refund_requested' | 'refunded';
  amount?: number;
  method?: 'paypal' | 'door' | 'free';
  transaction_id?: string;
  payer_info?: {
    first_name?: string;
    last_name?: string;
    email?: string;
  };
  created_on?: string;
  // Support for computed status from centralized system
  computed_payment_status?: 'completed' | 'pending' | 'failed' | 'not_required' | 'refund_requested' | 'refunded';
  transaction_details?: {
    transaction_id: string;
    amount: number;
    status: 'completed' | 'pending' | 'failed' | 'not_required' | 'refund_requested' | 'refunded';
    payment_method: 'paypal' | 'door' | 'free';
    created_on: string;
  };
}

interface EventPaymentStatusCardProps {
  eventId: string;
  eventName: string;
  eventPrice: number;
  requiresPayment: boolean;
  className?: string;
  onPaymentUpdate?: () => void;
}

export function EventPaymentStatusCard({
  eventId,
  eventName,
  eventPrice,
  requiresPayment,
  className = "",
  onPaymentUpdate
}: EventPaymentStatusCardProps) {
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch payment status
  const fetchPaymentStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get(`/v1/events/${eventId}/payment/status`);
      const data = response.data;
      
      // NEW: Transform backend response from centralized system
      if (data && (data.computed_payment_status || data.payment_status)) {
        const status = data.computed_payment_status || data.payment_status;
        
        setPaymentInfo({
          status: status,
          computed_payment_status: data.computed_payment_status,
          amount: data.payment_amount || data.transaction_details?.amount,
          method: data.payment_method || data.transaction_details?.payment_method,
          transaction_id: data.transaction_id || data.transaction_details?.transaction_id,
          payer_info: data.payer_info,
          created_on: data.payment_date || data.transaction_details?.created_on,
          transaction_details: data.transaction_details
        });
      } else {
        // No payment info found
        setPaymentInfo({
          status: requiresPayment ? 'pending' : 'not_required'
        });
      }
    } catch (err: any) {
      console.error('Failed to fetch payment status:', err);
      setError('Failed to load payment information');
      setPaymentInfo({
        status: requiresPayment ? 'pending' : 'not_required'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentStatus();
  }, [eventId, requiresPayment]);

  // Get status badge configuration
  const getStatusBadge = (status: PaymentInfo['status']) => {
    switch (status) {
      case 'completed':
        return { variant: 'default' as const, label: 'Paid', icon: CheckCircle, color: 'text-green-600' };
      case 'pending':
        return { variant: 'outline' as const, label: 'Payment Pending', icon: Clock, color: 'text-yellow-600' };
      case 'failed':
        return { variant: 'destructive' as const, label: 'Payment Failed', icon: AlertTriangle, color: 'text-red-600' };
      case 'not_required':
        return { variant: 'secondary' as const, label: 'Free Event', icon: CheckCircle, color: 'text-blue-600' };
      case 'refund_requested':
        return { variant: 'outline' as const, label: 'Refund Requested', icon: Clock, color: 'text-orange-600' };
      case 'refunded':
        return { variant: 'secondary' as const, label: 'Refunded', icon: RefreshCw, color: 'text-gray-600' };
      default:
        return { variant: 'outline' as const, label: 'Unknown', icon: AlertTriangle, color: 'text-gray-600' };
    }
  };

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            Loading payment status...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchPaymentStatus}
            className="mt-2"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!paymentInfo) return null;

  const statusConfig = getStatusBadge(paymentInfo.status);
  const StatusIcon = statusConfig.icon;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Event Information */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-medium">Event:</span>
            <span className="text-sm">{eventName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-medium">Price:</span>
            <span className="text-sm">
              {eventPrice === 0 ? 'Free' : formatCurrency(eventPrice)}
            </span>
          </div>
        </div>

        {/* Payment Status */}
        <div className="p-3 border rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">Status:</span>
            <Badge variant={statusConfig.variant}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig.label}
            </Badge>
          </div>

          {/* Payment Details */}
          {paymentInfo.status === 'completed' && (
            <div className="space-y-2 text-sm">
              {paymentInfo.amount && (
                <div className="flex justify-between">
                  <span>Amount Paid:</span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(paymentInfo.amount)}
                  </span>
                </div>
              )}
              {paymentInfo.method && (
                <div className="flex justify-between">
                  <span>Method:</span>
                  <span className="capitalize">{paymentInfo.method}</span>
                </div>
              )}
              {paymentInfo.transaction_id && (
                <div className="flex justify-between">
                  <span>Transaction:</span>
                  <span className="font-mono text-xs">{paymentInfo.transaction_id}</span>
                </div>
              )}
              {paymentInfo.created_on && (
                <div className="flex justify-between">
                  <span>Paid On:</span>
                  <span>{formatDate(paymentInfo.created_on)}</span>
                </div>
              )}
            </div>
          )}

          {/* Refund Requested Details */}
          {paymentInfo.status === 'refund_requested' && (
            <div className="space-y-2 text-sm">
              {paymentInfo.amount && (
                <div className="flex justify-between">
                  <span>Original Amount:</span>
                  <span className="font-medium">
                    {formatCurrency(paymentInfo.amount)}
                  </span>
                </div>
              )}
              {paymentInfo.method && (
                <div className="flex justify-between">
                  <span>Payment Method:</span>
                  <span className="capitalize">{paymentInfo.method}</span>
                </div>
              )}
              {paymentInfo.transaction_id && (
                <div className="flex justify-between">
                  <span>Transaction:</span>
                  <span className="font-mono text-xs">{paymentInfo.transaction_id}</span>
                </div>
              )}
              <Alert variant="default" className="mt-2">
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  Refund request is being processed. You will be notified when completed.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Refunded Details */}
          {paymentInfo.status === 'refunded' && (
            <div className="space-y-2 text-sm">
              {paymentInfo.amount && (
                <div className="flex justify-between">
                  <span>Refunded Amount:</span>
                  <span className="font-medium text-gray-600">
                    {formatCurrency(paymentInfo.amount)}
                  </span>
                </div>
              )}
              {paymentInfo.method && (
                <div className="flex justify-between">
                  <span>Original Method:</span>
                  <span className="capitalize">{paymentInfo.method}</span>
                </div>
              )}
              {paymentInfo.transaction_id && (
                <div className="flex justify-between">
                  <span>Transaction:</span>
                  <span className="font-mono text-xs">{paymentInfo.transaction_id}</span>
                </div>
              )}
              {paymentInfo.created_on && (
                <div className="flex justify-between">
                  <span>Refunded On:</span>
                  <span>{formatDate(paymentInfo.created_on)}</span>
                </div>
              )}
              <Alert variant="default" className="mt-2">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Payment has been refunded. You are no longer registered for this event.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Pending Payment Info - Covers all pending scenarios */}
          {paymentInfo.status === 'pending' && requiresPayment && (
            <Alert variant="destructive" className="mt-2">
              <Clock className="h-4 w-4" />
              <AlertDescription>
                Payment of {formatCurrency(eventPrice)} is still required for this event.
              </AlertDescription>
            </Alert>
          )}

          {/* Failed Payment Info */}
          {paymentInfo.status === 'failed' && (
            <Alert variant="destructive" className="mt-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Payment failed. Please try again or contact support.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Payer Information */}
        {paymentInfo.payer_info && (
          <div className="p-3 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-sm mb-2">Payer Information:</h4>
            <div className="space-y-1 text-sm">
              {paymentInfo.payer_info.first_name && paymentInfo.payer_info.last_name && (
                <div>
                  <strong>Name:</strong> {paymentInfo.payer_info.first_name} {paymentInfo.payer_info.last_name}
                </div>
              )}
              {paymentInfo.payer_info.email && (
                <div>
                  <strong>Email:</strong> {paymentInfo.payer_info.email}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchPaymentStatus();
              onPaymentUpdate?.();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>

          {paymentInfo.transaction_id && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Open transaction details in new window/tab
                window.open(`/admin/finance?transaction=${paymentInfo.transaction_id}`, '_blank');
              }}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View Transaction
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}