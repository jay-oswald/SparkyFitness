
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  role: string; // Add role property
  // Add other user properties as needed
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signIn: (userId: string, userEmail: string, token: string, userRole: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        // Attempt to fetch user info from the backend using the session cookie
        const response = await fetch('/openid/api/me', { credentials: 'include' });
        if (response.ok) {
          const userData = await response.json();
          if (userData && userData.userId && userData.email) {
            setUser({ id: userData.userId, email: userData.email, role: userData.role || 'user' });
          } else {
            // Session cookie might be present but user data invalid/expired
            setUser(null);
          }
        } else {
          // No active session or session expired
          setUser(null);
        }
      } catch (error) {
        console.error('Error checking session:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const signOut = async () => {
    try {
      // For OIDC users, the session is managed by cookies, so no token is sent.
      // For JWT users, the token is sent.
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({}),
      });

      if (response.ok) {
        // Clear all local storage items related to authentication
        localStorage.removeItem('userId');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        setUser(null);
      } else {
        const errorData = await response.json();
        console.error('Logout failed on server:', errorData);
        // Even if server logout fails, clear client-side state to avoid inconsistent state
        localStorage.removeItem('userId');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        setUser(null);
      }
    } catch (error) {
      console.error('Network error during logout:', error);
    }
  };

  const signIn = (userId: string, userEmail: string, token: string, userRole: string) => {
    // Only set token if it's provided. For OIDC, the session is managed by cookies.
    if (token) {
      localStorage.setItem('token', token);
    }
    localStorage.setItem('userId', userId);
    localStorage.setItem('userEmail', userEmail);
    localStorage.setItem('userRole', userRole); // Store userRole on sign in
    setUser({ id: userId, email: userEmail, role: userRole });
  };

  const value = {
    user,
    loading,
    signOut,
    signIn,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
