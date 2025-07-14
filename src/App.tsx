
import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PreferencesProvider } from "@/contexts/PreferencesContext";
import { ChatbotVisibilityProvider } from "@/contexts/ChatbotVisibilityContext";
import AppContent from "@/components/AppContent";
import DraggableChatbotButton from "@/components/DraggableChatbotButton";
import { info } from '@/utils/logging';
import { AuthProvider } from "@/hooks/useAuth";
import AboutDialog from "@/components/AboutDialog"; // Import AboutDialog
import NewReleaseDialog from "@/components/NewReleaseDialog"; // Import NewReleaseDialog
import axios from 'axios';

const queryClient = new QueryClient();

const App = () => {
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [latestRelease, setLatestRelease] = useState(null);
  const [showNewReleaseDialog, setShowNewReleaseDialog] = useState(false);

  useEffect(() => {
    const checkNewRelease = async () => {
      try {
        const response = await axios.get('/api/version/latest-github');
        const releaseData = response.data;
        setLatestRelease(releaseData);

        // Check if the user has dismissed this version before
        const dismissedVersion = localStorage.getItem('dismissedReleaseVersion');
        if (releaseData.isNewVersionAvailable && dismissedVersion !== releaseData.version) {
          setShowNewReleaseDialog(true);
        }
      } catch (error) {
        console.error('Error checking for new release:', error);
      }
    };

    checkNewRelease();
  }, []);

  const handleDismissRelease = (version: string) => {
    localStorage.setItem('dismissedReleaseVersion', version);
    setShowNewReleaseDialog(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PreferencesProvider>
          <ChatbotVisibilityProvider>
            <AppContent onShowAboutDialog={() => setShowAboutDialog(true)} />
            <DraggableChatbotButton />
            <AboutDialog isOpen={showAboutDialog} onClose={() => setShowAboutDialog(false)} />
            <NewReleaseDialog
              isOpen={showNewReleaseDialog}
              onClose={() => setShowNewReleaseDialog(false)}
              releaseInfo={latestRelease}
              onDismissForVersion={handleDismissRelease}
            />
          </ChatbotVisibilityProvider>
        </PreferencesProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
