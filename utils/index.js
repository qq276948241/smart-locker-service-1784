const moment = require('moment');
const config = require('../config');

const SIZE_TYPES = Object.freeze({
  SMALL: 'small',
  MEDIUM: 'medium',
  LARGE: 'large'
});

const SIZE_NAMES = Object.freeze({
  [SIZE_TYPES.SMALL]: '小格',
  [SIZE_TYPES.MEDIUM]: '中格',
  [SIZE_TYPES.LARGE]: '大格'
});

const SIZE_ALIASES = Object.freeze({
  'small': SIZE_TYPES.SMALL,
  'medium': SIZE_TYPES.MEDIUM,
  'large': SIZE_TYPES.LARGE,
  'S': SIZE_TYPES.SMALL,
  'M': SIZE_TYPES.MEDIUM,
  'L': SIZE_TYPES.LARGE,
  's': SIZE_TYPES.SMALL,
  'm': SIZE_TYPES.MEDIUM,
  'l': SIZE_TYPES.LARGE,
  '小': SIZE_TYPES.SMALL,
  '中': SIZE_TYPES.MEDIUM,
  '大': SIZE_TYPES.LARGE,
  '小格': SIZE_TYPES.SMALL,
  '中格': SIZE_TYPES.MEDIUM,
  '大格': SIZE_TYPES.LARGE
});

const VALID_SIZES = [SIZE_TYPES.SMALL, SIZE_TYPES.MEDIUM, SIZE_TYPES.LARGE];

function isValidSize(size) {
  return VALID_SIZES.includes(size);
}

function getSizeName(size) {
  return SIZE_NAMES[size] || '未知尺寸';
}

function parseSize(input) {
  if (!input) return null;
  const normalized = SIZE_ALIASES[input];
  return normalized || null;
}

function getAllSizeOptions() {
  return VALID_SIZES.map(size => ({
    key: size,
    name: SIZE_NAMES[size],
    alias: size.charAt(0).toUpperCase()
  }));
}

function generatePickupCode(length = config.pickupCode.length) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += Math.floor(Math.random() * 10);
  }
  return code;
}

function calculateOvertimeFee(depositTime, pickupTime = new Date()) {
  const depositMoment = moment(depositTime);
  const pickupMoment = moment(pickupTime);
  const diffHours = pickupMoment.diff(depositMoment, 'hours', true);
  const freeHours = config.locker.freeHours;
  
  if (diffHours <= freeHours) {
    return {
      hours: 0,
      fee: 0,
      isOvertime: false
    };
  }
  
  const overtimeHours = Math.ceil(diffHours - freeHours);
  return {
    hours: overtimeHours,
    fee: overtimeHours * config.locker.overtimeFeePerHour,
    isOvertime: true
  };
}

function getSizeType(packageSize) {
  return parseSize(packageSize);
}

function formatResponse(success, data = null, message = '') {
  return {
    success,
    data,
    message,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  SIZE_TYPES,
  SIZE_NAMES,
  VALID_SIZES,
  isValidSize,
  getSizeName,
  parseSize,
  getAllSizeOptions,
  generatePickupCode,
  calculateOvertimeFee,
  getSizeType,
  formatResponse
};
