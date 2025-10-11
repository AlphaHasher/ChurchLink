import api from '@/api/api';

// Only keep interfaces that are actually used
export interface FormPaymentOrderRequest {
  payment_amount?: number;
  form_response: Record<string, any>;
  return_url?: string;
  cancel_url?: string;
}

export interface FormPaymentOrderResponse {
  success: boolean;
  approval_url?: string;
  payment_id?: string;
  error?: string;
}

export interface FormSubmissionCompletionRequest {
  payment_id: string;
  payer_id: string;
  // total_amount removed - backend gets real amount from PayPal capture
  payer_email?: string;
  payer_name?: string;
  form_response: Record<string, any>;
  user_uid?: string;
}

export interface FormSubmissionCompletionResponse {
  success: boolean;
  data?: {
    status: string;
    message: string;
    form_id: string;
    form_slug: string;
    payment_id: string;
    response_id: string;
    total_amount: number;
  };
  error?: string;
}

export const formPaymentApi = {
  /**
   * Create form payment order
   */
  createFormPaymentOrder: async (
    slug: string,
    orderData: FormPaymentOrderRequest
  ): Promise<FormPaymentOrderResponse> => {
    try {
      const response = await api.post(
        `/v1/forms/slug/${slug}/payment/create-order`,
        orderData
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
      console.error('[FormPayment] Create payment order failed:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Network error',
      };
    }
  },

  /**
   * Complete form submission after payment
   */
  completeFormSubmission: async (
    slug: string,
    completionData: FormSubmissionCompletionRequest
  ): Promise<FormSubmissionCompletionResponse> => {
    try {
      const response = await api.post(
        `/v1/forms/slug/${slug}/payment/complete-submission`,
        completionData
      );

      console.log('[FormPayment] Completion response:', {
        status: response.status,
        data: response.data
      });

      if (response.status === 200 && response.data) {
        return {
          success: true,
          data: response.data,
        };
      }

      return {
        success: false,
        error: response.data?.detail || 'Failed to complete form submission',
      };
    } catch (error: any) {
      console.error('[FormPayment] Complete submission failed:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Network error',
      };
    }
  },
};