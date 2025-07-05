import { apiCall } from './api';

export interface FamilyAccess {
  id: string;
  owner_user_id: string; // Added this line
  family_email: string;
  family_user_id: string;
  access_permissions: {
    calorie: boolean;
    checkin: boolean;
    reports: boolean;
    food_list: boolean;
  };
  access_end_date: string | null;
  is_active: boolean;
  status: string;
  created_at: string;
}

interface FamilyAccessPayload {
  owner_user_id: string;
  family_user_id: string;
  family_email: string;
  access_permissions: {
    calorie: boolean;
    checkin: boolean;
    reports: boolean;
    food_list: boolean;
  };
  access_end_date: string | null;
  status: string;
}

export const loadFamilyAccess = async (ownerUserId: string): Promise<FamilyAccess[]> => {
  const data = await apiCall(`/api/family-access?owner_user_id=${ownerUserId}`, {
    method: 'GET',
    suppress404Toast: true,
  });
  // Transform the data to ensure proper typing, similar to the original component
  const transformedData: FamilyAccess[] = (data || []).map((item: any) => ({
    id: item.id,
    family_email: item.family_email,
    family_user_id: item.family_user_id,
    access_permissions: typeof item.access_permissions === 'object' ? {
      calorie: item.access_permissions.calorie || false,
      checkin: item.access_permissions.checkin || false,
      reports: item.access_permissions.reports || false,
      food_list: item.access_permissions.food_list || false
    } : {
      calorie: false,
      checkin: false,
      reports: false,
      food_list: false
    },
    access_end_date: item.access_end_date,
    is_active: item.is_active,
    status: item.status || 'pending',
    created_at: item.created_at,
    owner_user_id: item.owner_user_id // Added this line
  }));
  return transformedData;
};

export const findUserByEmail = async (email: string): Promise<string | null> => {
  const response = await apiCall('/api/family-access/find-user-by-email', {
    method: 'POST',
    body: { email },
  });
  return response.userId || null;
};

export const createFamilyAccess = async (payload: FamilyAccessPayload): Promise<FamilyAccess> => {
  return apiCall('/api/family-access', {
    method: 'POST',
    body: payload,
  });
};

export const updateFamilyAccess = async (id: string, payload: Partial<FamilyAccessPayload>): Promise<FamilyAccess> => {
  return apiCall(`/api/family-access/${id}`, {
    method: 'PUT',
    body: payload,
  });
};

export const toggleFamilyAccessActiveStatus = async (id: string, isActive: boolean): Promise<FamilyAccess> => {
  return apiCall(`/api/family-access/${id}/toggle-active`, {
    method: 'PUT',
    body: { is_active: isActive },
  });
};

export const deleteFamilyAccess = async (id: string): Promise<void> => {
  return apiCall(`/api/family-access/${id}`, {
    method: 'DELETE',
  });
};