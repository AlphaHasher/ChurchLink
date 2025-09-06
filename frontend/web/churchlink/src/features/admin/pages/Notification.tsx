import { useState, useEffect, useCallback } from "react";
import { Tab, Tabs } from '@mui/material';
// import { useAuth } from "@/lib/auth-context";

interface Notification {
  id?: number | string;
  title: string;
  message?: string;
  body?: string;
  schedule?: string;
  scheduled_time?: string;
  customDate?: string;
  customTime?: string;
  platform?: "mobile" | "email" | "both";
  recipients?: any;
  timestamp?: string;
  link?: string;
  actionType?: "text" | "link" | "route";
  route?: string;
  data?: any;
}

const Notification = () => {
  const [youtubeLiveTitle, setYoutubeLiveTitle] = useState<string>("");
  const [activeTab, setActiveTab] = useState<'scheduled' | 'history'>('scheduled');
  
  // Scheduled notifications from backend
  const [scheduledNotifications, setScheduledNotifications] = useState<any[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState<string | null>(null);
  const [cancelLoadingId, setCancelLoadingId] = useState<string | null>(null);
  const [selectedTimezone, setSelectedTimezone] = useState('America/Los_Angeles'); // Will be set from backend
  const [youtubeAPIKey, setYoutubeAPIKey] = useState("");
  const [youtubeChannelId, setYoutubeChannelId] = useState("");
  const [youtubePublicDomain, setYoutubePublicDomain] = useState("");
  const [streamNotificationMessage, setStreamNotificationMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [envOverride, setEnvOverride] = useState(false);
  const [newNotification, setNewNotification] = useState<Notification>({
    title: "",
    message: "",
    schedule: "",
    customDate: "",
    customTime: "",
    platform: "mobile",
    link: "",
    actionType: "link",
    route: "",
  });
  const [notificationHistory, setNotificationHistory] = useState<Notification[]>([]);
  const [targetAudience, setTargetAudience] = useState<"all" | "logged_in" | "anonymous">("all");
  const [formError, setFormError] = useState<string | null>(null);


  // Helper to check if custom date/time is in the past
  const isCustomPast = (() => {
    if (newNotification.schedule === "custom" && newNotification.customDate && newNotification.customTime) {
      const dateStr = `${newNotification.customDate}T${newNotification.customTime}:00`;
      try {
        const tzDate = new Date(
          new Date(dateStr).toLocaleString('en-US', { timeZone: selectedTimezone })
        );
        return tzDate.getTime() < Date.now();
      } catch {
        return false;
      }
    }
    return false;
  })();

  // Fetch YouTube settings from backend on mount
  useEffect(() => {
    setLoading(true);
  fetch("/api/v1/notification/settings")
      .then((res) => res.json())
      .then((data) => {
  setYoutubeAPIKey(data.YOUTUBE_API_KEY || "");
  setYoutubeChannelId(data.PRIMARY_CHANNEL_ID || "");
  setYoutubePublicDomain(data.PUBLIC_DOMAIN || "");
  setStreamNotificationMessage(data.STREAM_NOTIFICATION_MESSAGE || "A new stream is live!");
  setYoutubeLiveTitle(data.STREAM_NOTIFICATION_TITLE || "Live Stream Started");
  setSelectedTimezone(data.YOUTUBE_TIMEZONE || 'America/Los_Angeles');
  setEnvOverride(!!data.envOverride);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fetchNotificationHistory = useCallback(async () => {
    setLoading(true);
    try {
  const res = await fetch("/api/v1/notification/history");
      const data = await res.json();
      setNotificationHistory(data);
    } catch {
      setNotificationHistory([]);
    }
    setLoading(false);
  }, []);


  // Fetch scheduled notifications from backend
  const fetchScheduledNotifications = useCallback(async () => {
    try {
  const res = await fetch("/api/v1/notification/scheduled");
      const data = await res.json();
      setScheduledNotifications(data);
    } catch {
      setScheduledNotifications([]);
    }
  }, []);

  // Polling interval for scheduled notifications (auto-refresh Scheduled tab)
  useEffect(() => {
    if (activeTab !== 'scheduled') return;
    const interval = setInterval(() => {
      fetchScheduledNotifications();
    }, 10000); // 10 seconds
    return () => clearInterval(interval);
  }, [activeTab, fetchScheduledNotifications]);

  useEffect(() => {
    fetchNotificationHistory();
    fetchScheduledNotifications();
  }, [fetchNotificationHistory, fetchScheduledNotifications]);


  // Schedule notification via backend
  const handleAddNotification = async () => {
    setFormError(null);
    setScheduleLoading(true);
    setScheduleStatus(null);
    // Validation
    if (!newNotification.title?.trim()) {
      setFormError('Title is required.');
      setScheduleLoading(false);
      return;
    }
    if (!newNotification.message?.trim()) {
      setFormError('Message is required.');
      setScheduleLoading(false);
      return;
    }
    if (!newNotification.schedule) {
      setFormError('Schedule time is required.');
      setScheduleLoading(false);
      return;
    }
    if (newNotification.schedule === 'custom' && (!newNotification.customDate || !newNotification.customTime)) {
      setFormError('Custom date and time are required.');
      setScheduleLoading(false);
      return;
    }
    if (newNotification.actionType === 'link' && !newNotification.link?.trim()) {
      setFormError('Link is required for link action.');
      setScheduleLoading(false);
      return;
    }
    if (newNotification.actionType === 'route' && !newNotification.route?.trim()) {
      setFormError('Route is required for route action.');
      setScheduleLoading(false);
      return;
    }
    let scheduled_time = "";
    if (newNotification.schedule === "custom" && newNotification.customDate && newNotification.customTime) {
      // Convert selected date/time in selectedTimezone to UTC
      try {
        // Create a date object in the selected timezone
        const dateStr = `${newNotification.customDate}T${newNotification.customTime}:00`;
        // Get the timestamp in the selected timezone
        const utcDate = new Date(
          new Date(dateStr).toLocaleString('en-US', { timeZone: selectedTimezone })
        );
        // Convert to ISO string (UTC)
        scheduled_time = utcDate.toISOString();
      } catch {
        scheduled_time = `${newNotification.customDate}T${newNotification.customTime}:00Z`;
      }
    } else if (newNotification.schedule === "now") {
      scheduled_time = new Date().toISOString();
    }
    const payload = {
      title: newNotification.title,
      body: newNotification.message,
      scheduled_time,
      target: targetAudience,
      actionType: newNotification.actionType,
      link: newNotification.link,
      route: newNotification.route,
      data: {
        ...(newNotification.actionType === "link" && newNotification.link ? { link: newNotification.link } : {}),
        ...(newNotification.actionType === "route" && newNotification.route ? { route: newNotification.route } : {}),
      },
    };
    try {
  const res = await fetch("/api/v1/notification/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setScheduleStatus("Notification scheduled successfully.");
        setNewNotification({ title: "", message: "", schedule: "", customDate: "", customTime: "", platform: "both", actionType: "text", link: "", route: "" });
        fetchScheduledNotifications();
      } else {
        setScheduleStatus("Failed to schedule notification.");
      }
    } catch {
      setScheduleStatus("Network error. Please try again.");
    }
    setScheduleLoading(false);
  };


  // Remove scheduled notification from backend
  const handleRemoveScheduledNotification = async (id: string) => {
    setCancelLoadingId(id);
    try {
  await fetch(`/api/v1/notification/scheduled/${id}`, { method: "DELETE" });
      fetchScheduledNotifications();
    } catch {}
    setCancelLoadingId(null);
  };

  // Save YouTube settings to backend
  const handleSaveYoutubeSettings = async () => {
    if (envOverride) return;
    setLoading(true);
    setSaveStatus(null);
    try {
  const res = await fetch("/api/v1/notification/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          STREAM_NOTIFICATION_TITLE: youtubeLiveTitle,
          STREAM_NOTIFICATION_MESSAGE: streamNotificationMessage,
        }),
      });
      if (res.ok) {
        setSaveStatus("Settings saved successfully.");
      } else {
        const data = await res.json();
        setSaveStatus(data.detail || "Error saving settings.");
      }
    } catch (err) {
      setSaveStatus("Network error. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Manage Notifications</h1>

      {/* YouTube Channel Setup */}
      <div className="mb-6">
        {saveStatus && (
          <div className={`mb-2 p-2 rounded ${saveStatus.includes('success') ? 'bg-green-100 text-green-800 border border-green-400' : 'bg-red-100 text-red-800 border border-red-400'}`}>
            {saveStatus}
          </div>
        )}
        <h2 className="text-xl font-semibold mb-2">YouTube Live Notifications Setting</h2>
        <div className="mb-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Livestream Notification Title</label>
          <input
            type="text"
            placeholder="Livestream Notification Title"
            value={youtubeLiveTitle || "Live Stream Started"}
            onChange={(e) => setYoutubeLiveTitle(e.target.value)}
            className="border p-2 w-full mb-2"
            disabled={envOverride}
          />
        </div>
        <div className="mb-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Stream Notification Message</label>
          <input
            type="text"
            placeholder="Stream Notification Message"
            value={streamNotificationMessage}
            onChange={(e) => setStreamNotificationMessage(e.target.value)}
            className="border p-2 w-full mb-2"
            disabled={envOverride}
          />
        </div>
        <div className="mb-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Time Zone (from backend)</label>
          <input
            type="text"
            value={selectedTimezone}
            className="border p-2 w-full mb-2 bg-gray-100"
            disabled
          />
        </div>
        <button
          className="mt-2 bg-blue-500 text-white px-4 py-2 rounded"
          onClick={handleSaveYoutubeSettings}
          disabled={loading || envOverride}
        >
          {envOverride ? "Edit in .env" : loading ? "Saving..." : "Save Stream Notification Message"}
        </button>
      </div>

      {/* Notification Scheduling */}
      <h2 className="text-xl font-semibold mb-2">Schedule Notifications</h2>
      {scheduleStatus && (
        <div className={`mb-2 p-2 rounded ${scheduleStatus.includes('success') ? 'bg-green-100 text-green-800 border border-green-400' : 'bg-red-100 text-red-800 border border-red-400'}`}>
          {scheduleStatus}
        </div>
      )}
      {formError && (
        <div className="mb-2 p-2 rounded bg-red-100 text-red-800 border border-red-400">
          {formError}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Action Type</label>
          <select
            value={newNotification.actionType}
            onChange={e => setNewNotification({ ...newNotification, actionType: e.target.value as "text" | "link" | "route" })}
            className="border p-2 w-full"
          >
            <option value="text">Text Only (default)</option>
            <option value="link">Open Link (external)</option>
            <option value="route">Go to Page (in-app)</option>
          </select>
        </div>
        {newNotification.actionType === "link" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Link</label>
            <input
              type="text"
              placeholder="Link (e.g. https://...)"
              value={newNotification.link || ""}
              onChange={e => setNewNotification({ ...newNotification, link: e.target.value })}
              className="border p-2 w-full"
            />
          </div>
        )}
        {newNotification.actionType === "route" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Page Route</label>
            <input
              type="text"
              placeholder="Page route (e.g. /profile, /events)"
              value={newNotification.route || ""}
              onChange={e => setNewNotification({ ...newNotification, route: e.target.value })}
              className="border p-2 w-full"
            />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input
            type="text"
            placeholder="Title"
            value={newNotification.title}
            onChange={(e) => setNewNotification({ ...newNotification, title: e.target.value })}
            className="border p-2 w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
          <input
            type="text"
            placeholder="Message"
            value={newNotification.message}
            onChange={(e) => setNewNotification({ ...newNotification, message: e.target.value })}
            className="border p-2 w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
          <select
            value={newNotification.schedule}
            onChange={(e) => setNewNotification({ ...newNotification, schedule: e.target.value })}
            className="border p-2 w-full"
          >
            <option value="">Select Time</option>
            <option value="now">Now</option>
            <option value="custom">Custom...</option>
          </select>
        </div>
        {newNotification.schedule === "custom" && (
          <div className="flex gap-2 items-center">
            <label className="text-sm font-medium text-gray-700">Select Date:</label>
            <input
              type="date"
              value={newNotification.customDate || ""}
              onChange={(e) => setNewNotification({ ...newNotification, customDate: e.target.value })}
              className="border p-2 rounded"
              style={{ minWidth: 140 }}
            />
            <label className="text-sm font-medium text-gray-700">Time:</label>
            <input
              type="time"
              value={newNotification.customTime || ""}
              onChange={(e) => setNewNotification({ ...newNotification, customTime: e.target.value })}
              className="border p-2 rounded"
              style={{ minWidth: 100 }}
            />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
          <select
            value={targetAudience}
            onChange={e => setTargetAudience(e.target.value as "all" | "logged_in" | "anonymous")}
            className="border p-2 w-full"
          >
            <option value="all">All Users</option>
            <option value="logged_in">Logged-in Users</option>
            <option value="anonymous">Anonymous Users</option>
          </select>
        </div>
        <button
          className="bg-green-500 text-white px-4 py-2 rounded w-full"
          onClick={handleAddNotification}
          disabled={scheduleLoading || isCustomPast}
        >
          {isCustomPast ? "Cannot schedule in the past" : scheduleLoading ? "Scheduling..." : "Add Notification"}
        </button>
      </div>

      {/* Notification List Tabs */}
      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-2">Notification List</h2>
        <Tabs
          value={activeTab}
          onChange={(_event: React.SyntheticEvent, value: 'scheduled' | 'history') => {
            setActiveTab(value);
            if (value === 'scheduled') {
              fetchScheduledNotifications();
            } else if (value === 'history') {
              fetchNotificationHistory();
            }
          }}
          className="mb-4"
        >
          <Tab label="Scheduled" value="scheduled" />
          <Tab label="History" value="history" />
        </Tabs>
        {activeTab === 'scheduled' && (
          <table className="w-full border-collapse border border-gray-300 mt-4">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">Time</th>
                <th className="border p-2">Title</th>
                <th className="border p-2">Message</th>
                <th className="border p-2">Link</th>
                <th className="border p-2">Recipients</th>
                <th className="border p-2">Status</th>
                <th className="border p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {scheduledNotifications.map((n, idx) => (
                <tr key={n._id || idx} className="border">
                  <td className="p-2 border">{n.scheduled_time ? new Date(n.scheduled_time).toLocaleString('en-US', { timeZone: selectedTimezone }) : "-"}</td>
                  <td className="p-2 border">{n.title}</td>
                  <td className="p-2 border">{n.body}</td>
                  <td className="p-2 border">{n.link || n.data?.link || n.route || n.data?.route || '-'}</td>
                  <td className="p-2 border">All</td>
                  <td className="p-2 border text-center">
                    {n.canceled ? (
                      <span title="Canceled" style={{color: '#e53e3e'}}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="inline" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </span>
                    ) : n.sent ? (
                      <span title="Successfully sent" style={{color: '#38a169'}}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="inline" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      </span>
                    ) : (
                      <span title="Pending" style={{color: '#ecc94b'}}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="inline" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" /></svg>
                      </span>
                    )}
                  </td>
                  <td className="p-2 border">
                    {!n.sent && !n.canceled && (
                      <button
                        className={`bg-red-500 text-white px-3 py-1 rounded ${cancelLoadingId === n._id ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={() => handleRemoveScheduledNotification(n._id)}
                        disabled={cancelLoadingId === n._id}
                      >
                        {cancelLoadingId === n._id ? "Canceling..." : "Remove"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {activeTab === 'history' && (
          <table className="w-full border-collapse border border-gray-300 mt-4">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">Time</th>
                <th className="border p-2">Title</th>
                <th className="border p-2">Message</th>
                <th className="border p-2">Link</th>
                <th className="border p-2">Recipients</th>
                <th className="border p-2">Status</th>
                <th className="border p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...notificationHistory]
                .sort((a, b) => {
                  // Prefer sent_at, then scheduled_time, then timestamp
                  const getTime = (n: any) => n.sent_at || n.scheduled_time || n.timestamp || 0;
                  return new Date(getTime(b)).getTime() - new Date(getTime(a)).getTime();
                })
                .map((n, idx) => (
                  <tr key={n.id || idx} className="border">
                    <td className="p-2 border">{n.scheduled_time ? new Date(n.scheduled_time).toLocaleString('en-US', { timeZone: selectedTimezone }) : (n.timestamp ? new Date(n.timestamp).toLocaleString('en-US', { timeZone: selectedTimezone }) : "-")}</td>
                    <td className="p-2 border">{n.title}</td>
                    <td className="p-2 border">{n.message || n.body || (n.data?.message) || '-'}</td>
                    <td className="p-2 border">
                      {n.link || n.data?.link ? (
                        <a
                          href={n.link || n.data?.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 underline"
                        >
                          {n.link || n.data?.link}
                        </a>
                      ) : n.route || n.data?.route ? (
                        <span>{n.route || n.data?.route}</span>
                      ) : '-'}
                    </td>
                    <td className="p-2 border">{Array.isArray(n.recipients) ? n.recipients.length : 1}</td>
                    <td className="p-2 border text-center">
                      <span title="Successfully sent" style={{color: '#38a169'}}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="inline" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      </span>
                    </td>
                    <td className="p-2 border">-</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Notification;