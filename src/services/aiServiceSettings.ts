import { apiCall } from "./api";

interface AIService {
  id: string;
  service_name: string;
  service_type: string;
  api_key?: string; // Optional for updates, required for add
  custom_url: string | null;
  system_prompt: string | null;
  is_active: boolean;
  model_name?: string;
}

interface UserPreferences {
  auto_clear_history: string;
}

export const getAIServices = async (userId: string): Promise<AIService[]> => {
  const response = await apiCall(`/api/ai-service-settings?userId=${userId}`, {
    method: 'GET',
  });
  return response;
};

export const getPreferences = async (userId: string): Promise<UserPreferences> => {
  const response = await apiCall(`/api/user-preferences?userId=${userId}`, {
    method: 'GET',
  });
  return response;
};

export const addAIService = async (serviceData: AIService): Promise<AIService> => {
  const response = await apiCall('/api/ai-service-settings', {
    method: 'POST',
    body: serviceData,
  });
  return response;
};

export const updateAIService = async (serviceId: string, serviceData: Partial<AIService>): Promise<AIService> => {
  const response = await apiCall(`/api/ai-service-settings/${serviceId}`, {
    method: 'PUT',
    body: serviceData,
  });
  return response;
};

export const deleteAIService = async (serviceId: string): Promise<void> => {
  await apiCall(`/api/ai-service-settings/${serviceId}`, {
    method: 'DELETE',
  });
};

export const updateAIServiceStatus = async (serviceId: string, isActive: boolean): Promise<void> => {
  await apiCall(`/api/ai-service-settings/${serviceId}/status`, {
    method: 'PUT',
    body: { is_active: isActive },
  });
};

export const updateUserPreferences = async (userId: string, preferences: UserPreferences): Promise<void> => {
  await apiCall(`/api/user-preferences/${userId}`, {
    method: 'PUT',
    body: preferences,
  });
};