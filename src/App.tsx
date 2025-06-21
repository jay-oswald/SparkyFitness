
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PreferencesProvider } from "@/contexts/PreferencesContext";
import { ChatbotVisibilityProvider } from "@/contexts/ChatbotVisibilityContext";
import AppContent from "@/components/AppContent";
import DraggableChatbotButton from "@/components/DraggableChatbotButton";
import { info } from '@/utils/logging';

const queryClient = new QueryClient();

const App = () => {

  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        <ChatbotVisibilityProvider>
          <AppContent />
          <DraggableChatbotButton />
        </ChatbotVisibilityProvider>
      </PreferencesProvider>
    </QueryClientProvider>
  );
};

export default App;
