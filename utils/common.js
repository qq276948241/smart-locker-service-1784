const crypto = require('crypto');
const { LOCKER_CONFIG } = require('../config');

function generatePickupCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase() + Math.floor(Math.random() * 9000 + 1000);
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + '_locker_salt').digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function generateId(prefix) {
  return prefix + Date.now() + Math.floor(Math.random() * 1000);
}

function determineLockerSize(height, width, depth) {
  const sizes = ['large', 'medium', 'small'];
  for (const size of sizes) {
    const cfg = LOCKER_CONFIG[size];
    if (height <= cfg.heightLimit && width <= cfg.widthLimit && depth <= cfg.depthLimit) {
      return size;
    }
  }
  return null;
}

function isValidPhone(phone) {
  return /^1\d{10}$/.test(phone);
}

module.exports = {
  generatePickupCode,
  hashPassword,
  generateToken,
  generateId,
  determineLockerSize,
  isValidPhone,
};
