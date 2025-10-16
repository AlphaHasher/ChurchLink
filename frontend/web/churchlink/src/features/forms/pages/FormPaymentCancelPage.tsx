'use client';

import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/ui/button';
import { XCircle, ArrowLeft } from 'lucide-react';

export default function FormPaymentCancelPage() {
  const params = useParams();
  const navigate = useNavigate();
  const slug = params.slug as string;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <XCircle className="h-12 w-12 text-orange-500" />
          </div>
          <h1 className="text-2xl font-bold mb-4 text-gray-900">Payment Cancelled</h1>
        </div>
        
        <div className="text-center space-y-4">
          <p className="text-gray-600">
            Your payment was cancelled. No charges have been made to your account.
          </p>
          
          <p className="text-sm text-gray-500">
            You can try again or choose a different payment method.
          </p>
          
          <div className="space-y-2 pt-4">
            <Button 
              onClick={() => navigate(`/forms/${slug}`)}
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Return to Form
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate('/')}
              className="w-full"
            >
              Return to Home
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}