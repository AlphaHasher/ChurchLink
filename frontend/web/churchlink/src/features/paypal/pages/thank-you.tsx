import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  parsePayPalReturn,
  capturePayPalOrder,
  executePayPalSubscription,
  PaypalCaptureResponse,
  PaypalExecuteSubResponse,
} from "../../../helpers/PaypalHelper"

type AnyConfirmation = PaypalCaptureResponse | PaypalExecuteSubResponse | null;

const ThankYouPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [status, setStatus] = useState<string>("Processing your payment...");
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<AnyConfirmation>(null);

  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const { paymentId, payerId, token } = parsePayPalReturn(location.search);

    const run = async () => {
      // One-time payment
      if (paymentId && payerId) {
        try {
          const res = await capturePayPalOrder(paymentId, payerId);
          setConfirmation(res);
          setStatus("Thank you! Your donation was successful.");
        } catch (err: any) {
          const msg = err?.response?.data?.error || "Payment could not be completed.";
          if (typeof msg === "string" && (msg.includes("already captured") || msg.includes("PAYMENT_ALREADY_DONE"))) {
            setStatus("Thank you! Your donation was successful.");
          } else {
            setError(msg);
            setStatus("");
          }
        }
        return;
      }

      // Subscription
      if (token) {
        try {
          const res = await executePayPalSubscription(token);
          setConfirmation(res);
          setStatus("Thank you! Your subscription was successful.");
        } catch (err: any) {
          const msg = err?.response?.data?.error || "Subscription could not be completed.";
          setError(msg);
          setStatus("");
        }
        return;
      }

      setError("Missing payment information. Please try again or contact support.");
      setStatus("");
    };

    run();
  }, [location.search]);

  const renderSubscriptionBlock = (c: PaypalExecuteSubResponse) => {
    const subId =
      c.id || c.subscription_id || (c.agreement as any)?.id;
    const subStatus = c.state || c.status || (c.agreement as any)?.state;

    const startDateRaw =
      c.start_date ||
      (c.agreement as any)?.start_date ||
      (c.execution_details as any)?.start_time;

    const nameFromExec = (c.execution_details as any)?.payer_name;
    const backendName = (c as any).name;
    const subscriberName = c.subscriber?.["name"]
      ? `${(c.subscriber as any).name?.given_name || ""} ${(c.subscriber as any).name?.surname || ""}`.trim()
      : "";
    const payerName = c.payer?.["payer_info"]
      ? `${(c.payer as any).payer_info?.first_name || ""} ${(c.payer as any).payer_info?.last_name || ""}`.trim()
      : "";
    const agreementPayerName = (c.agreement as any)?.payer?.payer_info
      ? `${(c.agreement as any).payer?.payer_info?.first_name || ""} ${(c.agreement as any).payer?.payer_info?.last_name || ""}`.trim()
      : "";

    const displayName = nameFromExec || backendName || subscriberName || payerName || agreementPayerName;

    const payerEmail =
      (c.execution_details as any)?.payer_email ||
      (c.payer as any)?.payer_info?.email ||
      (c.subscriber as any)?.email_address ||
      (c.agreement as any)?.payer?.payer_info?.email;

    const amountValue =
      (c.plan as any)?.payment_definitions?.[0]?.amount?.value ||
      (c.agreement as any)?.plan?.payment_definitions?.[0]?.amount?.value;

    const amountCurrency =
      (c.plan as any)?.payment_definitions?.[0]?.amount?.currency ||
      (c.agreement as any)?.plan?.payment_definitions?.[0]?.amount?.currency;

    const cycles =
      (c.plan as any)?.payment_definitions?.[0]?.cycles ||
      (c.agreement as any)?.plan?.payment_definitions?.[0]?.cycles;

    const nextBillingRaw =
      (c as any).agreement_details?.next_billing_date ||
      (c.execution_details as any)?.next_billing_time ||
      (c.agreement as any)?.agreement_details?.next_billing_date;

    const finalPaymentRaw =
      (c as any).agreement_details?.final_payment_date ||
      (c.agreement as any)?.agreement_details?.final_payment_date;

    return (
      <>
        <div><strong>Subscription ID:</strong> {subId}</div>
        <div><strong>Status:</strong> {subStatus}</div>
        {c.description && <div><strong>Description:</strong> {c.description}</div>}
        {startDateRaw && (
          <div><strong>Start Date:</strong> {new Date(startDateRaw).toLocaleDateString()}</div>
        )}
        {displayName && <div><strong>Subscriber Name:</strong> {displayName}</div>}
        {payerEmail && <div><strong>Payer Email:</strong> {payerEmail}</div>}
        {(amountValue || amountCurrency) && (
          <div><strong>Amount:</strong> {amountValue} {amountCurrency}</div>
        )}
        {cycles && <div><strong>Cycles:</strong> {cycles}</div>}
        {nextBillingRaw && (
          <div><strong>Next Billing Date:</strong> {new Date(nextBillingRaw).toLocaleDateString()}</div>
        )}
        {finalPaymentRaw && (
          <div><strong>Final Payment Date:</strong> {new Date(finalPaymentRaw).toLocaleDateString()}</div>
        )}
        {Array.isArray(c.links) && c.links[0]?.href && (
          <div className="mt-2">
            <a
              href={c.links[0].href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              View on PayPal
            </a>
          </div>
        )}
      </>
    );
  };

  const renderOneTimeBlock = (c: PaypalCaptureResponse) => {
    return (
      <>
        {c.transaction_id && (
          <>
            <div><strong>Transaction ID:</strong> {c.transaction_id}</div>
            {c.amount !== undefined && <div><strong>Amount:</strong> ${c.amount}</div>}
            {(c as any).fund_name && <div><strong>Fund:</strong> {(c as any).fund_name}</div>}
            {(c as any).user_email && <div><strong>Donor Email:</strong> {(c as any).user_email}</div>}
            <div><strong>Status:</strong> {c.status || "Completed"}</div>
          </>
        )}
      </>
    );
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded shadow text-center">
        <h1 className="text-3xl font-bold mb-4">Thank You!</h1>

        {confirmation && (
          <div className="mb-4 text-left bg-gray-50 p-4 rounded">
            <h2 className="text-xl font-semibold mb-2">Confirmation Details</h2>

            <details className="mb-4">
              <summary className="cursor-pointer text-sm text-gray-600">Debug: Show raw data</summary>
              <pre className="text-xs bg-gray-100 p-2 mt-2 overflow-auto">
                {JSON.stringify(confirmation, null, 2)}
              </pre>
            </details>

            <div className="space-y-2">
              {renderOneTimeBlock(confirmation as PaypalCaptureResponse)}
              {renderSubscriptionBlock(confirmation as PaypalExecuteSubResponse)}
            </div>
          </div>
        )}

        {status && <p className="text-green-600 mb-2">{status}</p>}
        {error && <p className="text-red-500 mb-2">{error}</p>}

        <button
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded"
          onClick={() => navigate("/")}
        >
          Back to Home
        </button>
      </div>
    </div>
  );
};

export default ThankYouPage;
