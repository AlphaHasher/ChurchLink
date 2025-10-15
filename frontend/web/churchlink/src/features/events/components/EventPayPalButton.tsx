import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { CreditCard, Loader2, DollarSign } from "lucide-react";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import api from "@/api/api";

interface EventPayPalButtonProps {
  eventId: string;
  event?: {
    name: string;
    price: number;
    requires_payment?: boolean;
    is_free_event?: boolean;
    payment_options?: string[];
  };
  donationAmount?: number;
  onPaymentSuccess?: (result: any) => void;
  onPaymentError?: (error: string) => void;
  onPaymentStarted?: () => void;
  className?: string;
  disabled?: boolean;
}

export function EventPayPalButton({
  eventId,
  event,
  donationAmount = 0,
  onPaymentSuccess,
  onPaymentError,
  onPaymentStarted,
  className = "",
  disabled = false,
}: EventPayPalButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine payment type and amount
  const isPaidEvent = event?.requires_payment || (event?.price && event.price > 0);
  const isFreeDonation = !isPaidEvent && donationAmount > 0;
  const amount = isPaidEvent ? (event?.price || 0) : donationAmount;

  // Get button text based on payment type
  const getButtonText = () => {
    if (loading) return "Processing...";
    if (isPaidEvent) {
      return `Pay $${amount.toFixed(2)} with PayPal`;
    } else if (isFreeDonation) {
      return `Donate $${amount.toFixed(2)} with PayPal`;
    }
    return "Pay with PayPal";
  };

  // Get button icon based on payment type
  const getButtonIcon = () => {
    if (loading) {
      return <Loader2 className="mr-2 h-4 w-4 animate-spin" />;
    }
    if (isPaidEvent) {
      return <CreditCard className="mr-2 h-4 w-4" />;
    }
    return <DollarSign className="mr-2 h-4 w-4" />;
  };

  // Get button color based on payment type
  const getButtonColor = () => {
    if (isPaidEvent) {
      return "bg-blue-600 hover:bg-blue-700"; // PayPal blue for payments
    } else if (isFreeDonation) {
      return "bg-green-600 hover:bg-green-700"; // Green for donations
    }
    return "bg-blue-600 hover:bg-blue-700";
  };

  const handlePayment = async () => {
    setLoading(true);
    setError(null);
    onPaymentStarted?.();

    try {
      // Use unified API for single registration
      const registrations = [{
        person_id: null, // null for self-registration
        name: "Event Registration",
        donation_amount: isFreeDonation ? donationAmount : 0,
        payment_amount_per_person: 0
      }];

      const orderData = {
        registrations: registrations,
        message: "",
        return_url: "",
        cancel_url: ""
      };

      console.log('Creating PayPal payment order:', orderData);
      const response = await api.post(`/v1/events/${eventId}/payment/create-bulk-order`, orderData);

      if (response.data && response.data.approval_url) {
        console.log('Redirecting to PayPal:', response.data.approval_url);
        // Redirect to PayPal for payment
        window.location.href = response.data.approval_url;
      } else {
        throw new Error("Failed to create PayPal order");
      }
    } catch (err: any) {
      console.error('Payment creation failed:', err);
      const errorMessage = err.response?.data?.detail || err.message || "Payment failed";
      setError(errorMessage);
      onPaymentError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={handlePayment}
        disabled={disabled || loading || amount <= 0}
        className={`w-full ${getButtonColor()} ${className}`}
        variant="default"
      >
        {getButtonIcon()}
        {getButtonText()}
      </Button>
      
      {error && (
        <Alert variant="destructive" className="mt-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <p className="text-xs text-gray-500 mt-2">
        You will be redirected to PayPal to complete your payment securely.
      </p>
      
      {/* Payment amount display */}
      {amount > 0 && (
        <div className="text-sm text-center text-gray-600 mt-2">
          {isPaidEvent ? "Required payment" : "Optional donation"}: <span className="font-semibold">${amount.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}