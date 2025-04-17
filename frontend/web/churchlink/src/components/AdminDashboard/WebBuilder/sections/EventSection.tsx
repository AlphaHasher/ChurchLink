import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface Event {
  id: string;
  title: string;
  date: string;
  description?: string;
}

const EventSection: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [ministry, setMinistry] = useState('');
  const [ageRange, setAgeRange] = useState('');

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const params = new URLSearchParams();
        if (ministry) params.append('ministry', ministry);
        if (ageRange) params.append('ageRange', ageRange);

        const response = await axios.get(`/api/events/upcoming?${params.toString()}`);
        setEvents(response.data);
      } catch (error) {
        console.error('Failed to fetch events:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [ministry, ageRange]);

  if (loading) return <div>Loading...</div>;

  return (
    <section>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <label>
          Ministry:
          <select value={ministry} onChange={e => setMinistry(e.target.value)}>
            <option value="">All</option>
            <option value="Youth">Youth</option>
            <option value="Adult">Adult</option>
            <option value="Senior">Senior</option>
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
      <h2 style={{ marginBottom: '1rem' }}>Upcoming Events</h2>
      {events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#555' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📅</div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: '600' }}>There are no upcoming events.</h3>
        </div>
      ) : (
        <ul style={{ display: 'grid', gap: '1rem', listStyle: 'none', padding: 0 }}>
          {events.map(event => (
            <li key={event.id} style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '1rem', background: '#f9f9f9' }}>
              <h3 style={{ margin: '0 0 0.5rem' }}>{event.title}</h3>
              <p style={{ margin: 0 }}>{new Date(event.date).toLocaleDateString()}</p>
              {event.description && <p style={{ marginTop: '0.5rem' }}>{event.description}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default EventSection;