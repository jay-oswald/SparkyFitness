const crypto = require('crypto');
const { log } = require('../config/logging');

const ENCRYPTION_KEY = process.env.SPARKY_FITNESS_API_ENCRYPTION_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

if (!ENCRYPTION_KEY) {
  log('error', 'SPARKY_FITNESS_API_ENCRYPTION_KEY is not set in environment variables.');
  process.exit(1);
}

if (!JWT_SECRET) {
  log('error', 'JWT_SECRET is not set in environment variables. Please generate a strong secret.');
  process.exit(1);
}

// Utility functions for encryption and decryption
async function encrypt(text, key) {
  const iv = crypto.randomBytes(12); // GCM recommended IV size is 12 bytes
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'utf8'), iv);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const tag = cipher.getAuthTag().toString('base64');
  return { encryptedText: encrypted, iv: iv.toString('base64'), tag: tag };
}

async function decrypt(encryptedText, ivString, tagString, key) {
  const iv = Buffer.from(ivString, 'base64');
  const tag = Buffer.from(tagString, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'utf8'), iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports = {
  encrypt,
  decrypt,
  ENCRYPTION_KEY,
  JWT_SECRET
};