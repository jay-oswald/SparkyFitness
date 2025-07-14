const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { log } = require('../config/logging');
const { JWT_SECRET } = require('../security/encryption');
const userRepository = require('../models/userRepository');
const familyAccessRepository = require('../models/familyAccessRepository');

async function registerUser(email, password, full_name) {
  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const userId = uuidv4();

    await userRepository.createUser(userId, email, hashedPassword, full_name);

    const token = jwt.sign({ userId: userId }, JWT_SECRET, { expiresIn: '1h' });
    return { userId, token };
  } catch (error) {
    log('error', 'Error during user registration in authService:', error);
    throw error;
  }
}

async function loginUser(email, password) {
  try {
    const user = await userRepository.findUserByEmail(email);

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw new Error('Invalid credentials.');
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
    return { userId: user.id, token, role: user.role };
  } catch (error) {
    log('error', 'Error during user login in authService:', error);
    throw error;
  }
}

async function getUser(authenticatedUserId) {
  try {
    const user = await userRepository.findUserById(authenticatedUserId);
    if (!user) {
      throw new Error('User not found.');
    }
    return user;
  } catch (error) {
    log('error', `Error fetching user ${authenticatedUserId} in authService:`, error);
    throw error;
  }
}

async function findUserIdByEmail(email) {
  try {
    const user = await userRepository.findUserIdByEmail(email);
    if (!user) {
      throw new Error('User not found.');
    }
    return user.id;
  } catch (error) {
    log('error', `Error finding user by email ${email} in authService:`, error);
    throw error;
  }
}

async function generateUserApiKey(authenticatedUserId, targetUserId, description) {
  try {
    const newApiKey = uuidv4();
    const apiKey = await userRepository.generateApiKey(targetUserId, newApiKey, description);
    return apiKey;
  } catch (error) {
    log('error', `Error generating API key for user ${targetUserId} in authService:`, error);
    throw error;
  }
}

async function deleteUserApiKey(authenticatedUserId, targetUserId, apiKeyId) {
  try {
    const success = await userRepository.deleteApiKey(apiKeyId, targetUserId);
    if (!success) {
      throw new Error('API Key not found or not authorized for deletion.');
    }
    return true;
  } catch (error) {
    log('error', `Error deleting API key ${apiKeyId} for user ${targetUserId} in authService:`, error);
    throw error;
  }
}

async function getAccessibleUsers(authenticatedUserId) {
  try {
    const users = await userRepository.getAccessibleUsers(authenticatedUserId);
    return users;
  } catch (error) {
    log('error', `Error fetching accessible users for user ${authenticatedUserId} in authService:`, error);
    throw error;
  }
}

async function getUserProfile(authenticatedUserId, targetUserId) {
  try {
    const profile = await userRepository.getUserProfile(targetUserId);
    return profile;
  } catch (error) {
    log('error', `Error fetching profile for user ${targetUserId} in authService:`, error);
    throw error;
  }
}

async function updateUserProfile(authenticatedUserId, targetUserId, profileData) {
  try {
    const updatedProfile = await userRepository.updateUserProfile(
      targetUserId,
      profileData.full_name,
      profileData.phone_number,
      profileData.date_of_birth,
      profileData.bio,
      profileData.avatar_url
    );
    if (!updatedProfile) {
      throw new Error('Profile not found or no changes made.');
    }
    return updatedProfile;
  } catch (error) {
    log('error', `Error updating profile for user ${targetUserId} in authService:`, error);
    throw error;
  }
}

async function getUserApiKeys(authenticatedUserId, targetUserId) {
  try {
    const apiKeys = await userRepository.getUserApiKeys(targetUserId);
    return apiKeys;
  } catch (error) {
    log('error', `Error fetching API keys for user ${targetUserId} in authService:`, error);
    throw error;
  }
}

async function updateUserPassword(authenticatedUserId, newPassword) {
  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    const success = await userRepository.updateUserPassword(authenticatedUserId, hashedPassword);
    if (!success) {
      throw new Error('User not found.');
    }
    return true;
  } catch (error) {
    log('error', `Error updating password for user ${authenticatedUserId} in authService:`, error);
    throw error;
  }
}

