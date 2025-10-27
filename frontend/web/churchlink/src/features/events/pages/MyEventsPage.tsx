import { MyEventsSection } from '../components/MyEventsSection';

export default function MyEventsPage() {
  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">My Events</h1>
        <p className="text-gray-600">Manage your event registrations</p>
      </div>

      {/* Use the shared MyEventsSection component */}
      <MyEventsSection />
    </div>
  );
}