import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";

const ThankYouPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>("Processing your payment...");
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<any>(null);

  const hasRun = useRef(false);
  
  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    
    const params = new URLSearchParams(location.search);
    const paymentId = params.get("paymentId") || params.get("payment_id");
    const payerId = params.get("PayerID") || params.get("payer_id");
    const token = params.get("token");
    const apiHost = import.meta.env.VITE_API_HOST || "http://localhost:8000";
    
    if (paymentId && payerId) {
      // One-time payment
      axios.post(`${apiHost}/api/v1/paypal/orders/${paymentId}/capture?payer_id=${payerId}`)
        .then(res => {
          setConfirmation(res.data);
          setStatus("Thank you! Your donation was successful.");
        })
        .catch(err => {
          const msg = err?.response?.data?.error || "Payment could not be completed.";
          if (msg.includes("already captured") || msg.includes("PAYMENT_ALREADY_DONE")) {
            setStatus("Thank you! Your donation was successful.");
          } else {
            setError(msg);
            setStatus("");
          }
        });
    } else if (token) {
      // Subscription
      axios.post(`${apiHost}/api/v1/paypal/subscription/execute?token=${token}`)
        .then(res => {
          setConfirmation(res.data);
          setStatus("Thank you! Your subscription was successful.");
        })
        .catch(err => {
          const msg = err?.response?.data?.error || "Subscription could not be completed.";
          setError(msg);
          setStatus("");
        });
    } else {
      setError("Missing payment information. Please try again or contact support.");
      setStatus("");
    }
  }, [location.search]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded shadow text-center">
        <h1 className="text-3xl font-bold mb-4">Thank You!</h1>
        {confirmation && (
          <div className="mb-4 text-left bg-gray-50 p-4 rounded">
            <h2 className="text-xl font-semibold mb-2">Confirmation Details</h2>
            <div className="space-y-2">
              {/* One-time donation confirmation */}
              {confirmation.transaction_id && (
                <>
                  <div><strong>Transaction ID:</strong> {confirmation.transaction_id}</div>
                  <div><strong>Amount:</strong> ${confirmation.amount}</div>
                  {confirmation.fund_name && <div><strong>Fund:</strong> {confirmation.fund_name}</div>}
                  {confirmation.user_email && <div><strong>Donor Email:</strong> {confirmation.user_email}</div>}
                  <div><strong>Status:</strong> {confirmation.status || 'Completed'}</div>
                </>
              )}
              
              {/* Subscription confirmation */}
              {(confirmation.id || confirmation.subscription_id || confirmation.agreement) && (
                <>
                  <div><strong>Subscription ID:</strong> {confirmation.id || confirmation.subscription_id || confirmation.agreement?.id}</div>
                  <div><strong>Status:</strong> {confirmation.state || confirmation.status || confirmation.agreement?.state}</div>
                  {confirmation.description && <div><strong>Description:</strong> {confirmation.description}</div>}
                  {(confirmation.start_date || confirmation.agreement?.start_date || confirmation.execution_details?.start_time) && (
                    <div><strong>Start Date:</strong> {
                      new Date(confirmation.start_date || confirmation.agreement?.start_date || confirmation.execution_details?.start_time).toLocaleDateString()
                    }</div>
                  )}
                  
                  {/* Enhanced subscriber name display */}
                  {(() => {
                    const executionName = confirmation.execution_details?.payer_name;
                    const backendName = confirmation.name;
                    const subscriberName = confirmation.subscriber?.name ? 
                      `${confirmation.subscriber.name.given_name || ''} ${confirmation.subscriber.name.surname || ''}`.trim() : '';
                    const payerName = confirmation.payer?.payer_info ? 
                      `${confirmation.payer.payer_info.first_name || ''} ${confirmation.payer.payer_info.last_name || ''}`.trim() : '';
                    const agreementPayerName = confirmation.agreement?.payer?.payer_info ? 
                      `${confirmation.agreement.payer.payer_info.first_name || ''} ${confirmation.agreement.payer.payer_info.last_name || ''}`.trim() : '';
                    
                    const displayName = executionName || backendName || subscriberName || payerName || agreementPayerName;
                    
                    return displayName ? (
                      <div><strong>Subscriber Name:</strong> {displayName}</div>
                    ) : null;
                  })()}
                  
                  {/* Email display */}
                  {(confirmation.payer?.payer_info?.email || 
                    confirmation.subscriber?.email_address || 
                    confirmation.execution_details?.payer_email ||
                    confirmation.agreement?.payer?.payer_info?.email) && (
                    <div><strong>Payer Email:</strong> {
                      confirmation.execution_details?.payer_email ||
                      confirmation.payer?.payer_info?.email || 
                      confirmation.subscriber?.email_address || 
                      confirmation.agreement?.payer?.payer_info?.email
                    }</div>
                  )}
                  
                  {/* Amount display */}
                  {(confirmation.plan?.payment_definitions?.[0]?.amount ||
                    confirmation.agreement?.plan?.payment_definitions?.[0]?.amount) && (
                    <div><strong>Amount:</strong> ${
                      (confirmation.plan?.payment_definitions?.[0]?.amount?.value ||
                       confirmation.agreement?.plan?.payment_definitions?.[0]?.amount?.value)
                    } {
                      (confirmation.plan?.payment_definitions?.[0]?.amount?.currency ||
                       confirmation.agreement?.plan?.payment_definitions?.[0]?.amount?.currency)
                    }</div>
                  )}
                  
                  {/* Cycles */}
                  {(confirmation.plan?.payment_definitions?.[0]?.cycles ||
                    confirmation.agreement?.plan?.payment_definitions?.[0]?.cycles) && (
                    <div><strong>Cycles:</strong> {
                      confirmation.plan?.payment_definitions?.[0]?.cycles ||
                      confirmation.agreement?.plan?.payment_definitions?.[0]?.cycles
                    }</div>
                  )}
                  
                  {/* Next billing date */}
                  {(confirmation.agreement_details?.next_billing_date || 
                    confirmation.execution_details?.next_billing_time ||
                    confirmation.agreement?.agreement_details?.next_billing_date) && (
                    <div><strong>Next Billing Date:</strong> {
                      new Date(
                        confirmation.agreement_details?.next_billing_date || 
                        confirmation.execution_details?.next_billing_time ||
                        confirmation.agreement?.agreement_details?.next_billing_date
                      ).toLocaleDateString()
                    }</div>
                  )}
                  
                  {/* Final payment date */}
                  {(confirmation.agreement_details?.final_payment_date ||
                    confirmation.agreement?.agreement_details?.final_payment_date) && (
                    <div><strong>Final Payment Date:</strong> {
                      new Date(
                        confirmation.agreement_details?.final_payment_date ||
                        confirmation.agreement?.agreement_details?.final_payment_date
                      ).toLocaleDateString()
                    }</div>
                  )}
                </>
              )}
            </div>
            {confirmation && confirmation.links?.[0]?.href && (
              <div className="mt-2">
                <a href={confirmation.links[0].href} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                  View on PayPal
                </a>
              </div>
            )}
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
