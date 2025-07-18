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

export const checkOidcAvailability = async (): Promise<boolean> => {
  try {
    const response = await apiCall('/openid/login');
    // If the backend explicitly states OIDC is not active, return false.
    if (response && response.isOidcActive === false) {
      console.info('OIDC is explicitly disabled by backend configuration.');
      return false;
    }
    // If the response contains an authorizationUrl, OIDC is considered available.
    // The backend should only return this if OIDC is active and configured.
    return !!response.authorizationUrl;
  } catch (error: any) {
    // This catch block will now primarily handle actual network errors or unexpected backend responses
    // that are not explicitly signaling OIDC is disabled.
    console.warn('OIDC availability check failed due to an error:', error.message);
    return false;
  }
};