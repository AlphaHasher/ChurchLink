import { useEffect, useState, useRef } from "react";
import type { FormEvent, MouseEvent } from "react";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "../hooks/auth-context";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Dove from "@/assets/Dove";
import { verifyAndSyncUser } from "@/helpers/UserHelper";
import { getAuthErrorMessage } from "../utils/errorMessages";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/Dialog";
import { getChurchName } from "@/helpers/ChurchSettingsHelper";
import { useLocalize } from "@/shared/utils/localizationUtils";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetEmail, setResetEmail] = useState<string>("");
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [resetError, setResetError] = useState<string>("");
  const [resetLoading, setResetLoading] = useState<boolean>(false);
  const [churchName, setChurchName] = useState("Your Church Name");
  const [isAppleSignInAvailable, setIsAppleSignInAvailable] = useState(true);
  const localize = useLocalize();

  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Determine where to go after login
  const getRedirectTo = (): string => {
    const state = location.state as { redirectTo?: string } | null;
    const fromState = state?.redirectTo;
    if (fromState) return fromState;
    const params = new URLSearchParams(location.search);
    const qp = params.get("redirectTo");
    if (qp) return qp;
    return "/";
  };

  useEffect(() => {
    if (user) {
      navigate(getRedirectTo(), { replace: true });
      navigate(getRedirectTo(), { replace: true });
    }
  }, [user]);

  // Fetch church name on component mount
  useEffect(() => {
    const fetchChurchName = async () => {
      try {
        const name = await getChurchName();
        setChurchName(name);
      } catch (error) {
        console.warn("Failed to fetch church name for login page:", error);
        // Keep default value
      }
    };

    fetchChurchName();
  }, []);

  // Check Apple Sign-In availability
  useEffect(() => {
    const checkAppleSignInAvailability = () => {
      // Apple Sign-In is available in modern browsers
      // But may not work in all environments or if not properly configured
      const userAgent = navigator.userAgent;
      const isSupported = 
        // Check if we're in a supported browser (most modern browsers support it)
        'fetch' in window && 
        'crypto' in window && 
        !userAgent.includes('MSIE') && 
        !userAgent.includes('Trident');
        
      console.log("Apple Sign-In availability check:", isSupported);
      setIsAppleSignInAvailable(isSupported);
    };

    checkAppleSignInAvailability();
  }, []);

  // Cleanup timeout on component unmount to prevent stale state updates
  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }
    };
  }, []);

  const handleForgotPassword = (e: MouseEvent) => {
    e.preventDefault();
    // Clear any existing timeout to prevent stale timers
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
    setResetEmail(email); // Pre-fill with email from login form if available
    setShowResetModal(true);
    setResetError("");
    setResetEmailSent(false);
  };

  const handlePasswordReset = async () => {
    if (!resetEmail) {
      setResetError("Please enter your email address");
      return;
    }

    setResetLoading(true);
    setResetError("");

    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetEmailSent(true);
      setResetError("");
      // Clear any existing timeout before setting a new one
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
      // Close modal after 2 seconds and store the timeout ID
      resetTimeoutRef.current = setTimeout(() => {
        setShowResetModal(false);
        setResetEmail("");
        resetTimeoutRef.current = null;
      }, 2000);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setResetError(getAuthErrorMessage(err.message));
      } else {
        setResetError("An error occurred. Please try again.");
      }
    } finally {
      setResetLoading(false);
    }
  };

  const handleEmailLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(""); // Clear any existing errors
    try {
      await signInWithEmailAndPassword(auth, email, password);

      const verified = await verifyAndSyncUser(setError);
      if (!verified) return;
      navigate(getRedirectTo(), { replace: true });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(getAuthErrorMessage(err.message));
      } else {
        setError("An error occurred. Please try again.");
      }
    }
  };

  const handleGoogleLogin = async () => {
    setError(""); // Clear any existing errors
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);

      const verified = await verifyAndSyncUser(setError);
      if (!verified) return;
      navigate(getRedirectTo(), { replace: true });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(getAuthErrorMessage(err.message));
      } else {
        setError("An error occurred. Please try again.");
      }
    }
  };

  const handleAppleLogin = async () => {
    setError(""); // Clear any existing errors
    console.log("🍎 Starting Apple Sign-In process...");
    
    try {
      const provider = new OAuthProvider('apple.com');
      provider.addScope('email');
      provider.addScope('name');
      
      // Set custom parameters for Apple Sign-In
      provider.setCustomParameters({
        // Locale for the sign-in flow
        locale: 'en'
      });
      
      console.log("🍎 Attempting Apple Sign-In popup...");
      const result = await signInWithPopup(auth, provider);
      console.log("🍎 Apple Sign-In successful:", result.user?.email);

      console.log("🍎 Verifying and syncing user...");
      const verified = await verifyAndSyncUser(setError);
      if (!verified) {
        console.log("❌ User verification failed");
        return;
      }
      
      console.log("✅ Apple Sign-In complete, redirecting...");
      navigate(getRedirectTo(), { replace: true });
    } catch (err: unknown) {
      console.error("❌ Apple Sign-In error:", err);
      
      if (err instanceof Error) {
        console.error("Error message:", err.message);
        console.error("Error code:", (err as any).code);
        console.error("Full error object:", JSON.stringify(err, null, 2));
        
        const errorCode = (err as any).code;
        const errorMessage = err.message;
        
        // Handle specific Firebase Auth error codes for Apple Sign-In
        if (errorCode === 'auth/operation-not-allowed') {
          setError('Apple Sign-In is not enabled in Firebase. Please contact support.');
        } else if (errorCode === 'auth/popup-closed-by-user') {
          setError('Sign-in was cancelled.');
        } else if (errorCode === 'auth/popup-blocked') {
          setError('Popup was blocked. Please allow popups and try again.');
        } else if (errorCode === 'auth/unauthorized-domain') {
          setError('This domain is not authorized for Apple Sign-In.');
        } else if (errorCode === 'auth/cancelled-popup-request') {
          setError('Sign-in was cancelled or interrupted.');
        } else if (errorCode === 'auth/account-exists-with-different-credential') {
          setError('An account already exists with the same email but different sign-in method.');
        } else if (errorMessage.includes('operation-not-allowed')) {
          setError('Apple Sign-In is not enabled in Firebase. Please contact support.');
        } else if (errorMessage.includes('popup-closed-by-user')) {
          setError('Sign-in was cancelled.');
        } else if (errorMessage.includes('popup-blocked')) {
          setError('Popup was blocked. Please allow popups and try again.');
        } else if (errorMessage.includes('unauthorized-domain')) {
          setError('This domain is not authorized for Apple Sign-In.');
        } else {
          // Don't use getAuthErrorMessage for Apple Sign-In as it might not handle Apple-specific errors
          setError(`Apple Sign-In failed: ${errorMessage}`);
        }
      } else {
        setError("An unexpected error occurred during Apple Sign-In. Please try again.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <div className="flex justify-center mb-6">
          <Dove
            className="fill-black!"
            fill="black"
          />
        </div>

        <h2 className="text-3xl font-bold text-gray-900 mb-2">{localize("Sign In")}</h2>
        <div className="text-gray-600 mb-6">
          {localize(`${churchName} welcomes you back! Please enter your
          credentials below.`)}
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6">
            {localize(error)}
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {localize("Email Address")}
            </label>
            <input
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              type="email"
              placeholder={localize("Enter email address")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {localize("Password")}
            </label>
            <input
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              type="password"
              placeholder={localize("Enter password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline transition-all"
            >
              {localize("Forgot your password?")}
            </button>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-all transform hover:-translate-y-0.5 hover:shadow-lg"
          >
            {localize("Sign In")}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">{localize("Or continue with")}</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          type="button"
          className="w-full bg-white border-2 border-gray-400 hover:bg-gray-50 !text-gray-800 font-semibold py-2 px-4 rounded-lg transition-all transform hover:-translate-y-0.5 hover:shadow-lg flex items-center justify-center gap-2 mb-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          {localize("Sign in with Google")}
        </button>

        {isAppleSignInAvailable && (
          <button
            onClick={handleAppleLogin}
            type="button"
            className="w-full bg-black hover:bg-gray-800 text-white font-semibold py-2 px-4 rounded-lg transition-all transform hover:-translate-y-0.5 hover:shadow-lg flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            {localize("Sign in with Apple")}
          </button>
        )}

        <div className="mt-6 text-center text-sm text-gray-600">
          {localize("Don't have an account?")}{" "}
          <Link to="/auth/signup" className="text-blue-600 hover:text-blue-700 font-medium">
            {localize("Sign up here")}
          </Link>
        </div>
      </div>

      {/* Password Reset Modal */}
      <Dialog
        open={showResetModal}
        onOpenChange={(open) => {
          // Clear timeout when modal is closed
          if (!open && resetTimeoutRef.current) {
            clearTimeout(resetTimeoutRef.current);
            resetTimeoutRef.current = null;
          }
          setShowResetModal(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{localize("Reset Your Password")}</DialogTitle>
            <DialogDescription>
              {localize("Enter your email address and we'll send you a link to reset your password.")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {localize("Email Address")}
              </label>
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !resetLoading) {
                    handlePasswordReset();
                  }
                }}
                placeholder={localize("Enter your email address")}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                autoFocus
              />
            </div>

            {resetError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                {localize(resetError)}
              </div>
            )}

            {resetEmailSent && (
              <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm">
                {localize("Password reset email sent! Please check your inbox.")}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  // Clear timeout when manually closing modal
                  if (resetTimeoutRef.current) {
                    clearTimeout(resetTimeoutRef.current);
                    resetTimeoutRef.current = null;
                  }
                  setShowResetModal(false);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                disabled={resetLoading}
              >
                {localize("Cancel")}
              </button>
              <button
                onClick={handlePasswordReset}
                disabled={resetLoading || resetEmailSent}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-all transform hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
              >
                {resetLoading ? localize("Sending...") : localize("Send Reset Email")}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Login;
