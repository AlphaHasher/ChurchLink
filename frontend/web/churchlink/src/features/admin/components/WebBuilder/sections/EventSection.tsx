import React, { useEffect, useMemo, useState } from "react";
import api from "@/api/api";

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
  onAddPerson, // optional external flow
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

  const fetchPeople = async () => {
    const res = await api.get("/v1/users/me/people");
    const ppl = res.data?.people ?? res.data ?? [];
    setPeople(ppl);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [_, regRes] = await Promise.all([
          fetchPeople(),
          api.get(`/v1/events/${event.id}/registrations/summary`),
        ]);
        setSummary(regRes.data);

        // seed selection from current registrations
        const current = new Set<string>();
        let selfIsRegistered = false;
        (regRes.data?.user_registrations ?? []).forEach((r: any) => {
          if (r.person_id) current.add(r.person_id);
          else selfIsRegistered = true;
        });
        setSelectedIds(current);
        setSelfSelected(selfIsRegistered);
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

  // --- validation used for selection list (unchanged) ---
  const validatePersonForEvent = (person: Person, ev: Event): string | null => {
    const evGender = ev.gender ?? "all";
    const pGender = person.gender ?? null;
    if (evGender !== "all" && pGender && evGender.toUpperCase() !== (pGender as string).toUpperCase()) {
      return `This event is ${evGender}-only.`;
    }
    if (person.date_of_birth && ev.min_age != null && ev.max_age != null) {
      // Handle "YYYY-MM-DD" or ISO
      const dob = person.date_of_birth.length === 10
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
  for (const p of people) errs[p.id] = validatePersonForEvent(p, event);
    errs["__self__"] = null;
    setErrors(errs);
  }, [people, event]);

  const togglePerson = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const removeRegistered = async (personId: string | null) => {
    try {
      setSaving(true);
      if (personId === null) {
        await api.delete(`/v1/events/${event.id}/rsvp`);
      } else {
        await api.delete(`/v1/event-people/unregister/${event.id}/family-member/${personId}`);
      }
      const regRes = await api.get(`/v1/events/${event.id}/registrations/summary`);
      setSummary(regRes.data);
      if (personId === null) setSelfSelected(false);
      else setSelectedIds((prev) => { const n = new Set(prev); n.delete(personId); return n; });
    } catch {
      alert("Failed to remove registration.");
    } finally {
      setSaving(false);
    }
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
      want.forEach((id) => !have.has(id) && toAdd.push(id));
      have.forEach((id) => !want.has(id) && toRemove.push(id));

      // pre-validate selections
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

      // self
      if (wantSelf && !haveSelf) await api.post(`/v1/events/${event.id}/rsvp`);
      else if (!wantSelf && haveSelf) await api.delete(`/v1/events/${event.id}/rsvp`);

      // family
      for (const id of toAdd) {
        await api.post(`/v1/event-people/register/${event.id}/family-member/${id}`);
      }
      for (const id of toRemove) {
        await api.delete(`/v1/event-people/unregister/${event.id}/family-member/${id}`);
      }

      onSaved(); // parent refreshes + closes
    } catch {
      alert("Failed to update registration.");
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

      {/* Already registered */}
      <div>
        <h4 className="font-medium mb-2">Already Registered</h4>
        {summary?.user_registrations?.length ? (
          <div className="space-y-2">
            {summary.user_registrations.map((r) => (
              <div key={`${r.person_id ?? "__self__"}`} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium">{r.display_name}</div>
                  <div className="text-xs text-gray-500">
                    Registered on {new Date(r.registered_on).toLocaleString()}
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
          {onAddPerson && (
            <button
              className="px-3 py-2 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
              onClick={onAddPerson}
            >
              Open Full Add Screen
            </button>
          )}
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
        <label className="flex items-center gap-3 rounded-lg border p-3 mb-2">
          <input type="checkbox" checked={selfSelected} onChange={(e) => setSelfSelected(e.target.checked)} />
          <div>
            <div className="font-medium">Myself</div>
            {errors["__self__"] && <div className="text-sm text-red-600">{errors["__self__"]}</div>}
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
              return (
                <label
                  key={p.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 ${err ? "border-red-300 bg-red-50" : ""}`}
                >
                  <input type="checkbox" checked={checked} onChange={() => togglePerson(p.id)} />
                  <div>
                    <div className="font-medium">
                      {p.first_name} {p.last_name}
                    </div>
                    {p.date_of_birth && (
                      <div className="text-xs text-gray-500">DOB: {new Date(p.date_of_birth).toLocaleDateString()}</div>
                    )}
                    {err && <div className="text-sm text-red-600">{err}</div>}
                  </div>
                </label>
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
  const [watchScope, setWatchScope] = useState<MyEventScope>("series");

  // NEW: registration modal event
  const [regEvent, setRegEvent] = useState<Event | null>(null);

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

      if (isNameSet) {
        const all = await api.get("/v1/events/upcoming?limit=999");
        const names = Array.isArray(eventName) ? eventName : [eventName];
        const matches = all.data.filter(
          (e: Event) =>
            typeof e.name === "string" &&
            names.some((name) => typeof name === "string" && e.name!.toLowerCase().includes(name.toLowerCase()))
        );
        setEvents(matches);
      } else {
        const finalMinistry = lockedFilters?.ministry ?? ministry;
        const finalAgeRange = lockedFilters?.ageRange ?? ageRange;
        const params = new URLSearchParams();
        if (finalMinistry) params.append("ministry", finalMinistry);
        if (finalAgeRange) {
          const [minAge, maxAge] = finalAgeRange.split("-");
          if (minAge && maxAge) params.append("age", minAge);
        }
        params.append("limit", "999");
        const response = await api.get(`/v1/events/upcoming?${params.toString()}`);
        setEvents(response.data);
      }
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

  const isRecurring = (ev: Event) => ev.recurring && ev.recurring !== "never";
  const requiresRSVP = (ev: Event) => !!ev.rsvp;

  const isWatched = (ev: Event) => myEvents.some((m) => m.event_id === ev.id && m.reason === "watch");
  const currentWatchScope = (ev: Event): MyEventScope | null => {
    const hit = myEvents.find((m) => m.event_id === ev.id && m.reason === "watch");
    return hit ? hit.scope : null;
  };
  const isRegistered = (ev: Event) => myEvents.some((m) => m.event_id === ev.id && m.reason === "rsvp");

  // watch actions (unchanged except for removing datetime picker earlier)
  const addWatch = async (ev: Event, desiredScope?: MyEventScope) => {
    const scopeToUse = desiredScope ?? watchScope;
    setChanging(ev.id);
    try {
      const params = new URLSearchParams();
      params.set("scope", scopeToUse);
      if (scopeToUse === "occurrence") {
        params.set("occurrenceStart", new Date(ev.date).toISOString()); // auto-use event start
      }
      await api.post(`/v1/event-people/watch/${ev.id}?` + params.toString());
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

  const switchWatchScope = async (ev: Event) => {
    if (changing === ev.id) return;
    const next: MyEventScope = currentWatchScope(ev) === "series" ? "occurrence" : "series";
    setWatchScope(next);
    await removeWatch(ev);
    await addWatch(ev, next); // pass intended scope directly (fixes the “two clicks” issue)
  };

  // registration open/close hooks
  const openRegistration = (ev: Event) => setRegEvent(ev);
  const closeRegistration = () => setRegEvent(null);
  const handleRegistrationSaved = async () => {
    await fetchMyEvents(); // reflect buttons instantly
    setRegEvent(null);
  };

  if (loading) return <div>Loading...</div>;

  const WatchButtons = ({ ev }: { ev: Event }) => {
    const watched = isWatched(ev);
    const scope = currentWatchScope(ev);

    if (!isRecurring(ev)) {
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

    return (
      <div className="space-y-2">
        {!watched ? (
          <>
            <div className="flex items-center gap-3">
              <label className="text-sm">Add as:</label>
              <select
                value={watchScope}
                onChange={(e) => setWatchScope(e.target.value as MyEventScope)}
                className="border rounded px-2 py-1"
              >
                <option value="series">Recurring</option>
                <option value="occurrence">One time</option>
              </select>
            </div>
            <button
              disabled={changing === ev.id}
              onClick={() => addWatch(ev)}
              className="w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700"
            >
              Add to My Events ({watchScope})
            </button>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              disabled={changing === ev.id}
              onClick={() => switchWatchScope(ev)}
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
        )}
      </div>
    );
  };

  const RegisterButtons = ({ ev }: { ev: Event }) => {
    const registered = isRegistered(ev);
    return !registered ? (
      <button
        disabled={changing === ev.id}
        onClick={() => openRegistration(ev)}
        className="w-full px-4 py-2 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700"
      >
        Register For Event
      </button>
    ) : (
      <div className="space-y-2">
        <button
          disabled={changing === ev.id}
          onClick={() => openRegistration(ev)}
          className="w-full px-4 py-2 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700"
        >
          Change My Registration
        </button>
        <button
          disabled={changing === ev.id}
          onClick={async () => {
            try {
              setChanging(ev.id);
              const res = await api.delete(`/v1/events/${ev.id}/rsvp`);
              if (!res.data?.success) throw new Error("Unregistration failed");
              await fetchMyEvents();
            } catch {
              alert("Unregistration failed.");
            } finally {
              setChanging(null);
            }
          }}
          className="w-full px-4 py-2 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700"
        >
          Cancel Registration
        </button>
      </div>
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
            {events.slice(0, visibleCount).map((ev) => (
              <div key={ev.id} className="rounded-2xl shadow-md overflow-hidden bg-white flex flex-col h-full">
                <div
                  className="h-40 w-full bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${
                      ev.thumbnail_url
                        ? ev.thumbnail_url.startsWith("http")
                          ? ev.thumbnail_url
                          : "/assets/" + ev.thumbnail_url
                        : "/assets/default-thumbnail.jpg"
                    })`,
                  }}
                />
                <div className="flex flex-col h-full">
                  <div className="flex flex-col justify-between flex-grow p-4">
                    <div>
                      <h2 className="text-xl font-semibold mb-2">{ev.name}</h2>
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
            ))}
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
              >
                ×
              </button>

              {/* Previous details UI */}
              {selectedEvent.image_url && (
                <img
                  src={
                    selectedEvent.image_url.startsWith("http")
                      ? selectedEvent.image_url
                      : "/assets/" + selectedEvent.image_url
                  }
                  alt={selectedEvent.name}
                  className="w-full max-h-80 object-cover rounded-lg mb-6"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.onerror = null;
                    target.src = "/assets/default-thumbnail.jpg";
                  }}
                />
              )}

              <h2 className="text-3xl font-bold mb-2">{selectedEvent.name}</h2>

              {selectedEvent.description && (
                <p className="text-gray-700 mb-4 text-lg">{selectedEvent.description}</p>
              )}

              <p className="text-gray-900 font-medium text-base mb-1">
                📅 {new Date(selectedEvent.date).toLocaleString()}
              </p>

              {selectedEvent.location && (
                <p className="text-gray-900 text-base mb-1">📍 {selectedEvent.location}</p>
              )}

              <p className="text-gray-900 text-base mb-6">
                💲 Price:{" "}
                {selectedEvent.price != null && selectedEvent.price > 0
                  ? `$${selectedEvent.price}`
                  : "Free"}
              </p>

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
                  // hook up your full “Add Event Person” screen if you have one
                  // or rely on the inline form inside the modal
                  alert("Open your Add Event Person flow.");
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


