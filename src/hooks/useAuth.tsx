
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  // Add other user properties as needed
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signIn: (userId: string, userEmail: string, token: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUserId = localStorage.getItem('userId');
    const storedUserEmail = localStorage.getItem('userEmail');
    const storedToken = localStorage.getItem('token');

    if (storedUserId && storedUserEmail && storedToken) {
      setUser({ id: storedUserId, email: storedUserEmail });
    }
    setLoading(false);
  }, []);

  const signOut = async () => {
    try {
      const response = await fetch('http://localhost:3010/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user?.id }),
      });

      if (response.ok) {
        localStorage.removeItem('userId');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('token'); // Remove token on sign out
        setUser(null);
      } else {
        console.error('Logout failed on server:', await response.json());
      }
    } catch (error) {
      console.error('Network error during logout:', error);
    }
  };

  const signIn = (userId: string, userEmail: string, token: string) => {
    localStorage.setItem('userId', userId);
    localStorage.setItem('userEmail', userEmail);
    localStorage.setItem('token', token); // Store token on sign in
    setUser({ id: userId, email: userEmail });
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
