import { apiCall } from './api';
import { AuthResponse } from '../types'; // Import AuthResponse type

export const registerUser = async (email: string, password: string, fullName: string): Promise<AuthResponse> => {
  const response = await apiCall('/auth/register', {
    method: 'POST',
    body: { email, password, full_name: fullName },
  });
  return response as AuthResponse;
};

export const loginUser = async (email: string, password: string): Promise<AuthResponse> => {
  const response = await apiCall('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  return response as AuthResponse;
};

export const initiateOidcLogin = async () => {
  try {
    const response = await apiCall('/openid/login');
    if (response.authorizationUrl) {
      window.location.href = response.authorizationUrl;
    } else {
      console.error('Could not get OIDC authorization URL from server.');
    }
  } catch (error) {
    console.error('Failed to initiate OIDC login:', error);
  }
};