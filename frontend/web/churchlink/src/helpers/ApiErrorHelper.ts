/**
 * Extracts a user-friendly error message from an API error response.
 * 
 * @param error - The error object from axios or other API calls
 * @param fallbackMessage - Default message to show if no specific error is found
 * @returns A user-friendly error message
 */
export const getApiErrorMessage = (error: any, fallbackMessage: string = "An error occurred"): string => {
  // First, try to get the detail from the response (FastAPI standard)
  if (error?.response?.data?.detail) {
    const detail = error.response.data.detail;
    
    // If detail is a string, return it
    if (typeof detail === 'string') {
      return detail;
    }
    
    // If detail is an array (validation errors), format them
    if (Array.isArray(detail)) {
      const messages = detail.map((err: any) => {
        if (typeof err === 'string') return err;
        if (err.msg) return `${err.loc ? err.loc.join('.') + ': ' : ''}${err.msg}`;
        return JSON.stringify(err);
      });
      return messages.join('; ');
    }
    
    // If detail is an object, try to extract message
    if (typeof detail === 'object' && detail.message) {
      return detail.message;
    }
  }
  
  // Try other common error message locations
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  
  if (error?.response?.data?.error) {
    return typeof error.response.data.error === 'string' 
      ? error.response.data.error 
      : error.response.data.error.message || fallbackMessage;
  }
  
  // If there's a message directly on the error
  if (error?.message && typeof error.message === 'string') {
    // Filter out generic axios messages that aren't helpful
    if (!error.message.includes('Network Error') && 
        !error.message.includes('Request failed')) {
      return error.message;
    }
  }
  
  // Check for network errors
  if (error?.message === 'Network Error' || !error?.response) {
    return 'Network error. Please check your connection and try again.';
  }
  
  // Check for specific HTTP status codes
  if (error?.response?.status) {
    switch (error.response.status) {
      case 400:
        return fallbackMessage || 'Invalid request. Please check your input.';
      case 401:
        return 'You are not authorized to perform this action. Please log in again.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 409:
        return 'This item already exists or conflicts with an existing item.';
      case 500:
        return 'Server error. Please try again later.';
      case 503:
        return 'Service temporarily unavailable. Please try again later.';
      default:
        return `${fallbackMessage} (Error ${error.response.status})`;
    }
  }
  
  // Final fallback
  return fallbackMessage;
};
