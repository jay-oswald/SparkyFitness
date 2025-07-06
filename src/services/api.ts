import { toast } from "@/hooks/use-toast";
import { warn, error } from "@/utils/logging";
import { getUserLoggingLevel } from "@/utils/userPreferences";

interface ApiCallOptions extends RequestInit {
  body?: any;
  suppress404Toast?: boolean; // New option to suppress toast for 404 errors
  externalApi?: boolean;
}

export const API_BASE_URL = `http://localhost:${import.meta.env.VITE_SPARKY_FITNESS_SERVER_PORT || 3010}`;

export async function apiCall(endpoint: string, options?: ApiCallOptions): Promise<any> {
  const userLoggingLevel = getUserLoggingLevel();
  const url = options?.externalApi ? endpoint : `${API_BASE_URL}${endpoint}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };

  // Only add Authorization header for internal API calls
  if (!options?.externalApi) {
    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  if (options?.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      let errorData: any;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { message: response.statusText };
      }
      const errorMessage = errorData.error || errorData.message || `API call failed with status ${response.status}`;

      // Suppress toast for 404 errors if suppress404Toast is true
      if (response.status === 404 && options?.suppress404Toast) {
        warn(userLoggingLevel, `API call returned 404 for ${endpoint}, toast suppressed. Returning empty array.`);
        return []; // Return empty array for 404 with suppression
      }

      toast({
        title: "API Error",
        description: errorMessage,
        variant: "destructive",
      });
      if (errorMessage.includes('Authentication: Invalid or expired token.')) {
        localStorage.removeItem('token');
        window.location.reload();
      }
      throw new Error(errorMessage);
    }

    // Handle cases where the response might be empty (e.g., DELETE requests)
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  } catch (err: any) {
    error(userLoggingLevel, "API call network error:", err);
    toast({
      title: "Network Error",
      description: err.message || "Could not connect to the server.",
      variant: "destructive",
    });
    throw error;
  }
}