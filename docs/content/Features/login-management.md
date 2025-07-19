# Login Management

The SparkyFitness application provides a flexible authentication system that can be configured to meet various security and usability requirements. Administrators can manage login methods from the Admin section of the application.

## Features

- **Multiple Login Methods**: Supports both standard Email/Password and OIDC (OpenID Connect) for single sign-on (SSO).
- **Flexible Configuration**: Administrators can enable Email/Password, OIDC, or both, directly from the UI.
- **Smart Fail-Safe**: The system can detect if the OIDC provider is misconfigured or unreachable. If OIDC is the only method enabled and it becomes unhealthy, the system will automatically enable Email/Password login as a fallback to prevent administrative lockout.
- **Environment Variable Override**: A critical fail-safe mechanism is available via an environment variable, ensuring access can always be restored.

## Configuration

All authentication settings can be found in the **Admin -> Authentication Settings** page.

### Login Management

This section provides two main toggles:

-   **Enable Email & Password Login**: When enabled, users can sign in using their registered email and password.
-   **Enable OIDC Login**: When enabled, users can sign in through a configured OIDC provider.

### OIDC Provider Settings

This section contains all the necessary fields to configure an OIDC provider, such as the Issuer URL, Client ID, and Client Secret.

## Fail-Safe Mechanisms

### Automatic Fallback

If **Enable OIDC Login** is active and **Enable Email & Password Login** is disabled, the system will periodically check the health of the OIDC provider. If it detects that the provider's discovery endpoint is unreachable, it will temporarily and automatically re-enable the Email/Password login method to ensure users and administrators are not locked out. This event will be logged for administrative review.

### Environment Variable Override

For emergency situations where the application's settings are misconfigured and an administrator cannot log in, a server-side environment variable can be used to force the Email/Password login method to be enabled.

To activate this override, set the following environment variable on your server and restart the application:

```
SPARKY_FITNESS_FORCE_EMAIL_LOGIN=true
```

This variable takes precedence over all in-app settings and guarantees that the Email/Password form is available on the login page.