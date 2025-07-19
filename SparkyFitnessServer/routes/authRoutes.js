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
    const { userId, token, role } = await authService.loginUser(email, password);
    res.status(200).json({ message: 'Login successful', userId, token, role });
  } catch (error) {
    if (error.message === 'Invalid credentials.' || error.message === 'Email/Password login is disabled.') {
      return res.status(401).json({ error: error.message });
    }
    next(error);
  }
});

router.get('/settings', async (req, res, next) => {
  try {
    const settings = await authService.getLoginSettings();
    res.status(200).json(settings);
  } catch (error) {
    next(error);
  }
});

router.post('/logout', (req, res, next) => {
  // Destroy the session for OIDC users
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        return next(err);
      }
      // Clear the session cookie from the client
      res.clearCookie('sparky.sid'); // Ensure this matches the session name in SparkyFitnessServer.js
      res.status(200).json({ message: 'Logout successful.' });
    });
  } else {
    // For JWT users, simply acknowledge logout (client-side token removal is sufficient)
    res.status(200).json({ message: 'Logout successful.' });
  }
});

// Authentication Endpoints
router.post('/register', registerValidation, async (req, res, next) => {
  if (process.env.SPARKY_FITNESS_DISABLE_SIGNUP === 'true') {
    return res.status(403).json({ error: 'New user registration is currently disabled.' });
  }
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

router.get('/user', authenticateToken, async (req, res, next) => {
  try {
    const user = await authService.getUser(req.userId);
    // Ensure the role is included in the response
    res.status(200).json({
      userId: user.id,
      email: user.email,
      role: user.role,
      created_at: user.created_at // Include created_at for consistency
    });
  } catch (error) {
    if (error.message === 'User not found.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

router.get('/users/find-by-email', authenticateToken, authorizeAccess('admin'), async (req, res, next) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: 'Email parameter is required.' });
  }

  try {
    const userId = await authService.findUserIdByEmail(email);
    res.status(200).json({ userId });
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'User not found.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

router.post('/user/generate-api-key', authenticateToken, authorizeAccess('api_keys'), async (req, res, next) => {
  const { description } = req.body;
 
  try {
    const apiKey = await authService.generateUserApiKey(req.userId, req.userId, description); // targetUserId is authenticatedUserId
    res.status(201).json({ message: 'API key generated successfully', apiKey });
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

router.delete('/user/api-key/:apiKeyId', authenticateToken, authorizeAccess('api_keys'), async (req, res, next) => {
  const { apiKeyId } = req.params;
 
  try {
    await authService.deleteUserApiKey(req.userId, req.userId, apiKeyId); // targetUserId is authenticatedUserId
    res.status(200).json({ message: 'API key deleted successfully.' });
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'API Key not found or not authorized for deletion.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

router.get('/users/accessible-users', authenticateToken, async (req, res, next) => {
  try {
    const accessibleUsers = await authService.getAccessibleUsers(req.userId);
    res.status(200).json(accessibleUsers);
  } catch (error) {
    next(error);
  }
});

router.get('/profiles', authenticateToken, authorizeAccess('profile', (req) => req.userId), async (req, res, next) => {
  try {
    const profile = await authService.getUserProfile(req.userId, req.userId); // authenticatedUserId is targetUserId
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

router.put('/profiles', authenticateToken, authorizeAccess('profile', (req) => req.userId), async (req, res, next) => {
  const profileData = req.body;
 
  try {
    const updatedProfile = await authService.updateUserProfile(req.userId, req.userId, profileData); // authenticatedUserId is targetUserId
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

router.get('/user-api-keys', authenticateToken, authorizeAccess('api_keys'), async (req, res, next) => {
  try {
    const apiKeys = await authService.getUserApiKeys(req.userId, req.userId); // authenticatedUserId is targetUserId
    res.status(200).json(apiKeys);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

router.post('/update-password', authenticateToken, async (req, res, next) => {
  const { newPassword } = req.body;
 
  if (!newPassword) {
    return res.status(400).json({ error: 'New password is required.' });
  }
 
  try {
    await authService.updateUserPassword(req.userId, newPassword);
    res.status(200).json({ message: 'Password updated successfully.' });
  } catch (error) {
    if (error.message === 'User not found.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

router.post('/update-email', authenticateToken, async (req, res, next) => {
  const { newEmail } = req.body;
 
  if (!newEmail) {
    return res.status(400).json({ error: 'New email is required.' });
  }
 
  try {
    await authService.updateUserEmail(req.userId, newEmail);
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

router.get('/access/can-access-user-data', authenticateToken, async (req, res, next) => {
  const { targetUserId, permissionType } = req.query;
 
  if (!targetUserId || !permissionType) {
    return res.status(400).json({ error: 'targetUserId and permissionType are required.' });
  }
 
  try {
    const canAccess = await authService.canAccessUserData(targetUserId, permissionType, req.userId);
    res.status(200).json({ canAccess });
  } catch (error) {
    next(error);
  }
});

router.get('/access/check-family-access', authenticateToken, async (req, res, next) => {
  const { ownerUserId, permission } = req.query;
 
  if (!ownerUserId || !permission) {
    return res.status(400).json({ error: 'ownerUserId and permission are required.' });
  }
 
  try {
    const hasAccess = await authService.checkFamilyAccess(req.userId, ownerUserId, permission);
    res.status(200).json({ hasAccess });
  } catch (error) {
    next(error);
  }
});

router.get('/family-access', authenticateToken, authorizeAccess('family_access', (req) => req.query.owner_user_id), async (req, res, next) => {
  const { owner_user_id: targetUserId } = req.query;
 
  if (!targetUserId) {
    return res.status(400).json({ error: 'Target User ID is required.' });
  }
 
  try {
    const entries = await authService.getFamilyAccessEntries(req.userId, targetUserId);
    res.status(200).json(entries);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

router.get('/family-access/:targetUserId', authenticateToken, authorizeAccess('family_access', (req) => req.params.targetUserId), async (req, res, next) => {
  const { targetUserId } = req.params;
 
  if (!targetUserId) {
    return res.status(400).json({ error: 'Target User ID is required.' });
  }
 
  try {
    const entries = await authService.getFamilyAccessEntries(req.userId, targetUserId);
    res.status(200).json(entries);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

router.post('/family-access', authenticateToken, authorizeAccess('family_access', (req) => req.body.owner_user_id), async (req, res, next) => {
  const entryData = req.body;
 
  if (!entryData.family_user_id || !entryData.family_email || !entryData.access_permissions) {
    return res.status(400).json({ error: 'Family User ID, Family Email, and Access Permissions are required.' });
  }
 
  try {
    const newEntry = await authService.createFamilyAccessEntry(req.userId, entryData);
    res.status(201).json(newEntry);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

router.put('/family-access/:id', authenticateToken, authorizeAccess('family_access', (req) => req.body.owner_user_id), async (req, res, next) => {
  const { id } = req.params;
  const updateData = req.body;
 
  if (!id) {
    return res.status(400).json({ error: 'Family Access ID is required.' });
  }
 
  try {
    const updatedEntry = await authService.updateFamilyAccessEntry(req.userId, id, updateData);
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

router.delete('/family-access/:id', authenticateToken, authorizeAccess('family_access', (req) => req.body.owner_user_id), async (req, res, next) => {
  const { id } = req.params;
 
  if (!id) {
    return res.status(400).json({ error: 'Family Access ID is required.' });
  }
 
  try {
    await authService.deleteFamilyAccessEntry(req.userId, id);
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