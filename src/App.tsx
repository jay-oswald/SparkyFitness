
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PreferencesProvider } from "@/contexts/PreferencesContext";
import { ChatbotVisibilityProvider } from "@/contexts/ChatbotVisibilityContext";
import AppContent from "@/components/AppContent";
import DraggableChatbotButton from "@/components/DraggableChatbotButton";
import { info } from '@/utils/logging';
import { AuthProvider } from "@/hooks/useAuth"; // Import AuthProvider

const queryClient = new QueryClient();

const App = () => {

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider> {/* Wrap the application with AuthProvider */}
        <PreferencesProvider>
          <ChatbotVisibilityProvider>
            <AppContent />
            <DraggableChatbotButton />
          </ChatbotVisibilityProvider>
        </PreferencesProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
