import { useState, useEffect, useCallback, useMemo } from "react";
import { Tab, Tabs } from "@mui/material";
import {
  NotificationActionType,
  NotificationTarget,
  ScheduledNotification,
  HistoryNotification,
  getNotificationSettings,
  saveNotificationSettings,
  getScheduledNotifications,
  getNotificationHistory,
  scheduleNotification,
  deleteScheduledNotification,
  tzDateTimeToUTCISO,
} from "../../../helpers/NotificationHelper";

type ActiveTab = "scheduled" | "history";

interface DraftNotification {
  title: string;
  message: string;
  schedule: "" | "now" | "custom";
  customDate: string;
  customTime: string;
  platform: "mobile" | "email" | "both"; // keeping for parity even if not used server-side
  actionType: NotificationActionType;
  link?: string;
  route?: string;
}

const Notification = () => {
  // --- Settings ---
  const [youtubeLiveTitle, setYoutubeLiveTitle] = useState<string>("Live Stream Started");
  const [streamNotificationMessage, setStreamNotificationMessage] = useState<string>("A new stream is live!");
  const [selectedTimezone, setSelectedTimezone] = useState<string>("America/Los_Angeles");
  const [envOverride, setEnvOverride] = useState<boolean>(false);

  // --- UI / State ---
  const [activeTab, setActiveTab] = useState<ActiveTab>("scheduled");
  const [scheduledNotifications, setScheduledNotifications] = useState<ScheduledNotification[]>([]);
  const [notificationHistory, setNotificationHistory] = useState<HistoryNotification[]>([]);
  const [targetAudience, setTargetAudience] = useState<NotificationTarget>("all");

  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState<string | null>(null);
  const [cancelLoadingId, setCancelLoadingId] = useState<string | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [newNotification, setNewNotification] = useState<DraftNotification>({
    title: "",
    message: "",
    schedule: "",
    customDate: "",
    customTime: "",
    platform: "mobile",
    actionType: "text",
    link: "",
    route: "",
  });

  // --- Derived / Validation ---
  const isCustomPast = useMemo(() => {
    if (newNotification.schedule !== "custom") return false;
    if (!newNotification.customDate || !newNotification.customTime) return false;

    try {
      const iso = tzDateTimeToUTCISO(newNotification.customDate, newNotification.customTime, selectedTimezone);
      return new Date(iso).getTime() < Date.now();
    } catch {
      return false;
    }
  }, [newNotification.schedule, newNotification.customDate, newNotification.customTime, selectedTimezone]);

  // --- Init settings ---
  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      try {
        const s = await getNotificationSettings();
        if (ignore) return;
        setStreamNotificationMessage(s.streamNotificationMessage || "A new stream is live!");
        setYoutubeLiveTitle(s.streamNotificationTitle || "Live Stream Started");
        setSelectedTimezone(s.YOUTUBE_TIMEZONE || "America/Los_Angeles");
        setEnvOverride(!!s.envOverride);
      } catch {
        // leave defaults
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  // --- Fetchers ---
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotificationHistory();
      setNotificationHistory(data);
    } catch {
      setNotificationHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchScheduled = useCallback(async () => {
    try {
      const data = await getScheduledNotifications();
      setScheduledNotifications(data);
    } catch {
      setScheduledNotifications([]);
    }
  }, []);

  // initial loads
  useEffect(() => {
    fetchHistory();
    fetchScheduled();
  }, [fetchHistory, fetchScheduled]);

  // poll while on "scheduled"
  useEffect(() => {
    if (activeTab !== "scheduled") return;
    const id = setInterval(fetchScheduled, 10_000);
    return () => clearInterval(id);
  }, [activeTab, fetchScheduled]);

  // --- Actions ---
  const handleSaveYoutubeSettings = async () => {
    if (envOverride) return;
    setLoading(true);
    setSaveStatus(null);
    try {
      await saveNotificationSettings({
        streamNotificationTitle: youtubeLiveTitle,
        streamNotificationMessage,
      });
      setSaveStatus("Settings saved successfully.");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setSaveStatus(detail || "Error saving settings.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddNotification = async () => {
    setFormError(null);
    setScheduleStatus(null);
    setScheduleLoading(true);

    if (!newNotification.title.trim()) {
      setFormError("Title is required.");
      setScheduleLoading(false);
      return;
    }
    if (!newNotification.message.trim()) {
      setFormError("Message is required.");
      setScheduleLoading(false);
      return;
    }
    if (!newNotification.schedule) {
      setFormError("Schedule time is required.");
      setScheduleLoading(false);
      return;
    }
    if (newNotification.actionType === "link" && !newNotification.link?.trim()) {
      setFormError("Link is required for link action.");
      setScheduleLoading(false);
      return;
    }
    if (newNotification.actionType === "route" && !newNotification.route?.trim()) {
      setFormError("Route is required for route action.");
      setScheduleLoading(false);
      return;
    }
    if (newNotification.schedule === "custom" && (!newNotification.customDate || !newNotification.customTime)) {
      setFormError("Custom date and time are required.");
      setScheduleLoading(false);
      return;
    }
    if (isCustomPast) {
      setFormError("Custom time cannot be in the past.");
      setScheduleLoading(false);
      return;
    }

    let scheduled_time = "";
    if (newNotification.schedule === "now") {
      scheduled_time = new Date().toISOString();
    } else if (newNotification.schedule === "custom") {
      scheduled_time = tzDateTimeToUTCISO(
        newNotification.customDate,
        newNotification.customTime,
        selectedTimezone
      );
    }

    const payload = {
      title: newNotification.title,
      body: newNotification.message,
      scheduled_time,
      target: targetAudience,
      actionType: newNotification.actionType,
      link: newNotification.link || undefined,
      route: newNotification.route || undefined,
      data: {
        ...(newNotification.actionType === "link" && newNotification.link ? { link: newNotification.link } : {}),
        ...(newNotification.actionType === "route" && newNotification.route ? { route: newNotification.route } : {}),
      },
    };

    try {
      const res = await scheduleNotification(payload);
      if (res.status >= 200 && res.status < 300) {
        setScheduleStatus("Notification scheduled successfully.");
        setNewNotification({
          title: "",
          message: "",
          schedule: "",
          customDate: "",
          customTime: "",
          platform: "both",
          actionType: "text",
          link: "",
          route: "",
        });
        fetchScheduled();
      } else {
        setScheduleStatus("Failed to schedule notification.");
      }
    } catch {
      setScheduleStatus("Network error. Please try again.");
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleRemoveScheduledNotification = async (id: string) => {
    setCancelLoadingId(id);
    try {
      await deleteScheduledNotification(id);
      fetchScheduled();
    } catch {
      // noop
    } finally {
      setCancelLoadingId(null);
    }
  };

  // --- Render ---

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Manage Notifications</h1>

      {/* YouTube Channel Setup */}
      <div className="mb-6">
        {saveStatus && (
          <div
            className={`mb-2 p-2 rounded ${saveStatus.toLowerCase().includes("success")
              ? "bg-green-100 text-green-800 border border-green-400"
              : "bg-red-100 text-red-800 border border-red-400"
              }`}
          >
            {saveStatus}
          </div>
        )}
        <h2 className="text-xl font-semibold mb-2">YouTube Live Notifications Setting</h2>
        <div className="mb-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Livestream Notification Title</label>
          <input
            type="text"
            placeholder="Livestream Notification Title"
            value={youtubeLiveTitle}
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
          <input type="text" value={selectedTimezone} className="border p-2 w-full mb-2 bg-gray-100" disabled />
        </div>
        <button
          className="mt-2 bg-blue-500 text-white px-4 py-2 rounded"
          onClick={handleSaveYoutubeSettings}
          disabled={loading || envOverride}
        >
          {envOverride ? "Edit in .env" : loading ? "Saving..." : "Save Stream Notification Message"}
        </button>
      </div>

      {/* Scheduling */}
      <h2 className="text-xl font-semibold mb-2">Schedule Notifications</h2>
      {scheduleStatus && (
        <div
          className={`mb-2 p-2 rounded ${scheduleStatus.toLowerCase().includes("success")
            ? "bg-green-100 text-green-800 border border-green-400"
            : "bg-red-100 text-red-800 border border-red-400"
            }`}
        >
          {scheduleStatus}
        </div>
      )}
      {formError && <div className="mb-2 p-2 rounded bg-red-100 text-red-800 border border-red-400">{formError}</div>}

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Action Type</label>
          <select
            value={newNotification.actionType}
            onChange={(e) =>
              setNewNotification({ ...newNotification, actionType: e.target.value as NotificationActionType })
            }
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
              onChange={(e) => setNewNotification({ ...newNotification, link: e.target.value })}
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
              onChange={(e) => setNewNotification({ ...newNotification, route: e.target.value })}
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
            onChange={(e) => setNewNotification({ ...newNotification, schedule: e.target.value as DraftNotification["schedule"] })}
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
              value={newNotification.customDate}
              onChange={(e) => setNewNotification({ ...newNotification, customDate: e.target.value })}
              className="border p-2 rounded"
              style={{ minWidth: 140 }}
            />
            <label className="text-sm font-medium text-gray-700">Time:</label>
            <input
              type="time"
              value={newNotification.customTime}
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
            onChange={(e) => setTargetAudience(e.target.value as NotificationTarget)}
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

      {/* Tables */}
      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-2">Notification List</h2>
        <Tabs
          value={activeTab}
          onChange={(_e, v: ActiveTab) => {
            setActiveTab(v);
            if (v === "scheduled") fetchScheduled();
            if (v === "history") fetchHistory();
          }}
          className="mb-4"
        >
          <Tab label="Scheduled" value="scheduled" />
          <Tab label="History" value="history" />
        </Tabs>

        {activeTab === "scheduled" && (
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
              {scheduledNotifications.map((n) => (
                <tr key={n._id} className="border">
                  <td className="p-2 border">
                    {n.scheduled_time
                      ? new Date(n.scheduled_time).toLocaleString("en-US", { timeZone: selectedTimezone })
                      : "-"}
                  </td>
                  <td className="p-2 border">{n.title}</td>
                  <td className="p-2 border">{n.body}</td>
                  <td className="p-2 border">{String(n.link || n.data?.link || n.route || n.data?.route || "-")}</td>
                  <td className="p-2 border">All</td>
                  <td className="p-2 border text-center">
                    {n.canceled ? (
                      <span title="Canceled" style={{ color: "#e53e3e" }}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="inline" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </span>
                    ) : n.sent ? (
                      <span title="Successfully sent" style={{ color: "#38a169" }}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="inline" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      </span>
                    ) : (
                      <span title="Pending" style={{ color: "#ecc94b" }}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="inline" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" /></svg>
                      </span>
                    )}
                  </td>
                  <td className="p-2 border">
                    {!n.sent && !n.canceled && (
                      <button
                        className={`bg-red-500 text-white px-3 py-1 rounded ${cancelLoadingId === n._id ? "opacity-50 cursor-not-allowed" : ""}`}
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

        {activeTab === "history" && (
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
                  const getTime = (n: HistoryNotification) => n.sent_at || n.scheduled_time || n.timestamp || 0;
                  return new Date(getTime(b) as string).getTime() - new Date(getTime(a) as string).getTime();
                })
                .map((n, idx) => {
                  const timeString = n.scheduled_time || n.timestamp || n.sent_at || "";
                  const msg = n.message || n.body || (n.data as any)?.message || "-";
                  const link = (n.link || (n.data as any)?.link) ?? null;
                  const route = (n.route || (n.data as any)?.route) ?? null;

                  return (
                    <tr key={(n.id as any) || n._id || idx} className="border">
                      <td className="p-2 border">
                        {timeString ? new Date(timeString).toLocaleString("en-US", { timeZone: selectedTimezone }) : "-"}
                      </td>
                      <td className="p-2 border">{n.title}</td>
                      <td className="p-2 border">{msg}</td>
                      <td className="p-2 border">
                        {link ? (
                          <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                            {link}
                          </a>
                        ) : route ? (
                          <span>{route}</span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="p-2 border">
                        {Array.isArray(n.recipients) ? n.recipients.length : 1}
                      </td>
                      <td className="p-2 border text-center">
                        <span title="Successfully sent" style={{ color: "#38a169" }}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="inline" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        </span>
                      </td>
                      <td className="p-2 border">-</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Notification;
