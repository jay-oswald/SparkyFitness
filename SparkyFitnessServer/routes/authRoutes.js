const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeAccess } = require('../middleware/authMiddleware');
const { registerValidation, loginValidation } = require('../validation/authValidation');
const { validationResult } = require('express-validator');
const authService = require('../services/authService');

router.use(express.json());

router.post('/login', loginValidation, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const { userId, token } = await authService.loginUser(email, password);
    res.status(200).json({ message: 'Login successful', userId, token });
  } catch (error) {
    if (error.message === 'Invalid credentials.') {
      return res.status(401).json({ error: error.message });
    }
    next(error);
  }
});

router.post('/logout', (req, res) => {
  // In a real application, this would involve invalidating a JWT or session.
  // For now, it's a placeholder for client-side token removal.
  res.status(200).json({ message: 'Logout successful.' });
});

// Authentication Endpoints
router.post('/register', registerValidation, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password, full_name } = req.body;

  try {
    const { userId, token } = await authService.registerUser(email, password, full_name);
    res.status(201).json({ message: 'User registered successfully', userId, token });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'User with this email already exists.' });
    }
    next(error);
  }
});

router.get('/user', async (req, res, next) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  try {
    const user = await authService.getUser(userId);
    res.status(200).json(user);
  } catch (error) {
    if (error.message === 'User not found.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

router.get('/users/find-by-email', async (req, res, next) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: 'Email parameter is required.' });
  }

  try {
    const userId = await authService.findUserIdByEmail(email);
    res.status(200).json({ userId });
  } catch (error) {
    if (error.message === 'User not found.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

router.post('/user/generate-api-key', authenticateToken, authorizeAccess('api_keys'), async (req, res, next) => {
  const authenticatedUserId = req.userId;
  const { userId: targetUserId, description } = req.body;

  if (!targetUserId) {
    return res.status(400).json({ error: 'Target User ID is required.' });
  }

  try {
    const apiKey = await authService.generateUserApiKey(authenticatedUserId, targetUserId, description);
    res.status(201).json({ message: 'API key generated successfully', apiKey });
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

router.post('/user/revoke-api-key', authenticateToken, authorizeAccess('api_keys'), async (req, res, next) => {
  const authenticatedUserId = req.userId;
  const { userId: targetUserId, apiKeyId } = req.body;

  if (!targetUserId || !apiKeyId) {
    return res.status(400).json({ error: 'Target User ID and API Key ID are required.' });
  }

  try {
    await authService.revokeUserApiKey(authenticatedUserId, targetUserId, apiKeyId);
    res.status(200).json({ message: 'API key revoked successfully.' });
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'API Key not found or already inactive for this user.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

router.post('/user/revoke-all-api-keys', authenticateToken, authorizeAccess('api_keys'), async (req, res, next) => {
  const authenticatedUserId = req.userId;
  const { userId: targetUserId } = req.body;

  if (!targetUserId) {
    return res.status(400).json({ error: 'Target User ID is required.' });
  }

  try {
    await authService.revokeAllUserApiKeys(authenticatedUserId, targetUserId);
    res.status(200).json({ message: 'All API keys revoked successfully for the user.' });
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

router.get('/users/accessible-users', async (req, res, next) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  try {
    const accessibleUsers = await authService.getAccessibleUsers(userId);
    res.status(200).json(accessibleUsers);
  } catch (error) {
    next(error);
  }
});

router.get('/profiles/:targetUserId', authenticateToken, authorizeAccess('profile'), async (req, res, next) => {
  const authenticatedUserId = req.userId;
  const { targetUserId } = req.params;

  if (!targetUserId) {
    return res.status(400).json({ error: 'Target User ID is required.' });
  }

  try {
    const profile = await authService.getUserProfile(authenticatedUserId, targetUserId);
    if (!profile) {
      return res.status(200).json({});
    }
    res.status(200).json(profile);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

router.put('/profiles/:targetUserId', authenticateToken, authorizeAccess('profile'), async (req, res, next) => {
  const authenticatedUserId = req.userId;
  const { targetUserId } = req.params;
  const profileData = req.body;

  if (!targetUserId) {
    return res.status(400).json({ error: 'Target User ID is required.' });
  }

  try {
    const updatedProfile = await authService.updateUserProfile(authenticatedUserId, targetUserId, profileData);
    res.status(200).json({ message: 'Profile updated successfully.', profile: updatedProfile });
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Profile not found or no changes made.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

router.get('/user-api-keys/:targetUserId', authenticateToken, authorizeAccess('api_keys'), async (req, res, next) => {
  const authenticatedUserId = req.userId;
  const { targetUserId } = req.params;

  if (!targetUserId) {
    return res.status(400).json({ error: 'Target User ID is required.' });
  }

  try {
    const apiKeys = await authService.getUserApiKeys(authenticatedUserId, targetUserId);
    res.status(200).json(apiKeys);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

router.post('/update-password', async (req, res, next) => {
  const { userId, newPassword } = req.body;

  if (!userId || !newPassword) {
    return res.status(400).json({ error: 'User ID and new password are required.' });
  }

  try {
    await authService.updateUserPassword(userId, newPassword);
    res.status(200).json({ message: 'Password updated successfully.' });
  } catch (error) {
    if (error.message === 'User not found.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

router.post('/update-email', async (req, res, next) => {
  const { userId, newEmail } = req.body;

  if (!userId || !newEmail) {
    return res.status(400).json({ error: 'User ID and new email are required.' });
  }

  try {
    await authService.updateUserEmail(userId, newEmail);
    res.status(200).json({ message: 'Email update initiated. User will need to verify new email.' });
  } catch (error) {
    if (error.message === 'Email already in use by another account.') {
      return res.status(409).json({ error: error.message });
    }
    if (error.message === 'User not found.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

router.get('/access/can-access-user-data', async (req, res, next) => {
  const { targetUserId, permissionType, currentUserId } = req.query;

  if (!targetUserId || !permissionType || !currentUserId) {
    return res.status(400).json({ error: 'targetUserId, permissionType, and currentUserId are required.' });
  }

  try {
    const canAccess = await authService.canAccessUserData(targetUserId, permissionType, currentUserId);
    res.status(200).json({ canAccess });
  } catch (error) {
    next(error);
  }
});

router.get('/access/check-family-access', async (req, res, next) => {
  const { familyUserId, ownerUserId, permission } = req.query;

  if (!familyUserId || !ownerUserId || !permission) {
    return res.status(400).json({ error: 'familyUserId, ownerUserId, and permission are required.' });
  }

  try {
    const hasAccess = await authService.checkFamilyAccess(familyUserId, ownerUserId, permission);
    res.status(200).json({ hasAccess });
  } catch (error) {
    next(error);
  }
});

router.get('/family-access', authenticateToken, authorizeAccess('family_access'), async (req, res, next) => {
  const authenticatedUserId = req.userId;
  const { owner_user_id: targetUserId } = req.query;

  if (!targetUserId) {
    return res.status(400).json({ error: 'Target User ID is required.' });
  }

  try {
    const entries = await authService.getFamilyAccessEntries(authenticatedUserId, targetUserId);
    res.status(200).json(entries);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

router.get('/family-access/:userId', authenticateToken, authorizeAccess('family_access'), async (req, res, next) => {
  const authenticatedUserId = req.userId;
  const { userId: targetUserId } = req.params;

  if (!targetUserId) {
    return res.status(400).json({ error: 'Target User ID is required.' });
  }

  try {
    const entries = await authService.getFamilyAccessEntries(authenticatedUserId, targetUserId);
    res.status(200).json(entries);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

router.post('/family-access', authenticateToken, authorizeAccess('family_access'), async (req, res, next) => {
  const authenticatedUserId = req.userId;
  const entryData = req.body;

  if (!entryData.owner_user_id || !entryData.family_user_id || !entryData.family_email || !entryData.access_permissions) {
    return res.status(400).json({ error: 'Owner User ID, Family User ID, Family Email, and Access Permissions are required.' });
  }

  try {
    const newEntry = await authService.createFamilyAccessEntry(authenticatedUserId, entryData);
    res.status(201).json(newEntry);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

router.put('/family-access/:id', authenticateToken, authorizeAccess('family_access'), async (req, res, next) => {
  const authenticatedUserId = req.userId;
  const { id } = req.params;
  const { owner_user_id: targetOwnerUserId, ...updateData } = req.body;

  if (!id || !targetOwnerUserId) {
    return res.status(400).json({ error: 'Family Access ID and Owner User ID are required.' });
  }

  try {
    const updatedEntry = await authService.updateFamilyAccessEntry(authenticatedUserId, id, targetOwnerUserId, updateData);
    res.status(200).json(updatedEntry);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Family access entry not found or not authorized to update.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

router.delete('/family-access/:id', authenticateToken, authorizeAccess('family_access'), async (req, res, next) => {
  const authenticatedUserId = req.userId;
  const { id } = req.params;
  const { ownerUserId: targetOwnerUserId } = req.body;

  if (!id || !targetOwnerUserId) {
    return res.status(400).json({ error: 'Family Access ID and Target Owner User ID are required.' });
  }

  try {
    await authService.deleteFamilyAccessEntry(authenticatedUserId, id, targetOwnerUserId);
    res.status(200).json({ message: 'Family access entry deleted successfully.' });
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Family access entry not found or not authorized to delete.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

module.exports = router;