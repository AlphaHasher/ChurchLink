'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/ui/button';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { formPaymentApi } from "@/features/forms/api/formPaymentApi";
import { useAuth } from "@/features/auth/hooks/auth-context";

export default function FormPaymentSuccessPage() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const slug = params.slug as string;
  
  const token = searchParams.get('token');
  const payerId = searchParams.get('PayerID');
  
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing your payment...');
  const [transactionId, setTransactionId] = useState<string | null>(null);
  
  // Create unique lock keys for this payment
  const paymentLockKey = `payment_processed_${token}_${payerId}`;
  const paymentResultKey = `${paymentLockKey}_result`;
  
  // Single execution lock using useRef
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    const completePayment = async () => {
      // Check if we already have result stored (for page refreshes)
      const storedResult = localStorage.getItem(paymentResultKey);
      if (storedResult) {
        try {
          const result = JSON.parse(storedResult);
          setStatus(result.status);
          setMessage(result.message);
          setTransactionId(result.transactionId);
          hasProcessedRef.current = true;
          return;
        } catch (e) {
          console.error('Failed to parse stored result:', e);
        }
      }
      
      // Prevent duplicate processing
      if (hasProcessedRef.current || localStorage.getItem(paymentLockKey) === 'true') {
        hasProcessedRef.current = true;
        return;
      }
      
      // Set locks immediately to prevent race conditions
      hasProcessedRef.current = true;
      localStorage.setItem(paymentLockKey, 'true');
         
      // Helper function to set error state
      const setError = (message: string) => {
        const errorState = { status: 'error', message, transactionId: null };
        setStatus('error');
        setMessage(message);
        localStorage.setItem(paymentResultKey, JSON.stringify(errorState));
      };

      // Validate required parameters
      if (!token || !payerId) {
        setError('Missing payment information. Please try again.');
        return;
      }

      if (!user?.uid) {
        setError('You must be logged in to complete this payment.');
        return;
      }

      try {
        // Get saved form data
        let formResponseData = {};
        const savedFormData = localStorage.getItem(`form_data_${slug}`);
        if (savedFormData) {
          try {
            const { _timestamp, ...restoredData } = JSON.parse(savedFormData);
            formResponseData = restoredData;
          } catch (e) {
            console.error('Failed to parse saved form data:', e);
          }
        }
      
        
        const response = await formPaymentApi.completeFormSubmission(slug, {
          payment_id: token,
          payer_id: payerId,
          form_response: formResponseData,
          user_uid: user.uid,
          payer_email: user.email || undefined,
          payer_name: user.displayName || undefined
        });

        if (response.success) {
          const realAmount = response.data?.total_amount || 0;
          const successMessage = `Payment of $${realAmount.toFixed(2)} completed successfully! Your form submission has been recorded.`;
          const successTransactionId = response.data?.payment_id || token;
          
          // Clean up saved form data
          localStorage.removeItem(`form_data_${slug}`);
          
          // Set success state
          setStatus('success');
          setMessage(successMessage);
          setTransactionId(successTransactionId);
          
          // Store result for future page loads
          localStorage.setItem(paymentResultKey, JSON.stringify({
            status: 'success',
            message: successMessage,
            transactionId: successTransactionId
          }));
        } else {
          throw new Error(response.error || 'Payment completion failed');
        }
      } catch (error) {
        console.error('Payment completion error:', error);
        const errorMessage = error instanceof Error 
          ? `Payment completion failed: ${error.message}` 
          : 'Payment completion failed. Please contact support.';
        
        setError(errorMessage);
      }
    };
    // Only run when all required parameters are available
    if (token && payerId && user?.uid) {
      completePayment();
    }
  }, [token, payerId, slug, user?.uid, paymentLockKey, paymentResultKey]);

  const handleReturnToForm = () => {
    navigate(`/forms/${slug}`);
  };

  const handleGoHome = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            {status === 'processing' && (
              <>
                <Loader2 className="mx-auto h-12 w-12 text-blue-600 animate-spin" />
                <h2 className="mt-4 text-xl font-semibold text-gray-900">
                  Processing Payment
                </h2>
                <p className="mt-2 text-sm text-gray-600">{message}</p>
              </>
            )}

            {status === 'success' && (
              <>
                <CheckCircle className="mx-auto h-12 w-12 text-green-600" />
                <h2 className="mt-4 text-xl font-semibold text-gray-900">
                  Payment Successful!
                </h2>
                <p className="mt-2 text-sm text-gray-600">{message}</p>
                {transactionId && (
                  <p className="mt-2 text-xs text-gray-500">
                    Transaction ID: {transactionId}
                  </p>
                )}
                <div className="mt-6 space-y-3">
                  <Button
                    onClick={handleGoHome}
                    className="w-full"
                  >
                    Return to Home
                  </Button>
                  <Button
                    onClick={handleReturnToForm}
                    variant="outline"
                    className="w-full"
                  >
                    Submit Another Form
                  </Button>
                </div>
              </>
            )}

            {status === 'error' && (
              <>
                <AlertCircle className="mx-auto h-12 w-12 text-red-600" />
                <h2 className="mt-4 text-xl font-semibold text-gray-900">
                  Payment Error
                </h2>
                <p className="mt-2 text-sm text-gray-600">{message}</p>
                <div className="mt-6 space-y-3">
                  <Button
                    onClick={handleReturnToForm}
                    className="w-full"
                  >
                    Try Again
                  </Button>
                  <Button
                    onClick={handleGoHome}
                    variant="outline"
                    className="w-full"
                  >
                    Return to Home
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}