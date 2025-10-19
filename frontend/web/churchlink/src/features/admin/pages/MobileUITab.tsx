import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Save, ArrowUp, ArrowDown } from "lucide-react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { getAvailableTabs, saveTabConfiguration, AppTab } from "../../../helpers/TabsHelper";

interface EditingTab extends AppTab {
  isNew?: boolean;
}

// Predefined allowed tabs that can be added
const ALLOWED_TABS = [
  { name: 'home', displayName: 'Home', icon: 'home' },
  { name: 'live', displayName: 'Live', icon: 'live_tv' },
  { name: 'bulletin', displayName: 'Weekly Bulletin', icon: 'article' },
  { name: 'events', displayName: 'Events', icon: 'event' },
  { name: 'giving', displayName: 'Giving', icon: 'volunteer_activism' },
  { name: 'ministries', displayName: 'Ministries', icon: 'groups' },
  { name: 'contact', displayName: 'Contact Us', icon: 'contact_mail' },
  { name: 'sermons', displayName: 'Sermons', icon: 'church' },
  { name: 'bible', displayName: 'Bible', icon: 'menu_book' },
  { name: 'profile', displayName: 'Profile', icon: 'person' }
];

const MobileUITab = () => {
  const [tabs, setTabs] = useState<AppTab[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingTab, setEditingTab] = useState<EditingTab | null>(null);
  const [selectedTabToAdd, setSelectedTabToAdd] = useState<string>("");

  useEffect(() => {
    loadTabs();
  }, []);

  const loadTabs = async () => {
    setLoading(true);
    setError(null);
    try {
      const tabData = await getAvailableTabs();
      const processedTabs = [...tabData];
      const homeTabIndex = processedTabs.findIndex(tab => tab.name.toLowerCase() === 'home');
      if (homeTabIndex === -1) {
        processedTabs.unshift({
          index: 0,
          name: 'home',
          displayName: 'Home',
          icon: 'home'
        });
      } else if (homeTabIndex !== 0) {
        const homeTab = processedTabs.splice(homeTabIndex, 1)[0];
        homeTab.index = 0;
        processedTabs.unshift(homeTab);
      }
      processedTabs.forEach((tab, index) => {
        tab.index = index;
      });
      setTabs(processedTabs);
    } catch (err) {
      setError("Failed to load tabs");
      setTabs([{
        index: 0,
        name: 'home',
        displayName: 'Home',
        icon: 'home'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const saveTabs = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const success = await saveTabConfiguration(tabs);
      if (success) {
        setSuccess("Tab configuration saved successfully!");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        throw new Error("Failed to save tabs");
      }
    } catch (err: any) {
      setError(err.message || "Failed to save tabs");
    } finally {
      setSaving(false);
    }
  };

  const handleAddTab = (tabName: string) => {
    if (tabs.length >= 5) {
      setError("Maximum 5 tabs allowed due to Flutter BottomNavigationBar limitations");
      return;
    }
    const allowedTab = ALLOWED_TABS.find(t => t.name === tabName);
    if (!allowedTab) {
      setError("Invalid tab selection");
      return;
    }
    const exists = tabs.some(tab => tab.name.toLowerCase() === tabName.toLowerCase());
    if (exists) {
      setError("Tab already exists");
      return;
    }
    const newIndex = tabs.length;
    setEditingTab({
      index: newIndex,
      name: allowedTab.name,
      displayName: allowedTab.displayName,
      icon: allowedTab.icon,
      isNew: true
    });
    setSelectedTabToAdd("");
  };

  const getAvailableTabsToAdd = () => {
    return ALLOWED_TABS.filter(allowedTab => 
      !tabs.some(tab => tab.name.toLowerCase() === allowedTab.name.toLowerCase())
    );
  };

  const _getIconEmoji = (iconName: string): string => {
    switch (iconName?.toLowerCase()) {
      case 'home': return '🏠';
      case 'live_tv': 
      case 'live': return '📺';
      case 'article': 
      case 'bulletin': return '📄';
      case 'event': 
      case 'events': return '📅';
      case 'volunteer_activism': 
      case 'giving': return '🤝';
      case 'groups': 
      case 'ministries': return '👥';
      case 'contact_mail': 
      case 'contact': return '📧';
      case 'play_circle': 
      case 'church':
      case 'sermons': return '✝️';
      case 'menu_book': 
      case 'bible': return '📖';
      case 'person': 
      case 'profile': return '👤';
      default: return '📱';
    }
  };

  const handleEditTab = (tab: AppTab) => {
    setEditingTab({ ...tab });
  };

  const handleDeleteTab = (index: number) => {
    const tab = tabs.find(t => t.index === index);
    if (tab?.name.toLowerCase() === 'home') {
      setError("Home tab cannot be deleted as it is required");
      return;
    }
    if (confirm("Are you sure you want to delete this tab?")) {
      const newTabs = tabs.filter(tab => tab.index !== index);
      newTabs.forEach((tab, idx) => {
        tab.index = idx;
      });
      setTabs(newTabs);
    }
  };

  const handleMoveTab = (index: number, direction: 'up' | 'down') => {
    const tabIndex = tabs.findIndex(tab => tab.index === index);
    const tab = tabs[tabIndex];
    if (tab?.name.toLowerCase() === 'home' && direction === 'up') {
      setError("Home tab must remain in the first position");
      return;
    }
    if (direction === 'up' && tabIndex === 1) {
      const homeTab = tabs[0];
      if (homeTab?.name.toLowerCase() === 'home') {
        setError("No tab can be moved above the Home tab");
        return;
      }
    }
    const newTabs = [...tabs];
    if (direction === 'up' && tabIndex > 0) {
      [newTabs[tabIndex], newTabs[tabIndex - 1]] = [newTabs[tabIndex - 1], newTabs[tabIndex]];
    } else if (direction === 'down' && tabIndex < newTabs.length - 1) {
      [newTabs[tabIndex], newTabs[tabIndex + 1]] = [newTabs[tabIndex + 1], newTabs[tabIndex]];
    }
    newTabs.forEach((tab, idx) => {
      tab.index = idx;
    });
    setTabs(newTabs);
    setTimeout(() => setError(null), 3000);
  };

  const handleSaveEdit = () => {
    if (!editingTab || !editingTab.name || !editingTab.displayName) {
      setError("Name and Display Name are required");
      return;
    }
    if (editingTab.isNew) {
      const exists = tabs.some(tab => 
        tab.name.toLowerCase() === editingTab.name.toLowerCase() || 
        tab.index === editingTab.index
      );
      if (exists) {
        setError("Tab name or index already exists");
        return;
      }
      setTabs([...tabs, { ...editingTab, isNew: undefined }].sort((a, b) => a.index - b.index));
    } else {
      setTabs(tabs.map(tab => 
        tab.index === editingTab.index 
          ? { ...editingTab, isNew: undefined }
          : tab
      ));
    }
    setEditingTab(null);
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingTab(null);
    setError(null);
  };

  if (loading) {
    return (
      <div className="p-6 bg-background text-foreground">
        <h1 className="text-3xl font-bold mb-6">Mobile UI Tab</h1>
        <div className="text-center py-8">
          <Skeleton className="h-8 w-1/3 mx-auto" />
          <Skeleton className="h-48 w-full mt-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background text-foreground">
      <h1 className="text-3xl font-bold mb-6">Mobile UI Tab</h1>
      {/* Tab Management Section */}
      <div className="bg-card text-card-foreground border border-border rounded-lg shadow-sm p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">App Tab Configuration</h2>
          <div className="flex gap-2 items-center">
            <div className="relative">
              <select
                value={selectedTabToAdd}
                onChange={(e) => setSelectedTabToAdd(e.target.value)}
                disabled={!!editingTab || tabs.length >= 5}
                className="w-[260px] appearance-none bg-background text-foreground
                  border border-input rounded-md px-3 py-2 pr-10 shadow-sm
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                  focus-visible:ring-offset-2 focus-visible:ring-offset-background
                  disabled:bg-muted disabled:text-muted-foreground disabled:border-border
                  disabled:cursor-not-allowed disabled:opacity-70"
              >
                <option value="" disabled={tabs.length >= 5}>
                  {tabs.length >= 5 ? "Maximum 5 tabs reached" : "Select tab to add..."}
                </option>
                {getAvailableTabsToAdd().map((tab) => (
                  <option key={tab.name} value={tab.name}>
                    {tab.displayName}
                  </option>
                ))}
              </select>
              {/* Chevron icon */}
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.08 1.04l-4.25 4.25a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06z" />
              </svg>
            </div>
            <button
              onClick={() => {
                if (selectedTabToAdd) {
                  handleAddTab(selectedTabToAdd);
                }
              }}
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 flex items-center gap-2 disabled:bg-gray-400"
              disabled={!!editingTab || !selectedTabToAdd || tabs.length >= 5}
            >
              <Plus size={16} />
              Add Tab
            </button>
            <button
              onClick={saveTabs}
              className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 flex items-center gap-2"
              disabled={saving || !!editingTab}
            >
              <Save size={16} />
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        <div className="mb-4 p-3 bg-muted border border-border rounded-md">
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> The Home tab is fixed at the first position and cannot be moved or deleted. You can add up to 5 tabs total (Flutter BottomNavigationBar limit) from the predefined list: Live, Weekly Bulletin, Events, Giving, Ministries, Contact Us, Sermons, Bible, and Profile. Use the dropdown above to select and add new tabs, then arrange them in your desired order.
          </p>
          <div className="mt-2 p-2 bg-muted/50 rounded">
            <p className="text-xs text-muted-foreground">
              <strong>Icons:</strong> Home (🏠), Live (📺), Bulletin (📄), Events (📅), Giving (🤝), Ministries (👥), Contact (📧), Sermons (✝️), Bible (📖), Profile (👤)
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/50 text-destructive px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-primary/10 border border-primary/50 text-foreground px-4 py-3 rounded mb-4">
            {success}
          </div>
        )}

        {/* Editing Form */}
        {editingTab && (
          <div className="bg-muted border border-border rounded-md p-4 mb-4">
            <h3 className="text-lg font-medium mb-3">{editingTab.isNew ? "Add New Tab" : "Edit Tab"}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Index</label>
                <input
                  type="number"
                  value={editingTab.index}
                  onChange={(e) => setEditingTab({ ...editingTab, index: parseInt(e.target.value) })}
                  className="border border-input bg-muted text-foreground rounded px-3 py-2 w-full"
                  min="0"
                  disabled
                />
                <small className="text-muted-foreground">Index is automatically assigned</small>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Name (Internal)</label>
                <input
                  type="text"
                  value={editingTab.name}
                  onChange={(e) => setEditingTab({ ...editingTab, name: e.target.value.toLowerCase() })}
                  className="border border-input bg-muted text-foreground rounded px-3 py-2 w-full"
                  placeholder="home, bible, sermons, etc."
                  disabled
                />
                <small className="text-muted-foreground">Name is predefined and cannot be changed</small>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Display Name</label>
                <input
                  type="text"
                  value={editingTab.displayName}
                  onChange={(e) => setEditingTab({ ...editingTab, displayName: e.target.value })}
                  className="border border-input bg-background text-foreground rounded px-3 py-2 w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  placeholder="Home, Bible, Sermons, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Icon</label>
                <input
                  type="text"
                  value={editingTab.icon || ""}
                  onChange={(e) => setEditingTab({ ...editingTab, icon: e.target.value })}
                  className="border border-input bg-muted text-foreground rounded px-3 py-2 w-full"
                  placeholder="home, bible, event, etc."
                  disabled
                />
                <small className="text-muted-foreground">Icon is predefined and cannot be changed</small>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSaveEdit}
                className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90"
              >
                Save
              </button>
              <button
                onClick={handleCancelEdit}
                className="bg-secondary text-secondary-foreground px-4 py-2 rounded hover:bg-secondary/90"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Tabs List */}
        <div className="space-y-2">
          {tabs.map((tab, idx) => {
            const isHomeTab = tab.name.toLowerCase() === "home";
            return (
              <div
                key={tab.index}
                className={`flex items-center gap-4 p-3 border border-border rounded-md ${
                  isHomeTab ? "bg-muted/40" : "bg-muted/20"
                }`}
              >
                {isHomeTab && <div className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">FIXED</div>}

                <div className="flex flex-col">
                  <button
                    onClick={() => handleMoveTab(tab.index, "up")}
                    disabled={idx === 0 || isHomeTab}
                    className="text-gray-500 hover:text-gray-700 disabled:opacity-30"
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    onClick={() => handleMoveTab(tab.index, "down")}
                    disabled={idx === tabs.length - 1 || isHomeTab}
                    className="text-gray-500 hover:text-gray-700 disabled:opacity-30"
                  >
                    <ArrowDown size={16} />
                  </button>
                </div>

                <div className="flex-1 grid grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Index</div>
                    <div className="font-medium">{tab.index}</div>
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground">Name</div>
                    <div className="font-medium">{tab.name}</div>
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground">Display Name</div>
                    <div className="font-medium">{tab.displayName}</div>
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground">Icon</div>
                    <div className="font-medium flex items-center gap-2">
                      <span>{_getIconEmoji(tab.icon || tab.name)}</span>
                      <span>{tab.icon || "—"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditTab(tab)}
                    className="text-primary hover:opacity-90"
                    disabled={!!editingTab}
                    title={isHomeTab ? "Edit display name only" : "Edit tab"}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteTab(tab.index)}
                    className={`${
                      isHomeTab ? "text-muted-foreground/40 cursor-not-allowed" : "text-destructive hover:opacity-90"
                    }`}
                    disabled={!!editingTab || isHomeTab}
                    title={isHomeTab ? "Home tab cannot be deleted" : "Delete tab"}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {tabs.length === 0 && !editingTab && (
          <div className="text-center py-8 text-muted-foreground">No tabs configured. Click "Add Tab" to create your first tab.</div>
        )}
      </div>

      {/* Future Settings Sections */}
      <div className="bg-card text-card-foreground border border-border rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold mb-4">Other Settings</h2>
        <p className="text-muted-foreground">Additional settings can be added here in the future.</p>
      </div>
    </div>
  );
};

export default MobileUITab;
