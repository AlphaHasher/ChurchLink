// No imports needed for basic fetch calls

export interface ChurchSettings {
  CHURCH_NAME?: string;
  CHURCH_ADDRESS?: string;
  CHURCH_CITY?: string;
  CHURCH_STATE?: string;
  CHURCH_POSTAL_CODE?: string;
}

export interface ChurchSettingsResponse {
  success: boolean;
  settings: ChurchSettings;
}

/**
 * Fetch church settings from the database
 * Uses public endpoint that doesn't require authentication
 */
export const getChurchSettings = async (): Promise<ChurchSettings> => {
  try {
    // Use direct fetch to bypass auth interceptor for public data
    const response = await fetch('/api/v1/website/church/settings');
    if (response.ok) {
      const data = await response.json();
      return data.settings || {};
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    console.warn("Failed to fetch church settings, using defaults:", error);
    return {
      CHURCH_NAME: "Your Church Name",
      CHURCH_ADDRESS: "123 Main Street",
      CHURCH_CITY: "Your City", 
      CHURCH_STATE: "ST",
      CHURCH_POSTAL_CODE: "12345"
    };
  }
};

/**
 * Get just the church name from settings with fallback
 */
export const getChurchName = async (): Promise<string> => {
  try {
    const settings = await getChurchSettings();
    return settings.CHURCH_NAME || "Your Church Name";
  } catch (error) {
    console.warn("Failed to fetch church name:", error);
    return "Your Church Name";
  }
};

/**
 * Get church address components from settings
 */
export const getChurchAddress = async () => {
  try {
    const settings = await getChurchSettings();
    return {
      address: settings.CHURCH_ADDRESS || "123 Main Street",
      city: settings.CHURCH_CITY || "Your City",
      state: settings.CHURCH_STATE || "ST", 
      postalCode: settings.CHURCH_POSTAL_CODE || "12345"
    };
  } catch (error) {
    console.warn("Failed to fetch church address:", error);
    return {
      address: "123 Main Street",
      city: "Your City", 
      state: "ST",
      postalCode: "12345"
    };
  }
};