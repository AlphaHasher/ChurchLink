import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, ArrowLeft, Download, Users, Calendar, DollarSign, ExternalLink } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Separator } from '@/shared/components/ui/separator';
import api from '@/api/api';
import jsPDF from 'jspdf';

interface RegisteredPerson {
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  payment_amount: number;
  donation_amount: number;
}

interface CompletionData {
  registrations_completed: number;
  total_amount: number;
  registered_people?: RegisteredPerson[];
  total_event_fee?: number;
  total_donation?: number;
}

interface EventDetails {
  id: string;
  name: string;
  ru_name?: string;
  description: string;
  date: string;
  location: string;
  price: number;
  spots: number;
  registrations_count: number;
}

export const PaymentSuccessPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Payment URL parameters
  const paymentId = searchParams.get('paymentId');
  const payerId = searchParams.get('PayerID');
  const token = searchParams.get('token');

  // Component state
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');
  const [eventDetails, setEventDetails] = useState<EventDetails | null>(null);
  const [completionData, setCompletionData] = useState<CompletionData | null>(null);

  useEffect(() => {
    const processPaymentSuccess = async () => {
      if (!eventId) {
        setStatus('error');
        setMessage('Event ID is missing. Please contact support if this error persists.');
        return;
      }

      if (!paymentId || !payerId || !token) {
        setStatus('error');
        setMessage('Missing required payment information. Please contact support if this error persists.');
        return;
      }

      try {
        setStatus('loading');

        // Call the backend success endpoint to complete the payment
        console.log('Completing payment via backend...', { paymentId, payerId, token });
        const response = await api.get(`/v1/events/${eventId}/payment/success`, {
          params: {
            paymentId,
            PayerID: payerId,
            token
          }
        });

        console.log('Backend response:', response.data);

        if (response.data && response.data.success) {
          // Extract completion data from backend response
          const backendData = response.data;
          
          // Handle response format with registration details
          const completionData = {
            registrations_completed: backendData.registrations_completed || backendData.registration_count || 1,
            total_amount: backendData.total_amount || 0,
            registered_people: backendData.registered_people || [],
            total_event_fee: backendData.total_event_fee || backendData.total_amount || 0,
            total_donation: backendData.total_donation || 0
          };

          setCompletionData(completionData);
          setStatus('success');
          setMessage('Payment completed successfully! Your event registration is confirmed.');

          // Fetch event details for display
          try {
            const eventResponse = await api.get(`/v1/events/${eventId}`);
            setEventDetails(eventResponse.data);
          } catch (eventError) {
            console.warn('Could not fetch event details:', eventError);
            // Don't fail the whole process if we can't get event details
          }

        } else {
          throw new Error(response.data?.message || 'Payment completion failed');
        }

      } catch (error: any) {
        console.error('Payment processing error:', error);
        setStatus('error');
        
        if (error.response?.status === 404) {
          setMessage('Payment record not found. The payment may already be processed or the session may have expired. Please check your registration status or contact support.');
        } else if (error.response?.status === 400) {
          setMessage('Invalid payment parameters. Please contact support with your payment ID for assistance.');
        } else {
          setMessage(error.response?.data?.detail || error.message || 'An unexpected error occurred while processing your payment. Please contact support.');
        }
      }
    };

    processPaymentSuccess();
  }, [eventId, paymentId, payerId, token]);

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(num);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleGoToEvents = () => {
    navigate('/events');
  };

  const handleGoToMyEvents = () => {
    navigate('/profile/my-events');
  };

  const downloadReceipt = () => {
    if (!eventDetails || !completionData) return;

    // Create new PDF document
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let yPosition = 20;
    const lineHeight = 8;
    const sectionSpacing = 15;

    // Helper function to add text with automatic wrapping
    const addText = (text: string, x: number, y: number, options: any = {}) => {
      doc.setFont('helvetica', options.style || 'normal');
      doc.setFontSize(options.size || 12);
      doc.text(text, x, y, { maxWidth: pageWidth - 40, ...options });
      return y + (options.size || 12) * 0.35; // Return next Y position
    };

    // Header
    doc.setFillColor(34, 139, 34); // Forest Green
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setTextColor(255, 255, 255);
    yPosition = addText('Church Event Registration Receipt', 20, 20, { size: 18, style: 'bold' });
    
    // Reset text color
    doc.setTextColor(0, 0, 0);
    yPosition += sectionSpacing;

    // Event Details Section
    yPosition = addText('Event Details', 20, yPosition, { size: 14, style: 'bold' });
    yPosition += 5;
    
    doc.setDrawColor(200, 200, 200);
    doc.line(20, yPosition, pageWidth - 20, yPosition);
    yPosition += 10;
    
    yPosition = addText(`Event Name: ${eventDetails.name}`, 25, yPosition);
    yPosition += lineHeight;
    yPosition = addText(`Date: ${formatDate(eventDetails.date)}`, 25, yPosition);
    yPosition += lineHeight;
    yPosition = addText(`Location: ${eventDetails.location}`, 25, yPosition);
    yPosition += sectionSpacing;

    // Payment Details Section
    yPosition = addText('Payment Details', 20, yPosition, { size: 14, style: 'bold' });
    yPosition += 5;
    
    doc.line(20, yPosition, pageWidth - 20, yPosition);
    yPosition += 10;
    
    yPosition = addText(`Payment ID: ${paymentId || 'N/A'}`, 25, yPosition);
    yPosition += lineHeight;
    yPosition = addText(`Total Amount: ${formatCurrency(completionData.total_amount)}`, 25, yPosition);
    yPosition += lineHeight;
    yPosition = addText(`Currency: USD`, 25, yPosition);
    yPosition += lineHeight;
    yPosition = addText(`Number of Registrations: ${completionData.registrations_completed}`, 25, yPosition);
    yPosition += lineHeight;
    yPosition = addText(`Status: Completed`, 25, yPosition);
    yPosition += sectionSpacing;

    // Registered People Section
    if (completionData.registered_people && completionData.registered_people.length > 0) {
      yPosition = addText('Registered People', 20, yPosition, { size: 14, style: 'bold' });
      yPosition += 5;
      
      doc.line(20, yPosition, pageWidth - 20, yPosition);
      yPosition += 10;
      
      completionData.registered_people.forEach((person, index) => {
        // Check if we need a new page
        if (yPosition > 250) {
          doc.addPage();
          yPosition = 20;
        }
        
        yPosition = addText(`${index + 1}. ${person.full_name}`, 25, yPosition, { style: 'bold' });
        yPosition += 6;
        
        if (person.email) {
          yPosition = addText(`   Email: ${person.email}`, 25, yPosition, { size: 10 });
          yPosition += 6;
        }
        
        if (person.payment_amount > 0) {
          yPosition = addText(`   Event Fee: ${formatCurrency(person.payment_amount)}`, 25, yPosition, { size: 10 });
          yPosition += 6;
        }
        
        if (person.donation_amount > 0) {
          yPosition = addText(`   Donation: ${formatCurrency(person.donation_amount)}`, 25, yPosition, { size: 10 });
          yPosition += 6;
        }
        
        yPosition += 5; // Space between people
      });
    }

    // Footer
    yPosition += sectionSpacing;
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }
    
    doc.setDrawColor(200, 200, 200);
    doc.line(20, yPosition, pageWidth - 20, yPosition);
    yPosition += 10;
    
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    yPosition = addText(`Generated on: ${currentDate}`, 20, yPosition, { size: 10 });
    yPosition += lineHeight;
    yPosition = addText('Thank you for your registration!', 20, yPosition, { size: 10, style: 'italic' });

    // Save the PDF
    const fileName = `Event_Registration_Receipt_${paymentId || eventId}.pdf`;
    doc.save(fileName);
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <Loader2 className="h-16 w-16 animate-spin text-blue-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Processing Payment
              </h2>
              <p className="text-gray-600">
                Please wait while we verify your payment and complete your event registration...
              </p>
              <div className="mt-4 text-sm text-gray-500">
                <p>Payment ID: {paymentId}</p>
                <p>This may take a few moments</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-lg w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <XCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Payment Processing Failed
              </h2>
              <Alert variant="destructive" className="mb-6 text-left">
                <AlertDescription>{message}</AlertDescription>
              </Alert>
              
              <div className="space-y-3">
                <Button onClick={handleGoToEvents} variant="outline" className="w-full">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Return to Events
                </Button>
                
                {paymentId && (
                  <div className="pt-4 border-t border-gray-200">
                    <h3 className="text-sm font-medium text-gray-900 mb-2">Payment Information</h3>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p>Payment ID: {paymentId}</p>
                      {token && <p>Token: {token}</p>}
                      {payerId && <p>Payer ID: {payerId}</p>}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Please save this information for support reference
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Success Header - Consistent with Flutter design */}
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-10 w-10 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-green-800 mb-2">
                Payment Successful!
              </h1>
              <p className="text-green-700 mb-2">
                Your payment has been processed and your registration is confirmed.
              </p>
              {completionData && (
                <div className="text-sm text-green-600 mb-6">
                  <p className="mb-2">
                    {completionData.registrations_completed} {completionData.registrations_completed === 1 ? 'person' : 'people'} registered for {formatCurrency(completionData.total_amount)}
                  </p>
                  {completionData.registered_people && completionData.registered_people.length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-2">
                      <p className="font-semibold text-green-800 mb-2">Registrations Completed:</p>
                      <div className="space-y-1">
                        {completionData.registered_people.map((person, index) => (
                          <div key={index} className="flex justify-between items-center text-green-700">
                            <span className="font-medium">{person.full_name}</span>
                            <div className="text-xs">
                              {person.payment_amount > 0 && (
                                <span className="mr-2">Event: {formatCurrency(person.payment_amount)}</span>
                              )}
                              {person.donation_amount > 0 && (
                                <span>Donation: {formatCurrency(person.donation_amount)}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button 
                  onClick={handleGoToMyEvents} 
                  className="flex items-center bg-green-600 hover:bg-green-700"
                >
                  <Users className="h-4 w-4 mr-2" />
                  View My Events
                </Button>
                <Button onClick={handleGoToEvents} variant="outline" className="flex items-center border-green-300 text-green-700 hover:bg-green-100">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Browse More Events
                </Button>
                {eventDetails && completionData && (
                  <Button onClick={downloadReceipt} variant="outline" className="flex items-center border-green-300 text-green-700 hover:bg-green-100">
                    <Download className="h-4 w-4 mr-2" />
                    Download Receipt
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Event Details */}
          {eventDetails && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Event Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">{eventDetails.name}</h3>
                  {eventDetails.ru_name && (
                    <p className="text-sm text-gray-600">{eventDetails.ru_name}</p>
                  )}
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span>{formatDate(eventDetails.date)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-400" />
                    <span>{eventDetails.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                    <span>{formatCurrency(eventDetails.price)} per person</span>
                  </div>
                </div>

                {eventDetails.description && (
                  <div>
                    <h4 className="font-medium mb-2">Description</h4>
                    <p className="text-sm text-gray-600">{eventDetails.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Registration Summary */}
          {completionData && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Registration Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Registrations Completed:</span>
                  <Badge variant="secondary">{completionData.registrations_completed}</Badge>
                </div>
                
                {completionData.registered_people && completionData.registered_people.length > 0 && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="font-medium text-gray-800 mb-2">Registered People:</p>
                    <div className="space-y-2">
                      {completionData.registered_people.map((person, index) => (
                        <div key={index} className="flex justify-between items-center text-sm">
                          <span className="font-medium text-gray-700">{person.full_name}</span>
                          <div className="text-right text-gray-600">
                            {person.payment_amount > 0 && (
                              <div>Event: {formatCurrency(person.payment_amount)}</div>
                            )}
                            {person.donation_amount > 0 && (
                              <div>Donation: {formatCurrency(person.donation_amount)}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total Amount:</span>
                  <span className="font-semibold text-green-600">
                    {formatCurrency(completionData.total_amount)}
                  </span>
                </div>

                <Separator />

                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">Payment Confirmed</span>
                  </div>
                  <p className="text-sm text-green-700 mt-1">
                    Your registration is complete and confirmed.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Payment Information */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Payment Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="font-medium mb-2">Transaction Details</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Payment ID:</span>
                    <span className="font-mono">{paymentId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <Badge variant="default">Completed</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Method:</span>
                    <span>PayPal</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Payer ID:</span>
                    <span className="font-mono">{payerId}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Amount Details</h4>
                <div className="space-y-1 text-sm">
                  {completionData && (
                    <>
                      <div className="flex justify-between">
                        <span>Total Amount:</span>
                        <span className="font-semibold">{formatCurrency(completionData.total_amount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Currency:</span>
                        <span>USD</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Registrations:</span>
                        <span>{completionData.registrations_completed}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Next Steps Information */}
        <Card className="mt-6 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <CheckCircle className="h-5 w-5" />
              What Happens Next?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-blue-700">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
                <p className="text-sm">You will receive a confirmation email shortly with your registration details.</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
                <p className="text-sm">Check your calendar - the event is on {eventDetails ? formatDate(eventDetails.date) : 'the scheduled date'}.</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</div>
                <p className="text-sm">Arrive at {eventDetails?.location || 'the event location'} on time for check-in.</p>
              </div>
              {eventDetails && eventDetails.price > 0 && (
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">✓</div>
                  <p className="text-sm font-medium text-green-700">Payment completed - no additional payment needed!</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Support Information */}
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="text-center text-sm text-gray-600">
              <p className="mb-2">
                Need to make changes to your registration or have questions about the event?
              </p>
              <div className="flex justify-center items-center gap-4">
                <span className="font-mono text-xs">Ref: {paymentId}</span>
                <Separator orientation="vertical" className="h-4" />
                <a href="mailto:support@church.org" className="text-blue-600 hover:underline flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" />
                  Contact Support
                </a>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Save your reference number for faster support
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PaymentSuccessPage;