const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeAccess } = require('../middleware/authMiddleware');
const chatService = require('../services/chatService');

router.post('/', authenticateToken, async (req, res, next) => {
  const { messages, service_config, action, service_data } = req.body;

  try {
    if (action === 'save_ai_service_settings') {
      const result = await chatService.handleAiServiceSettings(action, service_data, req.userId);
      return res.status(200).json(result);
    }

    const { content } = await chatService.processChatMessage(messages, service_config, req.userId);
    return res.status(200).json({ content });
  } catch (error) {
    if (error.message.startsWith('Invalid messages format') || error.message.startsWith('AI service configuration ID is missing') || error.message.startsWith('No valid content')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message.startsWith('AI service setting not found') || error.message.startsWith('API key missing')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.startsWith('Image analysis is not supported') || error.message.startsWith('Unsupported service type')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message.startsWith('AI service API call error')) {
      const statusCodeMatch = error.message.match(/AI service API call error: (\d+) -/);
      const statusCode = statusCodeMatch ? parseInt(statusCodeMatch[1], 10) : 500;
      return res.status(statusCode).json({ error: error.message });
    }
    next(error);
  }
});

router.post('/clear-old-history', authenticateToken, async (req, res, next) => {
  try {
    const result = await chatService.clearOldChatHistory(req.userId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/ai-service-settings/:userId', authenticateToken, authorizeAccess('ai_service_settings'), async (req, res, next) => {
  const { userId: targetUserId } = req.params;
  if (!targetUserId) {
    return res.status(400).json({ error: 'Target User ID is required.' });
  }
  try {
    const settings = await chatService.getAiServiceSettings(req.userId, targetUserId);
    res.status(200).json(settings);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

router.get('/ai-service-settings/active/:userId', authenticateToken, authorizeAccess('ai_service_settings'), async (req, res, next) => {
  const { userId: targetUserId } = req.params;
  if (!targetUserId) {
    return res.status(400).json({ error: 'Target User ID is required.' });
  }
  try {
    const setting = await chatService.getActiveAiServiceSetting(req.userId, targetUserId);
    res.status(200).json(setting);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'No active AI service setting found for this user.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

router.delete('/ai-service-settings/:id', authenticateToken, authorizeAccess('ai_service_settings'), async (req, res, next) => {
  const { id } = req.params;
  const { userId: targetUserId } = req.body;
  if (!id || !targetUserId) {
    return res.status(400).json({ error: 'AI Service ID and Target User ID are required.' });
  }
  try {
    const result = await chatService.deleteAiServiceSetting(req.userId, id, targetUserId);
    res.status(200).json(result);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'AI service setting not found.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

router.get('/sparky-chat-history/:userId', authenticateToken, authorizeAccess('chat_history'), async (req, res, next) => {
  const { userId: targetUserId } = req.params;
  if (!targetUserId) {
    return res.status(400).json({ error: 'Target User ID is required.' });
  }
  try {
    const history = await chatService.getSparkyChatHistory(req.userId, targetUserId);
    res.status(200).json(history);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

router.get('/sparky-chat-history/entry/:id', authenticateToken, authorizeAccess('chat_history'), async (req, res, next) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'Chat History Entry ID is required.' });
  }
  try {
    const entry = await chatService.getSparkyChatHistoryEntry(req.userId, id);
    res.status(200).json(entry);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Chat history entry not found.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

router.put('/sparky-chat-history/:id', authenticateToken, authorizeAccess('chat_history'), async (req, res, next) => {
  const { id } = req.params;
  const { userId: targetUserId, ...updateData } = req.body;
  if (!id || !targetUserId) {
    return res.status(400).json({ error: 'Chat History Entry ID and Target User ID are required.' });
  }
  try {
    const updatedEntry = await chatService.updateSparkyChatHistoryEntry(req.userId, id, targetUserId, updateData);
    res.status(200).json(updatedEntry);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Chat history entry not found or not authorized to update.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

router.delete('/sparky-chat-history/:id', authenticateToken, authorizeAccess('chat_history'), async (req, res, next) => {
  const { id } = req.params;
  const { userId: targetUserId } = req.body;
  if (!id || !targetUserId) {
    return res.status(400).json({ error: 'Chat History Entry ID and Target User ID are required.' });
  }
  try {
    const result = await chatService.deleteSparkyChatHistoryEntry(req.userId, id, targetUserId);
    res.status(200).json(result);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Chat history entry not found or not authorized to delete.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

router.post('/clear-all-history', authenticateToken, authorizeAccess('chat_history'), async (req, res, next) => {
  const { userId: targetUserId } = req.body;
  if (!targetUserId) {
    return res.status(400).json({ error: 'Target User ID is required.' });
  }
  try {
    const result = await chatService.clearAllSparkyChatHistory(req.userId, targetUserId);
    res.status(200).json(result);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

router.post('/save-history', authenticateToken, authorizeAccess('chat_history'), async (req, res, next) => {
  const { userId: targetUserId, content, messageType, metadata } = req.body;
  if (!targetUserId || !content || !messageType) {
    return res.status(400).json({ error: 'Target User ID, content, and message type are required.' });
  }
  try {
    const result = await chatService.saveSparkyChatHistory(req.userId, { user_id: targetUserId, content, messageType, metadata });
    res.status(201).json(result);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

module.exports = router;