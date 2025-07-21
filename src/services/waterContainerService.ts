import { apiCall } from './api';

export interface WaterContainer {
  id: number;
  user_id: string;
  name: string;
  volume: number;
  unit: 'ml' | 'oz' | 'cup' | 'liter';
  is_primary: boolean;
}

export const getWaterContainers = async (): Promise<WaterContainer[]> => {
  return await apiCall('/water-containers');
};

export const createWaterContainer = async (containerData: Omit<WaterContainer, 'id' | 'user_id'>): Promise<WaterContainer> => {
  return await apiCall('/water-containers', {
    method: 'POST',
    body: containerData,
  });
};

export const updateWaterContainer = async (id: number, containerData: Partial<Omit<WaterContainer, 'id' | 'user_id'>>): Promise<WaterContainer> => {
  return await apiCall(`/water-containers/${id}`, {
    method: 'PUT',
    body: containerData,
  });
};

export const deleteWaterContainer = async (id: number): Promise<void> => {
  await apiCall(`/water-containers/${id}`, {
    method: 'DELETE',
  });
};

export const setPrimaryWaterContainer = async (id: number): Promise<WaterContainer> => {
  return await apiCall(`/water-containers/${id}/set-primary`, {
    method: 'PUT',
  });
};