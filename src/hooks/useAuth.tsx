
import { useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  // Add other user properties as needed
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUserId = localStorage.getItem('userId');
    const storedUserEmail = localStorage.getItem('userEmail'); // Assuming you'll store email too

    if (storedUserId && storedUserEmail) {
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
        body: JSON.stringify({ userId: user?.id }), // Send userId if available
      });

      if (response.ok) {
        localStorage.removeItem('userId');
        localStorage.removeItem('userEmail');
        setUser(null);
      } else {
        console.error('Logout failed on server:', await response.json());
      }
    } catch (error) {
      console.error('Network error during logout:', error);
    }
  };

  // Function to update user state after successful login
  const signIn = (userId: string, userEmail: string) => {
    localStorage.setItem('userId', userId);
    localStorage.setItem('userEmail', userEmail);
    setUser({ id: userId, email: userEmail });
  };

  return { user, loading, signOut, signIn };
};
