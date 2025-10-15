import { useState, useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group';

import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { 
  Users, 
  DollarSign, 
  CreditCard, 
  CheckCircle,
  AlertTriangle,
  Loader2 
} from 'lucide-react';
import api from '@/api/api';

interface Registration {
  family_member_id?: string | null;
  name: string;
}

interface Event {
  id: string;
  name: string;
  price: number;
  requires_payment?: boolean;
  is_free_event?: boolean;
  payment_options?: string[];
}

interface BulkEventRegistrationWidgetProps {
  event: Event;
  registrations: Registration[];
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

export function BulkEventRegistrationWidget({
  event,
  registrations,
  onSuccess,
  onCancel,
  className = ""
}: BulkEventRegistrationWidgetProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [donationAmount, setDonationAmount] = useState(10.0);
  const [selectedPaymentOption, setSelectedPaymentOption] = useState('free');
  const [errorMessage, setErrorMessage] = useState('');

  // Determine default payment option based on event requirements
  useEffect(() => {
    if (event.requires_payment) {
      // For paid events, default to the first available payment method
      if (event.payment_options?.includes('paypal')) {
        setSelectedPaymentOption('paypal');
      } else if (event.payment_options?.includes('door')) {
        setSelectedPaymentOption('door');
      }
    } else {
      // For free events, default to free registration
      setSelectedPaymentOption('free');
    }
  }, [event]);

  // Calculate total amount
  const totalAmount = event.requires_payment 
    ? event.price * registrations.length 
    : donationAmount;

  // Get button text based on selected payment option
  const getButtonText = () => {
    if (selectedPaymentOption === 'door') {
      return `Register & Pay $${(event.price * registrations.length).toFixed(2)} at Door`;
    } else if (selectedPaymentOption === 'paypal' && event.requires_payment) {
      return `Pay $${totalAmount.toFixed(2)} with PayPal`;
    } else if (selectedPaymentOption === 'paypal' && !event.requires_payment) {
      return `Donate $${donationAmount.toFixed(2)} with PayPal`;
    } else if (donationAmount > 0 && !event.requires_payment) {
      return `Donate $${donationAmount.toFixed(2)}`;
    }
    return `Register ${registrations.length} ${registrations.length === 1 ? 'person' : 'people'}`;
  };

  // Get button color based on payment option
  const getButtonColor = () => {
    if (selectedPaymentOption === 'door') {
      return 'bg-orange-600 hover:bg-orange-700';
    } else if (selectedPaymentOption === 'paypal' || donationAmount > 0) {
      return 'bg-blue-600 hover:bg-blue-700'; // PayPal blue
    }
    return '';
  };

  // Handle registration process
  const handleRegistration = async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      if (selectedPaymentOption === 'door') {
        await handlePayAtDoorRegistration();
      } else if (selectedPaymentOption === 'paypal') {
        await handlePayPalPayment();
      } else {
        await handleFreeRegistration();
      }
    } catch (error: any) {
      console.error('[BulkRegistration] Error:', error);
      setErrorMessage(error.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle pay-at-door registration
  const handlePayAtDoorRegistration = async () => {
    console.log('[BulkRegistration] Processing pay-at-door registration');
    
    // Register each person individually since there's no bulk endpoint
    const registrationPromises = registrations.map(async (reg) => {
      if (reg.family_member_id) {
        // Register family member
        return api.post(`/v1/event-people/register/${event.id}/family-member/${reg.family_member_id}`, {
          payment_option: 'door'
        });
      } else {
        // Register self
        return api.post(`/v1/event-people/register/${event.id}`, {
          payment_option: 'door'
        });
      }
    });

    const responses = await Promise.all(registrationPromises);
    
    // Check if all registrations succeeded
    const failures = responses.filter(response => !response.data?.success);
    if (failures.length > 0) {
      throw new Error(`Failed to register ${failures.length} person(s) for door payment`);
    }

    console.log('[BulkRegistration] Pay-at-door registrations completed');
    onSuccess?.();
  };

  // Handle PayPal payment
  const handlePayPalPayment = async () => {
    console.log('[BulkRegistration] Creating PayPal payment order');
    
    const requestData = {
      registrations: registrations.map(reg => ({
        person_id: reg.family_member_id,
        name: reg.name,
        donation_amount: (donationAmount || 0) / registrations.length, // Split donation among registrations
        payment_amount_per_person: 0
      })),
      message: "",
      return_url: "",
      cancel_url: ""
    };

    const response = await api.post(`/v1/events/${event.id}/payment/create-bulk-order`, requestData);

    if (!response.data?.success) {
      throw new Error(response.data?.message || 'Failed to create payment order');
    }

    const approvalUrl = response.data.approval_url;
    console.log('[BulkRegistration] Opening PayPal browser:', approvalUrl);

    // Redirect to PayPal
    window.location.href = approvalUrl;
  };

  // Handle free registration
  const handleFreeRegistration = async () => {
    console.log('[BulkRegistration] Processing free registrations');
    
    // Register each person individually since there's no bulk endpoint
    const registrationPromises = registrations.map(async (reg) => {
      if (reg.family_member_id) {
        // Register family member
        return api.post(`/v1/event-people/register/${event.id}/family-member/${reg.family_member_id}`, {
          payment_option: 'free'
        });
      } else {
        // Register self
        return api.post(`/v1/event-people/register/${event.id}`, {
          payment_option: 'free'
        });
      }
    });

    const responses = await Promise.all(registrationPromises);
    
    // Check if all registrations succeeded
    const failures = responses.filter(response => !response.data?.success);
    if (failures.length > 0) {
      throw new Error(`Failed to register ${failures.length} person(s) for free`);
    }

    console.log('[BulkRegistration] Free registrations completed');
    onSuccess?.();
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Registration Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Registration Summary */}
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-medium">Event:</span>
              <span>{event.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">Number of people:</span>
              <Badge variant="secondary">{registrations.length}</Badge>
            </div>
            {event.requires_payment && (
              <>
                <div className="flex justify-between items-center">
                  <span className="font-medium">Price per person:</span>
                  <span>${event.price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-green-600">Total amount:</span>
                  <span className="font-bold text-green-600">${totalAmount.toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Payment Options for Paid Events */}
        {event.requires_payment && (
          <div className="space-y-4">
            <Label className="text-base font-medium">Payment Method</Label>
            <p className="text-sm text-gray-600">
              This event costs ${event.price.toFixed(2)} per person. Choose your payment method:
            </p>
            <RadioGroup
              value={selectedPaymentOption}
              onValueChange={setSelectedPaymentOption}
            >
              {event.payment_options?.includes('paypal') && (
                <div className="flex items-center space-x-3 p-3 border rounded-lg">
                  <RadioGroupItem value="paypal" id="paypal" />
                  <div className="flex-1">
                    <Label htmlFor="paypal" className="font-medium cursor-pointer flex items-center gap-2">
                      Pay with PayPal
                      <Badge variant="outline" className="bg-blue-600 text-white">PayPal</Badge>
                    </Label>
                    <p className="text-sm text-gray-600">
                      Pay ${totalAmount.toFixed(2)} now
                    </p>
                  </div>
                </div>
              )}
              {event.payment_options?.includes('door') && (
                <div className="flex items-center space-x-3 p-3 border rounded-lg">
                  <RadioGroupItem value="door" id="door" />
                  <div className="flex-1">
                    <Label htmlFor="door" className="font-medium cursor-pointer">
                      Pay at Door
                    </Label>
                    <p className="text-sm text-gray-600">
                      Pay ${totalAmount.toFixed(2)} when you arrive
                    </p>
                  </div>
                </div>
              )}
            </RadioGroup>
          </div>
        )}

        {/* Optional Donation for Free Events */}
        {event.is_free_event && event.payment_options?.includes('paypal') && (
          <div className="space-y-4">
            <Label className="text-base font-medium">Optional Donation</Label>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-green-700 mb-3">
                This is a free event. You can optionally make a donation to support our ministry.
              </p>
              <RadioGroup
                value={selectedPaymentOption}
                onValueChange={setSelectedPaymentOption}
              >
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="free" id="free" />
                  <Label htmlFor="free" className="cursor-pointer">
                    Register (No donation)
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="paypal" id="paypal-donation" />
                  <Label htmlFor="paypal-donation" className="cursor-pointer">
                    Register + Donate via PayPal
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Donation Amount Selector */}
            {selectedPaymentOption === 'paypal' && (
              <div className="space-y-2">
                <Label htmlFor="donation-amount">Donation Amount</Label>
                <div className="flex items-center space-x-2">
                  <span>$</span>
                  <Input
                    id="donation-amount"
                    type="number"
                    min="0"
                    max="10000"
                    step="0.01"
                    value={donationAmount}
                    onChange={(e) => setDonationAmount(parseFloat(e.target.value) || 0)}
                    className="flex-1"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col space-y-3">
          <Button
            onClick={handleRegistration}
            disabled={isLoading}
            className={`w-full ${getButtonColor()}`}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {selectedPaymentOption === 'paypal' ? (
                  <CreditCard className="mr-2 h-4 w-4" />
                ) : selectedPaymentOption === 'door' ? (
                  <DollarSign className="mr-2 h-4 w-4" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                {getButtonText()}
              </>
            )}
          </Button>

          {onCancel && (
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
              className="w-full"
            >
              Cancel
            </Button>
          )}
        </div>

        {/* Registrant List */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Registrants:</Label>
          <div className="text-sm text-gray-600">
            {registrations.map((reg, index) => (
              <div key={index} className="flex items-center gap-2">
                <Users className="h-3 w-3" />
                <span>{reg.name}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}