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

export const loadCustomCategories = async (): Promise<CustomCategory[]> => {
  return apiCall(`/measurements/custom-categories`, {
    method: 'GET',
  });
};

export const fetchRecentMeasurements = async (): Promise<CustomMeasurement[]> => {
  return apiCall(`/measurements/custom-entries?limit=20&orderBy=entry_timestamp.desc&filter=value.gt.0`, {
    method: 'GET',
  });
};

export const handleDeleteMeasurement = async (measurementId: string): Promise<void> => {
  await apiCall(`/measurements/custom-entries/${measurementId}`, {
    method: 'DELETE',
  });
};

export const loadExistingCheckInMeasurements = async (selectedDate: string): Promise<any> => {
  return apiCall(`/measurements/check-in/${selectedDate}`, {
    method: 'GET',
  });
};

export const loadExistingCustomMeasurements = async (selectedDate: string): Promise<CustomMeasurement[]> => {
  return apiCall(`/measurements/custom-entries/${selectedDate}`, {
    method: 'GET',
  });
};

export const saveCheckInMeasurements = async (payload: any): Promise<void> => {
  await apiCall('/measurements/check-in', {
    method: 'POST',
    body: payload,
  });
};

export const saveCustomMeasurement = async (payload: any): Promise<void> => {
  await apiCall('/measurements/custom-entries', {
    method: 'POST',
    body: payload,
  });
};