import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface Event {
  id: string;
  name: string;
  description?: string;
  date: string;
  location?: string;
  price?: number;
  image_url?: string;
  thumbnail_url?: string;
}

interface EventSectionProps {
  showFilters?: boolean;
  eventName?: string | string[];
  lockedFilters?: { ministry?: string; ageRange?: string };
  title?: string;
  showTitle?: boolean;
}

const EventSection: React.FC<EventSectionProps> = ({ showFilters = true, eventName, lockedFilters, title, showTitle }) => {
  const isNameSet = Array.isArray(eventName)
    ? eventName.length > 0
    : typeof eventName === 'string' && eventName.trim() !== '';

  const filtersDisabled = isNameSet || !!lockedFilters?.ministry || !!lockedFilters?.ageRange;
  showFilters = showFilters && !filtersDisabled;
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [ministry, setMinistry] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [availableMinistries, setAvailableMinistries] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(3);
const [selectedEvent, setSelectedEvent] = useState<{
  id: string;
  name: string;
  description?: string;
  date: string;
  location?: string;
  price?: number;
  image_url?: string;
  thumbnail_url?: string;
} | null>(null);

  useEffect(() => {
    const fetchMinistries = async () => {
      try {
        const response = await axios.get('/api/v1/events/ministries');
        setAvailableMinistries(response.data);
      } catch (err) {
        console.error('Failed to fetch ministries:', err);
      }
    };
    fetchMinistries();
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const isNameSet = Array.isArray(eventName)
          ? eventName.length > 0
          : typeof eventName === 'string' && eventName.trim() !== '';

        if (isNameSet) {
          const all = await axios.get(`/api/v1/events/upcoming?limit=999`);
          const names = Array.isArray(eventName) ? eventName : [eventName];
          const matches = all.data.filter(
            (e: Event) =>
              typeof e.name === 'string' &&
              names.some(name => typeof name === 'string' && e.name!.toLowerCase().includes(name.toLowerCase()))
          );
          setEvents(matches);
        } else {
          const finalMinistry = lockedFilters?.ministry ?? ministry;
          const finalAgeRange = lockedFilters?.ageRange ?? ageRange;
          const params = new URLSearchParams();
          if (finalMinistry) params.append('ministry', finalMinistry);
          if (finalAgeRange) {
            const [minAge, maxAge] = finalAgeRange.split('-');
            if (minAge && maxAge) {
              params.append('age', minAge);
            }
          }
          params.append('limit', '999');
          const response = await axios.get(`/api/v1/events/upcoming?${params.toString()}`);
          setEvents(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch events:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [eventName, ministry, ageRange, lockedFilters]);

  const handleSignUp = (eventName: string) => {
    alert(`You signed up for: ${eventName}`);
  };

  const handleDetails = (event: {
    id: string;
    name: string;
    description?: string;
    date: string;
    location?: string;
    price?: number;
    image_url?: string;
    thumbnail_url?: string;
  }) => {
    setSelectedEvent(event);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <section className="w-full bg-white">
      <div className="w-full max-w-screen-xl mx-auto px-4 py-8">
        {showFilters && (
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <label>
              Ministry:
              <select value={ministry} onChange={e => setMinistry(e.target.value)}>
                <option value="">All</option>
                {availableMinistries.map(min => (
                  <option key={min} value={min}>{min}</option>
                ))}
              </select>
            </label>
            <label>
              Age Range:
              <select value={ageRange} onChange={e => setAgeRange(e.target.value)}>
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
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#555' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📅</div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '600' }}>There are no upcoming events.</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
            {events.slice(0, visibleCount).map((event) => (
              <div
                key={event.id}
                className="rounded-2xl shadow-md overflow-hidden bg-white flex flex-col h-full"
              >
                <div
                  className="h-40 w-full bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${
                      event.thumbnail_url
                        ? event.thumbnail_url.startsWith('http')
                          ? event.thumbnail_url
                          : '/assets/' + event.thumbnail_url
                        : '/assets/default-thumbnail.jpg'
                    })`
                  }}
                />
                <div className="flex flex-col h-full">
                  <div className="flex flex-col justify-between flex-grow p-4">
                    <div>
                      <h2 className="text-xl font-semibold mb-2">{event.name}</h2>
                      <p className="text-sm text-gray-600 mb-2">{event.description}</p>
                      <p className="text-sm text-gray-800 font-medium">{new Date(event.date).toLocaleDateString()}</p>
                      <p className="text-sm text-gray-800 mb-4">{event.location}</p>
                    </div>
                    <div className="mt-4 space-y-2">
                      <button
                        className="w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition duration-200"
                        onClick={() => handleSignUp(event.name)}
                      >
                        Sign Up
                      </button>
                      <button
                        className="w-full px-4 py-2 bg-white text-blue-600 font-semibold border border-blue-600 rounded-xl hover:bg-blue-50 transition duration-200"
                        onClick={() => handleDetails(event)}
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
        {selectedEvent && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50">
            <div className="bg-white rounded-2xl p-8 max-w-3xl w-full shadow-2xl relative overflow-y-auto max-h-[90vh]">
              <button
                onClick={() => setSelectedEvent(null)}
                className="absolute top-4 right-6 text-black-500 hover:text-gray-800 text-2xl"
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
              <p className="text-gray-900 font-medium text-base mb-1">📅 {new Date(selectedEvent.date).toLocaleString()}</p>
              <p className="text-gray-900 text-base mb-1">📍 {selectedEvent.location}</p>
              <p className="text-gray-900 text-base mb-1">💲 Price: ${selectedEvent.price ?? 'Free'}</p>
              <button
                onClick={() => handleSignUp(selectedEvent.name)}
                className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-lg w-full"
              >
                Sign Up
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default EventSection;