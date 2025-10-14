import api from '@/api/api';

export interface BulkRegistrationData {
  family_member_id?: string | null;
  name: string;
}

export interface BulkPaymentOrderRequest {
  registrations: BulkRegistrationData[];
  message: string;
  return_url?: string;
  cancel_url?: string;
}

export interface BulkPaymentOrderResponse {
  success: boolean;
  approval_url?: string;
  payment_id?: string;
  error?: string;
}

export interface PaymentStatusResponse {
  success: boolean;
  data?: {
    state: string;
    payer_id: string;
    amount: number;
  };
  error?: string;
}

export interface BulkRegistrationCompletionRequest {
  registrations: BulkRegistrationData[];
  payment_id: string;
  payer_id: string;
}

export interface BulkRegistrationCompletionResponse {
  success: boolean;
  data?: {
    registrations_completed: number;
    total_amount: number;
  };
  error?: string;
}

/**
 * PayPal API service for handling bulk event registrations with payment processing
 */
export const paypalEventApi = {
  /**
   * Create a bulk PayPal payment order for multiple event registrations
   */
  createBulkPaymentOrder: async (
    eventId: string,
    request: BulkPaymentOrderRequest
  ): Promise<BulkPaymentOrderResponse> => {
    try {
      const response = await api.post(
        `/v1/events/${eventId}/payment/create-bulk-order`,
        request
      );

      if (response.status === 200 && response.data) {
        return {
          success: true,
          approval_url: response.data.approval_url,
          payment_id: response.data.payment_id,
        };
      }

      return {
        success: false,
        error: response.data?.detail || 'Failed to create bulk payment order',
      };
    } catch (error: any) {
      console.error('[PayPal] Bulk payment order creation failed:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Network error',
      };
    }
  },

  /**
   * Get payment status for a specific payment
   */
  getPaymentStatus: async (
    eventId: string,
    paymentId: string
  ): Promise<PaymentStatusResponse> => {
    try {
      const response = await api.get(
        `/v1/events/${eventId}/payment/status/${paymentId}`
      );

      if (response.status === 200 && response.data) {
        return {
          success: true,
          data: response.data,
        };
      }

      return {
        success: false,
        error: 'Failed to get payment status',
      };
    } catch (error: any) {
      console.error('[PayPal] Payment status check failed:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Network error',
      };
    }
  },

  /**
   * Complete bulk event registration after successful payment
   */
  completeBulkRegistration: async (
    eventId: string,
    request: BulkRegistrationCompletionRequest
  ): Promise<BulkRegistrationCompletionResponse> => {
    try {
      const response = await api.post(
        `/v1/events/${eventId}/payment/complete-bulk-registration`,
        request
      );

      if (response.status === 200 && response.data) {
        return {
          success: true,
          data: response.data,
        };
      }

      return {
        success: false,
        error: response.data?.detail || 'Failed to complete bulk registration',
      };
    } catch (error: any) {
      console.error('[PayPal] Bulk registration completion failed:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Network error',
      };
    }
  },

  /**
   * Create individual event payment order (using bulk system for consistency)
   */
  createEventPaymentOrder: async (
    eventId: string,
    message: string,
    returnUrl?: string,
    cancelUrl?: string
  ): Promise<BulkPaymentOrderResponse> => {
    try {
      // Use bulk payment system with single registration for consistency
      const registrations = [
        {
          name: "Event Registration",
          family_member_id: null, // Self registration
          donation_amount: 0.0
        }
      ];

      const response = await api.post(
        `/v1/events/${eventId}/payment/create-bulk-order`,
        {
          registrations,
          message,
          return_url: returnUrl,
          cancel_url: cancelUrl,
        }
      );

      if (response.status === 200 && response.data) {
        return {
          success: true,
          approval_url: response.data.approval_url,
          payment_id: response.data.payment_id,
        };
      }

      return {
        success: false,
        error: response.data?.detail || 'Failed to create payment order',
      };
    } catch (error: any) {
      console.error('[PayPal] Event payment order creation failed:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Network error',
      };
    }
  },

  /**
   * Complete individual event payment (using bulk system for consistency)
   */
  completeEventPayment: async (
    eventId: string,
    paymentId: string,
    payerId: string,
    userEmail?: string
  ): Promise<BulkRegistrationCompletionResponse> => {
    try {
      // Use bulk completion system with single registration for consistency
      const registrations = [
        {
          name: "Event Registration",
          family_member_id: null, // Self registration
          donation_amount: 0.0
        }
      ];

      const response = await api.post(
        `/v1/events/${eventId}/payment/complete-bulk-registration`,
        {
          registrations,
          payment_id: paymentId,
          payer_id: payerId,
          payer_email: userEmail,
          total_amount: 0.0, // Will be calculated by backend
        }
      );

      console.log('[PayPal] Payment completion response:', {
        status: response.status,
        data: response.data
      });

      if (response.status === 200 && response.data) {
        // Check if the backend indicates success or partial success
        const backendStatus = response.data.success;
        if (backendStatus) {
          return {
            success: true,
            data: response.data,
          };
        } else {
          return {
            success: false,
            error: response.data.message || response.data.error || 'Payment processing failed',
          };
        }
      }

      return {
        success: false,
        error: response.data?.detail || 'Failed to complete payment',
      };
    } catch (error: any) {
      console.error('[PayPal] Event payment completion failed:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Network error',
      };
    }
  },
};