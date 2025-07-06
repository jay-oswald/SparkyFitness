const chatRepository = require('../models/chatRepository');
const userRepository = require('../models/userRepository');
const { log } = require('../config/logging');
const { getDefaultModel } = require('../ai/config');

async function handleAiServiceSettings(action, serviceData, authenticatedUserId) {
  try {
    if (action === 'save_ai_service_settings') {
      serviceData.user_id = authenticatedUserId; // Ensure user_id is set from authenticated user
      if (!serviceData.id && !serviceData.api_key) {
        throw new Error('API key is required for adding a new AI service.');
      }
      const result = await chatRepository.upsertAiServiceSetting(serviceData);
      return { message: 'AI service settings saved successfully.', setting: result };
    }
    // Add other actions if needed in the future
    throw new Error('Unsupported action for AI service settings.');
  } catch (error) {
    log('error', `Error handling AI service settings for user ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function getAiServiceSettings(authenticatedUserId, targetUserId) {
  try {
    const settings = await chatRepository.getAiServiceSettingsByUserId(targetUserId);
    return settings || []; // Return empty array if no settings found
  } catch (error) {
    log('error', `Error fetching AI service settings for user ${targetUserId} by ${authenticatedUserId}:`, error);
    return []; // Return empty array on error
  }
}

async function getActiveAiServiceSetting(authenticatedUserId, targetUserId) {
  try {
    const setting = await chatRepository.getActiveAiServiceSetting(targetUserId);
    return setting; // Returns null if no active setting found
  } catch (error) {
    log('error', `Error fetching active AI service setting for user ${targetUserId} by ${authenticatedUserId}:`, error);
    return null; // Return null on error
  }
}

async function deleteAiServiceSetting(authenticatedUserId, id, targetUserId) {
  try {
    // Verify that the setting belongs to the target user before deleting
    const setting = await chatRepository.getAiServiceSettingById(id, targetUserId);
    if (!setting) {
      throw new Error('AI service setting not found.');
    }
    if (setting.user_id !== targetUserId) {
      throw new Error('Forbidden: The provided user ID does not match the setting owner.');
    }
    const success = await chatRepository.deleteAiServiceSetting(id, targetUserId);
    if (!success) {
      throw new Error('AI service setting not found.');
    }
    return { message: 'AI service setting deleted successfully.' };
  } catch (error) {
    log('error', `Error deleting AI service setting ${id} for user ${targetUserId} by ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function clearOldChatHistory(authenticatedUserId) {
  try {
    await chatRepository.clearOldChatHistory(authenticatedUserId);
    return { message: 'Old chat history cleared successfully.' };
  } catch (error) {
    log('error', `Error clearing old chat history for user ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function getSparkyChatHistory(authenticatedUserId, targetUserId) {
  try {
    const history = await chatRepository.getChatHistoryByUserId(targetUserId);
    return history;
  } catch (error) {
    log('error', `Error fetching chat history for user ${targetUserId} by ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function getSparkyChatHistoryEntry(authenticatedUserId, id) {
  try {
    const entryOwnerId = await chatRepository.getChatHistoryEntryOwnerId(id);
    if (!entryOwnerId) {
      throw new Error('Chat history entry not found.');
    }
    const entry = await chatRepository.getChatHistoryEntryById(id);
    return entry;
  } catch (error) {
    log('error', `Error fetching chat history entry ${id} by ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function updateSparkyChatHistoryEntry(authenticatedUserId, id, targetUserId, updateData) {
  try {
    const updatedEntry = await chatRepository.updateChatHistoryEntry(id, targetUserId, updateData);
    if (!updatedEntry) {
      throw new Error('Chat history entry not found or not authorized to update.');
    }
    return updatedEntry;
  } catch (error) {
    log('error', `Error updating chat history entry ${id} for user ${targetUserId} by ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function deleteSparkyChatHistoryEntry(authenticatedUserId, id, targetUserId) {
  try {
    const success = await chatRepository.deleteChatHistoryEntry(id, targetUserId);
    if (!success) {
      throw new Error('Chat history entry not found or not authorized to delete.');
    }
    return { message: 'Chat history entry deleted successfully.' };
  } catch (error) {
    log('error', `Error deleting chat history entry ${id} for user ${targetUserId} by ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function clearAllSparkyChatHistory(authenticatedUserId, targetUserId) {
  try {
    await chatRepository.clearAllChatHistory(targetUserId);
    return { message: 'All chat history cleared successfully.' };
  } catch (error) {
    log('error', `Error clearing all chat history for user ${targetUserId} by ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function saveSparkyChatHistory(authenticatedUserId, historyData) {
  try {
    await chatRepository.saveChatHistory(historyData);
    return { message: 'Chat history saved successfully.' };
  } catch (error) {
    log('error', `Error saving chat history for user ${historyData.user_id} by ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function processChatMessage(messages, serviceConfig, authenticatedUserId) {
  try {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('Invalid messages format.');
    }
    if (!serviceConfig || !serviceConfig.id) {
      throw new Error('AI service configuration ID is missing.');
    }

    const aiService = await chatRepository.getAiServiceSettingById(serviceConfig.id, authenticatedUserId);
    if (!aiService) {
      throw new Error('AI service setting not found.');
    }
    if (!aiService.api_key) {
      throw new Error('API key missing for selected AI service.');
    }

    let response;
    const model = aiService.model_name || getDefaultModel(aiService.service_type);

    const systemMessage = messages.find(msg => msg.role === 'system');
    const systemPrompt = systemMessage?.content || '';
    const userMessages = messages.filter(msg => msg.role !== 'system');

    const cleanSystemPrompt = systemPrompt
      .replace(/[^\w\s\-.,!?:;()\[\]{}'"]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 1000);

    switch (aiService.service_type) {
      case 'openai':
      case 'openai_compatible':
      case 'mistral':
      case 'groq':
      case 'custom':
        response = await fetch(aiService.service_type === 'openai' ? 'https://api.openai.com/v1/chat/completions' :
                              aiService.service_type === 'openai_compatible' ? `${aiService.custom_url}/chat/completions` :
                              aiService.service_type === 'mistral' ? 'https://api.mistral.ai/v1/chat/completions' :
                              aiService.service_type === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' :
                              aiService.custom_url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${aiService.api_key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            messages: messages,
            temperature: 0.7,
          }),
        });
        break;

      case 'anthropic':
        response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': aiService.api_key,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: model,
            max_tokens: 1000,
            messages: userMessages,
            system: systemPrompt,
          }),
        });
        break;

      case 'google':
        const googleBody = {
          contents: messages.map(msg => {
            const role = msg.role === 'assistant' ? 'model' : 'user';
            let parts = [];
            if (typeof msg.content === 'string') {
              parts.push({ text: msg.content });
            } else if (Array.isArray(msg.content)) {
              parts = msg.content.map(part => {
                if (part.type === 'text') {
                  return { text: part.text };
                } else if (part.type === 'image_url' && part.image_url?.url) {
                  try {
                    const urlParts = part.image_url.url.split(';base64,');
                    if (urlParts.length !== 2) {
                      log('error', 'Invalid data URL format for image part. Expected "data:[mimeType];base64,[data]".');
                      return null;
                    }
                    const mimeTypeMatch = urlParts[0].match(/^data:(.*?)(;|$)/);
                    let mimeType = '';
                    if (mimeTypeMatch && mimeTypeMatch[1]) {
                      mimeType = mimeTypeMatch[1];
                    } else {
                      log('error', 'Could not extract mime type from data URL prefix:', urlParts[0]);
                      return null;
                    }
                    const base64Data = urlParts[1];
                    return {
                      inline_data: {
                        mime_type: mimeType,
                        data: base64Data
                      }
                    };
                  } catch (e) {
                    log('error', 'Error processing image data URL:', e);
                    return null;
                  }
                }
                return null;
              }).filter(part => part !== null);
            }
            if (parts.length === 0 && Array.isArray(msg.content) && msg.content.some(part => part.type === 'image_url')) {
              parts.push({ text: '' });
            }
            return {
              parts: parts,
              role: role,
            };
          }).filter(content => content.parts.length > 0),
        };

        if (googleBody.contents.length === 0) {
          throw new Error('No valid content (text or image) found to send to Google AI.');
        }

        if (cleanSystemPrompt && cleanSystemPrompt.length > 0) {
          googleBody.systemInstruction = {
            parts: [{ text: cleanSystemPrompt }]
          };
        }

        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${aiService.api_key}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(googleBody),
        });
        break;

      case 'ollama':
        response = await fetch(`${aiService.custom_url}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            messages: messages,
            stream: false,
          }),
        });
        break;

      default:
        const hasImage = messages.some(msg => Array.isArray(msg.content) && msg.content.some(part => part.type === 'image_url'));
        if (hasImage) {
          throw new Error(`Image analysis is not supported for the selected AI service type: ${aiService.service_type}. Please select a multimodal model like Google Gemini in settings.`);
        }
        throw new Error(`Unsupported service type: ${aiService.service_type}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      log('error', `AI service API call error for ${aiService.service_type}:`, errorText);
      throw new Error(`AI service API call error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    let content = '';

    switch (aiService.service_type) {
      case 'openai':
      case 'openai_compatible':
      case 'mistral':
      case 'groq':
      case 'custom':
        content = data.choices?.[0]?.message?.content || 'No response from AI service';
        break;
      case 'anthropic':
        content = data.content?.[0]?.text || 'No response from AI service';
        break;
      case 'google':
        content = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from AI service';
        break;
      case 'ollama':
        content = data.message?.content || 'No response from AI service';
        break;
    }
    return { content };
  } catch (error) {
    log('error', `Error processing chat message for user ${authenticatedUserId}:`, error);
    throw error;
  }
}

module.exports = {
  handleAiServiceSettings,
  getAiServiceSettings,
  getActiveAiServiceSetting,
  deleteAiServiceSetting,
  clearOldChatHistory,
  getSparkyChatHistory,
  getSparkyChatHistoryEntry,
  updateSparkyChatHistoryEntry,
  deleteSparkyChatHistoryEntry,
  clearAllSparkyChatHistory,
  saveSparkyChatHistory,
  processChatMessage,
};