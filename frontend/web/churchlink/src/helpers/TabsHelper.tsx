import { api } from "@/api";

export interface AppTab {
  index: number;
  name: string;
  displayName: string;
  icon?: string;
}

// Default tab structure (fallback)
export const DEFAULT_TABS: AppTab[] = [
  { index: 0, name: 'home', displayName: 'Home' },
  { index: 1, name: 'bible', displayName: 'Bible' },
  { index: 2, name: 'sermons', displayName: 'Sermons' },
  { index: 3, name: 'events', displayName: 'Events' },
  { index: 4, name: 'profile', displayName: 'Profile' },
];

// API call to get tabs from backend
export const getAvailableTabs = async (): Promise<AppTab[]> => {
  try {
    // Try to fetch from the new API endpoint
    const response = await api.get('/v1/app/tabs');
    return response.data.map((tab: any) => ({
      index: tab.index,
      name: tab.name,
      displayName: tab.displayName,
      icon: tab.icon
    }));
  } catch (error) {
    console.error('Failed to fetch tabs:', error);
    return DEFAULT_TABS;
  }
};

export const getTabByIndex = (index: number): AppTab | undefined => {
  return DEFAULT_TABS.find(tab => tab.index === index);
};

export const getTabByName = (name: string): AppTab | undefined => {
  return DEFAULT_TABS.find(tab => tab.name.toLowerCase() === name.toLowerCase());
};

export const saveTabConfiguration = async (tabs: AppTab[]): Promise<boolean> => {
  try {
    const response = await api.post('/v1/app/tabs', tabs);
    return response.status >= 200 && response.status < 300;
  } catch (error) {
    console.error('Failed to save tab configuration:', error);
    return false;
  }
};