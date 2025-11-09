import React, { useEffect, useMemo, useState } from "react";
import {
  PaypalContent,
  IntervalUnit,
  getPayPalSettings,
  createPayPalOrder,
  createPayPalSubscription,
  toStartDateISO,
  getReturnUrl,
  getCancelUrl,
} from "../../../../../helpers/PaypalHelper"

interface PaypalSectionProps {
  data: PaypalContent;
  isEditing: boolean;
  onChange?: (content: PaypalContent) => void;
  editableFields?: (keyof PaypalContent)[];
}

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

const PaypalSection: React.FC<PaypalSectionProps> = ({ data, isEditing, onChange, editableFields }) => {
  const [isPreview, setIsPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [allowedFunds, setAllowedFunds] = useState<string[]>(["General", "Building", "Missions", "Youth", "Other"]);

  const [purpose, setPurpose] = useState<string>(data.purpose || "General");
  const [amount, setAmount] = useState<number>(data.amount ?? 0.01);
  const [message, setMessage] = useState<string>(data.message ?? "");
  const [isSubscription, setIsSubscription] = useState<boolean>(!!data.isSubscription);
  const [startDate, setStartDate] = useState<string>(data.startDate?.substring(0, 10) ?? "");
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>(data.interval_unit ?? "MONTH");
  const [intervalCount, setIntervalCount] = useState<number>(data.interval_count ?? 1);
  const [cycles, setCycles] = useState<number>(data.cycles ?? 12);

  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");

  useEffect(() => {
    let ignore = false;
    (async () => {
      const funds = await getPayPalSettings();
      if (!ignore) setAllowedFunds(funds);
    })();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    setPurpose(data.purpose || "General");
    setAmount(data.amount ?? 0.01);
    setMessage(data.message ?? "");
    setIsSubscription(!!data.isSubscription);
    setIntervalUnit(data.interval_unit ?? "MONTH");
    setIntervalCount(data.interval_count ?? 1);
    setCycles(data.cycles ?? 12);
    if (data.startDate && !startDate) setStartDate(data.startDate.substring(0, 10));
  }, [data]);

  useEffect(() => {
    if (allowedFunds.length && !allowedFunds.includes(purpose)) {
      setPurpose(allowedFunds[0]);
      onChange?.({ ...data, purpose: allowedFunds[0] });
    }
  }, [allowedFunds]);

  const maxForUnit = useMemo(() => {
    switch (intervalUnit) {
      case "DAY":
        return 365;
      case "WEEK":
        return 52;
      case "MONTH":
        return 12;
      case "YEAR":
      default:
        return 1;
    }
  }, [intervalUnit]);

  const handleUpdate = (field: keyof PaypalContent, value: any) => {
    if (field === "isSubscription") setIsSubscription(!!value);
    onChange?.({ ...data, [field]: value });
  };

  const handleDonate = async () => {
    setLoading(true);
    setError(null);

    const validAmount = Number.isFinite(amount) && amount >= 0.01;
    if (!validAmount) {
      setError("Please enter a valid amount (min $0.01).");
      setLoading(false);
      return;
    }

    try {
      let result: { approval_url?: string } | null = null;

      if (isSubscription) {
        if (!firstName.trim() || !lastName.trim()) {
          setError("Please provide first and last name for subscriptions.");
          setLoading(false);
          return;
        }

        const donation = {
          fund_name: purpose,
          amount,
          message,
          interval_unit: intervalUnit,
          interval_count: clamp(intervalCount, 1, maxForUnit),
          cycles: clamp(cycles, 1, 60),
          start_date: toStartDateISO(startDate),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          return_url: getReturnUrl(),
          cancel_url: getCancelUrl(),
        };

        result = await createPayPalSubscription(donation);
      } else {
        const payload = {
          donation: {
            fund_name: purpose,
            amount,
            message,
            return_url: getReturnUrl(),
            cancel_url: getCancelUrl(),
          },
        };
        result = await createPayPalOrder(payload);
      }

      if (!result?.approval_url) {
        setError("Could not get PayPal approval URL.");
      } else {
        window.location.href = result.approval_url!;
      }
    } catch (e) {
      setError("Error processing PayPal request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      className="bg-cover bg-center text-white text-center rounded px-4 py-8 sm:py-12 lg:py-20"
      style={{ backgroundImage: `url(${data.backgroundImageUrl ?? ""})` }}
    >
      {isEditing && (
        <div className="text-right max-w-6xl mx-auto mb-4">
          <button
            onClick={() => setIsPreview((s) => !s)}
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
              onChange={(e) => handleUpdate("title", e.target.value)}
            />
          )}
          {editableFields?.includes("subtitle") && (
            <input
              type="text"
              placeholder="Paypal Subtitle"
              className="w-full border p-2 rounded bg-white text-black"
              value={data.subtitle || ""}
              onChange={(e) => handleUpdate("subtitle", e.target.value)}
            />
          )}
          {editableFields?.includes("backgroundImageUrl") && (
            <input
              type="text"
              placeholder="Background Image URL"
              className="w-full border p-2 rounded bg-white text-black"
              value={data.backgroundImageUrl || ""}
              onChange={(e) => handleUpdate("backgroundImageUrl", e.target.value)}
            />
          )}
          {editableFields?.includes("buttonText") && (
            <input
              type="text"
              placeholder="Button Text"
              className="w-full border p-2 rounded bg-white text-black"
              value={data.buttonText || ""}
              onChange={(e) => handleUpdate("buttonText", e.target.value)}
            />
          )}
        </div>
      ) : (
        <div className="flex justify-center items-center">
          <div className="bg-white/90 shadow-xl rounded-2xl p-6 sm:p-8 w-full max-w-[480px] text-gray-900">
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-2" aria-hidden>
                <svg width="32" height="32" fill="none" viewBox="0 0 24 24">
                  <path fill="#2563eb" d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16z" />
                </svg>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-blue-700 mb-1">
                {data.title || "Support Our Church"}
              </h1>
              <p className="text-base sm:text-lg text-gray-600">
                {data.subtitle || "Your generosity makes a difference!"}
              </p>
            </div>

            <form className="space-y-3 mb-6 w-full" onSubmit={(e) => { e.preventDefault(); handleDonate(); }}>
              <div className="mb-2">
                <label className="font-semibold text-gray-700 block mb-1">Purpose:</label>
                <select
                  className="w-full border rounded px-2 py-2 bg-blue-50 text-blue-700"
                  value={purpose}
                  onChange={(e) => {
                    setPurpose(e.target.value);
                    onChange?.({ ...data, purpose: e.target.value });
                  }}
                >
                  {allowedFunds.map((fund) => (
                    <option key={fund} value={fund}>
                      {fund}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-2">
                <label className="font-semibold text-gray-700 block mb-1">Amount:</label>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  className="w-full border rounded px-2 py-2 bg-green-50 text-green-700 text-xl font-bold"
                  value={Number.isFinite(amount) ? amount : 0.01}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    const safe = Number.isFinite(val) ? Math.max(0.01, val) : 0.01;
                    setAmount(safe);
                    onChange?.({ ...data, amount: safe });
                  }}
                  placeholder="$0.00"
                  inputMode="decimal"
                />
              </div>

              <div className="mb-2">
                <label className="font-semibold text-gray-700 block mb-1">Message (optional):</label>
                <input
                  type="text"
                  className="w-full border rounded px-2 py-2 bg-gray-50 text-gray-700"
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    onChange?.({ ...data, message: e.target.value });
                  }}
                  placeholder="Add a message for your donation"
                />
              </div>

              <div className="mb-2">
                <span className="font-semibold text-gray-700 block mb-1">Recurring:</span>
                <button
                  type="button"
                  className={`px-4 py-2 rounded-full font-semibold ${isSubscription ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"
                    }`}
                  onClick={() => handleUpdate("isSubscription", !isSubscription)}
                  aria-pressed={isSubscription}
                  aria-label="Toggle recurring donation"
                >
                  {isSubscription ? "Yes" : "No"}
                </button>
              </div>

              {isSubscription && (
                <>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="flex flex-col">
                      <label className="font-semibold text-gray-700 mb-1">First Name:</label>
                      <input
                        type="text"
                        className="border rounded px-2 py-2 bg-blue-50 text-blue-700"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
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
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Enter last name"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div className="flex flex-col">
                      <label className="font-semibold text-gray-700 mb-1">Interval Unit:</label>
                      <select
                        className="border rounded px-2 py-2 bg-blue-50 text-blue-700"
                        value={intervalUnit}
                        onChange={(e) => {
                          const val = e.target.value as IntervalUnit;
                          setIntervalUnit(val);
                          onChange?.({ ...data, interval_unit: val });
                          if (val === "YEAR") {
                            setIntervalCount(1);
                            onChange?.({ ...data, interval_count: 1 });
                          }
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
                        max={maxForUnit}
                        className="border rounded px-2 py-2 bg-blue-50 text-blue-700"
                        value={intervalCount}
                        onChange={(e) => {
                          const raw = parseInt(e.target.value, 10);
                          const val = clamp(Number.isFinite(raw) ? raw : 1, 1, maxForUnit);
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
                        onChange={(e) => {
                          const raw = parseInt(e.target.value, 10);
                          const val = clamp(Number.isFinite(raw) ? raw : 1, 1, 60);
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
                        onChange={(e) => {
                          setStartDate(e.target.value);
                          onChange?.({ ...data, startDate: e.target.value });
                        }}
                      />
                    </div>
                  </div>
                </>
              )}

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold px-6 py-3 rounded-full shadow transition"
                disabled={loading || isEditing}
                style={isEditing ? { cursor: "not-allowed", opacity: 0.6 } : {}}
              >
                {loading ? "Redirecting..." : data.buttonText || "Donate with PayPal"}
              </button>

              {error && <div className="text-red-500 mt-2 text-center">{error}</div>}
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default PaypalSection;
