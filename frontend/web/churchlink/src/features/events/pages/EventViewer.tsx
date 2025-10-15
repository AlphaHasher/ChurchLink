import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import api from "@/api/api";

interface EventItem {
  id: string;
  name: string;
  description: string;
  date: string;
  location: string;
  price: number;
  ministry: string[];
  minAge: number;
  maxAge: number;
  gender: string;
}

function EventViewer() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        // Filter to show only upcoming events (from today onwards)
        const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
        const response = await api.get("/v1/events/", {
          params: {
            date_after: today,
          },
        });
        setEvents(response.data);
      } catch (error) {
        console.error("Error fetching events:", error);
      }
    };

    fetchEvents();
  }, []);

  const handleSignUp = (eventName: string) => {
    alert(`You signed up for: ${eventName}`);
  };

  const handleDetails = (event: EventItem) => {
    setSelectedEvent(event);
  };

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
        {events.map((event) => (
          <motion.div
            key={event.id}
            whileHover={{ scale: 1.03 }}
            className="rounded-2xl shadow-md overflow-hidden bg-white"
          >
            <div className="flex flex-col h-full">
              <div className="p-4 flex flex-col justify-between flex-grow">
                <div>
                  <h2 className="text-xl font-semibold mb-2">{event.name}</h2>
                  <p className="text-sm text-gray-600 mb-2">{event.description}</p>
                  <p className="text-sm text-gray-800 font-medium">{event.date}</p>
                  <p className="text-sm text-gray-800 mb-4">{event.location}</p>
                </div>
                <button
                  onClick={() => handleDetails(event)}
                  className="mt-auto px-4 py-2 bg-blue-600 text-black rounded-xl hover:bg-blue-700 transition-colors"
                >
                  Event Details
                </button>
                <button
                  onClick={() => handleSignUp(event.name)}
                  className="mt-2 px-4 py-2 bg-blue-600 text-black rounded-xl hover:bg-blue-700 transition-colors"
                >
                  Sign Up
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {selectedEvent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-3xl w-full shadow-2xl relative">
            <button
              onClick={() => setSelectedEvent(null)}
              className="absolute top-4 right-6 text-black-500 hover:text-gray-800 text-2xl"
            >
              ×
            </button>
            <h2 className="text-3xl font-bold mb-4">{selectedEvent.name}</h2>
            <p className="text-gray-700 mb-4 text-lg">{selectedEvent.description}</p>
            <p className="text-gray-900 font-medium text-base mb-1">{selectedEvent.date}</p>
            <p className="text-gray-900 mb-6 text-base">{selectedEvent.location}</p>
            <p className="text-gray-900 mb-2 text-base">Price: ${selectedEvent.price}</p>
            <p className="text-gray-900 mb-2 text-base">Ministry: {selectedEvent.ministry.join(", ")}</p>
            <p className="text-gray-900 mb-2 text-base">Ages: {selectedEvent.minAge} - {selectedEvent.maxAge}</p>
            <p className="text-gray-900 mb-6 text-base">Gender: {selectedEvent.gender}</p>
            <button
              onClick={() => handleSignUp(selectedEvent.name)}
              className="px-6 py-3 bg-blue-600 text-black rounded-xl hover:bg-blue-700 transition-colors text-lg w-full"
            >
              Sign Up
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default EventViewer;

