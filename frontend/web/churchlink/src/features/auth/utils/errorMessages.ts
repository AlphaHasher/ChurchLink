// Firebase Auth Error Message Mapping
export const getAuthErrorMessage = (error: string): string => {
  // Extract the error code from Firebase error messages
  const errorCode = error.match(/\(([^)]+)\)/)?.[1] || error;
  
  const errorMessages: Record<string, string> = {
    // Authentication errors
    'auth/invalid-credential': 'Invalid email or password. Please try again.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'No account found with this email address.',
    
    // Sign up errors
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/email-already-exists': 'An account with this email already exists.',
    'auth/weak-password': 'Password must be at least 6 characters long.',
    'auth/invalid-password': 'Password must be at least 6 characters long.',
    'auth/operation-not-allowed': 'This sign-in method is currently disabled.',
    
    // Network and general errors
    'auth/network-request-failed': 'Network error. Please check your connection.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/internal-error': 'Server error. Please try again later.',
    
    // Google sign-in errors
    'auth/popup-closed-by-user': 'Sign in cancelled.',
    'auth/cancelled-popup-request': 'Another sign in is in progress.',
    
    // Password reset errors
    'auth/invalid-action-code': 'This link is invalid or has expired.',
    'auth/expired-action-code': 'This link has expired.',
    
    // Default fallback
    'default': 'An error occurred. Please try again later.'
  };
  
  // Check if we have a specific message for this error code
  for (const [key, message] of Object.entries(errorMessages)) {
    if (errorCode.includes(key)) {
      return message;
    }
  }
  
  // Return default message if no specific match
  return errorMessages.default;
};
