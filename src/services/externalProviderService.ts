import { apiCall } from './api';

export interface DataProvider {
  id: string;
  name: string;
  provider_type: string; // e.g., 'wger', 'fatsecret', 'openfoodfacts', 'nutritionix'
  provider_name: string; // e.g., 'Wger', 'FatSecret' (for display and value)
  is_active: boolean; // Changed from is_enabled to is_active
}

export const getExternalDataProviders = async (): Promise<DataProvider[]> => {
  return apiCall('/external-providers', {
    method: 'GET',
  });
};

export const getProviderCategory = (provider: DataProvider): 'food' | 'exercise' | 'other' => {
  switch (provider.provider_type.toLowerCase()) { // Use provider.provider_type
    case 'wger':
      return 'exercise';
    case 'fatsecret':
    case 'openfoodfacts':
    case 'nutritionix':
      return 'food';
    default:
      return 'other';
  }
};