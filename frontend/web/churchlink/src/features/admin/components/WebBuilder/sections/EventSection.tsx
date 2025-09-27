import React, { useEffect, useState } from "react";
import api from "@/api/api";

type Recurring = "daily" | "weekly" | "monthly" | "yearly" | "never";
type MyEventScope = "series" | "occurrence";

interface Event {
  id: string;
  name: string;
  description?: string;
  date: string;                 // ISO
  location?: string;
  price?: number;
  image_url?: string;
  thumbnail_url?: string;

  // Needed to decide actions (optional to keep backwards compat with your API responses)
  rsvp?: boolean;
  recurring?: Recurring;
}

interface MyEventRef {
  event_id: string;             // stringified ObjectId
  reason: "watch" | "rsvp";
  scope: MyEventScope;
  occurrence_start?: string | null;
  // meta, key, etc. may also exist
}

interface EventSectionProps {
  showFilters?: boolean;
  eventName?: string | string[];
  lockedFilters?: { ministry?: string; ageRange?: string };
  title?: string;
  showTitle?: boolean;
}

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
  const [changing, setChanging] = useState<string | null>(null); // eventId currently updating
  const [watchScope, setWatchScope] = useState<MyEventScope>("series");
  const [occurrenceStart, setOccurrenceStart] = useState<string>(""); // ISO when scope=occurrence

  // ---------- fetch helpers ----------
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
            names.some(
              (name) => typeof name === "string" && e.name!.toLowerCase().includes(name.toLowerCase())
            )
        );
        setEvents(matches);
      } else {
        const finalMinistry = lockedFilters?.ministry ?? ministry;
        const finalAgeRange = lockedFilters?.ageRange ?? ageRange;
        const params = new URLSearchParams();
        if (finalMinistry) params.append("ministry", finalMinistry);
        if (finalAgeRange) {
          const [minAge, maxAge] = finalAgeRange.split("-");
          if (minAge && maxAge) {
            params.append("age", minAge);
          }
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

  // ---------- utility ----------
  const isRecurring = (ev: Event) => ev.recurring && ev.recurring !== "never";
  const requiresRSVP = (ev: Event) => !!ev.rsvp;

  const isWatched = (ev: Event) =>
    myEvents.some((m) => m.event_id === ev.id && m.reason === "watch");

  const currentWatchScope = (ev: Event): MyEventScope | null => {
    const hit = myEvents.find((m) => m.event_id === ev.id && m.reason === "watch");
    return hit ? hit.scope : null;
  };

  const isRegistered = (ev: Event) =>
    myEvents.some((m) => m.event_id === ev.id && m.reason === "rsvp");

  // ---------- actions: WATCH (non-RSVP) ----------
  const addWatch = async (ev: Event) => {
    setChanging(ev.id);
    try {
      const params = new URLSearchParams();
      params.set("scope", watchScope);
      if (watchScope === "occurrence" && occurrenceStart) {
        params.set("occurrenceStart", occurrenceStart);
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
    const next: MyEventScope = currentWatchScope(ev) === "series" ? "occurrence" : "series";
    setWatchScope(next);
    await removeWatch(ev);
    await addWatch(ev);
  };

  // ---------- actions: RSVP / registration ----------
  const register = async (ev: Event) => {
    setChanging(ev.id);
    try {
      const res = await api.post(`/v1/events/${ev.id}/rsvp`);
      if (!res.data?.success) throw new Error("Registration failed");
      await fetchMyEvents();
    } catch (e) {
      console.error(e);
      alert("Registration failed (full or already registered).");
    } finally {
      setChanging(null);
    }
  };

  const unregister = async (ev: Event) => {
    setChanging(ev.id);
    try {
      const res = await api.delete(`/v1/events/${ev.id}/rsvp`);
      if (!res.data?.success) throw new Error("Unregistration failed");
      await fetchMyEvents();
    } catch (e) {
      console.error(e);
      alert("Unregistration failed.");
    } finally {
      setChanging(null);
    }
  };

  const changeRegistration = async (ev: Event) => {
    // Stub: open your family-member dialog and call:
    //  POST /v1/event-people/register/{event_id}/family-member/{family_member_id}
    //  DELETE /v1/event-people/unregister/{event_id}/family-member/{family_member_id}
    alert("Open 'Change Registration' dialog here (select family members, then call the family endpoints).");
  };

  // ---------- UI handlers ----------
  const handleDetails = (event: Event) => setSelectedEvent(event);

  if (loading) return <div>Loading...</div>;

  // ---------- small UI blocks ----------
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

    // Recurring
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
            {watchScope === "occurrence" && (
              <input
                type="datetime-local"
                className="border rounded px-2 py-1 w-full"
                value={occurrenceStart}
                onChange={(e) => setOccurrenceStart(e.target.value)}
                placeholder="Choose occurrence start"
              />
            )}
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
        onClick={() => register(ev)}
        className="w-full px-4 py-2 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700"
      >
        Register For Event
      </button>
    ) : (
      <div className="space-y-2">
        <button
          disabled={changing === ev.id}
          onClick={() => changeRegistration(ev)}
          className="w-full px-4 py-2 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700"
        >
          Change My Registration
        </button>
        <button
          disabled={changing === ev.id}
          onClick={() => unregister(ev)}
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
                      <p className="text-sm text-gray-800 font-medium">
                        {new Date(ev.date).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-800 mb-4">{ev.location}</p>
                      <p className="text-sm text-gray-800">
                        {requiresRSVP(ev) ? "Registration required" : "No registration required"}
                        {isRecurring(ev) && " • Recurring"}
                      </p>
                    </div>

                    {/* Primary action block */}
                    <div className="mt-4 space-y-2">
                      {requiresRSVP(ev) ? (
                        <RegisterButtons ev={ev} />
                      ) : (
                        <WatchButtons ev={ev} />
                      )}
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

        {/* Details modal */}
        {selectedEvent && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50">
            <div className="bg-white rounded-2xl p-8 max-w-3xl w-full shadow-2xl relative overflow-y-auto max-h-[90vh]">
              <button
                onClick={() => setSelectedEvent(null)}
                className="absolute top-4 right-6 text-gray-500 hover:text-gray-800 text-2xl"
              >
                ×
              </button>

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
              <p className="text-gray-700 mb-4 text-lg">{selectedEvent.description}</p>
              <p className="text-gray-900 font-medium text-base mb-1">
                📅 {new Date(selectedEvent.date).toLocaleString()}
              </p>
              <p className="text-gray-900 text-base mb-1">📍 {selectedEvent.location}</p>
              <p className="text-gray-900 text-base mb-1">
                💲 Price: {selectedEvent.price != null ? `$${selectedEvent.price}` : "Free"}
              </p>

              {/* Mirror primary actions inside modal */}
              <div className="mt-6 space-y-2">
                {requiresRSVP(selectedEvent) ? (
                  <RegisterButtons ev={selectedEvent} />
                ) : (
                  <>
                    {isRecurring(selectedEvent) && (
                      <div className="mb-3">
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
                        {watchScope === "occurrence" && (
                          <input
                            type="datetime-local"
                            className="border rounded px-2 py-1 w-full mt-2"
                            value={occurrenceStart}
                            onChange={(e) => setOccurrenceStart(e.target.value)}
                            placeholder="Choose occurrence start"
                          />
                        )}
                      </div>
                    )}
                    <WatchButtons ev={selectedEvent} />
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default EventSection;
