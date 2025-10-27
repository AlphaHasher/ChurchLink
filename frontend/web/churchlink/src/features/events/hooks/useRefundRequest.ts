import { toast } from 'react-toastify';
import api from '@/api/api';
import { MyEvent } from '../types/myEvents';

export function useRefundRequest() {
  const handleRefundRequest = async (eventRef: MyEvent, onSuccess?: () => void): Promise<void> => {
    try {
      // Show confirmation dialog with refund policy
      const refundPolicy = eventRef.event?.refund_policy || "Standard refund policy applies.";
      const displayName = eventRef.display_name || 'your registration';
      const confirmMessage = `Request refund for ${displayName}?\n\nRefund Policy: ${refundPolicy}\n\nThis will:\n• Submit a refund request to administrators\n• Keep the registration active until refund is processed\n• Send you email updates on refund status`;
      
      if (!window.confirm(confirmMessage)) {
        return;
      }

      // Submit refund request
      const payload = {
        event_id: eventRef.event_id,
        person_id: eventRef.person_id,
        display_name: displayName,
        reason: "User requested refund via My Events interface"
      };

      const response = await api.post(`/v1/events/${eventRef.event_id}/refund/request`, payload);
      
      if (response.data?.success) {
        toast.success(`Refund request submitted successfully for ${displayName}. You will receive email updates on the refund status.`);
        
        // Wait longer for backend to update payment status and database consistency
        setTimeout(() => {
          if (onSuccess) {
            onSuccess();
          }
        }, 1500); // Increased to 1.5s delay to ensure backend and database have processed the status update
      } else {
        throw new Error(response.data?.message || "Failed to submit refund request");
      }
    } catch (error: any) {
      console.error("Refund request failed:", error);
      
      // Handle specific error types with user-friendly messages
      let errorMessage = "Failed to submit refund request";
      
      if (error?.response?.status === 409) {
        // Conflict - duplicate request
        errorMessage = error?.response?.data?.detail || "You have already submitted a refund request for this registration.";
      } else if (error?.response?.status === 404) {
        // Not found - registration/transaction not found
        errorMessage = error?.response?.data?.detail || "Registration or payment information not found.";
      } else if (error?.response?.data?.detail) {
        // Other API error with detail
        errorMessage = error.response.data.detail;
      } else if (error?.message) {
        // General error
        errorMessage = error.message;
      }
      
      toast.error(`Refund request failed: ${errorMessage}`);
      throw error; // Re-throw for component-specific handling if needed
    }
  };

  return {
    handleRefundRequest
  };
}