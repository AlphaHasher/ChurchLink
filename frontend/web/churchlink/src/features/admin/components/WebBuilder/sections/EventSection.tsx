import React, { useEffect, useMemo, useState } from "react";
import { Calendar as FiCalendar, MapPin as FiMapPin, DollarSign as FiDollarSign, Repeat as FiRepeat, Users, CreditCard } from "lucide-react";
import api from "@/api/api";
import { EventPayPalButton } from "@/features/events/components/EventPayPalButton";
import { useUserProfile } from "@/helpers/useUserProfile";
import { getPublicUrl } from "@/helpers/MediaInteraction";

type Recurring = "daily" | "weekly" | "monthly" | "yearly" | "never";
type MyEventScope = "series" | "occurrence";
type Gender = "male" | "female" | "all";

interface Event {
  id: string;
  name: string;
  description?: string;
  date: string;                 // ISO
  location?: string;
  price?: number;
  image_url?: string;
  thumbnail_url?: string;

  // Needed to decide actions
  rsvp?: boolean;
  recurring?: Recurring;
  min_age?: number;             // if your payload includes them
  max_age?: number;
  gender?: Gender;
  
  // Payment processing fields
  payment_options?: string[]; // Available payment methods: ['PayPal', 'Door']
  refund_policy?: string;
}

interface MyEventRef {
  event_id: string;             // stringified ObjectId
  reason: "watch" | "rsvp";
  scope: MyEventScope;
  occurrence_start?: string | null;
  person_id?: string | null;
}

interface EventSectionProps {
  showFilters?: boolean;
  eventName?: string | string[];
  lockedFilters?: { ministry?: string; ageRange?: string };
  title?: string;
  showTitle?: boolean;
}

/* ---------- Registration Form (modal content) ---------- */

// Helper function to check if event requires payment
const requiresPayment = (event: Event): boolean => {
  // An event requires payment if it has a price > 0 and any payment options available
  return !!(event.price && event.price > 0 && event.payment_options && event.payment_options.length > 0);
};

// Helper function to check if PayPal payment is available
const hasPayPalOption = (event: Event): boolean => {
  return !!(event.payment_options?.includes('PayPal') || event.payment_options?.includes('paypal'));
};

// Registration step enum for single-step flow
enum RegistrationStep {
  PEOPLE_SELECTION = 'people_selection'
}

