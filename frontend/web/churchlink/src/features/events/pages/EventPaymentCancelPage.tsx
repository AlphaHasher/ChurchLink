import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { XCircle, ArrowLeft, Home, Calendar, AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import api from '@/api/api';

interface EventDetails {
  id: string;
  name: string;
  ru_name?: string;
  description: string;
  date: string;
  location: string;
  price: number;
  spots: number;
  seats_taken?: number; // Use the correct field name from backend
  registrations_count?: number; // Keep as fallback for compatibility
}

export const EventPaymentCancelPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Get query parameters
  const token = searchParams.get('token');
  const hasError = searchParams.get('error') === 'true';

  // State
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEventDetails = async () => {
      if (!eventId) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get(`/v1/events/${eventId}`);
        if (response.data) {
          setEvent(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch event details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEventDetails();
  }, [eventId]);

  const handleRetryPayment = () => {
    if (eventId) {
      // Navigate back to the event registration page
      navigate(`/events/${eventId}`);
    } else {
      navigate('/');
    }
  };

  const handleGoHome = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading event details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Cancelled</h1>
          <p className="text-lg text-gray-600">
            Your event registration payment was cancelled
          </p>
        </div>

        {/* Error Alert (if there was an error during cancellation) */}
        {hasError && (
          <Alert className="mb-6 border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              There was an issue processing your payment cancellation. Please contact support if you have any concerns.
            </AlertDescription>
          </Alert>
        )}

        {/* Event Details Card */}
        {event && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                Event Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{event.name}</h3>
                  {event.ru_name && (
                    <p className="text-sm text-gray-600">{event.ru_name}</p>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Date:</span>
                    <p className="text-gray-600">{new Date(event.date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Location:</span>
                    <p className="text-gray-600">{event.location}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Price:</span>
                    <p className="text-gray-600">${event.price.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Available Spots:</span>
                    <p className="text-gray-600">
                      {(() => {
                        const takenSpots = event.seats_taken ?? event.registrations_count ?? 0;
                        const availableSpots = event.spots - takenSpots;
                        return `${Math.max(0, availableSpots)} remaining`;
                      })()}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Alert */}
        <Alert className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>No registration was completed.</strong>
            {' '}Your payment was cancelled and no charges were made to your account. 
            Your spot has not been reserved for this event.
          </AlertDescription>
        </Alert>

        {/* Information */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">What happened?</h3>
              <div className="space-y-3 text-sm text-gray-600">
                <p>
                  • Your payment process was cancelled before completion
                </p>
                <p>
                  • No charges were made to your payment method
                </p>
                <p>
                  • Your registration for this event was not processed
                </p>
                {token && (
                  <p className="text-xs text-gray-500">
                    Transaction reference: {token}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {eventId && (
            <Button
              onClick={handleRetryPayment}
              size="lg"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Try Again
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleGoHome}
            size="lg"
            className="flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            Go to Home
          </Button>
        </div>

        {/* Additional Help */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Need help? Contact us for assistance with your registration.
          </p>
        </div>
      </div>
    </div>
  );
};

export default EventPaymentCancelPage;