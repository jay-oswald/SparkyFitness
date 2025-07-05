import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ActiveUserProvider } from '@/contexts/ActiveUserContext';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useAuth } from '@/hooks/useAuth'; // Import useAuth
import Index from '@/pages/Index';
import NotFound from '@/pages/NotFound';
import Auth from '@/components/Auth'; // Import Auth component

const AppContent: React.FC = () => {
  const { loggingLevel } = usePreferences();
  const { user, loading } = useAuth(); // No longer passing navigate

  if (loading) {
    // Optionally, render a loading spinner or skeleton screen here
    return <div>Loading authentication...</div>;
  }

  return (
    <ThemeProvider loggingLevel={loggingLevel}>
      <ActiveUserProvider> {/* No longer passing navigate */}
        <TooltipProvider>
          <Toaster />
          <Routes>
            <Route path="/" element={user ? <Index /> : <Auth />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </ActiveUserProvider>
    </ThemeProvider>
  );
};

export default AppContent;