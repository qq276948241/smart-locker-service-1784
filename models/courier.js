const { hashPassword, generateToken } = require('../utils/common');
const { TOKEN_EXPIRE_MS } = require('../config');

const couriers = {};
const activeTokens = {};

function registerCourier({ name, phone, password }) {
  if (couriers[phone]) return null;

  couriers[phone] = {
    name,
    phone,
    passwordHash: hashPassword(password),
    registeredAt: new Date().toISOString(),
  };
  return couriers[phone];
}

function loginCourier({ phone, password }) {
  const courier = couriers[phone];
  if (!courier || courier.passwordHash !== hashPassword(password)) return null;

  const token = generateToken();
  activeTokens[token] = {
    phone,
    createdAt: Date.now(),
  };

  return { token, courier };
}

function logoutCourier(token) {
  if (activeTokens[token]) {
    delete activeTokens[token];
    return true;
  }
  return false;
}

function validateToken(token) {
  const tokenInfo = activeTokens[token];
  if (!tokenInfo) return null;

  if (Date.now() - tokenInfo.createdAt > TOKEN_EXPIRE_MS) {
    delete activeTokens[token];
    return null;
  }

  const courier = couriers[tokenInfo.phone];
  if (!courier) return null;

  return { courier, token };
}

function getCourierByPhone(phone) {
  return couriers[phone];
}

module.exports = {
  registerCourier,
  loginCourier,
  logoutCourier,
  validateToken,
  getCourierByPhone,
};
