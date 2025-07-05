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

export const loadUserPreferences = async (userId: string): Promise<UserPreferences> => {
  const data = await apiCall(`/api/user-preferences/${userId}`, {
    method: 'GET',
  });
  const preferences = data || { auto_clear_history: 'never', logging_level: 'WARN' };
  setUserLoggingLevel(preferences.logging_level);
  return preferences;
};

export const loadChatHistory = async (userId: string, autoClearHistory: string): Promise<Message[]> => {
  const params = new URLSearchParams({
    autoClearHistory,
  });
  const data = await apiCall(`/api/chat-history/${userId}?${params.toString()}`, {
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
  userId: string,
  content: string,
  messageType: 'user' | 'assistant',
  metadata?: any
): Promise<void> => {
  await apiCall(`/api/chat-history/${userId}`, {
    method: 'POST',
    body: { content, message_type: messageType, metadata },
  });
};

export const clearChatHistory = async (userId: string, clearType: 'manual' | 'all'): Promise<void> => {
  await apiCall(`/api/chat-history/${userId}/clear`, {
    method: 'POST',
    body: { clear_type: clearType },
  });
};

export const processUserInput = async (
  userId: string,
  input: string,
  image: File | null,
  transactionId: string,
  lastBotMessageMetadata?: any
): Promise<any> => {
  const formData = new FormData();
  formData.append('input', input);
  formData.append('userId', userId);
  formData.append('transactionId', transactionId);
  if (image) {
    formData.append('image', image);
  }
  if (lastBotMessageMetadata) {
    formData.append('lastBotMessageMetadata', JSON.stringify(lastBotMessageMetadata));
  }

  return apiCall('/api/chat/process-input', {
    method: 'POST',
    body: formData,
    headers: {
      // Content-Type will be set automatically by the browser for FormData
    },
  });
};

export const getTodaysNutrition = async (userId: string, date: string): Promise<any> => {
  const params = new URLSearchParams({ date });
  return apiCall(`/api/nutrition/today/${userId}?${params.toString()}`, {
    method: 'GET',
  });
};