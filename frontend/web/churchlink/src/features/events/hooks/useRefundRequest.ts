import { toast } from 'react-toastify';
import api from '@/api/api';
import { MyEvent } from '../types/myEvents';

export function useRefundRequest() {
  const handleRefundRequest = async (eventRef: MyEvent, onSuccess?: () => void): Promise<void> => {
    try {
      // Show confirmation dialog with refund policy
      const refundPolicy = eventRef.event?.refund_policy || "Standard refund policy applies.";
      const displayName = eventRef.display_name || 'your registration';
      const confirmMessage = `Request refund for ${displayName}?\n\nRefund Policy: ${refundPolicy}`;
      
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
        
        // Brief delay to allow backend processing before refreshing
        setTimeout(() => {
          if (onSuccess) {
            onSuccess();
          }
        }, 500);
      } else {
        throw new Error(response.data?.message || "Failed to submit refund request");
      }
    } catch (error: any) {
      console.error("Refund request failed:", error);
      
      // Trust backend error messages
      const errorMessage = error?.response?.data?.detail || 
                           error?.message || 
                           "Failed to submit refund request";
      
      toast.error(`Refund request failed: ${errorMessage}`);
      throw error;
    }
  };

  return {
    handleRefundRequest
  };
}