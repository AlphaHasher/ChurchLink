import React, { useState } from "react";
import axios from "axios";

export interface PaypalContent {
  title?: string;
  subtitle?: string;
  buttonText?: string;
  amount?: number;
  message?: string;
  backgroundImageUrl?: string;
  purpose?: string;
  isSubscription?: boolean;
  cycles?: number;
  startDate?: string;
  interval_unit?: "DAY" | "WEEK" | "MONTH" | "YEAR";
  interval_count?: number;
}

interface PaypalSectionProps {
  data: PaypalContent;
  isEditing: boolean;
  onChange?: (content: PaypalContent) => void;
  editableFields?: (keyof PaypalContent)[];
}


const PaypalSection: React.FC<PaypalSectionProps> = ({ data, isEditing, onChange, editableFields }) => {
  const [isPreview, setIsPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowedFunds, setAllowedFunds] = useState<string[]>(["General", "Building", "Missions", "Youth", "Other"]);
  
  // State variables
  const [purpose, setPurpose] = useState<string>(data.purpose || "General");
  const [amount, setAmount] = useState<number>(data.amount || 0.01);
  const [message, setMessage] = useState<string>(data.message || "");
  const [isSubscription, setIsSubscription] = useState(!!data.isSubscription);
  const [startDate, setStartDate] = useState<string>(data.startDate?.substring(0, 10) || "");
  const [intervalUnit, setIntervalUnit] = useState<"DAY"|"WEEK"|"MONTH"|"YEAR">(data.interval_unit || "MONTH");
  const [intervalCount, setIntervalCount] = useState<number>(data.interval_count || 1);
  const [cycles, setCycles] = useState<number>(data.cycles || 12);
  
  // Name fields for subscriptions
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");

  React.useEffect(() => {
    if (allowedFunds.length > 0 && !allowedFunds.includes(purpose)) {
      setPurpose(allowedFunds[0]);
    }
  }, [allowedFunds]);

  React.useEffect(() => {
    setPurpose(data.purpose || "General");
    setAmount(data.amount || 0.01);
    setMessage(data.message || "");
    setIsSubscription(!!data.isSubscription);
    setIntervalUnit(data.interval_unit || "MONTH");
    setIntervalCount(data.interval_count || 1);
    setCycles(data.cycles || 12);
    
    if (data.startDate && !startDate) {
      setStartDate(data.startDate.substring(0, 10));
    }
  }, [data]);

  // Fetch PayPal settings
  const fetchPayPalSettings = async () => {
    try {
      const apiHost = import.meta.env.VITE_API_HOST || "http://localhost:8000";
      const response = await axios.get(`${apiHost}/api/v1/paypal/settings`);
      if (response.data?.settings?.ALLOWED_FUNDS) {
        setAllowedFunds(response.data.settings.ALLOWED_FUNDS);
      }
    } catch (error) {
      console.warn('Failed to fetch PayPal settings, using defaults');
    }
  };

  // Load settings on component mount
  React.useEffect(() => {
    fetchPayPalSettings();
  }, []);

  const updateField = (field: keyof PaypalContent, value: string | number | boolean) => {
    if (field === "isSubscription") {
      setIsSubscription(!!value);
    }
    onChange?.({ ...data, [field]: value });
  };

  // Dedicated function for PayPal subscription creation
  interface PaypalDonation {
    fund_name: string;
    amount?: number;
    message?: string;
    interval_unit?: string;
    interval_count?: number;
    cycles?: number;
    start_date?: string;
    return_url?: string;
    cancel_url?: string;
  }

  const createSubscription = async (donation: PaypalDonation) => {
    const apiHost = import.meta.env.VITE_API_HOST || "http://localhost:8000";
    const url = `${apiHost}/api/v1/paypal/subscription`;
    try {
      const response = await axios.post(url, { donation }, {
        headers: { 'Content-Type': 'application/json' }
      });
      return response.status === 200 ? response.data : null;
    } catch (e) {
      console.error('Subscription creation error:', e);
      return null;
    }
  };

  // Handler for PayPal donation
  const handleDonate = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiHost = import.meta.env.VITE_API_HOST || "http://localhost:8000";
      let response;
      
      if (isSubscription) {
        let startDateIso = startDate;
        if (startDate && startDate.includes('-')) {
          const [year, month, day] = startDate.split('-').map(Number);
          if (year > 2020 && year < 2030 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            const targetDate = new Date(year, month - 1, day, 12, 0, 0);
            startDateIso = targetDate.toISOString();
          }
        } else {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          startDateIso = tomorrow.toISOString();
        }

        const donationPayload = {
          fund_name: purpose,
          amount: amount,
          message: message,
          interval_unit: intervalUnit,
          interval_count: intervalCount,
          cycles: cycles,
          start_date: startDateIso,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          return_url: window.location.origin + "/thank-you",
          cancel_url: window.location.origin + window.location.pathname,
        };
        response = await createSubscription(donationPayload);
      } else {
        // One-time donation
        const payload = {
          donation: {
            fund_name: purpose,
            amount: amount,
            message: message,
            return_url: window.location.origin + "/thank-you",
            cancel_url: window.location.origin + window.location.pathname,
          },
        };
        response = await axios.post(`${apiHost}/api/v1/paypal/orders`, payload);
      }
      
      if (!response) {
        setError("Failed to process payment. Please try again.");
        return;
      }
      
      const approval_url = response?.approval_url || response?.data?.approval_url;
      if (approval_url) {
        window.location.href = approval_url;
      } else {
        setError("Could not get PayPal approval URL.");
      }
    } catch (err) {
      let errorMsg = "Error creating PayPal order.";
      if (axios.isAxiosError(err)) {
        errorMsg = err.response?.data?.error || errorMsg;
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-cover bg-center py-20 text-white text-center rounded" style={{ backgroundImage: `url(${data.backgroundImageUrl})` }}    >
      {isEditing && (
        <div className="text-right max-w-6xl mx-auto mb-4">
          <button
            onClick={() => setIsPreview(!isPreview)}
            className="px-4 py-1 text-sm bg-white text-white rounded hover:bg-gray-200"
          >
            {isPreview ? "Edit" : "Preview"}
          </button>
        </div>
      )}
      {isEditing && !isPreview ? (
        <div className="space-y-3 max-w-2xl mx-auto">
          {editableFields?.includes("title") && (
            <input
              type="text"
              placeholder="Paypal Title"
              className="w-full border p-2 rounded bg-white text-black"
              value={data.title || ""}
              onChange={(e) => updateField("title", e.target.value)}
            />
          )}
          {editableFields?.includes("subtitle") && (
            <input
              type="text"
              placeholder="Paypal Subtitle"
              className="w-full border p-2 rounded bg-white text-black"
              value={data.subtitle || ""}
              onChange={(e) => updateField("subtitle", e.target.value)}
            />
          )}
          {editableFields?.includes("backgroundImageUrl") && (
            <input
              type="text"
              placeholder="Background Image URL"
              className="w-full border p-2 rounded bg-white text-black"
              value={data.backgroundImageUrl || ""}
              onChange={(e) => updateField("backgroundImageUrl", e.target.value)}
            />
          )}
          {editableFields?.includes("buttonText") && (
            <input
              type="text"
              placeholder="Button Text"
              className="w-full border p-2 rounded bg-white text-black"
              value={data.buttonText || ""}
              onChange={(e) => updateField("buttonText", e.target.value)}
            />
          )}
        </div>
      ) : (
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="bg-white/90 shadow-xl rounded-2xl p-8 w-full max-w-lg text-gray-900">
            <div className="flex flex-col items-center mb-6">
              <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                <svg width="40" height="40" fill="none" viewBox="0 0 24 24"><path fill="#2563eb" d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16z"/></svg>
              </div>
              <h1 className="text-3xl font-bold text-blue-700 mb-1">{data.title || "Support Our Church"}</h1>
              <p className="text-lg text-gray-600">{data.subtitle || "Your generosity makes a difference!"}</p>
            </div>
            <form className="space-y-3 mb-6 w-full" onSubmit={e => {e.preventDefault(); handleDonate();}}>
              {/* Purpose dropdown */}
              <div className="mb-2">
                <label className="font-semibold text-gray-700 block mb-1">Purpose:</label>
                <select
                  className="w-full border rounded px-2 py-2 bg-blue-50 text-blue-700"
                  value={purpose}
                  onChange={e => {
                    setPurpose(e.target.value);
                    onChange?.({ ...data, purpose: e.target.value });
                  }}
                >
                  {allowedFunds.map(fund => (
                    <option key={fund} value={fund}>{fund}</option>
                  ))}
                </select>
              </div>
              {/* Amount (editable) */}
              <div className="mb-2">
                <label className="font-semibold text-gray-700 block mb-1">Amount:</label>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  className="w-full border rounded px-2 py-2 bg-green-50 text-green-700 text-2xl font-bold"
                  value={amount}
                  onChange={e => {
                    const val = parseFloat(e.target.value) || 0.01;
                    setAmount(val);
                    onChange?.({ ...data, amount: val });
                  }}
                  placeholder="$0.00"
                />
              </div>
              {/* Message optional */}
              <div className="mb-2">
                <label className="font-semibold text-gray-700 block mb-1">Message (optional):</label>
                <input
                  type="text"
                  className="w-full border rounded px-2 py-2 bg-gray-50 text-gray-700"
                  value={message}
                  onChange={e => {
                    setMessage(e.target.value);
                    onChange?.({ ...data, message: e.target.value });
                  }}
                  placeholder="Add a message for your donation"
                />
              </div>
              {/* Recurring toggle */}
              <div className="mb-2">
                <label className="font-semibold text-gray-700 block mb-1">Recurring:</label>
                <button
                  type="button"
                  className={`px-4 py-2 rounded-full font-semibold ${isSubscription ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                  onClick={() => updateField("isSubscription", !isSubscription)}
                  aria-pressed={isSubscription}
                >
                  {isSubscription ? "Yes" : "No"}
                </button>
              </div>
              
              {/* Name fields for subscriptions */}
              {isSubscription && (
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="flex flex-col">
                    <label className="font-semibold text-gray-700 mb-1">First Name:</label>
                    <input
                      type="text"
                      className="border rounded px-2 py-2 bg-blue-50 text-blue-700"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      placeholder="Enter first name"
                      required
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="font-semibold text-gray-700 mb-1">Last Name:</label>
                    <input
                      type="text"
                      className="border rounded px-2 py-2 bg-blue-50 text-blue-700"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      placeholder="Enter last name"
                      required
                    />
                  </div>
                </div>
              )}
              
              {/* Show recurrence/cycles/start date if recurring */}
              {isSubscription && (
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div className="flex flex-col">
                    <label className="font-semibold text-gray-700 mb-1">Interval Unit:</label>
                    <select
                      className="border rounded px-2 py-2 bg-blue-50 text-blue-700"
                      value={intervalUnit}
                      onChange={e => {
                        const val = e.target.value as "DAY" | "WEEK" | "MONTH" | "YEAR";
                        setIntervalUnit(val);
                        onChange?.({ ...data, interval_unit: val });
                      }}
                    >
                      <option value="DAY">Day</option>
                      <option value="WEEK">Week</option>
                      <option value="MONTH">Month</option>
                      <option value="YEAR">Year</option>
                    </select>
                  </div>
                  <div className="flex flex-col">
                    <label className="font-semibold text-gray-700 mb-1">Interval Count:</label>
                    <input
                      type="number"
                      min={1}
                      max={intervalUnit === "DAY" ? 365 : intervalUnit === "WEEK" ? 52 : intervalUnit === "MONTH" ? 12 : 1}
                      className="border rounded px-2 py-2 bg-blue-50 text-blue-700"
                      value={intervalCount}
                      onChange={e => {
                        let val = parseInt(e.target.value, 10);
                        let max = 1;
                        if (intervalUnit === "DAY") max = 365;
                        else if (intervalUnit === "WEEK") max = 52;
                        else if (intervalUnit === "MONTH") max = 12;
                        else if (intervalUnit === "YEAR") max = 1;
                        if (isNaN(val) || val < 1) val = 1;
                        if (val > max) val = max;
                        setIntervalCount(val);
                        onChange?.({ ...data, interval_count: val });
                      }}
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="font-semibold text-gray-700 mb-1">Cycles (max 60):</label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      className="border rounded px-2 py-2 bg-blue-50 text-blue-700"
                      value={cycles}
                      onChange={e => {
                        let val = parseInt(e.target.value, 10);
                        if (isNaN(val) || val < 1) val = 1;
                        if (val > 60) val = 60;
                        setCycles(val);
                        onChange?.({ ...data, cycles: val });
                      }}
                    />
                  </div>
                  <div className="flex flex-col col-span-3">
                    <label className="font-semibold text-gray-700 mb-1">Start Date:</label>
                    <input
                      type="date"
                      className="border rounded px-2 py-2 bg-blue-50 text-blue-700"
                      value={startDate}
                      onChange={e => {
                        setStartDate(e.target.value);
                        onChange?.({ ...data, startDate: e.target.value });
                      }}
                    />
                  </div>
                </div>
              )}
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold px-6 py-3 rounded-full shadow transition"
                disabled={loading || isEditing}
                style={isEditing ? { cursor: 'not-allowed', opacity: 0.6 } : {}}
              >
                {loading ? "Redirecting..." : (data.buttonText || "Donate with PayPal")}
              </button>
              {error && <div className="text-red-500 mt-2 text-center">{error}</div>}
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

export default PaypalSection;
