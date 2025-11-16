'use client';

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/auth-context";

import {
  captureAndSubmitFormPayment,
} from "@/helpers/FormSubmissionHelper";
import { useLocalize } from "@/shared/utils/localizationUtils";

export default function FormPaymentSuccessPage() {
  const localize = useLocalize();

  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const slug = params.slug as string;

  // PayPal orders v2: token === order_id. PayerID is not required for our combined server call.
  const orderId = searchParams.get("token");

  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("Processing your payment...");
  const [transactionId, setTransactionId] = useState<string | null>(null);

  // Strict Mode / refresh idempotency guards
  const processedRef = useRef<string | null>(null);

  useEffect(() => {
    // We only need orderId + slug
    if (!orderId || !slug) {
      setStatus("error");
      setMessage("Missing payment information. Please try again.");
      return;
    }

    // Per-tab latch to avoid StrictMode double-run and user refresh spam
    const seenKey = `form_processed_${orderId}`;
    if (processedRef.current === orderId || sessionStorage.getItem(seenKey)) {
      // Already processed in this tab/session — show success calmly
      setStatus("success");
      setMessage("Payment completed successfully! Your form submission has been recorded.");
      setTransactionId(orderId);
      return;
    }

    const go = async () => {
      if (!user?.uid) {
        setStatus("error");
        setMessage("You must be logged in to complete this payment.");
        return;
      }

      try {
        // Latch before network (prevents double dispatch in Strict Mode)
        processedRef.current = orderId;
        sessionStorage.setItem(seenKey, "1");

        // Restore answers saved before redirect
        const storageKey = `form_data_${slug}`;
        const saved = localStorage.getItem(storageKey);
        let answers: Record<string, any> = {};
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            const { _timestamp, ...restored } = parsed ?? {};
            answers = restored;
          } catch {
            // ignore parse failure
          }
        }

        // Single server request: capture PayPal and submit the form response atomically
        const result = await captureAndSubmitFormPayment(slug, orderId, answers);

        // Clean up persisted answers; keep session latch
        localStorage.removeItem(storageKey);

        setStatus("success");
        setMessage("Payment completed successfully! Your form submission has been recorded.");
        setTransactionId(result?.transaction_id || orderId);
      } catch (err: any) {
        console.error("Payment completion error", err);
        // Clear the latch ONLY if server says it truly failed, so user can retry
        processedRef.current = null;
        sessionStorage.removeItem(seenKey);

        setStatus("error");
        setMessage(
          err?.response?.data?.detail ||
          err?.response?.data?.message ||
          err?.message ||
          "Payment completion failed. Please contact support."
        );
      }
    };

    go();
  }, [slug, orderId, user]);

  const handleReturnToForm = () => navigate(`/forms/${slug}`);
  const handleGoHome = () => navigate("/");

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            {status === "processing" && (
              <>
                <Loader2 className="mx-auto h-12 w-12 text-blue-600 animate-spin" />
                <h2 className="mt-4 text-xl font-semibold text-gray-900">{localize("Processing Payment")}</h2>
                <p className="mt-2 text-sm text-gray-600">{localize(message)}</p>
              </>
            )}

            {status === "success" && (
              <>
                <CheckCircle className="mx-auto h-12 w-12 text-green-600" />
                <h2 className="mt-4 text-xl font-semibold text-gray-900">{localize("Payment Successful!")}</h2>
                <p className="mt-2 text-sm text-gray-600">{localize(message)}</p>
                {transactionId && (
                  <p className="mt-2 text-xs text-gray-500">{localize("Transaction ID")}: {transactionId}</p>
                )}
                <div className="mt-6 space-y-3">
                  <Button onClick={handleGoHome} className="w-full">
                    {localize("Return to Home")}
                  </Button>
                  <Button onClick={handleReturnToForm} variant="outline" className="w-full">
                    {localize("Submit Another Form")}
                  </Button>
                </div>
              </>
            )}

            {status === "error" && (
              <>
                <AlertCircle className="mx-auto h-12 w-12 text-red-600" />
                <h2 className="mt-4 text-xl font-semibold text-gray-900">{localize("Payment Error")}</h2>
                <p className="mt-2 text-sm text-gray-600">{localize(message)}</p>
                <div className="mt-6 space-y-3">
                  <Button onClick={handleReturnToForm} className="w-full">
                    {localize("Try Again")}
                  </Button>
                  <Button onClick={handleGoHome} variant="outline" className="w-full">
                    {localize("Return to Home")}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