function EventRegistrationForm({
  event,
  onClose,
  onSaved, 
}: {
  event: Event;
  onClose: () => void;
  onSaved: (paymentMethod?: 'paypal' | 'door') => void;
  onAddPerson?: () => void;
}) {
  type Person = {
    id: string;
    first_name: string;
    last_name: string;
    gender?: "M" | "F" | null;
    date_of_birth?: string | null; // expect "YYYY-MM-DD" from API or ISO; we handle both
  };

  type RegistrationSummary = {
    success: boolean;
    user_registrations: Array<{
      user_uid: string;
      person_id: string | null;
      person_name: string | null;
      display_name: string;
      registered_on: string;
      kind: "rsvp";
      payment_method?: "paypal" | "door";
      payment_status?: "awaiting_payment" | "completed" | "paid" | "pending_door";
      scope?: "series" | "occurrence";
    }>;
    total_registrations: number;
    available_spots: number;
    total_spots: number;
    can_register: boolean;
  };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [summary, setSummary] = useState<RegistrationSummary | null>(null);
  
  // Single-step flow state
  const currentStep = RegistrationStep.PEOPLE_SELECTION;

  // Payment method state
  const [selectedPaymentOption, setSelectedPaymentOption] = useState<'paypal' | 'door'>('paypal');

  // local selections
  const [selfSelected, setSelfSelected] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [me, setMe] = useState<{ first: string; last: string } | null>(null);

  // Per-person scope selection (series = recurring, occurrence = one-time)
  const [personScopes, setPersonScopes] = useState<Record<string, "series" | "occurrence">>({});
  const [selfScope, setSelfScope] = useState<"series" | "occurrence">("series");

  // Check if event is recurring
  const isRecurring = event.recurring && event.recurring !== "never";

  // Use cached profile hook
  const { profile: currentUserProfile } = useUserProfile();

  /** ---------- INLINE ADD PERSON (schema-conformant) ---------- **/
  const [showAdd, setShowAdd] = useState(false);
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newGender, setNewGender] = useState<"" | "M" | "F">(""); // required by schema
  const [newDob, setNewDob] = useState<string>("");               // "YYYY-MM-DD" from <input type="date" />

  const resetAddForm = () => {
    setNewFirst("");
    setNewLast("");
    setNewGender("");
    setNewDob("");
  };

  // Step navigation functions
  const handleNextStep = () => {
    console.log('➡️ [EVENT SECTION] handleNextStep called - will trigger registration');
    // No next step - go directly to payment flow after registration
    createOrUpdate();
  };

  // Check if any people are selected for registration
  const hasSelections = selfSelected || selectedIds.size > 0;

  const fetchPeople = async () => {
    const res = await api.get("/v1/users/me/people");
    const ppl = res.data?.people ?? res.data ?? [];
    setPeople(ppl);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        const [, regRes] = await Promise.all([
          fetchPeople(),
          api.get(`/v1/events/${event.id}/registrations/summary`),
        ]);
        
        setSummary(regRes.data);

        const current = new Set<string>();
        let selfIsRegistered = false;
        const scopes: Record<string, "series" | "occurrence"> = {};
        let selfScopeValue: "series" | "occurrence" = "series";

        (regRes.data?.user_registrations ?? []).forEach((r: any) => {
          if (r.person_id) {
            current.add(r.person_id);
            scopes[r.person_id] = r.scope || "series";
          } else {
            selfIsRegistered = true;
            selfScopeValue = r.scope || "series";
          }
        });

        setSelectedIds(current);
        setSelfSelected(false);
        setPersonScopes(scopes);
        setSelfScope(selfScopeValue);
      } catch (e) {
        console.error("Failed to load registration form data:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [event.id]);

  // Update display name when profile loads
  useEffect(() => {
    if (currentUserProfile?.first_name && currentUserProfile?.last_name) {
      setMe({ 
        first: currentUserProfile.first_name, 
        last: currentUserProfile.last_name 
      });
    }
  }, [currentUserProfile]);

  const registeredSet = useMemo(() => {
    const s = new Set<string>();
    summary?.user_registrations?.forEach((r) => r.person_id && s.add(r.person_id));
    return s;
  }, [summary]);

  const selfRegistered = useMemo(
    () => !!summary?.user_registrations?.some((r) => r.person_id === null),
    [summary]
  );
  

  // --- validation used for selection list (enhanced with proper null handling) ---
  const validatePersonForEvent = (person: Person, ev: Event): string | null => {
  const evGender = ev.gender ?? "all"; // "male" | "female" | "all"
  
  // Check gender requirements - FIXED: properly handle null/undefined gender
  if (evGender !== "all") {
    if (!person.gender) {
      // No gender set - block registration for gender-restricted events
      return `Please set gender in profile to register for this ${evGender}-only event.`;
    }
    
    const personAsEventGender = person.gender === "M" ? "male" : "female";
    if (personAsEventGender !== evGender) {
      return `This event is ${evGender}-only.`;
    }
  }

  if (person.date_of_birth && ev.min_age != null && ev.max_age != null) {
    const dob =
      person.date_of_birth.length === 10
        ? new Date(`${person.date_of_birth}T00:00:00`)
        : new Date(person.date_of_birth);
    const on = new Date(ev.date);
    let age = on.getFullYear() - dob.getFullYear();
    const m = on.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && on.getDate() < dob.getDate())) age--;
    if (age < ev.min_age || age > ev.max_age) return `Age restriction: ${ev.min_age}–${ev.max_age}.`;
  }
  return null;
};

  // Validate current user for event eligibility
  const validateCurrentUserForEvent = (ev: Event): string | null => {
    if (!currentUserProfile) {
      return "Unable to load your profile. Please refresh the page and try again.";
    }

    // Convert current user profile to person-like object for validation
    const currentUserAsPerson: Person = {
      id: "current-user", // Add required id field
      first_name: currentUserProfile.first_name || "", // Handle undefined
      last_name: currentUserProfile.last_name || "", // Handle undefined  
      date_of_birth: currentUserProfile.birthday, // Use correct field name
      gender: currentUserProfile.gender,
    };

    const validationError = validatePersonForEvent(currentUserAsPerson, ev);
    if (validationError) {
      return validationError;
    }

    return null; // No error - user is eligible
  };

  useEffect(() => {
    const errs: Record<string, string | null> = {};
    for (const p of people) errs[p.id] = validatePersonForEvent(p, event);
    
    // FIXED: Actually validate the current user instead of always setting null
    errs["__self__"] = validateCurrentUserForEvent(event);
    
    setErrors(errs);
  }, [people, event]);

  const togglePerson = (id: string) => {
    // Prevent toggling already registered people
    if (registeredSet.has(id)) {
      return;
    }
    
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // Initialize scope to series if not set
        if (!personScopes[id]) {
          setPersonScopes((prev) => ({ ...prev, [id]: "series" }));
        }
      }
      return next;
    });
  };

  const removeRegistered = async (personId: string | null) => {
    try {
      setSaving(true);
      if (personId === null) {
        await api.delete(`/v1/event-people/unregister/${event.id}`);
      } else {
        await api.delete(`/v1/event-people/unregister/${event.id}/family-member/${personId}`);
      }
      const regRes = await api.get(`/v1/events/${event.id}/registrations/summary`);
      setSummary(regRes.data);
      if (personId === null) setSelfSelected(false);
      else setSelectedIds((prev) => { const n = new Set(prev); n.delete(personId); return n; });
    } catch (error: any) {
      console.error("Remove registration failed:", error);
      const errorMessage = error?.response?.data?.detail || error?.message || "Unknown error occurred";
      alert(`Failed to remove registration: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };
  
  const togglePersonScope = (id: string) => {
    setPersonScopes((prev) => ({
      ...prev,
      [id]: prev[id] === "series" ? "occurrence" : "series",
    }));
  };

  const createOrUpdate = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const wantSelf = selfSelected;
      const haveSelf = selfRegistered;
      const want = selectedIds;
      const have = registeredSet;

      const toAdd: string[] = [];
      const toRemove: string[] = [];
      const toUpdateScope: string[] = [];

      // Check for new registrations and scope changes
      want.forEach((id) => {
        if (!have.has(id)) {
          toAdd.push(id);
        } else {
          // Check if scope changed for existing registration
          const currentReg = summary?.user_registrations?.find(r => r.person_id === id);
          const currentScope = currentReg?.scope || "series";
          const desiredScope = personScopes[id] || "series";
          if (currentScope !== desiredScope) {
            toUpdateScope.push(id);
          }
        }
      });
      have.forEach((id) => !want.has(id) && toRemove.push(id));

      // Check if self scope changed
      let selfScopeChanged = false;
      if (wantSelf && haveSelf) {
        const currentSelfReg = summary?.user_registrations?.find(r => r.person_id === null);
        const currentSelfScope = currentSelfReg?.scope || "series";
        selfScopeChanged = currentSelfScope !== selfScope;
      }

      if (wantSelf && errors["__self__"]) {
        alert(`Cannot register yourself: ${errors["__self__"]}`);
        setSaving(false);
        return;
      }
      const bads = toAdd.map((id) => ({ id, err: errors[id] })).filter((x) => x.err);
      if (bads.length) {
        alert("One or more selected people do not meet this event’s requirements.");
        setSaving(false);
        return;
      }

      // Check if this is a paid event and determine payment method
      const isPaidEvent = requiresPayment(event);
      const isPayPalPayment = selectedPaymentOption === 'paypal';
      const isDoorPayment = selectedPaymentOption === 'door';
      
      if (isPaidEvent && isPayPalPayment) {
        console.log('💳 [EVENT SECTION] Paid event with PayPal - creating PayPal order without registration');
        console.log('⚠️ [EVENT SECTION] Registration will be deferred until PayPal payment completion');
        
        // Prepare bulk registration data for PayPal order
        const registrations = [];
        
        // Add self if selected
        if (wantSelf && !haveSelf) {
          const selfName = me ? `${me.first} ${me.last}` : 'You';
          registrations.push({
            name: selfName,
            family_member_id: null, // null for self
            donation_amount: 0,
            payment_amount_per_person: event.price || 0
          });
        }
        
        // Add family members
        for (const id of toAdd) {
          const person = people.find(p => p.id === id);
          const personName = person ? `${person.first_name} ${person.last_name}` : 'Family Member';
          registrations.push({
            name: personName,
            family_member_id: id,
            donation_amount: 0,
            payment_amount_per_person: event.price || 0
          });
        }
        
        if (registrations.length === 0) {
          alert('No people selected for registration.');
          setSaving(false);
          return;
        }
        
        console.log('📋 [EVENT SECTION] Prepared registrations for PayPal:', registrations);
        
        try {
          // Create PayPal order using unified API
          const orderData = {
            registrations: registrations.map(reg => ({
              person_id: reg.family_member_id,
              name: reg.name,
              donation_amount: reg.donation_amount || 0,
              payment_amount_per_person: reg.payment_amount_per_person || 0
            })),
            message: "",
            return_url: "",
            cancel_url: ""
          };
          
          console.log('📤 [EVENT SECTION] Creating PayPal order:', orderData);
          
          const response = await api.post(`/v1/events/${event.id}/payment/create-bulk-order`, orderData);
          
          if (response.status === 200 && response.data) {
            const { approval_url, payment_id } = response.data;
            
            if (approval_url) {
              console.log('✅ [EVENT SECTION] PayPal order created successfully');
              console.log('🔗 [EVENT SECTION] Redirecting to PayPal:', approval_url);
              console.log('🆔 [EVENT SECTION] Payment ID:', payment_id);
              console.log('⏳ [EVENT SECTION] People will be registered ONLY after successful payment');
              
              // Redirect to PayPal
              window.location.href = approval_url;
              return; // Don't continue with immediate registration
            } else {
              throw new Error('No PayPal approval URL received');
            }
          } else {
            throw new Error(response.data?.detail || 'Failed to create PayPal order');
          }
        } catch (error: any) {
          console.error('❌ [EVENT SECTION] PayPal order creation failed:', error);
          const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to create PayPal payment order';
          alert(`PayPal payment failed: ${errorMessage}`);
          setSaving(false);
          return;
        }
      } else if (isPaidEvent && isDoorPayment) {
        console.log('🚪 [EVENT SECTION] Paid event with door payment - registering with pending status');
        
        // Register each person individually for door payment
        const registrationPromises = [];
        
        if (wantSelf && !haveSelf) {
          registrationPromises.push(
            api.post(`/v1/event-people/register/${event.id}`, {
              payment_option: 'door'
            })
          );
        }
        
        for (const id of toAdd) {
          registrationPromises.push(
            api.post(`/v1/event-people/register/${event.id}/family-member/${id}`, {
              payment_option: 'door'
            })
          );
        }
        
        const responses = await Promise.all(registrationPromises);
        
        // Check if all registrations succeeded
        const failures = responses.filter(response => !response.data?.success);
        if (failures.length > 0) {
          throw new Error(`Failed to register ${failures.length} person(s) for door payment`);
        }
        
        console.log('✅ [EVENT SECTION] Door payment registrations completed');
        onSaved('door'); // parent refreshes + closes with door payment method
        return;
      } else {
        console.log('🆓 [EVENT SECTION] Free event - registering immediately');
      }

      // If free event with PayPal donation, it will be handled in the payment flow
      // No need to handle donation here

      // Handle self registration/unregistration
      if (wantSelf && !haveSelf) {
        await api.post(`/v1/event-people/register/${event.id}?scope=${selfScope}`);
      } else if (!wantSelf && haveSelf) {
        // Unregister with old scope (or null to remove all)
        await api.delete(`/v1/event-people/unregister/${event.id}`);
      } else if (selfScopeChanged && wantSelf && haveSelf) {
        // Update self scope: remove old scope, add new scope
        const oldScope = summary?.user_registrations?.find(r => r.person_id === null)?.scope || "series";
        await api.delete(`/v1/event-people/unregister/${event.id}?scope=${oldScope}`);
        await api.post(`/v1/event-people/register/${event.id}?scope=${selfScope}`);
      }

      // family
      for (const id of toAdd) {
        console.log(`📝 [EVENT SECTION] Registering family member: ${id}`);
        await api.post(`/v1/event-people/register/${event.id}/family-member/${id}`);
      }

      // Add new registrations
      for (const id of toAdd) {
        const scope = personScopes[id] || "series";
        await api.post(`/v1/event-people/register/${event.id}/family-member/${id}?scope=${scope}`);
      }

      // Remove registrations
      for (const id of toRemove) {
        console.log(`❌ [EVENT SECTION] Unregistering family member: ${id}`);
        await api.delete(`/v1/event-people/unregister/${event.id}/family-member/${id}`);
      }

      // Update scope for existing registrations (remove old scope, add new scope)
      for (const id of toUpdateScope) {
        const oldScope = summary?.user_registrations?.find(r => r.person_id === id)?.scope || "series";
        const newScope = personScopes[id] || "series";
        await api.delete(`/v1/event-people/unregister/${event.id}/family-member/${id}?scope=${oldScope}`);
        await api.post(`/v1/event-people/register/${event.id}/family-member/${id}?scope=${newScope}`);
      }

      // Refetch the summary to update the registered state
      const regRes = await api.get(`/v1/events/${event.id}/registrations/summary`);
      setSummary(regRes.data);

      console.log('✅ [EVENT SECTION] Registration completed successfully');
      onSaved(selectedPaymentOption); // parent refreshes + closes with payment method
    } catch (error: any) {
      console.error("❌ [EVENT SECTION] Registration update failed:", error);
      const errorMessage = error?.response?.data?.detail || error?.message || "Unknown error occurred";
      alert(`Failed to update registration: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  /** ---------- SUBMIT ADD PERSON (matches schema) ---------- **/
  const submitAddPerson = async () => {
    // required by schema
    if (!newFirst.trim() || !newLast.trim()) {
      alert("First and last name are required.");
      return;
    }
    if (newGender !== "M" && newGender !== "F") {
      alert("Please select gender (Male or Female).");
      return;
    }
    if (!newDob) {
      alert("Please select a date of birth.");
      return;
    }

    try {
      setSaving(true);
      // EXACTLY what your PersonCreate expects:
      //   first_name: str
      //   last_name:  str
      //   gender:     "M" | "F"
      //   date_of_birth: "YYYY-MM-DD"
      const payload = {
        first_name: newFirst.trim(),
        last_name:  newLast.trim(),
        gender:     newGender,  // "M" | "F"
        date_of_birth: newDob,  // raw date string from input
      };

      await api.post("/v1/users/me/people", payload, {
        headers: { "Content-Type": "application/json" },
      });

      await fetchPeople();
      resetAddForm();
      setShowAdd(false);
    } catch (e: any) {
      console.error("Add person failed:", e?.response?.data || e);
      alert(
        "Failed to add person: " +
          (e?.response?.data?.detail
            ? JSON.stringify(e.response.data.detail)
            : "Please check required fields.")
      );
    } finally {
      setSaving(false);
    }
  };

  const canSavePerson =
    newFirst.trim().length > 0 &&
    newLast.trim().length > 0 &&
    (newGender === "M" || newGender === "F") &&
    !!newDob;

  if (loading) return <div>Loading…</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            Select People for {event.name}
          </h3>
          <p className="text-sm text-gray-600">
            {new Date(event.date).toLocaleString()} • {
              summary?.available_spots === -1 
                ? "Unlimited spots" 
                : summary?.available_spots !== undefined && summary?.available_spots >= 0
                ? `${summary.available_spots} spots left`
                : "Loading spots..."
            } (of{" "}
            {summary?.total_spots === 0 ? "unlimited" : summary?.total_spots ?? "?"})
          </p>
        </div>
        <button className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200" onClick={onClose}>
          Close
        </button>
      </div>

      {/* Step 1: People Selection */}
      {currentStep === RegistrationStep.PEOPLE_SELECTION && (
        <>
          {/* Event Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Event Information</h4>
            <div className="space-y-1 text-sm text-blue-800">
              <p>Event: {event.name}</p>
              {requiresPayment(event) ? (
                <p>Price per person: ${event.price?.toFixed(2)}</p>
              ) : (
                <p className="text-green-700 font-medium">This event is free!</p>
              )}
              {event.price === 0 && hasPayPalOption(event) && (
                <p className="text-blue-600">Optional donations welcome</p>
              )}
            </div>
          </div>

      {/* Already registered */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium">Already Registered</h4>
          {/* Payment Status Summary for paid events */}
          {summary?.user_registrations?.length && (event.price ?? 0) > 0 && (
            <div className="text-xs text-gray-500">
              {(() => {
                const registrations = summary.user_registrations;
                const completedPayments = registrations.filter(r => r.payment_status === 'completed' || r.payment_status === 'paid').length;
                const doorPayments = registrations.filter(r => r.payment_status === 'pending_door').length;
                const pendingPayments = registrations.filter(r => !r.payment_status || r.payment_status === 'awaiting_payment').length;
                
                const parts = [];
                if (completedPayments > 0) parts.push(`${completedPayments} paid online`);
                if (doorPayments > 0) parts.push(`${doorPayments} pay at door`);
                if (pendingPayments > 0) parts.push(`${pendingPayments} pending`);
                
                return parts.length > 0 ? parts.join(' • ') : 'All paid';
              })()}
            </div>
          )}
        </div>
        {summary?.user_registrations?.length ? (
          <div className="space-y-2">
            {summary.user_registrations.map((r) => (
              <div key={`${r.person_id ?? "__self__"}`} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex-1">
                  <div className="font-medium">{r.display_name}</div>
                  <div className="text-xs text-gray-500">
                    Registered on {new Date(r.registered_on).toLocaleString()}
                  </div>
                  {/* Context-aware Payment Status Display */}
                  <div className="mt-1">
                    {event.price === 0 ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 inline-block">
                        ✅ Registered (Free Event)
                      </span>
                    ) : r.payment_status ? (
                      <span className={`text-xs px-2 py-1 rounded-full inline-block ${
                        (r.payment_status === 'completed' || r.payment_status === 'paid')
                          ? 'bg-green-100 text-green-700' 
                          : r.payment_status === 'pending_door'
                          ? 'bg-yellow-100 text-yellow-700'
                          : r.payment_status === 'awaiting_payment'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {(r.payment_status === 'completed' || r.payment_status === 'paid')
                          ? '✅ Paid Online' 
                          : r.payment_status === 'pending_door'
                          ? '🚪 Pay at Door'
                          : r.payment_status === 'awaiting_payment'
                          ? '⏳ PayPal Processing'
                          : '❌ Payment Required'}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 inline-block">
                        ❌ Payment Required
                      </span>
                    )}
                  </div>
                </div>
                <button
                  disabled={saving}
                  className="px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
                  onClick={() => removeRegistered(r.person_id)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500">No one is registered yet.</div>
        )}
      </div>

      {/* Add Person CTA + Inline form */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">Need to add a new Event Person?</div>
        <div className="flex gap-2">
          <button
            className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
            onClick={() => setShowAdd((s) => !s)}
            >
              {showAdd ? "Close Inline Add" : "Add Person Here"}
            </button>
        </div>
      </div>

      {showAdd && (
        <div className="rounded-xl border p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              className="border rounded px-3 py-2"
              placeholder="First name"
              value={newFirst}
              onChange={(e) => setNewFirst(e.target.value)}
              required
            />
            <input
              className="border rounded px-3 py-2"
              placeholder="Last name"
              value={newLast}
              onChange={(e) => setNewLast(e.target.value)}
              required
            />
            <select
              className="border rounded px-3 py-2"
              value={newGender}
              onChange={(e) => setNewGender(e.target.value as "M" | "F" | "")}
              required
            >
              <option value="">Select gender</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
            <input
              type="date"
              className="border rounded px-3 py-2"
              value={newDob}
              onChange={(e) => setNewDob(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end">
            <button
              disabled={saving || !canSavePerson}
              className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              onClick={submitAddPerson}
            >
              Save Person
            </button>
          </div>
        </div>
      )}

      {/* Choose from saved Event People */}
      <div>
        <h4 className="font-medium mb-2">Choose from your saved Event People</h4>

        {/* Self */}
        <label className={`flex items-center gap-3 rounded-lg border p-3 mb-2 ${
          selfRegistered ? "border-green-300 bg-green-50 opacity-60 cursor-not-allowed" : "cursor-pointer"
        }`}>
          <input
            type="checkbox"
            checked={selfSelected}
            disabled={selfRegistered}
            onChange={(e) => {
              if (!selfRegistered) {
                setSelfSelected(e.target.checked);
              }
            }}
            className={selfRegistered ? "cursor-not-allowed" : ""}
          />
        <div>
          <div className={`font-medium ${selfRegistered ? "text-green-700" : ""}`}>
             {me ? `${me.first} ${me.last} (you)` : "You"}
             {selfRegistered && <span className="ml-2 text-xs text-green-600 font-semibold">✓ Already Registered</span>}
         </div>
         {errors["__self__"] && <div className="text-sm text-red-600">{errors["__self__"]}</div>}
         {isRecurring && selfSelected && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selfScope === "series"}
                onChange={() => setSelfScope(selfScope === "series" ? "occurrence" : "series")}
              />
              <span className="text-gray-700">Register for all occurrences</span>
            </label>
          )}
        </div>
        </label>

        {/* Family */}
        <div className="space-y-2">
          {people.length === 0 ? (
            <div className="text-sm text-gray-500">You have no saved Event People yet.</div>
          ) : (
            people.map((p) => {
              const checked = selectedIds.has(p.id);
              const err = errors[p.id];
              const isAlreadyRegistered = registeredSet.has(p.id);
              
              const scope = personScopes[p.id] || "series";
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 ${
                    err ? "border-red-300 bg-red-50" : 
                    isAlreadyRegistered ? "border-green-300 bg-green-50 opacity-60" : ""
                  } ${isAlreadyRegistered ? "cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <input 
                    type="checkbox" 
                    checked={checked} 
                    disabled={isAlreadyRegistered}
                    onChange={() => togglePerson(p.id)}
                    className={isAlreadyRegistered ? "cursor-not-allowed" : ""}
                  />
                  <div>
                    <div className={`font-medium ${isAlreadyRegistered ? "text-green-700" : ""}`}>
                      {p.first_name} {p.last_name}
                      {isAlreadyRegistered && <span className="ml-2 text-xs text-green-600 font-semibold">✓ Already Registered</span>}
                    </div>
                    {p.date_of_birth && (
                      <div className="text-xs text-gray-500">DOB: {new Date(p.date_of_birth).toLocaleDateString()}</div>
                    )}
                    {err && <div className="text-sm text-red-600">{err}</div>}
                  </div>
                  {isRecurring && checked && (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={scope === "series"}
                        onChange={() => togglePersonScope(p.id)}
                      />
                      <span className="text-gray-700">Register for all occurrences</span>
                    </label>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Selected People Summary */}
      {hasSelections && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-medium text-green-900 mb-2">
            Selected for Registration ({(selfSelected ? 1 : 0) + selectedIds.size} people)
          </h4>
          <div className="text-sm text-green-800">
            {selfSelected && <p>• You</p>}
            {Array.from(selectedIds).map(personId => {
              const person = people.find(p => p.id === personId);
              return person ? <p key={personId}>• {person.first_name} {person.last_name}</p> : null;
            })}
            {requiresPayment(event) && (
              <p className="font-medium mt-2">
                Total Cost: ${((event.price || 0) * ((selfSelected ? 1 : 0) + selectedIds.size)).toFixed(2)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Payment Method Selection for Paid Events */}
      {requiresPayment(event) && hasSelections && (
        <div className="border-t pt-4 mt-4">
          <h3 className="text-lg font-semibold mb-3">Choose Payment Method</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setSelectedPaymentOption('paypal')}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedPaymentOption === 'paypal'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="text-center">
                <CreditCard className="h-6 w-6 mx-auto mb-2" />
                <div className="font-medium">Pay Online</div>
                <div className="text-sm opacity-75">Pay now with PayPal</div>
              </div>
            </button>
            
            <button
              onClick={() => setSelectedPaymentOption('door')}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedPaymentOption === 'door'
                  ? 'border-orange-500 bg-orange-50 text-orange-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="text-center">
                <FiDollarSign className="h-6 w-6 mx-auto mb-2" />
                <div className="font-medium">Pay at Door</div>
                <div className="text-sm opacity-75">Pay when you arrive</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Step 1 Navigation */}
      <div className="flex justify-between pt-4">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200"
        >
          Cancel
        </button>

        <button
          onClick={handleNextStep}
          disabled={!hasSelections || saving}
          className="min-w-[120px] px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? (
            "Processing..."
          ) : (
            <>
              {requiresPayment(event) ? (
                <>
                  {selectedPaymentOption === 'paypal' ? (
                    <>
                      <CreditCard className="h-4 w-4" />
                      Register & Pay Online
                    </>
                  ) : (
                    <>
                      <FiDollarSign className="h-4 w-4" />
                      Register & Pay at Door
                    </>
                  )}
                </>
              ) : (
                <>
                  <Users className="h-4 w-4" />
                  Register Now
                </>
              )}
            </>
          )}
        </button>
      </div>
    </>
  )}
    </div>
  );
}

/* ---------- EventSection with integrated registration modal ---------- */

const EventSection: React.FC<EventSectionProps> = ({
  showFilters = true,
  eventName,
  lockedFilters,
  title,
  showTitle,
}) => {
  const filtersDisabled = !!eventName || (lockedFilters?.ministry || lockedFilters?.ageRange);
  showFilters = showFilters && !filtersDisabled;

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [ministry, setMinistry] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [availableMinistries, setAvailableMinistries] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(3);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  // My Events + UI state
  const [myEvents, setMyEvents] = useState<MyEventRef[]>([]);
  const [changing, setChanging] = useState<string | null>(null);
  const [watchScopes, setWatchScopes] = useState<Record<string, MyEventScope>>({});
  const getWatchScopeFor = (ev: Event) => watchScopes[ev.id] ?? "series";
  const setWatchScopeFor = (eventId: string, scope: MyEventScope) =>
        setWatchScopes((m) => ({ ...m, [eventId]: scope }));

  // NEW: registration modal event
  const [regEvent, setRegEvent] = useState<Event | null>(null);
  
  // Payment state management
  const [showPaymentRequired, setShowPaymentRequired] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [donationAmount, setDonationAmount] = useState<number>(0);
    const now = new Date();
    const upcomingEvents = events.filter(ev => new Date(ev.date) >= now);

  const recurrenceLabel = (ev: Event) => {
    if (!ev.recurring || ev.recurring === "never") return "One-time";
    // daily | weekly | monthly | yearly
    return `Repeats ${ev.recurring}`;
  };

  const RecurrenceBadge = ({ ev }: { ev: Event }) => {
    const recurring = ev.recurring && ev.recurring !== "never";
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm ${recurring
        ? "bg-indigo-600 text-white"
        : "bg-white/90 text-slate-700 backdrop-blur-sm border border-slate-200"
        }`}>
        {recurring && <FiRepeat className="w-3 h-3" />}
        {recurrenceLabel(ev)}
      </span>
    );
  };

  const fetchMinistries = async () => {
    try {
      const response = await api.get("/v1/events/ministries");
      setAvailableMinistries(response.data);
    } catch (err) {
      console.error("Failed to fetch ministries:", err);
    }
  };

  const fetchEvents = async () => {
  setLoading(true);
  try {
    const isNameSet = Array.isArray(eventName)
      ? eventName.length > 0
      : typeof eventName === "string" && eventName.trim() !== "";

    const finalMinistry = lockedFilters?.ministry ?? ministry;
    const finalAgeRange = lockedFilters?.ageRange ?? ageRange;

    const params = new URLSearchParams();
    params.append("limit", "999");

    if (finalMinistry) params.append("ministry", finalMinistry);

    // Age filter (optional)
    if (finalAgeRange) {
      const [minAge] = finalAgeRange.split("-");
      if (minAge) params.append("age", minAge);
    }

    // ✅ Use backend "name" filtering instead of local includes()
    if (isNameSet) {
      const names = Array.isArray(eventName) ? eventName : [eventName];
      // if your API expects a single name substring, send the first; or join with commas if supported
      params.append("name", names.join(","));
    }

    const { data } = await api.get(`/v1/events/upcoming?${params.toString()}`);
    
    // Process events to ensure payment fields have default values and handle migration
    const processedEvents = data.map((event: any) => ({
      ...event,
      // Ensure payment_options field exists with backward compatibility
      payment_options: event.payment_options || (event.paypal_enabled ? ['PayPal'] : []),
      refund_policy: event.refund_policy ?? "",
    }));
    
    setEvents(processedEvents);
  } catch (error) {
    console.error("Failed to fetch events:", error);
  } finally {
    setLoading(false);
  }
};

  const fetchMyEvents = async () => {
  try {
    const res = await api.get("/v1/event-people/user");
    setMyEvents(res.data?.events ?? []);
  } catch (err) {
    console.error("Failed to fetch My Events:", err);
  }
};

  useEffect(() => {
    fetchMinistries();
  }, []);
  useEffect(() => {
    fetchEvents();
  }, [eventName, ministry, ageRange, lockedFilters]);
  useEffect(() => {
    fetchMyEvents();
  }, []);

  const isWatched = (ev: Event) => myEvents.some((m) => m.event_id === ev.id && m.reason === "watch");
  const currentWatchScope = (ev: Event): MyEventScope | null => {
    const hit = myEvents.find((m) => m.event_id === ev.id && m.reason === "watch");
    return hit ? hit.scope : null;
  };

  // watch actions (unchanged except for removing datetime picker earlier)
  const addWatch = async (ev: Event, desiredScope?: MyEventScope) => {
  const scopeToUse = desiredScope ?? getWatchScopeFor(ev); // "series" | "occurrence"
  setChanging(ev.id);
  try {
    const params = new URLSearchParams();
    params.set("scope", scopeToUse);
    if (scopeToUse === "occurrence") {
      params.set("occurrenceStart", new Date(ev.date).toISOString());
    }
    await api.post(`/v1/event-people/watch/${ev.id}?${params.toString()}`);
    await fetchMyEvents();
  } catch (e) {
    console.error(e);
    alert("Failed to add to My Events.");
  } finally {
    setChanging(null);
  }
};

const removeWatch = async (ev: Event) => {
  setChanging(ev.id);
  try {
    // If you want to target a specific occurrence:
    // const params = new URLSearchParams();
    // params.set("scope", currentWatchScope(ev) ?? "series");
    // await api.delete(`/v1/event-people/watch/${ev.id}?${params.toString()}`);

    await api.delete(`/v1/event-people/watch/${ev.id}`);
    await fetchMyEvents();
  } catch (e) {
    console.error(e);
    alert("Failed to remove from My Events.");
  } finally {
    setChanging(null);
  }
};


  // registration open/close hooks
  const openRegistration = (ev: Event) => setRegEvent(ev);
  const handleRegistrationSaved = async (paymentMethod?: 'paypal' | 'door') => {
    await fetchMyEvents(); // reflect buttons instantly
    
    // Only show payment interface for PayPal payments, not for door payments
    if (regEvent && (hasPayPalOption(regEvent) || requiresPayment(regEvent))) {
      // Check if door payment was selected - if so, skip payment interface
      if (paymentMethod === 'door') {
        console.log('🚪 [EVENT SECTION] Door payment completed - registration complete, no payment interface needed');
        setRegEvent(null); // Close registration modal directly
      } else {
        // PayPal payment or free event with PayPal donation - show payment interface
        console.log('💳 [EVENT SECTION] PayPal payment selected - showing payment interface');
        setShowPaymentRequired(true);
        setPaymentCompleted(false);
        setDonationAmount(0); // Reset donation amount
      }
    } else {
      // No payment options available, close normally (registration complete)
      setRegEvent(null);
    }
  };

  if (loading) return <div>Loading...</div>;

  const WatchButtons = ({ ev }: { ev: Event }) => {
   const watched = isWatched(ev);
   const scope = currentWatchScope(ev);
   const recurring = !!ev.recurring && ev.recurring !== "never";

   if (!recurring) {
     // One-time event
     return watched ? (
       <button
         disabled={changing === ev.id}
         onClick={() => removeWatch(ev)}
         className="w-full px-4 py-2 bg-gray-200 text-gray-800 font-semibold rounded-xl hover:bg-gray-300"
       >
         Remove from My Events
       </button>
     ) : (
       <button
         disabled={changing === ev.id}
         onClick={() => addWatch(ev)} // one-time doesn't need scope param
         className="w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700"
       >
         Add to My Events
       </button>
     );
   }

   // Recurring event
   if (!watched) {
     // Show two explicit buttons instead of a dropdown
     return (
       <div className="grid grid-cols-2 gap-2">
         <button
           disabled={changing === ev.id}
           onClick={() => addWatch(ev, "series")}
           className="px-3 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
         >
           Watch series
         </button>
         <button
           disabled={changing === ev.id}
           onClick={() => addWatch(ev, "occurrence")}
           className="px-3 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"
         >
           Watch one time
         </button>
       </div>
     );
   }

   // Already watched → Switch / Remove
   return (
     <div className="grid grid-cols-2 gap-2">
       <button
         disabled={changing === ev.id}
         onClick={async () => {
           const next: MyEventScope = scope === "series" ? "occurrence" : "series";
           await removeWatch(ev);
           await addWatch(ev, next);
         }}
         className="px-3 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"
       >
         Switch to {scope === "series" ? "one time" : "recurring"}
       </button>
       <button
         disabled={changing === ev.id}
         onClick={() => removeWatch(ev)}
         className="px-3 py-2 bg-gray-200 text-gray-800 rounded-xl hover:bg-gray-300"
       >
         Remove
       </button>
     </div>
   );
 };


  // Replace your current RegisterButtons with this
const RegisterButtons = ({ ev }: { ev: Event }) => {
  const anyReg = myEvents.some(
    (m) => m.event_id === ev.id && m.reason === "rsvp"
  );

  return (
    <button
      disabled={changing === ev.id}
      onClick={() => openRegistration(ev)}
      className={`w-full px-4 py-2 font-semibold rounded-xl ${
        anyReg
          ? "bg-indigo-600 text-white hover:bg-indigo-700"
          : "bg-green-600 text-white hover:bg-green-700"
      }`}
    >
      {anyReg ? "Change Registration" : "Register For Event"}
    </button>
  );
};

  return (
    <section className="w-full bg-white">
      <div className="w-full max-w-screen-xl mx-auto px-4 py-8">
        {showFilters && (
          <div className="mb-6 flex flex-wrap items-center gap-3 justify-between">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-slate-700">
                Ministry
                <select
                  value={ministry}
                  onChange={(e) => setMinistry(e.target.value)}
                  className="ml-2 border px-3 py-2 rounded-lg bg-white text-sm shadow-sm"
                >
                  <option value="">All</option>
                  {availableMinistries.map((min) => (
                    <option key={min} value={min}>
                      {min}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Age Range
                <select
                  value={ageRange}
                  onChange={(e) => setAgeRange(e.target.value)}
                  className="ml-2 border px-3 py-2 rounded-lg bg-white text-sm shadow-sm"
                >
                  <option value="">All</option>
                  <option value="0-12">0–12</option>
                  <option value="13-17">13–17</option>
                  <option value="18-35">18–35</option>
                  <option value="36-60">36–60</option>
                  <option value="60+">60+</option>
                </select>
              </label>
            </div>
            <div className="text-sm text-slate-500">
              {events.length} total
            </div>
          </div>
        )}

        {showTitle !== false && (
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-center text-slate-900 mb-12">
            {title || "Upcoming Events"}
          </h2>
        )}
        {upcomingEvents.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 1rem", color: "#555" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📅</div>
            <h3 style={{ fontSize: "1.5rem", fontWeight: 600 }}>There are no upcoming events.</h3>
          </div>
        ) : (
          <div className="flex flex-wrap gap-8 justify-center max-w-7xl mx-auto">
            {events.slice(0, visibleCount).map((ev) => {
              const primary = ev.image_url ? getPublicUrl(ev.image_url) : null;
              const bg = primary
                ? `url("${primary}"), url("/assets/default-thumbnail.jpg")`
                : `url("/assets/default-thumbnail.jpg")`;

              return (
                <div key={ev.id} className="group rounded-3xl overflow-hidden bg-white flex flex-col shadow-lg hover:shadow-2xl transition-all duration-300 w-full sm:w-[calc(50%-1rem)] lg:w-[380px] border border-slate-100">
                  {/* Image Header */}
                  <div className="relative overflow-hidden">
                    <div
                      className="w-full bg-cover bg-center aspect-[16/9] group-hover:scale-105 transition-transform duration-300"
                      style={{
                        backgroundImage: bg,
                      }}
                    />
                    <div className="absolute top-3 right-3">
                      <RecurrenceBadge ev={ev} />
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="flex flex-col flex-grow p-6">
                    <div className="flex-grow">
                      <h3 className="text-2xl font-bold mb-3 text-slate-900 leading-tight line-clamp-2">
                        {ev.name}
                      </h3>

                      {/* Date & Location */}
                      <div className="space-y-2 mb-4">
                        <div className="flex items-start gap-2 text-slate-700">
                          <FiCalendar className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span className="text-sm font-medium">
                            {new Date(ev.date).toLocaleDateString(undefined, {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                        {ev.location && (
                          <div className="flex items-start gap-2 text-slate-700">
                            <FiMapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span className="text-sm line-clamp-1">{ev.location}</span>
                          </div>
                        )}
                      </div>

                      {ev.description && (
                        <p className="text-sm text-slate-600 leading-relaxed line-clamp-3 mb-4">
                          {ev.description}
                        </p>
                      )}

                      {/* Registration Badge */}
                      <div className="flex items-center gap-2 mb-4">
                        {ev.rsvp ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            Registration required
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            No registration required
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      {ev.rsvp ? <RegisterButtons ev={ev} /> : <WatchButtons ev={ev} />}

                      <button
                        className="w-full px-4 py-2 bg-white text-blue-600 font-semibold border border-blue-600 rounded-xl hover:bg-blue-50 transition duration-200"
                        onClick={() => setSelectedEvent(ev)}
                      >
                        View Details
                      </button>
                    </div>

                    
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Show More (unchanged) */}
        {visibleCount < events.length && (
          <div className="text-center mt-4">
            <button
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              onClick={() => setVisibleCount((prev) => prev + 3)}
            >
              Show More
            </button>
          </div>
        )}

        {/* Event details modal */}
        {selectedEvent && (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50">
    <div className="bg-white rounded-2xl p-8 max-w-3xl w-full shadow-2xl relative overflow-y-auto max-h-[90vh]">
      <button
        onClick={() => setSelectedEvent(null)}
        className="absolute top-4 right-6 text-gray-500 hover:text-gray-800 text-2xl"
        aria-label="Close"
      >
        ×
      </button>

              {/* Image */}
              {selectedEvent.image_url && (
                <img
                  src={getPublicUrl(selectedEvent.image_url)}
                  alt={selectedEvent.name}
                  className="w-full object-cover rounded-lg mb-6"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.onerror = null;
                    target.src = "/assets/default-thumbnail.jpg";
                  }}
                />
              )}

      {/* Title + badges */}
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-3xl font-bold">{selectedEvent.name}</h2>
        <div className="flex flex-wrap gap-2">
          {/* Recurrence badge */}
          {selectedEvent.recurring && selectedEvent.recurring !== "never" ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium">
              <FiRepeat className="inline-block" /> Recurring
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-50 text-gray-700 text-xs font-medium">
              One-time
            </span>
          )}
          {/* Gender badge */}
          {selectedEvent.gender && selectedEvent.gender !== "all" ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-medium">
              {selectedEvent.gender === "male" ? "Men only" : "Women only"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
              All welcome
            </span>
          )}
          {/* Age badge */}
          {typeof selectedEvent.min_age === "number" &&
            typeof selectedEvent.max_age === "number" && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-50 text-yellow-700 text-xs font-medium">
                Ages {selectedEvent.min_age}–{selectedEvent.max_age}
              </span>
            )}
        </div>
      </div>

      {/* Description */}
      {selectedEvent.description && (
        <p className="text-gray-700 mt-3 mb-6 text-lg">{selectedEvent.description}</p>
      )}

      {/* Meta rows with icons */}
      <div className="space-y-2 mb-6 text-gray-900">
        <div className="flex items-center gap-2">
          <FiCalendar />
          <span>{new Date(selectedEvent.date).toLocaleString()}</span>
        </div>
        {selectedEvent.location && (
          <div className="flex items-center gap-2">
            <FiMapPin />
            <span>{selectedEvent.location}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <FiDollarSign />
          <span>
            {requiresPayment(selectedEvent) 
              ? `$${selectedEvent.price} - PayPal payment required`
              : selectedEvent.price != null && selectedEvent.price > 0
              ? `$${selectedEvent.price}`
              : "Free"}
          </span>
        </div>
      </div>

      {/* Actions */}
      {selectedEvent.rsvp ? (
        /* RSVP-required → open registration */
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setSelectedEvent(null)}
            className="px-6 py-3 bg-gray-100 text-gray-800 rounded-xl hover:bg-gray-200 transition-colors text-lg w-full"
          >
            Close
          </button>
          <button
            onClick={() => {
              setRegEvent(selectedEvent);
              setSelectedEvent(null);
            }}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-lg w-full"
          >
            Register / Change
          </button>
        </div>
      ) : (
        /* Non-RSVP → Add/Remove to My Events with per-event scope buttons */
        <div className="space-y-4">
          {(() => {
            const watched = isWatched(selectedEvent);
            const recurring = selectedEvent.recurring && selectedEvent.recurring !== "never";
            const currentScope = currentWatchScope(selectedEvent); // null if not watched

            if (!recurring) {
              // One-time event
              return (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="px-6 py-3 bg-gray-100 text-gray-800 rounded-xl hover:bg-gray-200 transition-colors text-lg w-full"
                  >
                    Close
                  </button>
                  {!watched ? (
                    <button
                      disabled={changing === selectedEvent.id}
                      onClick={async () => {
                        await addWatch(selectedEvent); // scope not needed for one-time
                        setSelectedEvent(null);
                      }}
                      className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-lg w-full"
                    >
                      Add to My Events
                    </button>
                  ) : (
                    <button
                      disabled={changing === selectedEvent.id}
                      onClick={async () => {
                        await removeWatch(selectedEvent);
                        setSelectedEvent(null);
                      }}
                      className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors text-lg w-full"
                    >
                      Remove from My Events
                    </button>
                  )}
                </div>
              );
            }

            // Recurring events
            return !watched ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-sm">Add as:</span>
                  <div className="inline-flex rounded-lg overflow-hidden border">
                    <button
                      className={`px-3 py-1 text-sm ${
                        (getWatchScopeFor(selectedEvent) ?? "series") === "series"
                          ? "bg-indigo-600 text-white"
                          : "bg-white text-gray-700"
                      }`}
                      onClick={() => setWatchScopeFor(selectedEvent.id, "series")}
                    >
                      Recurring
                    </button>
                    <button
                      className={`px-3 py-1 text-sm ${
                        (getWatchScopeFor(selectedEvent) ?? "series") === "occurrence"
                          ? "bg-indigo-600 text-white"
                          : "bg-white text-gray-700"
                      }`}
                      onClick={() => setWatchScopeFor(selectedEvent.id, "occurrence")}
                    >
                      One time
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="px-6 py-3 bg-gray-100 text-gray-800 rounded-xl hover:bg-gray-200 transition-colors text-lg w-full"
                  >
                    Close
                  </button>
                  <button
                    disabled={changing === selectedEvent.id}
                    onClick={async () => {
                      await addWatch(selectedEvent, getWatchScopeFor(selectedEvent));
                      setSelectedEvent(null);
                    }}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-lg w-full"
                  >
                    Add to My Events ({getWatchScopeFor(selectedEvent)})
                  </button>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="px-6 py-3 bg-gray-100 text-gray-800 rounded-xl hover:bg-gray-200 transition-colors text-lg w-full"
                >
                  Close
                </button>
                <button
                  disabled={changing === selectedEvent.id}
                  onClick={async () => {
                    const next = currentScope === "series" ? "occurrence" : "series";
                    await removeWatch(selectedEvent);
                    await addWatch(selectedEvent, next);
                    setSelectedEvent(null);
                  }}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-lg w-full"
                >
                  Switch to {currentScope === "series" ? "one time" : "recurring"}
                </button>
                <button
                  disabled={changing === selectedEvent.id}
                  onClick={async () => {
                    await removeWatch(selectedEvent);
                    setSelectedEvent(null);
                  }}
                  className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors text-lg w-full"
                >
                  Remove
                </button>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  </div>
)}

        {/* Registration modal */}
        {regEvent && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-start z-50 overflow-y-auto py-8">
            <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl relative mx-4 my-auto min-h-fit max-h-full overflow-y-auto">
              {!showPaymentRequired ? (
                <EventRegistrationForm
                  event={regEvent}
                  onClose={() => setRegEvent(null)}
                  onSaved={handleRegistrationSaved}
                  onAddPerson={() => {
                  }}
                />
              ) : (
                <div className="space-y-6">
                  <div className="border-b pb-4">
                    <h2 className="text-2xl font-bold text-gray-900">Complete Your Registration</h2>
                    <p className="text-gray-600 mt-2">
                      You have successfully registered for <strong>{regEvent.name}</strong>. 
                      {regEvent.price && regEvent.price > 0 
                        ? "You can pay online now or pay at the door."
                        : "You may optionally make a donation to support this event."
                      }
                    </p>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-lg font-medium">Event:</span>
                      <span className="text-lg">{regEvent.name}</span>
                    </div>
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-lg font-medium">
                        {regEvent.price && regEvent.price > 0 ? "Event Cost:" : "Base Amount:"}
                      </span>
                      <span className="text-lg font-bold">${regEvent.price?.toFixed(2) || "0.00"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-medium">Date:</span>
                      <span className="text-lg">{new Date(regEvent.date).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Donation Input for Free Events */}
                  {regEvent.price === 0 && hasPayPalOption(regEvent) && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h3 className="font-medium text-blue-900 mb-3">Optional Donation</h3>
                      <label htmlFor="donationInput" className="block text-sm font-medium text-gray-700 mb-2">
                        Donation Amount (USD)
                      </label>
                      <div className="flex items-center">
                        <FiDollarSign className="h-4 w-4 text-gray-500 mr-2" />
                        <input
                          id="donationInput"
                          type="number"
                          min="0"
                          step="0.01"
                          className="border rounded px-3 py-2 w-32"
                          placeholder="0.00"
                          value={donationAmount || ''}
                          onChange={(e) => setDonationAmount(parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        This event is free, but you can make an optional donation to support it.
                      </p>
                    </div>
                  )}

                  {!paymentCompleted ? (
                    <div className="space-y-4">
                      <EventPayPalButton
                        eventId={regEvent.id}
                        event={{
                          name: regEvent.name,
                          price: regEvent.price || 0,
                          requires_payment: (regEvent.price && regEvent.price > 0) || false,
                          is_free_event: !regEvent.price || regEvent.price === 0,
                          payment_options: regEvent.payment_options
                        }}
                        donationAmount={donationAmount}
                        onPaymentSuccess={() => {
                          setPaymentCompleted(true);
                        }}
                        onPaymentError={(error) => {
                          console.error("Payment failed:", error);
                          alert(`Payment failed: ${error}`);
                        }}
                        className="w-full"
                      />
                      
                      {/* Show skip button for various scenarios */}
                      <button
                        onClick={() => {
                          setRegEvent(null);
                          setShowPaymentRequired(false);
                          setPaymentCompleted(false);
                          setDonationAmount(0);
                        }}
                        className="w-full px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                      >
                        {regEvent.price && regEvent.price > 0 
                          ? "I'll Pay at the Door" 
                          : "Skip Donation & Complete Registration"
                        }
                      </button>
                    </div>
                  ) : (
                    <div className="text-center space-y-4">
                      <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                        Payment completed successfully! Your registration is confirmed.
                      </div>
                      <button
                        onClick={() => {
                          setRegEvent(null);
                          setShowPaymentRequired(false);
                          setPaymentCompleted(false);
                          setDonationAmount(0);
                        }}
                        className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <button
                      onClick={() => {
                        setShowPaymentRequired(false);
                        setPaymentCompleted(false);
                        setDonationAmount(0);
                      }}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      ← Back to Registration
                    </button>
                    <button
                      onClick={() => {
                        setRegEvent(null);
                        setShowPaymentRequired(false);
                        setPaymentCompleted(false);
                        setDonationAmount(0);
                      }}
                      className="px-4 py-2 text-red-600 hover:text-red-800 transition-colors"
                    >
                      Cancel Registration
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default EventSection;


