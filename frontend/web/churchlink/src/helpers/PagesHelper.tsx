import { api } from "@/api";

// Dashboard page model
export interface DashboardPage {
  index: number;
  pageName: string;
  displayName: string;
  imageId?: string;   // References image_data _id
  enabled?: boolean;
}

// Default dashboard page structure (fallback)
export const DEFAULT_DASHBOARD_PAGES: DashboardPage[] = [
  { index: 0, pageName: "overview", displayName: "Overview" },
  { index: 1, pageName: "reports", displayName: "Reports" },
  { index: 2, pageName: "analytics", displayName: "Analytics" },
  { index: 3, pageName: "settings", displayName: "Settings" },
];

// Fetch all dashboard pages from backend
export const getDashboardPages = async (): Promise<DashboardPage[]> => {
  try {
    const response = await api.get("/v1/app/dashboard/pages");
    return response.data.map((page: any) => ({
      index: page.index,
      pageName: page.page_name || page.pageName,
      displayName: page.display_name || page.displayName,
      imageId: page.image_id || page.imageId,
      enabled: page.enabled ?? true,
    }));
  } catch (error) {
    console.error("Failed to fetch dashboard pages:", error);
    return DEFAULT_DASHBOARD_PAGES;
  }
};

// Fetch a specific dashboard page by index
export const getDashboardPageByIndex = async (
  index: number
): Promise<DashboardPage | undefined> => {
  try {
    const response = await api.get(`/v1/app/dashboard/pages/${index}`);
    const page = response.data;
    return {
      index: page.index,
      pageName: page.page_name || page.pageName,
      displayName: page.display_name || page.displayName,
      imageId: page.image_id || page.imageId,
      enabled: page.enabled ?? true,
    };
  } catch (error) {
    console.error(`Failed to fetch dashboard page ${index}:`, error);
    return undefined;
  }
};

// Fetch a specific dashboard page by name
export const getDashboardPageByName = async (
  name: string
): Promise<DashboardPage | undefined> => {
  try {
    const response = await api.get(`/v1/app/dashboard/pages/name/${name}`);
    const page = response.data;
    return {
      index: page.index,
      pageName: page.page_name || page.pageName,
      displayName: page.display_name || page.displayName,
      imageId: page.image_id || page.imageId,
      enabled: page.enabled ?? true,
    };
  } catch (error) {
    console.error(`Failed to fetch dashboard page by name '${name}':`, error);
    return undefined;
  }
};

// Save (replace) the entire dashboard page configuration
export const saveDashboardPageConfiguration = async (
  pages: DashboardPage[]
): Promise<boolean> => {
  try {
    const response = await api.post("/v1/app/dashboard/pages", pages);
    return response.status >= 200 && response.status < 300;
  } catch (error) {
    console.error("Failed to save dashboard page configuration:", error);
    return false;
  }
};

// Update a specific dashboard page
export const updateDashboardPage = async (
  index: number,
  updates: Partial<DashboardPage>
): Promise<boolean> => {
  try {
    const response = await api.put(`/v1/app/dashboard/pages/${index}`, updates);
    return response.status >= 200 && response.status < 300;
  } catch (error) {
    console.error(`Failed to update dashboard page ${index}:`, error);
    return false;
  }
};

// Delete a dashboard page
export const deleteDashboardPage = async (
  index: number
): Promise<boolean> => {
  try {
    const response = await api.delete(`/v1/app/dashboard/pages/${index}`);
    return response.status >= 200 && response.status < 300;
  } catch (error) {
    console.error(`Failed to delete dashboard page ${index}:`, error);
    return false;
  }
};
