import { useState } from "react";
// import { useAuth } from "@/lib/auth-context";

interface Notification {
  id: number;
  title: string;
  message: string;
  schedule: string;
  platform: "mobile" | "email" | "both";
}

const Notification = () => {
  // const { role } = useAuth();
//   if (role !== "admin") return <p>Access Denied</p>; // Restrict to admins only

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [youtubeChannel, setYoutubeChannel] = useState("");
  const [newNotification, setNewNotification] = useState({
    title: "",
    message: "",
    schedule: "",
    platform: "both",
  });
  const handleAddNotification = () => {
    setNotifications((prev) => [
      ...prev,
      { id: Date.now(), ...newNotification, platform: newNotification.platform as "mobile" | "email" | "both" },
    ]);
    setNewNotification({ title: "", message: "", schedule: "", platform: "both" });
  };

  const handleRemoveNotification = (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Manage Notifications</h1>

      {/* YouTube Channel Setup */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">YouTube Live Notifications</h2>
        <input
          type="text"
          placeholder="Enter YouTube Channel ID"
          value={youtubeChannel}
          onChange={(e) => setYoutubeChannel(e.target.value)}
          className="border p-2 w-full"
        />
        <button
          className="mt-2 bg-blue-500 text-white px-4 py-2 rounded"
          onClick={() => console.log("YouTube Channel Set:", youtubeChannel)}
        >
          Save YouTube Channel
        </button>
      </div>

      {/* Notification Scheduling */}
      <h2 className="text-xl font-semibold mb-2">Schedule Notifications</h2>
      <div className="grid gap-4 md:grid-cols-3">
        <input
          type="text"
          placeholder="Title"
          value={newNotification.title}
          onChange={(e) =>
            setNewNotification({ ...newNotification, title: e.target.value })
          }
          className="border p-2 w-full"
        />
        <input
          type="text"
          placeholder="Message"
          value={newNotification.message}
          onChange={(e) =>
            setNewNotification({ ...newNotification, message: e.target.value })
          }
          className="border p-2 w-full"
        />
        <input
          type="datetime-local"
          value={newNotification.schedule}
          onChange={(e) =>
            setNewNotification({ ...newNotification, schedule: e.target.value })
          }
          className="border p-2 w-full"
        />
        <select
          value={newNotification.platform}
          onChange={(e) =>
            setNewNotification({ ...newNotification, platform: e.target.value as "mobile" | "email" | "both" })
          }
          className="border p-2 w-full"
        >
          <option value="both">Mobile & Email</option>
          <option value="mobile">Mobile Only</option>
          <option value="email">Email Only</option>
        </select>
        <button
          className="bg-green-500 text-white px-4 py-2 rounded w-full"
          onClick={handleAddNotification}
        >
          Add Notification
        </button>
      </div>

      {/* Display Notifications */}
      <h2 className="text-xl font-semibold mt-6">Scheduled Notifications</h2>
      <table className="w-full border-collapse border border-gray-300 mt-4">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2">Title</th>
            <th className="border p-2">Message</th>
            <th className="border p-2">Scheduled Time</th>
            <th className="border p-2">Platform</th>
            <th className="border p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {notifications.map((n) => (
            <tr key={n.id} className="border">
              <td className="p-2 border">{n.title}</td>
              <td className="p-2 border">{n.message}</td>
              <td className="p-2 border">{n.schedule}</td>
              <td className="p-2 border">{n.platform}</td>
              <td className="p-2 border">
                <button
                  className="bg-red-500 text-white px-3 py-1 rounded"
                  onClick={() => handleRemoveNotification(n.id)}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Notification;