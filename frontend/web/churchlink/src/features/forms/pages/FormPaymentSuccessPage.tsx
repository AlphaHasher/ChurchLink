'use client';

import { useEffect, useState } from 'react';
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

  useEffect(() => {
    const completePayment = async () => {
      // Validate required parameters
      if (!token || !payerId) {
        setStatus('error');
        setMessage('Missing payment information. Please try again.');
        return;
      }

      if (!user?.uid) {
        setStatus('error');
        setMessage('You must be logged in to complete this payment.');
        return;
      }

      try {
        // Get saved form data
        const savedFormData = localStorage.getItem(`form_data_${slug}`);
        let formResponseData = {};
        
        if (savedFormData) {
          try {
            const parsedData = JSON.parse(savedFormData);
            const { _timestamp, ...restoredData } = parsedData;
            formResponseData = restoredData;
          } catch (e) {
            console.error('Failed to parse saved form data:', e);
          }
        }

        // Complete the payment
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
          
          // Clean up saved form data
          localStorage.removeItem(`form_data_${slug}`);
          
          // Set success state
          setStatus('success');
          setMessage(`Payment of $${realAmount.toFixed(2)} completed successfully! Your form submission has been recorded.`);
          setTransactionId(response.data?.payment_id || token);
        } else {
          throw new Error(response.error || 'Payment completion failed');
        }
      } catch (error) {
        console.error('Payment completion error:', error);
        setStatus('error');
        setMessage(
          error instanceof Error 
            ? `Payment completion failed: ${error.message}` 
            : 'Payment completion failed. Please contact support.'
        );
      }
    };

    completePayment();
  }, [token, payerId, slug, user]);

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