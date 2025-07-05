import { apiCall } from './api';

export const registerUser = async (email: string, password: string, fullName: string): Promise<any> => {
  return apiCall('/api/auth/register', {
    method: 'POST',
    body: { email, password, full_name: fullName },
  });
};

export const loginUser = async (email: string, password: string): Promise<any> => {
  return apiCall('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
};