async function updateUserEmail(authenticatedUserId, newEmail) {
  try {
    const existingUser = await userRepository.findUserByEmail(newEmail);
    if (existingUser && existingUser.id !== authenticatedUserId) {
      throw new Error('Email already in use by another account.');
    }
    const success = await userRepository.updateUserEmail(authenticatedUserId, newEmail);
    if (!success) {
      throw new Error('User not found.');
    }
    return true;
  } catch (error) {
    log('error', `Error updating email for user ${authenticatedUserId} in authService:`, error);
    throw error;
  }
}

async function canAccessUserData(targetUserId, permissionType, authenticatedUserId) {
  try {
    const pool = require('../db/connection'); // Import pool from connection.js
    const client = await pool.connect();
    const result = await client.query(
      `SELECT public.can_access_user_data($1, $2, $3) AS can_access`,
      [targetUserId, permissionType, authenticatedUserId]
    );
    client.release();
    return result.rows[0].can_access;
  } catch (error) {
    log('error', `Error checking access for user ${targetUserId} by ${authenticatedUserId} with permission ${permissionType} in authService:`, error);
    throw error;
  }
}

async function checkFamilyAccess(authenticatedUserId, ownerUserId, permission) {
  try {
    const hasAccess = await familyAccessRepository.checkFamilyAccessPermission(authenticatedUserId, ownerUserId, permission);
    return hasAccess;
  } catch (error) {
    log('error', `Error checking family access for family user ${authenticatedUserId} and owner ${ownerUserId} with permission ${permission} in authService:`, error);
    throw error;
  }
}

async function getFamilyAccessEntries(authenticatedUserId, targetUserId) {
  try {
    let entries;
    if (authenticatedUserId === targetUserId) {
      entries = await familyAccessRepository.getFamilyAccessEntriesByUserId(targetUserId);
    } else {
      entries = await familyAccessRepository.getFamilyAccessEntriesByOwner(targetUserId);
    }
    return entries;
  } catch (error) {
    log('error', `Error fetching family access entries for user ${targetUserId} in authService:`, error);
    throw error;
  }
}

async function createFamilyAccessEntry(authenticatedUserId, entryData) {
  try {
    const newEntry = await familyAccessRepository.createFamilyAccessEntry(
      authenticatedUserId, // Use authenticatedUserId as owner_user_id
      entryData.family_user_id,
      entryData.family_email,
      entryData.access_permissions,
      entryData.access_end_date,
      entryData.status
    );
    return newEntry;
  } catch (error) {
    log('error', `Error creating family access entry for owner ${authenticatedUserId} in authService:`, error);
    throw error;
  }
}

async function updateFamilyAccessEntry(authenticatedUserId, id, updateData) {
  try {
    const updatedEntry = await familyAccessRepository.updateFamilyAccessEntry(
      id,
      authenticatedUserId, // Use authenticatedUserId as owner_user_id
      updateData.access_permissions,
      updateData.access_end_date,
      updateData.is_active,
      updateData.status
    );
    if (!updatedEntry) {
      throw new Error('Family access entry not found or not authorized to update.');
    }
    return updatedEntry;
  } catch (error) {
    log('error', `Error updating family access entry ${id} for owner ${authenticatedUserId} in authService:`, error);
    throw error;
  }
}

async function deleteFamilyAccessEntry(authenticatedUserId, id) {
  try {
    const success = await familyAccessRepository.deleteFamilyAccessEntry(id, authenticatedUserId); // Use authenticatedUserId as owner_user_id
    if (!success) {
      throw new Error('Family access entry not found or not authorized to delete.');
    }
    return true;
  } catch (error) {
    log('error', `Error deleting family access entry ${id} for owner ${authenticatedUserId} in authService:`, error);
    throw error;
  }
}

module.exports = {
  registerUser,
  registerOidcUser,
  loginUser,
  getUser,
  findUserIdByEmail,
  generateUserApiKey,
  deleteUserApiKey,
  getAccessibleUsers,
  getUserProfile,
  updateUserProfile,
  getUserApiKeys,
  updateUserPassword,
  updateUserEmail,
  canAccessUserData,
  checkFamilyAccess,
  getFamilyAccessEntries,
  createFamilyAccessEntry,
  updateFamilyAccessEntry,
  deleteFamilyAccessEntry,
};

async function registerOidcUser(email, fullName, oidcSub) {
  try {
    const userId = uuidv4();
    await userRepository.createOidcUser(userId, email, fullName, oidcSub);
    return userId;
  } catch (error) {
    log('error', 'Error during OIDC user registration in authService:', error);
    throw error;
  }
}