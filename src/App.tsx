
import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PreferencesProvider } from "@/contexts/PreferencesContext";
import { ChatbotVisibilityProvider } from "@/contexts/ChatbotVisibilityContext";
import AppContent from "@/components/AppContent";
import DraggableChatbotButton from "@/components/DraggableChatbotButton";
import { info } from '@/utils/logging';
import { useAuth } from "@/hooks/useAuth"; // Import useAuth
import AboutDialog from "@/components/AboutDialog"; // Import AboutDialog
import NewReleaseDialog from "@/components/NewReleaseDialog"; // Import NewReleaseDialog
import axios from 'axios';

const queryClient = new QueryClient();

const App = () => {
  const { user, loading } = useAuth(); // Get user and loading from useAuth
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [latestRelease, setLatestRelease] = useState(null);
  const [showNewReleaseDialog, setShowNewReleaseDialog] = useState(false);

  useEffect(() => {
    console.log('App useEffect: user', user, 'loading', loading);
    if (!loading && user) {
      console.log('User is authenticated, checking for new release.');
      const checkNewRelease = async () => {
        try {
          const response = await axios.get('/api/version/latest-github');
          const releaseData = response.data;
          setLatestRelease(releaseData);
          console.log('Latest GitHub release data:', releaseData);

          const dismissedVersion = localStorage.getItem('dismissedReleaseVersion');
          console.log('Dismissed release version from localStorage:', dismissedVersion);

          if (releaseData.isNewVersionAvailable && dismissedVersion !== releaseData.version) {
            console.log('Showing new release dialog.');
            setShowNewReleaseDialog(true);
          } else {
            console.log('New release dialog not shown. isNewVersionAvailable:', releaseData.isNewVersionAvailable, 'dismissedVersion:', dismissedVersion, 'releaseData.version:', releaseData.version);
          }
        } catch (error) {
          console.error('Error checking for new release:', error);
        }
      };

      checkNewRelease();
    } else {
      console.log('User not authenticated or still loading, skipping new release check.');
    }
  }, [user, loading]); // Add user and loading to dependency array

  const handleDismissRelease = (version: string) => {
    localStorage.setItem('dismissedReleaseVersion', version);
    setShowNewReleaseDialog(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  );
};

export default App;
