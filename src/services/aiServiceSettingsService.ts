import { apiCall } from './api';

export interface AIService {
  id: string;
  service_name: string;
  service_type: string;
  api_key: string; // This will temporarily hold the plain text key from the user
  custom_url: string | null;
  system_prompt: string | null;
  is_active: boolean;
  model_name?: string;
}

export interface UserPreferences {
  auto_clear_history: string;
}

export const getAIServices = async (userId: string): Promise<AIService[]> => {
  try {
    const services = await apiCall(`/api/ai-service-settings/${userId}`, {
      method: 'GET',
      suppress404Toast: true, // Suppress toast for 404
    });
    return services || []; // Return empty array if 404 (no services found)
  } catch (error) {
    // If it's a 404 and we suppressed the toast, it means no services were found.
    // Re-throw other errors if necessary, or handle them.
    if (error.message.includes('not found')) { // Check for specific message from backend
      return [];
    }
    throw error;
  }
};

export const getPreferences = async (userId: string): Promise<UserPreferences> => {
  return apiCall(`/api/user-preferences/${userId}`, {
    method: 'GET',
  });
};

export const addAIService = async (serviceData: Partial<AIService>): Promise<AIService> => {
  return apiCall('/api/ai-service-settings', {
    method: 'POST',
    body: serviceData,
  });
};

export const updateAIService = async (serviceId: string, serviceUpdateData: Partial<AIService>): Promise<AIService> => {
  return apiCall(`/api/ai-service-settings/${serviceId}`, {
    method: 'PUT',
    body: serviceUpdateData,
  });
};

export const deleteAIService = async (serviceId: string): Promise<void> => {
  return apiCall(`/api/ai-service-settings/${serviceId}`, {
    method: 'DELETE',
  });
};

export const updateAIServiceStatus = async (serviceId: string, isActive: boolean): Promise<AIService> => {
  return apiCall(`/api/ai-service-settings/${serviceId}/status`, {
    method: 'PUT',
    body: { is_active: isActive },
  });
};

export const updateUserPreferences = async (userId: string, preferences: UserPreferences): Promise<UserPreferences> => {
  return apiCall(`/api/user-preferences/${userId}`, {
    method: 'PUT',
    body: preferences,
  });
};