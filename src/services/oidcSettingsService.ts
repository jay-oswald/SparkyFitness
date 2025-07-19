import { api } from './api'; // Assuming 'api' is your axios instance or similar

export interface OidcSettings {
    id?: number;
    issuer_url: string;
    client_id: string;
    client_secret?: string; // Optional for 'none' auth method
    redirect_uris: string[];
    scope: string;
    token_endpoint_auth_method: string;
    response_types: string[];
    is_active: boolean;
    id_token_signed_response_alg?: string;
    userinfo_signed_response_alg?: string;
    request_timeout?: number;
    auto_register?: boolean;
    enable_email_password_login?: boolean;
}

export const oidcSettingsService = {
    getSettings: async (): Promise<OidcSettings | null> => {
        try {
            const response = await api.get('/admin/oidc-settings');
            return response; // api.get already returns the data
        } catch (error) {
            console.error('Error fetching OIDC settings:', error);
            throw error;
        }
    },

    saveSettings: async (settings: OidcSettings): Promise<OidcSettings> => {
        try {
            // Correctly pass the settings object as the body of the request
            const response = await api.put('/admin/oidc-settings', { body: settings });
            return response;
        } catch (error) {
            console.error('Error saving OIDC settings:', error);
            throw error;
        }
    },
};