import { apiCall } from './api';
import { setUserLoggingLevel } from '@/utils/userPreferences';

export interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  metadata?: any;
}

export interface UserPreferences {
  auto_clear_history: 'never' | '7days' | 'all';
  logging_level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR';
}

export const loadUserPreferences = async (): Promise<UserPreferences> => {
  const data = await apiCall(`/user-preferences`, {
    method: 'GET',
  });
  const preferences = data || { auto_clear_history: 'never', logging_level: 'WARN' };
  setUserLoggingLevel(preferences.logging_level);
  return preferences;
};

export const loadChatHistory = async (autoClearHistory: string): Promise<Message[]> => {
  const params = new URLSearchParams({
    autoClearHistory,
  });
  const data = await apiCall(`/chat/sparky-chat-history?${params.toString()}`, {
    method: 'GET',
  });
  return (data || []).map((item: any) => ({
    id: item.id,
    content: item.content,
    isUser: item.message_type === 'user',
    timestamp: new Date(item.created_at),
    metadata: item.metadata
  }));
};

export const saveMessageToHistory = async (
  content: string,
  messageType: 'user' | 'assistant',
  metadata?: any
): Promise<void> => {
  await apiCall(`/chat/save-history`, {
    method: 'POST',
    body: { content, messageType, metadata },
  });
};

export const clearChatHistory = async (clearType: 'manual' | 'all'): Promise<void> => {
  await apiCall(`/chat/${clearType === 'all' ? 'clear-all-history' : 'clear-old-history'}`, {
    method: 'POST',
    body: {}, // No body needed, user is identified by JWT
  });
};

export const processUserInput = async (
  input: string,
  image: File | null,
  transactionId: string,
  lastBotMessageMetadata?: any
): Promise<any> => {
  const formData = new FormData();
  formData.append('input', input);
  formData.append('transactionId', transactionId);
  if (image) {
    formData.append('image', image);
  }
  if (lastBotMessageMetadata) {
    formData.append('lastBotMessageMetadata', JSON.stringify(lastBotMessageMetadata));
  }

  return apiCall('/chat', {
    method: 'POST',
    body: formData,
    headers: {
      // Content-Type will be set automatically by the browser for FormData
    },
  });
};

export const getTodaysNutrition = async (date: string): Promise<any> => {
  const params = new URLSearchParams({ date });
  return apiCall(`/nutrition/today?${params.toString()}`, {
    method: 'GET',
  });
};