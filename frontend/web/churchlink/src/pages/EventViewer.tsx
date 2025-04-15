import { useState } from "react";
import { motion } from "framer-motion";
import cleaningImg from "../assets/clean.jpg";
import runningImg from "../assets/running.jpg";
import headacheImg from "../assets/headache.jpg";

interface EventItem {
  id: number;
  title: string;
  description: string;
  imageUrl: string;
  date: string;
  time: string;
}

const events: EventItem[] = [
  {
    id: 1,
    title: "Community Clean-Up Day",
    description: "Join us for a day of giving back by helping clean up our neighborhood park.",
    imageUrl: cleaningImg,
    date: "April 20, 2025",
    time: "10:00 AM - 2:00 PM",
  },
  {
    id: 2,
    title: "Charity Run 5K",
    description: "Participate in our annual 5K charity run to support local shelters.",
    imageUrl: runningImg,
    date: "May 5, 2025",
    time: "8:00 AM - 11:00 AM",
  },
  {
    id: 3,
    title: "Computer Science Student Awareness Day",
    description: "Join us for a day of spreading awareness for overworked Computer Science students.",
    imageUrl: headacheImg,
    date: "May 15, 2025",
    time: "12:00 PM - 4:00 PM",
  },
];

function EventViewer() {
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);

  const handleSignUp = (eventTitle: string) => {
    alert(`You signed up for: ${eventTitle}`);
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
              <img
                src={event.imageUrl}
                alt={event.title}
                className="h-48 w-full object-cover"
              />
              <div className="p-4 flex flex-col justify-between flex-grow">
                <div>
                  <h2 className="text-xl font-semibold mb-2">{event.title}</h2>
                  <p className="text-sm text-gray-600 mb-2">{event.description}</p>
                  <p className="text-sm text-gray-800 font-medium">{event.date}</p>
                  <p className="text-sm text-gray-800 mb-4">{event.time}</p>
                </div>
                <button
                  onClick={() => handleDetails(event)}
                  className="mt-auto px-4 py-2 bg-blue-600 text-black rounded-xl hover:bg-blue-700 transition-colors"
                >
                  Event Details
                </button>
                <button
                  onClick={() => handleSignUp(event.title)}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-lg relative">
            <button
              onClick={() => setSelectedEvent(null)}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-xl"
            >
              ×
            </button>
            <img
              src={selectedEvent.imageUrl}
              alt={selectedEvent.title}
              className="w-full h-48 object-cover rounded-lg mb-4"
            />
            <h2 className="text-2xl font-bold mb-2">{selectedEvent.title}</h2>
            <p className="text-gray-700 mb-2">{selectedEvent.description}</p>
            <p className="text-gray-900 font-medium mb-1">{selectedEvent.date}</p>
            <p className="text-gray-900 mb-4">{selectedEvent.time}</p>
            <button
              onClick={() => handleSignUp(selectedEvent.title)}
              className="px-4 py-2 bg-blue-600 text-black rounded-xl hover:bg-blue-700 transition-colors w-full"
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

