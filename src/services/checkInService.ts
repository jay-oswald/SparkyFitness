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

export const loadCustomCategories = async (userId: string): Promise<CustomCategory[]> => {
  return apiCall(`/api/measurements/custom-categories?userId=${userId}`, {
    method: 'GET',
  });
};

export const fetchRecentMeasurements = async (userId: string): Promise<CustomMeasurement[]> => {
  return apiCall(`/api/measurements/custom-entries?userId=${userId}&limit=20&orderBy=entry_timestamp.desc&filter=value.gt.0`, {
    method: 'GET',
  });
};

export const handleDeleteMeasurement = async (measurementId: string, userId: string): Promise<void> => {
  await apiCall(`/api/measurements/custom-entries/${measurementId}?userId=${userId}`, {
    method: 'DELETE',
  });
};

export const loadExistingCheckInMeasurements = async (userId: string, selectedDate: string): Promise<any> => {
  return apiCall(`/api/measurements/check-in/${userId}/${selectedDate}`, {
    method: 'GET',
  });
};

export const loadExistingCustomMeasurements = async (userId: string, selectedDate: string): Promise<CustomMeasurement[]> => {
  return apiCall(`/api/measurements/custom-entries/${userId}/${selectedDate}`, {
    method: 'GET',
  });
};

export const saveCheckInMeasurements = async (payload: any): Promise<void> => {
  await apiCall('/api/measurements/check-in', {
    method: 'POST',
    body: payload,
  });
};

export const saveCustomMeasurement = async (payload: any, frequency: string): Promise<void> => {
  if (frequency === 'All') {
    await apiCall('/api/measurements/custom-entries', {
      method: 'POST',
      body: payload,
    });
  } else {
    await apiCall('/api/measurements/custom-entries', {
      method: 'PUT', // Assuming PUT for upsert
      body: payload,
    });
  }
};