import React, { useEffect, useMemo, useState } from "react";
import { Calendar as FiCalendar, MapPin as FiMapPin, DollarSign as FiDollarSign, Repeat as FiRepeat } from "lucide-react";
import api from "@/api/api";
import { getBaseURL } from "@/helpers/StrapiInteraction";

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

function EventRegistrationForm({
  event,
  onClose,
  onSaved,
}: {
  event: Event;
  onClose: () => void;
  onSaved: () => void;
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

  /** ---------- INLINE ADD PERSON (schema-conformant) ---------- **/
  const [showAdd, setShowAdd] = useState(false);
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newGender, setNewGender] = useState<"" | "M" | "F">("");
  const [newDob, setNewDob] = useState<string>("");

  const resetAddForm = () => {
    setNewFirst("");
    setNewLast("");
    setNewGender("");
    setNewDob("");
  };

  const fetchPeople = async () => {
    const res = await api.get("/v1/users/me/people");
    const ppl = res.data?.people ?? res.data ?? [];
    setPeople(ppl);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        const [_, regRes, profileRes] = await Promise.all([
          fetchPeople(),
          api.get(`/v1/events/${event.id}/registrations/summary`),
          api.get(`/v1/users/get-profile`),
        ]);

        const p = profileRes?.data?.profile_info ?? {};
        const first = p.first_name ?? "";
        const last = p.last_name ?? "";
        setMe(first || last ? { first, last } : null);

        // Set the summary first so registeredSet memo works correctly
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
        setSelfSelected(selfIsRegistered);
        setPersonScopes(scopes);
        setSelfScope(selfScopeValue);
      } catch (e) {
        console.error("Failed to load registration form data:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [event.id]);

  const registeredSet = useMemo(() => {
    const s = new Set<string>();
    summary?.user_registrations?.forEach((r) => r.person_id && s.add(r.person_id));
    return s;
  }, [summary]);

  const selfRegistered = useMemo(
    () => !!summary?.user_registrations?.some((r) => r.person_id === null),
    [summary]
  );

  const validatePersonForEvent = (person: Person, ev: Event): string | null => {
    const evGender = ev.gender ?? "all";
    if (evGender !== "all" && person.gender) {
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

  useEffect(() => {
    const errs: Record<string, string | null> = {};
    for (const p of people) {
      errs[p.id] = validatePersonForEvent(p, event);
    }
    errs["__self__"] = null;
    setErrors(errs);
  }, [people, event]);

  const togglePerson = (id: string) => {
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

      // Add new registrations
      for (const id of toAdd) {
        const scope = personScopes[id] || "series";
        await api.post(`/v1/event-people/register/${event.id}/family-member/${id}?scope=${scope}`);
      }
      
      // Remove registrations
      for (const id of toRemove) {
        // Remove all scopes for this person
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

      onSaved();
    } catch (error) {
      console.error("Registration update error:", error);
      alert("Failed to update registration.");
    } finally {
      setSaving(false);
    }
  };

  const submitAddPerson = async () => {
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
      const payload = {
        first_name: newFirst.trim(),
        last_name: newLast.trim(),
        gender: newGender,
        date_of_birth: newDob,
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
          <h3 className="text-xl font-semibold">Register for: {event.name}</h3>
          <p className="text-sm text-gray-600">
            {new Date(event.date).toLocaleString()} • {summary?.available_spots ?? 0} spots left (of{" "}
            {summary?.total_spots ?? "?"})
          </p>
        </div>
        <button className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200" onClick={onClose}>
          Close
        </button>
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
        <div className="flex items-center gap-3 rounded-lg border p-3 mb-2">
          <input
            type="checkbox"
            checked={selfSelected}
            onChange={(e) => setSelfSelected(e.target.checked)}
          />
          <div className="flex-1">
            <div className="font-medium">
              {me ? `${me.first} ${me.last} (you)` : "You"}
            </div>
            {errors["__self__"] && <div className="text-sm text-red-600">{errors["__self__"]}</div>}
          </div>
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

        {/* Family */}
        <div className="space-y-2">
          {people.length === 0 ? (
            <div className="text-sm text-gray-500">You have no saved Event People yet.</div>
          ) : (
            people.map((p) => {
              const checked = selectedIds.has(p.id);
              const err = errors[p.id];
              const scope = personScopes[p.id] || "series";
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 ${err ? "border-red-300 bg-red-50" : ""}`}
                >
                  <input type="checkbox" checked={checked} onChange={() => togglePerson(p.id)} />
                  <div className="flex-1">
                    <div className="font-medium">
                      {p.first_name} {p.last_name}
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

      {/* Submit */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">Payment is not required for this step.</div>
        <button
          disabled={saving}
          onClick={createOrUpdate}
          className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
        >
          {summary?.user_registrations?.length ? "Update Registration" : "Create Registration"}
        </button>
      </div>
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

  const recurrenceLabel = (ev: Event) => {
    if (!ev.recurring || ev.recurring === "never") return "One-time";
    return `Repeats ${ev.recurring}`;
  };

  const RecurrenceBadge = ({ ev }: { ev: Event }) => (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
      {recurrenceLabel(ev)}
    </span>
  );

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

      if (finalAgeRange) {
        const [minAge] = finalAgeRange.split("-");
        if (minAge) params.append("age", minAge);
      }

      if (isNameSet) {
        const names = Array.isArray(eventName) ? eventName : [eventName];
        params.append("name", names.join(","));
      }

      const { data } = await api.get(`/v1/events/upcoming?${params.toString()}`);
      setEvents(data);
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

  const addWatch = async (ev: Event, desiredScope?: MyEventScope) => {
    const scopeToUse = desiredScope ?? getWatchScopeFor(ev);
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
      await api.delete(`/v1/event-people/watch/${ev.id}`);
      await fetchMyEvents();
    } catch (e) {
      console.error(e);
      alert("Failed to remove from My Events.");
    } finally {
      setChanging(null);
    }
  };

  const openRegistration = (ev: Event) => setRegEvent(ev);
  const handleRegistrationSaved = async () => {
    await fetchMyEvents();
    setRegEvent(null);
  };

  if (loading) return <div>Loading...</div>;

  const WatchButtons = ({ ev }: { ev: Event }) => {
    const watched = isWatched(ev);
    const scope = currentWatchScope(ev);
    const recurring = !!ev.recurring && ev.recurring !== "never";

    if (!recurring) {
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
          onClick={() => addWatch(ev)}
          className="w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700"
        >
          Add to My Events
        </button>
      );
    }

    if (!watched) {
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

  const RegisterButtons = ({ ev }: { ev: Event }) => {
    const anyReg = myEvents.some(
      (m) => m.event_id === ev.id && m.reason === "rsvp"
    );

    return (
      <button
        disabled={changing === ev.id}
        onClick={() => openRegistration(ev)}
        className={`w-full px-4 py-2 font-semibold rounded-xl ${anyReg
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
          <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
            <label>
              Ministry:
              <select value={ministry} onChange={(e) => setMinistry(e.target.value)}>
                <option value="">All</option>
                {availableMinistries.map((min) => (
                  <option key={min} value={min}>
                    {min}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Age Range:
              <select value={ageRange} onChange={(e) => setAgeRange(e.target.value)}>
                <option value="">All</option>
                <option value="0-12">0–12</option>
                <option value="13-17">13–17</option>
                <option value="18-35">18–35</option>
                <option value="36-60">36–60</option>
                <option value="60+">60+</option>
              </select>
            </label>
          </div>
        )}

        {showTitle !== false && (
          <h2 className="text-3xl font-bold mb-6 text-center">{title || "Upcoming Events"}</h2>
        )}
        {events.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 1rem", color: "#555" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📅</div>
            <h3 style={{ fontSize: "1.5rem", fontWeight: 600 }}>There are no upcoming events.</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
            {events.slice(0, visibleCount).map((ev) => {
              const primary = ev.image_url ? getBaseURL(ev.image_url) : null;
              const bg = primary
                ? `url("${primary}"), url("/assets/default-thumbnail.jpg")`
                : `url("/assets/default-thumbnail.jpg")`;

              return (
                <div key={ev.id} className="rounded-2xl shadow-md overflow-hidden bg-white flex flex-col h-full">
                  <div
                    className="h-100 w-full bg-cover bg-center"
                    style={{
                      backgroundImage: bg,
                    }}
                  />
                  <div className="flex flex-col h-full">
                    <div className="flex flex-col justify-between flex-grow p-4">
                      <div>
                        <h2 className="text-xl font-semibold mb-2">{ev.name}</h2>
                        <div className="mb-2"><RecurrenceBadge ev={ev} /></div>
                        <p className="text-sm text-gray-600 mb-2">{ev.description}</p>
                        <p className="text-sm text-gray-800 font-medium">{new Date(ev.date).toLocaleDateString()}</p>
                        <p className="text-sm text-gray-800 mb-1">{ev.location}</p>
                        <p className="text-sm text-gray-800">
                          {ev.rsvp ? "Registration required" : "No registration required"}
                          {ev.recurring && ev.recurring !== "never" ? " • Recurring" : ""}
                        </p>
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
                </div>
              );
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
                  src={getBaseURL(selectedEvent.image_url)}
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
                  {selectedEvent.recurring && selectedEvent.recurring !== "never" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium">
                      <FiRepeat className="inline-block" /> Recurring
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-50 text-gray-700 text-xs font-medium">
                      One-time
                    </span>
                  )}
                  {selectedEvent.gender && selectedEvent.gender !== "all" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-medium">
                      {selectedEvent.gender === "male" ? "Men only" : "Women only"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                      All welcome
                    </span>
                  )}
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
                    {selectedEvent.price != null && selectedEvent.price > 0
                      ? `$${selectedEvent.price}`
                      : "Free"}
                  </span>
                </div>
              </div>

              {/* Actions */}
              {selectedEvent.rsvp ? (
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
                <div className="space-y-4">
                  {(() => {
                    const watched = isWatched(selectedEvent);
                    const recurring = selectedEvent.recurring && selectedEvent.recurring !== "never";
                    const currentScope = currentWatchScope(selectedEvent);

                    if (!recurring) {
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
                                await addWatch(selectedEvent);
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

                    return !watched ? (
                      <>
                        <div className="flex items-center gap-3">
                          <span className="text-sm">Add as:</span>
                          <div className="inline-flex rounded-lg overflow-hidden border">
                            <button
                              className={`px-3 py-1 text-sm ${(getWatchScopeFor(selectedEvent) ?? "series") === "series"
                                ? "bg-indigo-600 text-white"
                                : "bg-white text-gray-700"
                                }`}
                              onClick={() => setWatchScopeFor(selectedEvent.id, "series")}
                            >
                              Recurring
                            </button>
                            <button
                              className={`px-3 py-1 text-sm ${(getWatchScopeFor(selectedEvent) ?? "series") === "occurrence"
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
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl relative">
              <EventRegistrationForm
                event={regEvent}
                onClose={() => setRegEvent(null)}
                onSaved={handleRegistrationSaved}
                onAddPerson={() => {
                }}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default EventSection;
