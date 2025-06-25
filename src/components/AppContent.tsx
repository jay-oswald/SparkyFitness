import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ActiveUserProvider } from '@/contexts/ActiveUserContext';
import { usePreferences } from '@/contexts/PreferencesContext';
import Index from '@/pages/Index';
import NotFound from '@/pages/NotFound';

const AppContent: React.FC = () => {
  const { loggingLevel } = usePreferences();

  return (
    <ThemeProvider loggingLevel={loggingLevel}>
      <ActiveUserProvider>
        <TooltipProvider>
          <Toaster />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ActiveUserProvider>
    </ThemeProvider>
  );
};

export default AppContent;