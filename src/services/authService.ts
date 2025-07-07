import { apiCall } from './api';
import { AuthResponse } from '../types'; // Import AuthResponse type

export const registerUser = async (email: string, password: string, fullName: string): Promise<AuthResponse> => {
  return apiCall('/auth/register', {
    method: 'POST',
    body: { email, password, full_name: fullName },
  });
};

export const loginUser = async (email: string, password: string): Promise<AuthResponse> => {
  return apiCall('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
};