import { apiCall } from './api';

export interface CustomCategory {
  id: string;
  name: string;
  measurement_type: string;
  frequency: string;
}

export interface CustomMeasurement {
  id: string;
  category_id: string;
  value: number;
  entry_date: string;
  entry_hour: number | null;
  entry_timestamp: string;
  custom_categories: {
    name: string;
    measurement_type: string;
    frequency: string;
  };
}

export const getCustomCategories = async (userId: string): Promise<CustomCategory[]> => {
  return apiCall(`/api/custom-categories?user_id=${userId}`, {
    method: 'GET',
  });
};

export const getCustomMeasurements = async (userId: string): Promise<CustomMeasurement[]> => {
  return apiCall(`/api/custom-measurements?user_id=${userId}`, {
    method: 'GET',
  });
};

export const getCustomMeasurementsForDate = async (userId: string, date: string): Promise<CustomMeasurement[]> => {
  return apiCall(`/api/custom-measurements/${userId}/${date}`, {
    method: 'GET',
  });
};

export const saveCustomMeasurement = async (measurementData: any, frequency: string): Promise<CustomMeasurement> => {
  if (frequency === 'All') {
    return apiCall('/api/custom-measurements', {
      method: 'POST',
      body: measurementData,
    });
  } else {
    return apiCall('/api/custom-measurements', {
      method: 'PUT',
      body: measurementData,
    });
  }
};

export const deleteCustomMeasurement = async (measurementId: string): Promise<void> => {
  return apiCall(`/api/custom-measurements/${measurementId}`, {
    method: 'DELETE',
  });
};