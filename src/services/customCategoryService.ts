import { apiCall } from './api';

export interface CustomCategory {
  id: string;
  name: string;
  measurement_type: string;
  frequency: string;
}

export const getCategories = async (userId: string): Promise<CustomCategory[]> => {
  const response = await apiCall(`/api/custom-categories?user_id=${userId}`, {
    method: 'GET',
    suppress404Toast: true,
  });
  console.log('Raw API response for getCategories:', response);
  return response.filter((cat: any) => {
    const id = cat && cat.id ? String(cat.id) : '';
    if (!id) {
      console.error('Category fetched with missing or invalid ID, filtering out:', cat);
      return false; // Filter out categories without a valid ID
    }
    return true;
  }).map((cat: any) => ({ ...cat, id: String(cat.id) })); // Ensure ID is string for valid categories
};

export const addCategory = async (categoryData: { user_id: string; name: string; measurement_type: string; frequency: string }): Promise<CustomCategory> => {
  const response = await apiCall('/api/custom-categories', {
    method: 'POST',
    body: categoryData,
  });
  console.log('Raw API response for addCategory:', response);
  const id = response && response.id ? String(response.id) : null;
  if (!id) {
    console.error('New category added with missing or invalid ID:', response);
    throw new Error('Failed to add category: Missing or invalid ID in response.');
  }
  return { ...response, id: id };
};

export const updateCategory = async (categoryId: string, categoryData: { name: string; measurement_type: string; frequency: string }): Promise<CustomCategory> => {
  const response = await apiCall(`/api/measurements/custom-categories/${categoryId}`, {
    method: 'PUT',
    body: categoryData,
  });
  console.log('Raw API response for updateCategory:', response);
  const id = response && response.id ? String(response.id) : null;
  if (!id) {
    console.error('Updated category with missing or invalid ID:', response);
    throw new Error('Failed to update category: Missing or invalid ID in response.');
  }
  return { ...response, id: id };
};

export const deleteCategory = async (categoryId: string, userId: string): Promise<void> => {
  if (!userId) {
    console.error('Attempted to delete a category with an undefined or null user ID.');
    throw new Error('User ID is missing for delete operation.');
  }
  return apiCall(`/api/custom-categories/${categoryId}?user_id=${userId}`, {
    method: 'DELETE',
  });
};